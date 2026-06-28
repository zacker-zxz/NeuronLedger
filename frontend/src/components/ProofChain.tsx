import { useState } from 'react';
import type { LedgerEntry, ChainVerification } from '../types';
import { verifyChain } from '../api/client';

interface ProofChainProps {
  entries: LedgerEntry[];
  onRefresh: () => void;
}

function truncHash(h: string, n = 8) {
  return `${h.slice(0, n)}…${h.slice(-6)}`;
}

export function ProofChain({ entries, onRefresh }: ProofChainProps) {
  const [verification, setVerification] = useState<ChainVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleVerify = async () => {
    setIsVerifying(true);
    try { setVerification(await verifyChain()); }
    catch (e) { console.error(e); }
    finally { setIsVerifying(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-surface)' }}>
      {/* Header */}
      <div className="panel-hd">
        <div className="panel-hd-title">
          <span className="panel-hd-icon">🔗</span>
          Proof Ledger
          {entries.length > 0 && (
            <span className="tag tag-cyan" style={{ fontSize: 9, padding: '1px 7px' }}>
              {entries.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={onRefresh} id="refresh-ledger-btn" title="Refresh">↺</button>
          <button
            className="btn btn-violet btn-sm"
            onClick={handleVerify}
            disabled={isVerifying || entries.length === 0}
            id="verify-chain-btn"
          >
            {isVerifying
              ? <><div className="spinner spinner-sm" />Verifying…</>
              : <>🔐 Verify</>}
          </button>
        </div>
      </div>

      {/* Verification result */}
      {verification && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-faint)' }}>
          <div className={`alert ${verification.is_valid ? 'alert-emerald' : 'alert-rose'}`}>
            <span className="alert-icon">{verification.is_valid ? '✅' : '❌'}</span>
            <div>
              <div className="alert-title">
                {verification.is_valid ? 'Chain Integrity Verified' : 'Integrity Breach Detected'}
              </div>
              <div className="alert-body" style={{ fontSize: 10.5 }}>
                {verification.entries_checked} entries checked · {verification.issues.length} issues found
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chain */}
      <div className="panel-body scroll-y" style={{ flex: 1 }}>
        {entries.length === 0 ? (
          <div className="empty" style={{ height: '100%' }}>
            <div className="empty-glyph">📋</div>
            <div className="empty-title">Empty Ledger</div>
            <div className="empty-body">Run your first inference to create a tamper-evident proof entry</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[...entries].reverse().map((entry, idx) => {
              const isExp = expanded === entry.id;
              const hasIssue = verification?.issues.some((i) => i.entry_index === entry.entry_index);

              return (
                <div key={entry.id}>
                  {idx > 0 && <div className="chain-connector-line" style={{ margin: '3px auto' }} />}

                  <div
                    className={`chain-block ${hasIssue ? 'invalid' : 'valid'}`}
                    onClick={() => setExpanded(isExp ? null : entry.id)}
                  >
                    {/* Block header */}
                    <div className="chain-block-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="chain-idx">#{entry.entry_index}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        {hasIssue
                          ? <span className="tag tag-rose" style={{ fontSize: 9 }}>TAMPERED</span>
                          : <span className="tag tag-emerald" style={{ fontSize: 9 }}>VALID</span>
                        }
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {isExp ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {/* Compact hashes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {[
                        ['merkle_root', entry.merkle_root, true],
                        ['prev_hash', entry.previous_hash, false],
                      ].map(([label, val, accent]) => (
                        <div key={String(label)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 76, flexShrink: 0 }}>
                            {String(label)}
                          </span>
                          <span className={`hash ${accent ? 'accent' : ''}`}>
                            {truncHash(String(val))}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Expanded */}
                    {isExp && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border-faint)', paddingTop: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                          {[
                            ['Graph Hash', entry.graph_state_hash, 'var(--violet-bright)'],
                            ['Input Hash', entry.input_hash, 'var(--amber)'],
                            ['Output Hash', entry.output_hash, 'var(--emerald)'],
                            ['Model', entry.model_version, 'var(--cyan)'],
                          ].map(([label, val, color]) => (
                            <div key={String(label)} style={{
                              background: 'var(--bg-base)',
                              borderRadius: 6,
                              padding: '7px 9px',
                              border: '1px solid var(--border-faint)',
                            }}>
                              <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 3 }}>
                                {String(label)}
                              </div>
                              <div className="hash" style={{ fontSize: 9, color: String(color) }}>
                                {String(val).length > 16 ? truncHash(String(val), 10) : String(val)}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Full merkle root */}
                        <div style={{ background: 'var(--bg-base)', borderRadius: 6, padding: '8px 9px', border: '1px solid rgba(0,212,255,0.1)', marginBottom: 6 }}>
                          <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 3 }}>
                            Merkle Root (full SHA-256)
                          </div>
                          <div className="hash accent" style={{ fontSize: 9 }}>{entry.merkle_root}</div>
                        </div>

                        <div style={{ background: 'var(--bg-base)', borderRadius: 6, padding: '8px 9px', border: '1px solid var(--border-faint)' }}>
                          <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 3 }}>
                            HMAC-SHA256 Signature
                          </div>
                          <div className="hash" style={{ fontSize: 9 }}>{entry.verification_signature.slice(0, 40)}…</div>
                        </div>

                        {entry.blockchain_tx_hash && entry.blockchain_tx_hash !== "local_chain_only" && entry.blockchain_tx_hash !== "anchoring_failed" && (
                          <div style={{ background: 'var(--bg-base)', borderRadius: 6, padding: '8px 9px', border: '1px solid var(--border-faint)', marginTop: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                              <div style={{ fontSize: 8.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                                Ethereum TX Hash (Sepolia)
                              </div>
                              <a 
                                href={`https://sepolia.etherscan.io/tx/${entry.blockchain_tx_hash}`} 
                                target="_blank" 
                                rel="noreferrer"
                                style={{ fontSize: 9, color: 'var(--cyan)', textDecoration: 'none', background: 'rgba(0,212,255,0.1)', padding: '2px 6px', borderRadius: 4 }}
                              >
                                View on Etherscan ↗
                              </a>
                            </div>
                            <div className="hash" style={{ fontSize: 9, color: 'var(--cyan)' }}>{entry.blockchain_tx_hash}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
