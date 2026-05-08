import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, Navigate, useParams } from 'react-router-dom'
import { phenomenaPg, phenomenaRedis, admin } from '../api'
import Stepper from '../components/Stepper'
import SessionPanel from '../components/SessionPanel'

const PHENOMENA = [
  { id: 'lost_update',         label: 'Lost Update',         badIso: 'read_committed', badLock: 'none',         fixIso: 'read_committed', fixLock: 'for_update' },
  { id: 'non_repeatable_read', label: 'Non-Repeatable Read', badIso: 'read_committed', badLock: 'none',         fixIso: 'repeatable_read', fixLock: 'none' },
  { id: 'phantom',             label: 'Phantom Read',        badIso: 'read_committed', badLock: 'none',         fixIso: 'repeatable_read', fixLock: 'none' },
  { id: 'write_skew',          label: 'Write Skew',          badIso: 'repeatable_read', badLock: 'none',        fixIso: 'serializable',    fixLock: 'none' },
  { id: 'deadlock',            label: 'Deadlock',            badIso: 'read_committed', badLock: 'none',         fixIso: 'read_committed',  fixLock: 'none', noFix: true },
]

const REDIS_NOTES = {
  lost_update:         'INCR is atomic — never lost. Naive GET/SET reproduces the bug.',
  non_repeatable_read: 'Redis has no transaction snapshots. Two GETs see latest value.',
  phantom:             'No range-locking. SCAN over a moving keyspace can include or skip keys.',
  write_skew:          'WATCH + MULTI/EXEC offers optimistic concurrency.',
  deadlock:            'Single-threaded command loop — multi-key deadlock is impossible.',
}

export default function PhenomenaLab() {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl shadow-sm border p-3 flex flex-wrap gap-2">
        {PHENOMENA.map(p => (
          <NavLink
            key={p.id}
            to={p.id}
            className={({ isActive }) =>
              `text-xs px-3 py-1.5 rounded font-medium ${
                isActive ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`
            }
          >
            {p.label}
          </NavLink>
        ))}
      </div>
      <Routes>
        <Route index element={<Navigate to="lost_update" replace />} />
        <Route path=":id" element={<PhenomenonPage />} />
      </Routes>
    </div>
  )
}

function PhenomenonPage() {
  const { id } = useParams()
  const meta = useMemo(() => PHENOMENA.find(p => p.id === id), [id])
  const [iso, setIso] = useState('read_committed')
  const [lock, setLock] = useState('none')
  const [run, setRun] = useState(null)
  const [doneSet, setDoneSet] = useState(() => new Set())
  const [busySet, setBusySet] = useState(() => new Set())
  const [redisOut, setRedisOut] = useState(null)

  useEffect(() => { reset() }, [id]) // eslint-disable-line

  // Aborting the active run when the tab unmounts (or phenomenon switches)
  // prevents leaked psycopg2 connections from holding row locks indefinitely —
  // those would block subsequent flash-sale runs that touch m4_concurrency.*.
  useEffect(() => {
    return () => {
      const rid = run?.run_id
      if (rid) phenomenaPg.abort(rid).catch(() => {})
    }
  }, [run?.run_id])

  async function start() {
    if (run?.run_id) await phenomenaPg.abort(run.run_id).catch(() => {})
    await admin.reset().catch(() => {})
    const r = await phenomenaPg.start({ phenomenon: id, isolation: iso, lock_mode: lock })
    setRun(r)
    setDoneSet(new Set())
    setBusySet(new Set())
  }
  function reset() {
    if (!meta) return
    setIso(meta.badIso); setLock(meta.badLock)
    setRun(null); setDoneSet(new Set()); setBusySet(new Set()); setRedisOut(null)
  }
  async function step(i) {
    if (!run?.run_id) return
    setBusySet(prev => new Set(prev).add(i))
    try {
      await phenomenaPg.step(run.run_id, i)
      const fresh = await phenomenaPg.state(run.run_id)
      setRun(prev => ({ ...prev, ...fresh }))
      setDoneSet(prev => new Set(prev).add(i))
    } finally {
      setBusySet(prev => { const n = new Set(prev); n.delete(i); return n })
    }
  }
  async function runAll() {
    if (!run) return
    // each session is an independent sequential timeline; fire both in parallel
    const bySession = { 1: [], 2: [] }
    run.steps.forEach((s) => {
      if (!doneSet.has(s.idx ?? run.steps.indexOf(s))) bySession[s.session].push(s.idx)
    })
    async function seq(indices) { for (const i of indices) await step(i) }
    await Promise.all([seq(bySession[1]), seq(bySession[2])])
  }
  async function applyFix() {
    if (!meta || meta.noFix) return
    setIso(meta.fixIso); setLock(meta.fixLock)
    setTimeout(() => start(), 50)
  }
  async function fullReset() {
    if (run?.run_id) await phenomenaPg.abort(run.run_id).catch(() => {})
    await admin.reset().catch(() => {})
    reset()
  }

  if (!meta) return <p>Unknown phenomenon</p>

  const steps = run?.steps || []

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-bold">{meta.label}</h2>
          <p className="text-xs text-gray-500">{run?.phenomenon ? `phenomenon=${run.phenomenon}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 items-center text-xs">
          <Knob label="Isolation" value={iso} onChange={setIso}
            options={['read_committed','repeatable_read','serializable']} />
          <Knob label="Lock mode" value={lock} onChange={setLock}
            options={['none','for_update']} />
          <button className="bg-red-600 text-white px-3 py-1.5 rounded" onClick={start}>
            Start run
          </button>
          {run?.run_id && (
            <>
              <button className="bg-gray-200 px-3 py-1.5 rounded" onClick={runAll} disabled={!run}>
                Run remaining
              </button>
              {!meta.noFix && (
                <button className="bg-emerald-600 text-white px-3 py-1.5 rounded" onClick={applyFix}>
                  Apply fix ({meta.fixIso}{meta.fixLock !== 'none' ? ' + ' + meta.fixLock : ''})
                </button>
              )}
              <button className="bg-gray-300 text-gray-800 px-3 py-1.5 rounded" onClick={fullReset}>
                Reset
              </button>
              <span className="text-gray-500">run_id: {run.run_id}</span>
            </>
          )}
        </div>
      </div>

      {run?.run_id && (
        <>
          <div className="bg-white rounded-xl shadow-sm border p-3">
            <h3 className="text-sm font-bold mb-2">Steps (per session)</h3>
            <Stepper steps={steps} doneSet={doneSet} busySet={busySet} onStep={step} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SessionPanel sessionId={1} history={run.sessions?.[1]?.history || []} />
            <SessionPanel sessionId={2} history={run.sessions?.[2]?.history || []} />
          </div>
        </>
      )}

      <RedisPane id={id} out={redisOut} setOut={setRedisOut} />
    </div>
  )
}

function Knob({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-gray-600">{label}:</span>
      <select className="border rounded px-1 py-0.5" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function RedisPane({ id, out, setOut }) {
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    try {
      let res
      if (id === 'lost_update') res = await phenomenaRedis.atomicIncr(100)
      else if (id === 'write_skew') res = await phenomenaRedis.watch(20)
      else if (id === 'deadlock') res = await phenomenaRedis.setnxMutex(150)
      else res = await phenomenaRedis.nonAtomicSet(50, 5)
      setOut(res)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">Redis comparison</h3>
          <p className="text-xs text-amber-900 mt-1">{REDIS_NOTES[id] || ''}</p>
        </div>
        <button className="bg-amber-600 text-white px-3 py-1.5 rounded text-xs" onClick={go} disabled={busy}>
          {busy ? 'Running…' : 'Run Redis demo'}
        </button>
      </div>
      {out && (
        <pre className="mt-3 bg-white border p-2 rounded text-xs overflow-auto">
{JSON.stringify(out, null, 2)}
        </pre>
      )}
    </div>
  )
}
