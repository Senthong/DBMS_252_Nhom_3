import { useState } from 'react'
import Navbar from './components/Navbar'
import HeroSplit from './components/HeroSplit'
import SectionHeader from './components/SectionHeader'
import { RunButton, ResultBox } from './components/Controls'
import {
  commitDemo, rollbackDemo, savepointDemo,
  transferDemo, redisMulti, redisDiscard,
  getHistory, getStats, clearHistory,
} from './api/client'

// ── shared styles ────────────────────────────────────────────────────────
const PAGE = { maxWidth: 1100, margin: '0 auto', padding: '0 48px' }
const SECTION = { padding: '80px 0', borderBottom: '1px solid var(--cream-dark)' }
const LABEL = {
  fontFamily: 'var(--font-body)', fontSize: '0.7rem',
  letterSpacing: '0.12em', color: 'var(--text-muted)',
  textTransform: 'uppercase', marginBottom: 8, display: 'block',
}
const INPUT = {
  width: '100%', padding: '12px 16px',
  border: '1px solid #c8c0b4', background: 'var(--white)',
  fontFamily: 'var(--font-body)', fontSize: '0.88rem',
  color: 'var(--navy)', outline: 'none',
}

// ── small hook for each demo ──────────────────────────────────────────────
function useDemo(apiFn) {
  const [result, setResult] = useState(null)
  const [error,  setError]  = useState(null)
  const [loading, setLoading] = useState(false)
  const run = async (arg) => {
    setLoading(true); setResult(null); setError(null)
    try { setResult((await apiFn(arg)).data) }
    catch(e) { setError(e.response?.data || { message: e.message }) }
    finally  { setLoading(false) }
  }
  return { result, error, loading, run }
}

// ── ACID reference table data ─────────────────────────────────────────────
const ACID_TABLE = [
  { p: 'Atomicity',   pg: 'COMMIT / ROLLBACK',        redis: 'MULTI / EXEC · DISCARD',  g: 'All-or-nothing execution' },
  { p: 'Consistency', pg: 'Constraints · SAVEPOINT',  redis: 'WATCH (optimistic lock)',  g: 'Data rules always hold' },
  { p: 'Isolation',   pg: 'SELECT FOR UPDATE · Levels',redis: 'Single-threaded (partial)',g: 'No dirty reads between sessions' },
  { p: 'Durability',  pg: 'WAL + fsync',              redis: 'RDB snapshot · AOF log',   g: 'Committed data survives crash' },
]

// ── Visual element shown on right panel of hero ───────────────────────────
function HeroVisual() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '6rem',
        color: 'rgba(255,255,255,0.06)',
        lineHeight: 1,
        letterSpacing: '-0.04em',
        userSelect: 'none',
      }}>ACID</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: -20 }}>
        {['A','C','I','D'].map((l, i) => (
          <div key={l} style={{
            width: 56, height: 56,
            border: '1px solid rgba(184,154,106,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-serif)',
            fontSize: '1.4rem', fontWeight: 700,
            color: 'var(--gold)',
            animation: `fadeUp 0.6s ease ${i * 0.1}s both`,
          }}>{l}</div>
        ))}
      </div>
      <p style={{
        marginTop: 28,
        fontFamily: 'var(--font-light)',
        fontSize: '0.9rem',
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: '0.1em',
      }}>Transaction Guarantees</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('COMMIT')

  const commit    = useDemo(commitDemo)
  const rollback  = useDemo(rollbackDemo)
  const savepoint = useDemo(savepointDemo)
  const redis     = useDemo(redisMulti)
  const discard   = useDemo(redisDiscard)

  // transfer
  const transfer  = useDemo(transferDemo)
  const [txFrom, setTxFrom]     = useState('ACC-ALPHA')
  const [txTo,   setTxTo]       = useState('ACC-BETA')
  const [txAmt,  setTxAmt]      = useState(500)

  // history / stats
  const [history, setHistory]   = useState(null)
  const [stats,   setStats]     = useState(null)
  const [histLoad, setHistLoad] = useState(false)

  const loadHistory = async () => {
    setHistLoad(true)
    try {
      const [h, s] = await Promise.all([getHistory(), getStats()])
      setHistory(h.data); setStats(s.data)
    } finally { setHistLoad(false) }
  }
  const doClear = async () => {
    if (!confirm('Reset all demo logs and account balances?')) return
    await clearHistory()
    setHistory(null); setStats(null)
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>

      <Navbar active={activeTab} onSelect={setActiveTab} />

      {/* ── HERO ── */}
      <HeroSplit
        tag="TOPIC IV · MEMBER 3"
        title={<>Transaction<br/>Control</>}
        subtitle="Exploring ACID guarantees in PostgreSQL and Redis through live interactive demonstrations."
        acid="ACID"
        rightContent={<HeroVisual />}
      />

      {/* ── SECTION WRAPPER ── */}
      <div style={{ background: 'var(--cream)' }}>

        {/* ── COMMIT ── */}
        <div style={SECTION} id="COMMIT">
          <div style={PAGE}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
              <div>
                <SectionHeader eyebrow="Demo ①" title="COMMIT" />
                <p style={{ fontFamily: 'var(--font-light)', fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 32 }}>
                  Insert a new order record inside a transaction and commit it to the database.
                  Demonstrates <strong>Atomicity</strong> and <strong>Durability</strong> — the data
                  is permanently saved once committed.
                </p>
                <CodeBlock>{`BEGIN;
INSERT INTO orders(order_id, ...)
  VALUES ('demo-xxxx', ...);
COMMIT;  -- permanently saved`}</CodeBlock>
              </div>
              <div style={{ paddingTop: 8 }}>
                <AcidTag letters="AD" />
                <div style={{ marginTop: 28 }}>
                  <RunButton loading={commit.loading} onClick={commit.run} />
                </div>
                <ResultBox result={commit.result} error={commit.error} />
              </div>
            </div>
          </div>
        </div>

        {/* ── ROLLBACK ── */}
        <div style={{ ...SECTION, background: 'var(--white)' }} id="ROLLBACK">
          <div style={PAGE}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
              <div>
                <SectionHeader eyebrow="Demo ②" title="ROLLBACK" />
                <p style={{ fontFamily: 'var(--font-light)', fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 32 }}>
                  An error is intentionally triggered mid-transaction (division by zero).
                  PostgreSQL automatically reverts all changes — the order is <em>never</em> saved.
                  Pure <strong>Atomicity</strong>.
                </p>
                <CodeBlock>{`BEGIN;
INSERT INTO orders(...) VALUES (...);
SELECT 1/0;  -- ← intentional error
-- ROLLBACK triggered automatically
-- order row disappears`}</CodeBlock>
              </div>
              <div style={{ paddingTop: 8 }}>
                <AcidTag letters="A" />
                <div style={{ marginTop: 28 }}>
                  <RunButton loading={rollback.loading} onClick={rollback.run} label="RUN ROLLBACK" />
                </div>
                <ResultBox result={rollback.result} error={rollback.error} />
              </div>
            </div>
          </div>
        </div>

        {/* ── SAVEPOINT ── */}
        <div style={SECTION} id="SAVEPOINT">
          <div style={PAGE}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
              <div>
                <SectionHeader eyebrow="Demo ③" title="SAVEPOINT" />
                <p style={{ fontFamily: 'var(--font-light)', fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 32 }}>
                  A savepoint is created after inserting Order A. Order B then fails.
                  Rolling back to the savepoint discards only B — Order A is committed.
                  Demonstrates <strong>Consistency</strong>.
                </p>
                <CodeBlock>{`BEGIN;
INSERT order_A;       -- committed ✓
SAVEPOINT sp1;
INSERT order_B;
SELECT 1/0;           -- error
ROLLBACK TO sp1;      -- B discarded
COMMIT;               -- only A saved`}</CodeBlock>
              </div>
              <div style={{ paddingTop: 8 }}>
                <AcidTag letters="C" />
                <div style={{ marginTop: 28 }}>
                  <RunButton loading={savepoint.loading} onClick={savepoint.run} label="RUN SAVEPOINT" />
                </div>
                <ResultBox result={savepoint.result} error={savepoint.error} />
              </div>
            </div>
          </div>
        </div>

        {/* ── TRANSFER ── */}
        <div style={{ ...SECTION, background: 'var(--white)' }} id="TRANSFER">
          <div style={PAGE}>
            <SectionHeader eyebrow="Demo ④ · Full ACID" title="Balance Transfer" center />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-light)', fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 32 }}>
                  Debit one account and credit another atomically.
                  <code style={{ background: 'var(--cream)', padding: '1px 6px', fontFamily: 'monospace', fontSize: '0.85rem' }}> SELECT FOR UPDATE</code> locks
                  both rows to prevent race conditions. A balance constraint prevents going negative.
                </p>
                <CodeBlock>{`BEGIN;
SELECT balance FROM accounts
  WHERE account_id = :from
  FOR UPDATE;          -- row lock (Isolation)

UPDATE accounts SET balance = balance - :amt
  WHERE account_id = :from;

UPDATE accounts SET balance = balance + :amt
  WHERE account_id = :to;

COMMIT;                -- Atomicity + Durability`}</CodeBlock>
              </div>
              <div>
                <AcidTag letters="ACID" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 24 }}>
                  {[
                    ['From account', txFrom, setTxFrom],
                    ['To account',   txTo,   setTxTo],
                  ].map(([label, val, set]) => (
                    <div key={label}>
                      <label style={LABEL}>{label}</label>
                      <input style={INPUT} value={val} onChange={e => set(e.target.value)} />
                    </div>
                  ))}
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={LABEL}>Amount (USD)</label>
                    <input style={INPUT} type="number" value={txAmt}
                      onChange={e => setTxAmt(Number(e.target.value))} />
                  </div>
                </div>
                <div style={{ marginTop: 20 }}>
                  <RunButton loading={transfer.loading}
                    onClick={() => transfer.run({ from_account: txFrom, to_account: txTo, amount: txAmt })}
                    label="RUN TRANSFER" />
                </div>
                <ResultBox result={transfer.result} error={transfer.error} />
              </div>
            </div>
          </div>
        </div>

        {/* ── REDIS ── */}
        <div style={SECTION} id="REDIS">
          <div style={PAGE}>
            <SectionHeader eyebrow="Demo ⑤ ⑥ · NoSQL" title="Redis Transactions" center />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

              <div style={{ background: 'var(--white)', padding: 36, border: '1px solid var(--cream-dark)' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', letterSpacing: '0.15em', color: 'var(--gold)', marginBottom: 12 }}>DEMO ⑤</p>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--navy)', marginBottom: 16 }}>MULTI / EXEC</h3>
                <p style={{ fontFamily: 'var(--font-light)', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 20, fontSize: '0.95rem' }}>
                  Queue three INCR commands in a pipeline. EXEC runs them atomically — no other client can interleave.
                  Analogous to PostgreSQL's BEGIN/COMMIT.
                </p>
                <CodeBlock>{`MULTI
SET counter 0
INCR counter
INCR counter
INCR counter
EXEC  → [OK, 1, 2, 3]`}</CodeBlock>
                <div style={{ marginTop: 20 }}>
                  <RunButton loading={redis.loading} onClick={redis.run} label="RUN MULTI/EXEC" />
                </div>
                <ResultBox result={redis.result} error={redis.error} />
              </div>

              <div style={{ background: 'var(--white)', padding: 36, border: '1px solid var(--cream-dark)' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', letterSpacing: '0.15em', color: 'var(--gold)', marginBottom: 12 }}>DEMO ⑥</p>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--navy)', marginBottom: 16 }}>DISCARD</h3>
                <p style={{ fontFamily: 'var(--font-light)', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 20, fontSize: '0.95rem' }}>
                  Open a MULTI block, queue a SET command, then DISCARD — the queued commands are cancelled.
                  Counter remains unchanged. Analogous to ROLLBACK in PostgreSQL.
                </p>
                <CodeBlock>{`MULTI
SET counter 9999    ← queued
DISCARD             ← cancelled
GET counter → unchanged`}</CodeBlock>
                <div style={{ marginTop: 20 }}>
                  <RunButton loading={discard.loading} onClick={discard.run} label="RUN DISCARD" />
                </div>
                <ResultBox result={discard.result} error={discard.error} />
              </div>
            </div>
          </div>
        </div>

        {/* ── HISTORY ── */}
        <div style={{ ...SECTION, background: 'var(--white)' }} id="HISTORY">
          <div style={PAGE}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48 }}>
              <SectionHeader eyebrow="Logs" title="Transaction History" />
              <div style={{ display: 'flex', gap: 12, paddingBottom: 24 }}>
                <RunButton loading={histLoad} onClick={loadHistory} label="LOAD HISTORY" />
                <button onClick={doClear} style={{
                  background: 'none', border: '1px solid #c0392b', color: '#c0392b',
                  padding: '13px 28px', fontFamily: 'var(--font-body)',
                  fontSize: '0.72rem', letterSpacing: '0.15em', cursor: 'pointer',
                }}>CLEAR ALL</button>
              </div>
            </div>

            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
                {/* account cards */}
                {stats.accounts.map(a => (
                  <div key={a.account_id} style={{
                    border: '1px solid var(--cream-dark)',
                    padding: '20px 24px', background: 'var(--cream)',
                  }}>
                    <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 8 }}>{a.account_id}</p>
                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--navy)', marginBottom: 4 }}>{a.owner}</p>
                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', color: 'var(--gold)', fontWeight: 700 }}>
                      ${Number(a.balance).toLocaleString()}
                    </p>
                  </div>
                ))}
                {/* demo count */}
                <div style={{
                  border: '1px solid var(--navy)',
                  background: 'var(--navy)', padding: '20px 24px',
                  gridColumn: '3 / -1',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                }}>
                  <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>DEMO RUNS</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {stats.demo_counts.map(r => (
                      <div key={r.demo_type + r.status} style={{ textAlign: 'center' }}>
                        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: 'var(--gold)', fontWeight: 700, lineHeight: 1 }}>{r.count}</p>
                        <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginTop: 4 }}>{r.demo_type}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {history && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                {/* PG log */}
                <div>
                  <p style={{ ...LABEL, marginBottom: 16 }}>PostgreSQL Log ({history.postgres_log.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 360, overflowY: 'auto' }}>
                    {history.postgres_log.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No records yet. Run a demo first.</p>}
                    {history.postgres_log.map(r => (
                      <div key={r.id} style={{
                        display: 'grid', gridTemplateColumns: '100px 1fr auto',
                        gap: 16, padding: '10px 16px',
                        background: r.status === 'committed' ? 'var(--cream)' : r.status === 'rolled_back' ? '#fdf0ef' : '#fefbe8',
                        fontSize: '0.78rem', alignItems: 'center',
                        borderLeft: `3px solid ${r.status === 'committed' ? 'var(--green-ok)' : r.status === 'rolled_back' ? 'var(--red-err)' : 'var(--gold)'}`,
                      }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--navy)', fontWeight: 600 }}>{r.demo_type}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.order_id}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Redis log */}
                <div>
                  <p style={{ ...LABEL, marginBottom: 16 }}>Redis Event Log (last 20)</p>
                  <div style={{
                    background: 'var(--navy-deep)', padding: '16px 20px',
                    fontFamily: 'monospace', fontSize: '0.75rem',
                    maxHeight: 360, overflowY: 'auto',
                  }}>
                    {history.redis_log.length === 0 && <p style={{ color: 'rgba(255,255,255,0.25)' }}>No Redis events yet.</p>}
                    {history.redis_log.map((r, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        <span style={{ color: 'rgba(255,255,255,0.25)' }}>{r.ts.slice(11, 19)}</span>
                        {'  '}
                        <span style={{ color: 'var(--gold)' }}>{r.event}</span>
                        {'  '}
                        <span style={{ color: 'rgba(255,255,255,0.55)' }}>{r.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!history && !histLoad && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-light)', fontSize: '1rem' }}>
                Click <strong>Load History</strong> to view transaction logs
              </div>
            )}
          </div>
        </div>

        {/* ── ACID TABLE ── */}
        <div style={{ ...SECTION, borderBottom: 'none' }}>
          <div style={PAGE}>
            <SectionHeader eyebrow="Reference" title="ACID Properties" center />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)' }}>
              <thead>
                <tr style={{ background: 'var(--navy)' }}>
                  {['Property', 'PostgreSQL', 'Redis', 'Guarantee'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '16px 24px',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '0.65rem', letterSpacing: '0.15em', fontWeight: 500,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACID_TABLE.map((row, i) => (
                  <tr key={row.p} style={{ background: i % 2 === 0 ? 'var(--white)' : 'var(--cream)' }}>
                    <td style={{ padding: '18px 24px', fontFamily: 'var(--font-serif)', fontSize: '1rem', fontWeight: 700, color: 'var(--navy)' }}>{row.p}</td>
                    <td style={{ padding: '18px 24px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-body)' }}>{row.pg}</td>
                    <td style={{ padding: '18px 24px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#b8860b' }}>{row.redis}</td>
                    <td style={{ padding: '18px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-light)' }}>{row.g}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────
function CodeBlock({ children }) {
  return (
    <pre style={{
      background: 'var(--navy-deep)',
      color: 'rgba(255,255,255,0.7)',
      padding: '20px 24px',
      fontFamily: "'Fira Code', 'Cascadia Code', monospace",
      fontSize: '0.78rem',
      lineHeight: 1.7,
      overflow: 'auto',
      borderLeft: '3px solid var(--gold)',
      margin: 0,
    }}>{children}</pre>
  )
}

function AcidTag({ letters }) {
  const MAP = { A: '#b89a6a', C: '#5a7a6a', I: '#4a6a8a', D: '#7a5a8a' }
  const NAMES = { A: 'Atomicity', C: 'Consistency', I: 'Isolation', D: 'Durability' }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {letters.split('').map(l => (
        <span key={l} style={{
          border: `1px solid ${MAP[l] || '#999'}`,
          color: MAP[l] || '#999',
          padding: '4px 12px',
          fontFamily: 'var(--font-body)',
          fontSize: '0.65rem',
          letterSpacing: '0.1em',
        }}>
          {l} · {NAMES[l]}
        </span>
      ))}
    </div>
  )
}
