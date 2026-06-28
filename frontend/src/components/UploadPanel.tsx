import { useState, useCallback } from 'react';
import { ingestCSV, ingestJSON } from '../api/client';

interface UploadPanelProps {
  onGraphCreated: (graphId: string, name: string) => void;
}

const SAMPLE_JSON = {
  name: 'Custom Network',
  description: 'Define your own graph',
  nodes: [
    { id: 'A', label: 'Alice', node_type: 'wallet', balance: 50000 },
    { id: 'B', label: 'Bob', node_type: 'wallet', balance: 20000 },
    { id: 'C', label: 'Carol', node_type: 'wallet', balance: 5000 },
  ],
  edges: [
    { source: 'A', target: 'B', weight: 15000, label: 'transfer' },
    { source: 'B', target: 'C', weight: 4000, label: 'transfer' },
    { source: 'C', target: 'A', weight: 1000, label: 'return' },
  ],
};

export function UploadPanel({ onGraphCreated }: UploadPanelProps) {
  const [tab, setTab] = useState<'csv' | 'json'>('csv');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [jsonText, setJsonText] = useState(JSON.stringify(SAMPLE_JSON, null, 2));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.csv')) {
      setFile(f);
      setName(f.name.replace('.csv', ''));
      setError(null);
    } else {
      setError('Please drop a .csv file');
    }
  }, []);

  const handleCSVSubmit = async () => {
    if (!file) { setError('Select a CSV file first'); return; }
    setIsLoading(true); setError(null); setSuccess(null);
    try {
      const r = await ingestCSV(file, name || file.name);
      setSuccess(`Graph created — ${r.node_count} nodes · ${r.edge_count} edges`);
      onGraphCreated(r.graph_id, name || file.name);
      setFile(null);
    } catch (e: any) {
      let errorMsg = 'Upload failed';
      if (e?.response?.data?.detail) {
        const detail = e.response.data.detail;
        errorMsg = typeof detail === 'string' ? detail : JSON.stringify(detail);
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJSONSubmit = async () => {
    setIsLoading(true); setError(null); setSuccess(null);
    try {
      const parsed = JSON.parse(jsonText);
      const r = await ingestJSON(parsed);
      setSuccess(`Graph created — ${r.node_count} nodes · ${r.edge_count} edges`);
      onGraphCreated(r.graph_id, parsed.name || 'Custom Graph');
    } catch (e: any) {
      let errorMsg = 'Ingestion failed';
      if (e instanceof SyntaxError) {
        errorMsg = 'Invalid JSON syntax';
      } else if (e?.response?.data?.detail) {
        const detail = e.response.data.detail;
        errorMsg = typeof detail === 'string' ? detail : JSON.stringify(detail);
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="upload-view">
      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            📥
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1 }}>
              Ingest Data
            </h1>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              Upload structured datasets to build a neural graph
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-rose" style={{ marginBottom: 14 }}>
          <span className="alert-icon">❌</span>
          <div><div className="alert-title">Error</div><div className="alert-body">{error}</div></div>
        </div>
      )}
      {success && (
        <div className="alert alert-emerald" style={{ marginBottom: 14 }}>
          <span className="alert-icon">✅</span>
          <div><div className="alert-title">Graph Created</div><div className="alert-body">{success}</div></div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab-btn ${tab === 'csv' ? 'active' : ''}`} onClick={() => setTab('csv')}>
          📊 CSV Upload
        </button>
        <button className={`tab-btn ${tab === 'json' ? 'active' : ''}`} onClick={() => setTab('json')}>
          ⚙ JSON Editor
        </button>
      </div>

      {/* CSV tab */}
      {tab === 'csv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            className={`drop-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input-csv')?.click()}
          >
            <span className="drop-icon">{file ? '📄' : '📤'}</span>
            <div className="drop-title">{file ? file.name : 'Drop CSV file here'}</div>
            <div className="drop-sub">
              {file
                ? `${(file.size / 1024).toFixed(1)} KB — click to replace`
                : 'or click to browse · Expected columns: from, to, amount'}
            </div>
            <input id="file-input-csv" type="file" accept=".csv" style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); setName(f.name.replace('.csv', '')); }
              }}
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="csv-name">Graph Name</label>
            <input id="csv-name" className="field-input" type="text" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="e.g. Q1 Transactions" />
          </div>

          {/* Format sample */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: 14 }}>
            <div className="field-label" style={{ marginBottom: 8 }}>Expected CSV Format</div>
            <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)', lineHeight: 1.9, margin: 0 }}>
{`from,to,amount,timestamp,label
Alice,Bob,5000,2024-01-01,transfer
Bob,Charlie,2500,2024-01-02,transfer
Mixer1,Dave,4800,2024-01-03,suspicious`}
            </pre>
          </div>

          <button
            id="submit-csv-btn"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleCSVSubmit}
            disabled={!file || isLoading}
          >
            {isLoading ? <><div className="spinner spinner-sm" />Processing…</> : '📥 Ingest CSV Dataset'}
          </button>
        </div>
      )}

      {/* JSON tab */}
      {tab === 'json' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-faint)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="field-label" style={{ marginBottom: 0 }}>Graph JSON Schema</div>
              <span className="tag tag-muted">nodes + edges</span>
            </div>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              style={{
                width: '100%',
                height: 300,
                resize: 'vertical',
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                lineHeight: 1.7,
                background: 'var(--bg-base)',
                color: 'var(--cyan)',
                border: 'none',
                outline: 'none',
                padding: '12px',
              }}
              spellCheck={false}
            />
          </div>

          <button
            id="submit-json-btn"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleJSONSubmit}
            disabled={isLoading}
          >
            {isLoading ? <><div className="spinner spinner-sm" />Processing…</> : '📥 Ingest JSON Graph'}
          </button>
        </div>
      )}
    </div>
  );
}
