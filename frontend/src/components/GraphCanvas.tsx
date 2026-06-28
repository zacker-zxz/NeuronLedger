import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Billboard } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { GraphData, NodeResult, GraphNode } from '../types';

// ─── Color palette ────────────────────────────────────────────────────────────
const CLUSTER_PALETTE = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#6366f1', '#14b8a6', '#f97316',
];

function nodeColor(node: GraphNode, res?: NodeResult): string {
  if (res?.is_anomaly) return '#ef4444';
  if (String(node.node_type) === 'mixer') return '#f59e0b';
  if (String(node.node_type) === 'exchange') return '#8b5cf6';
  if (res && res.cluster_id >= 0) return CLUSTER_PALETTE[res.cluster_id % CLUSTER_PALETTE.length];
  return '#3b82f6';
}

function nodeRadius(node: GraphNode, res?: NodeResult): number {
  const deg = typeof node.degree === 'number' ? node.degree : 1;
  const base = 0.14 + Math.min(deg * 0.035, 0.22);
  return res?.is_anomaly ? base * 1.4 : base;
}

// ─── Golden sphere layout ─────────────────────────────────────────────────────
function goldenLayout(nodes: GraphNode[]): Map<string, THREE.Vector3> {
  const map = new Map<string, THREE.Vector3>();
  const n = nodes.length;
  if (n === 0) return map;

  const PHI = Math.PI * (3 - Math.sqrt(5));
  const R = Math.max(3.5, n * 0.28);

  nodes.forEach((nd, i) => {
    const y = 1 - (i / Math.max(n - 1, 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = PHI * i;
    map.set(nd.id, new THREE.Vector3(
      r * Math.cos(theta) * R,
      y * R * 0.55,
      r * Math.sin(theta) * R,
    ));
  });
  return map;
}

// ─── Grid floor ───────────────────────────────────────────────────────────────
function GridFloor() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value += dt;
    }
  });

  const shader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#3b82f6') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec2 grid = abs(fract(vUv * 30.0 - 0.5) - 0.5) / fwidth(vUv * 30.0);
        float line = min(grid.x, grid.y);
        float alpha = 1.0 - min(line, 1.0);
        
        float dist = length(vUv - 0.5);
        float fade = smoothstep(0.5, 0.1, dist);
        
        gl_FragColor = vec4(uColor, alpha * fade * 0.15);
      }
    `,
    transparent: true,
    depthWrite: false,
  }), []);

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]}>
      <planeGeometry args={[40, 40]} />
      <shaderMaterial args={[shader]} />
    </mesh>
  );
}

// ─── Ambient particles ────────────────────────────────────────────────────────
function AmbientParticles({ count = 200 }: { count?: number }) {
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 28;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 28;
    }
    return pos;
  }, [count]);

  const speeds = useMemo(() => Array.from({ length: count }, () => ({
    dx: (Math.random() - 0.5) * 0.003,
    dy: (Math.random() - 0.5) * 0.002,
    dz: (Math.random() - 0.5) * 0.003,
  })), [count]);

  const geomRef = useRef<THREE.BufferGeometry>(null);
  const posRef = useRef(positions.slice());

  useFrame(() => {
    const p = posRef.current;
    for (let i = 0; i < count; i++) {
      p[i * 3 + 0] += speeds[i].dx;
      p[i * 3 + 1] += speeds[i].dy;
      p[i * 3 + 2] += speeds[i].dz;
      // Wrap
      if (Math.abs(p[i * 3]) > 14) speeds[i].dx *= -1;
      if (Math.abs(p[i * 3 + 1]) > 8) speeds[i].dy *= -1;
      if (Math.abs(p[i * 3 + 2]) > 14) speeds[i].dz *= -1;
    }
    if (geomRef.current) {
      (geomRef.current.attributes.position as THREE.BufferAttribute).set(p);
      (geomRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial color="#3b82f6" size={0.015} transparent opacity={0.3} sizeAttenuation />
    </points>
  );
}

// ─── Edge with signal pulse ───────────────────────────────────────────────────
function Edge({
  start,
  end,
  color,
  isSuspicious,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  isSuspicious: boolean;
}) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(Math.random());

  const points = useMemo(() => [start, end], [start, end]);
  const dir = useMemo(() => end.clone().sub(start), [start, end]);
  const len = dir.length();
  const mid = useMemo(() => start.clone().add(end).multiplyScalar(0.5), [start, end]);

  useFrame((_, dt) => {
    if (!pulseRef.current) return;
    tRef.current += dt * (isSuspicious ? 0.7 : 0.4);
    if (tRef.current > 1) tRef.current = 0;

    const t = tRef.current;
    pulseRef.current.position.lerpVectors(start, end, t);
    pulseRef.current.visible = true;
  });

  const opacity = isSuspicious ? 0.5 : 0.15;
  const lineColor = isSuspicious ? '#f59e0b' : color;

  return (
    <group>
      {/* Tube edge */}
      <mesh position={mid}>
        <cylinderGeometry args={[
          isSuspicious ? 0.012 : 0.006,
          isSuspicious ? 0.012 : 0.006,
          len, 4, 1
        ]} />
        <meshBasicMaterial color={lineColor} transparent opacity={opacity} />
        {/* Rotate cylinder to align with edge */}
        <primitive object={(() => {
          const mesh = new THREE.Mesh();
          const axis = new THREE.Vector3(0, 1, 0);
          const edgeDir = dir.clone().normalize();
          mesh.quaternion.setFromUnitVectors(axis, edgeDir);
          return mesh;
        })()} />
      </mesh>

      {/* Signal pulse dot */}
      <mesh ref={pulseRef}>
        <sphereGeometry args={[isSuspicious ? 0.06 : 0.04, 8, 8]} />
        <meshStandardMaterial
          color={lineColor}
          emissive={lineColor}
          emissiveIntensity={3}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

// ─── Proper tube edge using THREE.js manually ─────────────────────────────────
function TubeEdge({
  start,
  end,
  color,
  isSuspicious,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  isSuspicious: boolean;
}) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(Math.random());

  useFrame((_, dt) => {
    if (!pulseRef.current) return;
    tRef.current = (tRef.current + dt * (isSuspicious ? 0.65 : 0.35)) % 1;
    pulseRef.current.position.lerpVectors(start, end, tRef.current);
  });

  const geometry = useMemo(() => {
    const path = new THREE.LineCurve3(start, end);
    return new THREE.TubeGeometry(path, 1, isSuspicious ? 0.013 : 0.006, 6, false);
  }, [start, end, isSuspicious]);

  const lineColor = isSuspicious ? '#f59e0b' : color;
  const opacity = isSuspicious ? 0.55 : 0.18;

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={lineColor}
          transparent
          opacity={opacity}
          roughness={0.8}
        />
      </mesh>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[isSuspicious ? 0.05 : 0.035, 8, 8]} />
        <meshStandardMaterial
          color={lineColor}
          transparent
          opacity={1.0}
        />
      </mesh>
    </group>
  );
}

// ─── 3D Node sphere ───────────────────────────────────────────────────────────
function NodeSphere({
  pos,
  color,
  radius,
  label,
  isAnomaly,
  isSelected,
  onClick,
}: {
  pos: THREE.Vector3;
  color: string;
  radius: number;
  label: string;
  isAnomaly: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  useFrame((state, dt) => {
    phaseRef.current += dt;
    const t = phaseRef.current;

    if (meshRef.current) {
      // Gentle vertical bob
      meshRef.current.position.y = pos.y + Math.sin(t * 0.7) * 0.06;

      // Rotation for interest
      meshRef.current.rotation.y += dt * 0.3;
      meshRef.current.rotation.x = Math.sin(t * 0.4) * 0.1;

      // Selected scale pulse
      const targetScale = isSelected ? 1.25 + Math.sin(t * 3) * 0.05 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }

    if (glowRef.current) {
      const scale = isAnomaly
        ? 1.0 + Math.sin(t * 2.5) * 0.2
        : 1.0 + Math.sin(t * 1.2) * 0.06;
      glowRef.current.scale.setScalar(scale);
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = isAnomaly ? 0.1 + Math.sin(t * 2.5) * 0.05 : 0.04;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z += dt * 0.8;
      ringRef.current.position.y = pos.y + Math.sin(t * 0.7) * 0.06;
    }
  });

  return (
    <group>
      {/* Outer halo */}
      <mesh ref={glowRef} position={pos}>
        <sphereGeometry args={[radius * 2.0, 16, 16]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>

      {/* Anomaly ring */}
      {isAnomaly && (
        <mesh ref={ringRef} position={pos} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 1.8, 0.01, 8, 32]} />
          <meshStandardMaterial
            color="#ef4444"
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {/* Selected ring */}
      {isSelected && (
        <mesh position={pos} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 2.1, 0.02, 8, 32]} />
          <meshStandardMaterial
            color="#3b82f6"
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {/* Main sphere */}
      <mesh
        ref={meshRef}
        position={pos}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        castShadow
      >
        <icosahedronGeometry args={[radius, 1]} />
        <meshStandardMaterial
          color={color}
          roughness={0.6}
          metalness={0.2}
          wireframe={!isSelected && !isAnomaly}
        />
      </mesh>

      {/* Label */}
      <Billboard position={[pos.x, pos.y + radius + 0.18, pos.z]}>
        <Text
          fontSize={0.075}
          color={isAnomaly ? '#ef4444' : isSelected ? '#3b82f6' : '#94a3b8'}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.005}
          outlineColor="#090a0c"
        >
          {String(label).length > 9 ? String(label).slice(0, 9) + '…' : String(label)}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({
  graphData,
  nodeResults,
  selectedNode,
  onNodeClick,
}: {
  graphData: GraphData;
  nodeResults: Record<string, NodeResult>;
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
}) {
  const layout = useMemo(() => goldenLayout(graphData.nodes), [graphData.nodes]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    graphData.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [graphData.nodes]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[8, 8, 8]} intensity={1.0} color="#ffffff" />
      <pointLight position={[-8, -5, -8]} intensity={0.5} color="#94a3b8" />
      <pointLight position={[0, 12, 0]} intensity={0.6} color="#ffffff" />
      <pointLight position={[0, -8, 0]} intensity={0.3} color="#3b82f6" />
      <hemisphereLight args={['#0f1115', '#090a0c', 0.6]} />

      <GridFloor />
      <AmbientParticles count={180} />

      {/* Edges */}
      {graphData.edges.map((edge, i) => {
        const s = layout.get(String(edge.source));
        const t = layout.get(String(edge.target));
        if (!s || !t || s.distanceTo(t) < 0.001) return null;
        const srcNode = nodeMap.get(String(edge.source));
        const isSuspicious = String(edge.label || '').match(/suspicious|layering|spam/i) !== null;
        const col = srcNode ? nodeColor(srcNode, nodeResults[String(edge.source)]) : '#3b82f6';
        return (
          <TubeEdge
            key={i}
            start={s}
            end={t}
            color={col}
            isSuspicious={isSuspicious}
          />
        );
      })}

      {/* Nodes */}
      {graphData.nodes.map((node) => {
        const p = layout.get(node.id);
        if (!p) return null;
        const res = nodeResults[node.id];
        return (
          <NodeSphere
            key={node.id}
            pos={p}
            color={nodeColor(node, res)}
            radius={nodeRadius(node, res)}
            label={String(node.label || node.id)}
            isAnomaly={res?.is_anomaly ?? false}
            isSelected={selectedNode === node.id}
            onClick={() => onNodeClick(node.id)}
          />
        );
      })}

      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.45}
        zoomSpeed={1.5}
        minDistance={2}
        maxDistance={250}
        autoRotate
        autoRotateSpeed={0.4}
      />
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface GraphCanvasProps {
  graphData: GraphData | null;
  nodeResults?: Record<string, NodeResult>;
  onNodeClick?: (nodeId: string) => void;
  selectedNode?: string | null;
}

export function GraphCanvas({ graphData, nodeResults = {}, onNodeClick, selectedNode = null }: GraphCanvasProps) {
  const handleClick = useCallback((id: string) => onNodeClick?.(id), [onNodeClick]);

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="graph-canvas-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty">
          <div className="empty-glyph">🧠</div>
          <div className="empty-title">No Graph Loaded</div>
          <div className="empty-body">Select a dataset from the sidebar to visualize the neural graph in 3D</div>
        </div>
      </div>
    );
  }

  const anomalyCount = Object.values(nodeResults).filter((r) => r.is_anomaly).length;
  const clusterIds = [...new Set(Object.values(nodeResults).map((r) => r.cluster_id).filter((c) => c >= 0))];

  return (
    <div className="graph-canvas-root">
      <Canvas
        camera={{ position: [0, 3, 11], fov: 52 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#090a0c', 1);
        }}
      >
        <Scene
          graphData={graphData}
          nodeResults={nodeResults}
          selectedNode={selectedNode}
          onNodeClick={handleClick}
        />
      </Canvas>

      {/* Stats HUD */}
      <div className="graph-top-right">
        <div className="hud-card">
          <div className="hud-title">Graph State</div>
          <div className="hud-row">
            <span className="hud-key">nodes</span>
            <span className="hud-val" style={{ color: 'var(--cyan)' }}>{graphData.node_count}</span>
          </div>
          <div className="hud-row">
            <span className="hud-key">edges</span>
            <span className="hud-val">{graphData.edge_count}</span>
          </div>
          {anomalyCount > 0 && (
            <div className="hud-row">
              <span className="hud-key">anomalies</span>
              <span className="hud-val" style={{ color: 'var(--rose)' }}>{anomalyCount}</span>
            </div>
          )}
          {clusterIds.length > 0 && (
            <div className="hud-row">
              <span className="hud-key">clusters</span>
              <span className="hud-val" style={{ color: 'var(--violet-bright)' }}>{clusterIds.length}</span>
            </div>
          )}
          {graphData.density !== undefined && (
            <div className="hud-row">
              <span className="hud-key">density</span>
              <span className="hud-val">{(graphData.density * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="graph-bottom-left">
        <div className="legend-card">
          <div className="hud-title" style={{ marginBottom: 2 }}>Node Types</div>
          <div className="legend-row"><div className="legend-dot" style={{ background: '#3b82f6' }} />Normal</div>
          <div className="legend-row"><div className="legend-dot" style={{ background: '#ef4444' }} />Anomaly</div>
          <div className="legend-row"><div className="legend-dot" style={{ background: '#f59e0b' }} />Mixer</div>
          <div className="legend-row"><div className="legend-dot" style={{ background: '#8b5cf6' }} />Exchange</div>
          {clusterIds.slice(0, 3).map((cid, i) => (
            <div key={cid} className="legend-row">
              <div className="legend-dot" style={{ background: CLUSTER_PALETTE[i] }} />
              Cluster {cid}
            </div>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div className="graph-bottom-right">
        <div className="hint-label">Drag · Scroll · Click node</div>
      </div>
    </div>
  );
}
