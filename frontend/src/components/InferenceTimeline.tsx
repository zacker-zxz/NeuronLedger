import type { InferenceRecord } from '../types';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Area, AreaChart,
} from 'recharts';

interface InferenceTimelineProps {
  inferences: InferenceRecord[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 10.5,
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>{d?.time}</div>
      <div style={{ color: 'var(--cyan)', fontWeight: 700 }}>Confidence: {d?.confidence}%</div>
      {d?.anomalies > 0 && (
        <div style={{ color: 'var(--rose)', fontWeight: 700 }}>Anomalies: {d?.anomalies}</div>
      )}
    </div>
  );
};

export function InferenceTimeline({ inferences, selectedId, onSelect }: InferenceTimelineProps) {
  const chartData = [...inferences].reverse().map((inf, i) => ({
    index: i + 1,
    confidence: Math.round(inf.confidence * 100),
    anomalies: inf.anomaly_count,
    id: inf.id,
    time: new Date(inf.created_at).toLocaleTimeString(),
  }));

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Chart column */}
      <div style={{ flex: '0 0 280px', borderRight: '1px solid var(--border-faint)', display: 'flex', flexDirection: 'column' }}>
        <div className="panel-hd" style={{ padding: '8px 14px' }}>
          <div className="panel-hd-title">
            <span className="panel-hd-icon">📈</span>
            Confidence Trend
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {inferences.length} run{inferences.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ flex: 1, padding: '8px 12px 12px' }}>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="index" hide />
                <YAxis domain={[0, 100]} tick={{ fill: '#4a5568', fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={70} stroke="rgba(244,63,94,0.35)" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="confidence"
                  stroke="#00d4ff"
                  strokeWidth={2}
                  fill="url(#confGrad)"
                  dot={{ fill: '#00d4ff', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#00d4ff', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty" style={{ height: '100%' }}>
              <div className="empty-glyph" style={{ fontSize: 24 }}>📊</div>
              <div className="empty-body">Run at least 2 inferences to see trend</div>
            </div>
          )}
        </div>
      </div>

      {/* List column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="panel-hd" style={{ padding: '8px 14px' }}>
          <div className="panel-hd-title">
            <span className="panel-hd-icon">⏱</span>
            Run History
          </div>
        </div>

        <div className="scroll-y" style={{ flex: 1, padding: '6px 10px' }}>
          {inferences.length === 0 ? (
            <div className="empty">
              <div className="empty-body">No inference runs yet</div>
            </div>
          ) : (
            [...inferences].reverse().map((inf) => (
              <div
                key={inf.id}
                className={`list-row ${selectedId === inf.id ? 'selected' : ''}`}
                onClick={() => onSelect(inf.id)}
              >
                <div className="list-row-icon" style={{
                  background: inf.anomaly_count > 0 ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
                  border: `1px solid ${inf.anomaly_count > 0 ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}`,
                }}>
                  {inf.anomaly_count > 0 ? '⚠' : '✓'}
                </div>
                <div className="list-row-body">
                  <div className="list-row-name">
                    Run #{inf.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="list-row-sub">
                    {new Date(inf.created_at).toLocaleString()} · {inf.anomaly_count} anomalies
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 900, color: 'var(--cyan)' }}>
                    {(inf.confidence * 100).toFixed(0)}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400 }}>%</span>
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>confidence</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
