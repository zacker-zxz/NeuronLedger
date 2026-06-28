import type { GraphNode, NodeResult, ExplanationPath } from '../types';

interface NodeDetailsPanelProps {
  node: GraphNode;
  result?: NodeResult;
  explanation?: ExplanationPath;
  onClose: () => void;
}

export function NodeDetailsPanel({ node, result, explanation, onClose }: NodeDetailsPanelProps) {
  const isAnomaly = result?.is_anomaly ?? false;
  const isMixer = String(node.node_type) === 'mixer';
  const avatarClass = isAnomaly ? 'anomaly' : isMixer ? 'mixer' : 'normal';
  const avatarIcon = isAnomaly ? '⚠' : isMixer ? '⇌' : '◉';

  return (
    <div className="node-overlay">
      {/* Header */}
      <div className="node-overlay-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`node-avatar ${avatarClass}`}>{avatarIcon}</div>
          <div>
            <div className="node-name">{String(node.label || node.id)}</div>
            <div className="node-type">{String(node.node_type || 'node')} · {node.id}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-xs btn-icon" onClick={onClose} style={{ padding: '3px 6px' }}>
          ✕
        </button>
      </div>

      {/* Status */}
      {result && (
        <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
          <span className={`tag ${isAnomaly ? 'tag-rose' : 'tag-emerald'}`}>
            {isAnomaly ? '⚠ Anomaly' : '✓ Normal'}
          </span>
          {result.cluster_id >= 0 && (
            <span className="tag tag-violet">Cluster {result.cluster_id}</span>
          )}
        </div>
      )}

      {/* Scores */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 12 }}>
          <div className="score-bar">
            <div className="score-bar-header">
              <span className="score-bar-label">Anomaly Risk</span>
              <span className="score-bar-value" style={{ color: isAnomaly ? 'var(--rose)' : 'var(--text-muted)' }}>
                {(result.anomaly_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="score-bar-track">
              <div className={`score-bar-fill ${isAnomaly ? 'rose' : 'cyan'}`} style={{ width: `${result.anomaly_score * 100}%` }} />
            </div>
          </div>
          <div className="score-bar">
            <div className="score-bar-header">
              <span className="score-bar-label">Trust Score</span>
              <span className="score-bar-value" style={{ color: 'var(--emerald)' }}>
                {(result.trust_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="score-bar-track">
              <div className="score-bar-fill emerald" style={{ width: `${result.trust_score * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Node attributes */}
      <div className="divider" />
      <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
        Attributes
      </div>
      {Object.entries(node)
        .filter(([k]) => !['id', 'label'].includes(k))
        .slice(0, 5)
        .map(([k, v]) => (
          <div key={k} className="info-row">
            <span className="info-key">{k}</span>
            <span className="info-val">{String(v ?? '—')}</span>
          </div>
        ))}

      {/* Explanation */}
      {explanation && (
        <>
          <div className="divider" />
          <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
            Influence Path
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 8 }}>
            {explanation.explanation}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {explanation.path_nodes.slice(0, 4).map((pn) => (
              <div key={pn.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                background: 'var(--bg-elevated)',
                borderRadius: 4,
                fontSize: 10,
              }}>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 16 }}>D{pn.depth}</span>
                <span style={{ flex: 1, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pn.id}
                </span>
                <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {(pn.influence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
