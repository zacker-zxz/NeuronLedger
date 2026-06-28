import { useState } from 'react';
import type { InferenceResult } from '../types';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';

interface ScorePanelProps {
  result: InferenceResult | null;
  isLoading: boolean;
  onRunInference: () => void;
  graphId: string | null;
}

const CLUSTER_COLORS = ['#00d4ff', '#a855f7', '#10b981', '#f59e0b', '#f43f5e', '#6366f1'];

const CustomRadarTick = ({ x, y, payload }: any) => (
  <text x={x} y={y} fill="#4a5568" fontSize={9} textAnchor="middle" fontFamily="JetBrains Mono, monospace">
    {payload.value}
  </text>
);

const CustomBarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
      <div style={{ color: 'var(--text-muted)' }}>{payload[0]?.payload?.name}</div>
      <div style={{ color: 'var(--cyan)', fontWeight: 700 }}>{payload[0]?.value} nodes</div>
    </div>
  );
};

export function ScorePanel({ result, isLoading, onRunInference, graphId }: ScorePanelProps) {
  const [tab, setTab] = useState<'overview' | 'nodes' | 'clusters'>('overview');

  const anomalyNodes = result
    ? Object.entries(result.node_results)
        .filter(([, r]) => r.is_anomaly)
        .sort(([, a], [, b]) => b.anomaly_score - a.anomaly_score)
    : [];

  const clusterMap = result
    ? Object.values(result.node_results).reduce<Record<number, number>>((acc, r) => {
        if (r.cluster_id >= 0) acc[r.cluster_id] = (acc[r.cluster_id] || 0) + 1;
        return acc;
      }, {})
    : {};

  const radarData = result ? [
    { subject: 'Confidence', A: Math.round(result.confidence * 100) },
    { subject: 'Trust', A: Math.round(result.average_trust * 100) },
    { subject: 'Density', A: Math.round((result.graph_summary.density || 0) * 1000) },
    { subject: 'Clusters', A: Math.min(Math.round((result.cluster_count / 8) * 100), 100) },
    { subject: 'Integrity', A: Math.round((1 - result.anomaly_count / Math.max(result.graph_summary.node_count, 1)) * 100) },
  ] : [];

  const barData = Object.entries(clusterMap).map(([id, count]) => ({ name: `C${id}`, count }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-surface)' }}>
      {/* Header */}
      <div className="panel-hd">
        <div className="panel-hd-title">
          <span className="panel-hd-icon">⚡</span>
          Inference Engine
        </div>
        <button
          id="run-inference-btn"
          className="btn btn-primary btn-sm"
          onClick={onRunInference}
          disabled={!graphId || isLoading}
        >
          {isLoading
            ? <><div className="spinner spinner-sm" />Running…</>
            : <>▶ Analyze</>}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ padding: '10px 12px 0' }}>
        <div className="tabs">
          {(['overview', 'nodes', 'clusters'] as const).map((t) => (
            <button
              key={t}
              className={`tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="panel-body scroll-y" style={{ flex: 1 }}>

        {/* Empty */}
        {!result && !isLoading && (
          <div className="empty" style={{ height: '100%' }}>
            <div className="empty-glyph">🔬</div>
            <div className="empty-title">Ready to Analyze</div>
            <div className="empty-body">Select a graph dataset and click Analyze to run the neural inference engine</div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="empty" style={{ height: '100%' }}>
            <div className="spinner" />
            <div className="empty-title" style={{ color: 'var(--cyan)' }}>Running Analysis…</div>
            <div className="empty-body">Isolation Forest · Louvain Clustering · PageRank Trust · Explanation Paths</div>
          </div>
        )}

        {/* Overview */}
        {result && !isLoading && tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="metrics-grid">
              <div className="metric-card rose">
                <div className="metric-lbl">Anomalies</div>
                <div className={`metric-val ${result.anomaly_count > 0 ? 'rose' : 'emerald'}`}>
                  {result.anomaly_count}
                </div>
                <div className="metric-sub">of {result.graph_summary.node_count} nodes</div>
              </div>
              <div className="metric-card violet">
                <div className="metric-lbl">Clusters</div>
                <div className="metric-val violet">{result.cluster_count}</div>
                <div className="metric-sub">communities</div>
              </div>
              <div className="metric-card emerald">
                <div className="metric-lbl">Avg Trust</div>
                <div className="metric-val emerald">{(result.average_trust * 100).toFixed(0)}%</div>
                <div className="metric-sub">network mean</div>
              </div>
              <div className="metric-card cyan">
                <div className="metric-lbl">Confidence</div>
                <div className="metric-val cyan">{(result.confidence * 100).toFixed(0)}%</div>
                <div className="metric-sub">model certainty</div>
              </div>
            </div>

            {/* Radar */}
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                Signal Profile
              </div>
              <ResponsiveContainer width="99%" height={148} minWidth={1}>
                <RadarChart data={radarData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <PolarGrid stroke="rgba(255,255,255,0.04)" />
                  <PolarAngleAxis dataKey="subject" tick={<CustomRadarTick />} />
                  <Radar dataKey="A" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.1} strokeWidth={1.5} dot={{ r: 3, fill: '#00d4ff' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Model info */}
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                Model Info
              </div>
              <div className="info-row">
                <span className="info-key">version</span>
                <span className="info-val">{result.model_version}</span>
              </div>
              <div className="info-row">
                <span className="info-key">algorithm</span>
                <span className="info-val" style={{ color: 'var(--cyan)' }}>IsolationForest</span>
              </div>
              <div className="info-row">
                <span className="info-key">community</span>
                <span className="info-val" style={{ color: 'var(--violet-bright)' }}>Louvain</span>
              </div>
              <div className="info-row">
                <span className="info-key">trust</span>
                <span className="info-val" style={{ color: 'var(--emerald)' }}>PageRank</span>
              </div>
              <div className="info-row">
                <span className="info-key">graph_density</span>
                <span className="info-val">{result.graph_summary.density.toFixed(4)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Nodes */}
        {result && !isLoading && tab === 'nodes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {anomalyNodes.length === 0 ? (
              <div className="empty">
                <div style={{ fontSize: 28 }}>✅</div>
                <div className="empty-title" style={{ color: 'var(--emerald)' }}>All Clear</div>
                <div className="empty-body">No anomalies detected across all nodes</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, fontFamily: 'var(--font-mono)' }}>
                  {anomalyNodes.length} flagged node{anomalyNodes.length !== 1 ? 's' : ''}
                </div>
                {anomalyNodes.map(([nid, r]) => (
                  <div key={nid} style={{
                    padding: '10px 12px',
                    background: 'rgba(244,63,94,0.06)',
                    border: '1px solid rgba(244,63,94,0.15)',
                    borderRadius: 'var(--r-md)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--rose)', fontWeight: 700 }}>
                        ⚠ {nid}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {(r.anomaly_score * 100).toFixed(0)}% risk
                      </span>
                    </div>
                    <div className="score-bar-track">
                      <div className="score-bar-fill rose" style={{ width: `${r.anomaly_score * 100}%` }} />
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="divider" />
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
              All Nodes
            </div>
            {Object.entries(result.node_results).slice(0, 24).map(([nid, r]) => (
              <div key={nid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-faint)' }}>
                <div className={`node-dot ${r.is_anomaly ? 'a' : 'n'}`}>
                  {r.is_anomaly ? '!' : r.cluster_id >= 0 ? r.cluster_id : '·'}
                </div>
                <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nid}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: r.is_anomaly ? 'var(--rose)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {(r.trust_score * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Clusters */}
        {result && !isLoading && tab === 'clusters' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {barData.length === 0 ? (
              <div className="empty">
                <div className="empty-glyph">🔵</div>
                <div className="empty-title">No Clusters</div>
                <div className="empty-body">Graph may be too sparse for community detection</div>
              </div>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                    Distribution
                  </div>
                  <ResponsiveContainer width="99%" height={100} minWidth={1}>
                    <BarChart data={barData} barSize={18} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: '#4a5568', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#4a5568', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {barData.map((_, i) => <Cell key={i} fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {barData.map((d, i) => (
                  <div key={d.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-elevated)',
                    borderLeft: `2px solid ${CLUSTER_COLORS[i % CLUSTER_COLORS.length]}`,
                    borderRadius: 'var(--r-sm)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}>
                        Community {i}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Louvain cluster</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 900, color: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}>
                      {d.count}
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}> nodes</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
