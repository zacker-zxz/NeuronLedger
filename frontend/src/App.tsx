import { useState, useEffect, useCallback } from 'react';
import './index.css';
import { GraphCanvas } from './components/GraphCanvas';
import { ScorePanel } from './components/ScorePanel';
import { ProofChain } from './components/ProofChain';
import { InferenceTimeline } from './components/InferenceTimeline';
import { NodeDetailsPanel } from './components/NodeDetailsPanel';
import { UploadPanel } from './components/UploadPanel';
import type {
  GraphRecord, GraphData, InferenceResult, InferenceRecord,
  LedgerEntry, NodeResult, AppView, GraphNode,
} from './types';
import {
  getGraphs, getGraph, runInference, getInferences,
  getLedger, deleteGraph,
} from './api/client';

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV: { view: AppView; icon: string; label: string }[] = [
  { view: 'dashboard', icon: '⬡', label: 'Neural Graph' },
  { view: 'inference', icon: '⚡', label: 'Inference' },
  { view: 'ledger', icon: '🔗', label: 'Proof Ledger' },
  { view: 'upload', icon: '↑', label: 'Ingest Data' },
];

const DATASET_ICON: Record<string, string> = {
  wallet: '💎', citation: '📚', social: '👥',
};

function datasetIcon(name: string): string {
  const lower = name.toLowerCase();
  return DATASET_ICON[Object.keys(DATASET_ICON).find((k) => lower.includes(k)) ?? ''] ?? '🗂';
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const [graphs, setGraphs] = useState<GraphRecord[]>([]);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [nodeResults, setNodeResults] = useState<Record<string, NodeResult>>({});
  const [inferenceResult, setInferenceResult] = useState<InferenceResult | null>(null);
  const [inferences, setInferences] = useState<InferenceRecord[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedInferenceId, setSelectedInferenceId] = useState<string | null>(null);
  const [isInferenceLoading, setIsInferenceLoading] = useState(false);
  const [anomalyAlerts, setAnomalyAlerts] = useState<string[]>([]);
  const [backendError, setBackendError] = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadGraphs = useCallback(async () => {
    try {
      const data = await getGraphs();
      setGraphs(data);
      setBackendError(false);
      if (data.length > 0 && !selectedGraphId) setSelectedGraphId(data[0].id);
    } catch { setBackendError(true); }
  }, [selectedGraphId]);

  const loadInferences = useCallback(async () => {
    try { setInferences(await getInferences()); } catch {}
  }, []);

  const loadLedger = useCallback(async () => {
    try { setLedgerEntries(await getLedger()); } catch {}
  }, []);

  useEffect(() => { loadGraphs(); loadInferences(); loadLedger(); }, []);

  // ── Load graph on selection ───────────────────────────────────────────────

  useEffect(() => {
    if (!selectedGraphId) { setGraphData(null); return; }
    setSelectedNode(null);
    setNodeResults({});
    setInferenceResult(null);
    getGraph(selectedGraphId).then((g) => setGraphData(g.graph ?? null)).catch(console.error);
  }, [selectedGraphId]);

  // ── Inference ─────────────────────────────────────────────────────────────

  const handleRunInference = useCallback(async () => {
    if (!selectedGraphId) return;
    setIsInferenceLoading(true);
    setAnomalyAlerts([]);
    try {
      const response = await runInference(selectedGraphId);
      const result = response.result as InferenceResult;
      setInferenceResult(result);
      setNodeResults(result.node_results);
      setSelectedInferenceId(response.inference_id);
      if (result.anomaly_count > 0) setAnomalyAlerts(result.anomaly_nodes.slice(0, 4));
      await Promise.all([loadInferences(), loadLedger()]);
    } catch (e) { console.error(e); }
    finally { setIsInferenceLoading(false); }
  }, [selectedGraphId, loadInferences, loadLedger]);

  // ── Graph created ─────────────────────────────────────────────────────────

  const handleGraphCreated = async (graphId: string) => {
    await loadGraphs();
    setSelectedGraphId(graphId);
    setView('dashboard');
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedNodeData = graphData?.nodes.find((n) => n.id === selectedNode) ?? null;
  const selectedNodeResult = selectedNode ? nodeResults[selectedNode] : undefined;
  const selectedNodeExplanation = selectedNode && inferenceResult?.explanation_paths
    ? inferenceResult.explanation_paths[selectedNode]
    : undefined;

  return (
    <div className="app-shell">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="logo-group">
          <div className="logo-mark">🧠</div>
          <span className="logo-name">NeuronLedger</span>
          <span className="logo-version">v1.0</span>
        </div>

        <div className="header-divider" />

        {/* Stats */}
        <div className="header-status-row">
          <div className="status-chip">
            <div className={`status-chip-dot ${backendError ? 'alert' : 'online'}`} />
            {backendError ? 'Backend Offline' : 'Connected'}
          </div>
          <div className="status-chip" style={{ fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--cyan)' }}>{graphs.length}</span>&nbsp;graphs
          </div>
          <div className="status-chip" style={{ fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--violet-bright)' }}>{inferences.length}</span>&nbsp;runs
          </div>
          <div className="status-chip" style={{ fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--emerald)' }}>{ledgerEntries.length}</span>&nbsp;proofs
          </div>
        </div>

        <div className="header-spacer" />

        {/* Anomaly alerts */}
        {anomalyAlerts.length > 0 && (
          <div className="anomaly-strip">
            <span className="anomaly-strip-label">⚠ FLAGGED</span>
            {anomalyAlerts.map((nid) => (
              <span key={nid} className="anomaly-node-tag">{nid}</span>
            ))}
          </div>
        )}

        <div className="header-accent-line" />
      </header>

      {/* ── Sidebar ── */}
      <aside className="app-sidebar">
        <div className="sidebar-section">Navigation</div>
        {NAV.map((item) => (
          <button
            key={item.view}
            className={`nav-item ${view === item.view ? 'active' : ''}`}
            onClick={() => setView(item.view)}
            id={`nav-${item.view}`}
          >
            <div className="nav-icon">{item.icon}</div>
            <span className="nav-label">{item.label}</span>
            {item.view === 'ledger' && ledgerEntries.length > 0 && (
              <span className="nav-badge">{ledgerEntries.length}</span>
            )}
          </button>
        ))}

        <div style={{ height: 12 }} />
        <div className="sidebar-section">Datasets</div>

        {graphs.length === 0 && !backendError && (
          <div style={{ padding: '12px 10px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>No datasets loaded.</div>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setView('upload')}>
              + Upload Dataset
            </button>
          </div>
        )}

        {graphs.map((g) => (
          <button
            key={g.id}
            className={`dataset-item ${selectedGraphId === g.id ? 'active' : ''}`}
            onClick={() => {
              setSelectedGraphId(g.id);
              setInferenceResult(null);
              setNodeResults({});
              setAnomalyAlerts([]);
              setView('dashboard');
            }}
          >
            <div className="dataset-icon">{datasetIcon(g.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="dataset-name">{g.name}</div>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {g.node_count}N · {g.edge_count}E
              </div>
            </div>
          </button>
        ))}

        <div className="sidebar-footer">
          <div className="tech-stack-row">
            {[
              ['var(--cyan)', 'IsolationForest AI'],
              ['var(--violet-bright)', 'Louvain Clustering'],
              ['var(--emerald)', 'PageRank Trust'],
              ['var(--amber)', 'SHA-256 Merkle Chain'],
            ].map(([color, label]) => (
              <div key={label} className="tech-tag">
                <div className="tech-tag-dot" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="app-main">
        {view === 'dashboard' && (
          <div className="dashboard-layout">
            {/* 3D Graph */}
            <div className="graph-zone">
              <GraphCanvas
                graphData={graphData}
                nodeResults={nodeResults}
                onNodeClick={(id) => setSelectedNode((prev) => prev === id ? null : id)}
                selectedNode={selectedNode}
              />

              {/* Node details overlay */}
              {selectedNodeData && (
                <NodeDetailsPanel
                  node={selectedNodeData}
                  result={selectedNodeResult}
                  explanation={selectedNodeExplanation}
                  onClose={() => setSelectedNode(null)}
                />
              )}

              {/* Loading veil */}
              {isInferenceLoading && (
                <div className="loading-veil">
                  <div className="loading-box">
                    <div className="spinner" />
                    <div className="loading-box-title">Neural Analysis Running</div>
                    <div className="loading-box-sub">
                      Isolation Forest · Louvain Clustering<br />
                      PageRank Trust · Explanation Paths
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Score panel */}
            <div className="score-zone">
              <ScorePanel
                result={inferenceResult}
                isLoading={isInferenceLoading}
                onRunInference={handleRunInference}
                graphId={selectedGraphId}
              />
            </div>

            {/* Bottom: Timeline */}
            <div className="timeline-zone">
              <InferenceTimeline
                inferences={inferences}
                selectedId={selectedInferenceId ?? undefined}
                onSelect={setSelectedInferenceId}
              />
            </div>
          </div>
        )}

        {view === 'inference' && (
          <div className="inference-view">
            {/* Left: Score panel */}
            <div style={{ borderRight: '1px solid var(--border-faint)', overflow: 'hidden' }}>
              <ScorePanel
                result={inferenceResult}
                isLoading={isInferenceLoading}
                onRunInference={handleRunInference}
                graphId={selectedGraphId}
              />
            </div>

            {/* Right: Explanation paths */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="panel-hd" style={{ background: 'var(--bg-surface)' }}>
                <div className="panel-hd-title">
                  <span className="panel-hd-icon">🔍</span>
                  Explanation Paths
                </div>
              </div>

              <div className="panel-body scroll-y" style={{ flex: 1, background: 'var(--bg-surface)' }}>
                {!inferenceResult ? (
                  <div className="empty" style={{ height: '100%' }}>
                    <div className="empty-glyph">🔬</div>
                    <div className="empty-title">No Analysis Yet</div>
                    <div className="empty-body">Run inference to see why the model flagged specific nodes</div>
                  </div>
                ) : Object.keys(inferenceResult.explanation_paths).length === 0 ? (
                  <div className="empty" style={{ height: '100%' }}>
                    <div style={{ fontSize: 36 }}>✅</div>
                    <div className="empty-title" style={{ color: 'var(--emerald)' }}>All Nodes Normal</div>
                    <div className="empty-body">No anomalies were found in this graph — no explanation paths needed</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {Object.entries(inferenceResult.explanation_paths).map(([nodeId, path]) => {
                      const res = inferenceResult.node_results[nodeId];
                      return (
                        <div key={nodeId} style={{
                          background: 'rgba(244,63,94,0.05)',
                          border: '1px solid rgba(244,63,94,0.12)',
                          borderLeft: '3px solid var(--rose)',
                          borderRadius: 'var(--r-md)',
                          padding: 16,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <span className="tag tag-rose">⚠ {nodeId}</span>
                            {res && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                Anomaly score: <strong style={{ color: 'var(--rose)' }}>{(res.anomaly_score * 100).toFixed(0)}%</strong>
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
                            {path.explanation}
                          </p>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {path.path_nodes.slice(0, 6).map((pn) => (
                              <div key={pn.id} style={{
                                padding: '5px 10px',
                                background: 'var(--bg-elevated)',
                                borderRadius: 20,
                                fontSize: 11,
                                fontFamily: 'var(--font-mono)',
                                color: pn.depth === 0 ? 'var(--rose)' : 'var(--text-secondary)',
                                border: `1px solid ${pn.depth === 0 ? 'rgba(244,63,94,0.3)' : 'var(--border-subtle)'}`,
                                display: 'flex',
                                gap: 5,
                                alignItems: 'center',
                              }}>
                                <span>{pn.id}</span>
                                <span style={{ color: 'var(--cyan)', fontSize: 10 }}>{(pn.influence * 100).toFixed(0)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ paddingBottom: 8 }}>
                      <InferenceTimeline
                        inferences={inferences}
                        selectedId={selectedInferenceId ?? undefined}
                        onSelect={setSelectedInferenceId}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'ledger' && (
          <div className="ledger-view">
            <ProofChain entries={ledgerEntries} onRefresh={loadLedger} />
          </div>
        )}

        {view === 'upload' && (
          <UploadPanel onGraphCreated={handleGraphCreated} />
        )}
      </main>
    </div>
  );
}
