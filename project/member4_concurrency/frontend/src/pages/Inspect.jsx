import { useEffect, useState } from 'react'
import { inspect } from '../api'

export default function Inspect() {
  const [locks, setLocks] = useState([])
  const [activity, setActivity] = useState([])
  const [clients, setClients] = useState([])
  const [memInfo, setMemInfo] = useState(null)
  const [auto, setAuto] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const [l, a, c, m] = await Promise.all([
          inspect.pgLocks(), inspect.pgActivity(), inspect.redisClients(), inspect.redisInfo(),
        ])
        if (cancelled) return
        setLocks(l); setActivity(a); setClients(c); setMemInfo(m)
      } catch { /* ignore transient errors */ }
    }
    tick()
    if (!auto) return () => { cancelled = true }
    const id = setInterval(tick, 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [auto])

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl shadow-sm border p-3 flex items-center gap-3 text-sm">
        <h2 className="font-bold text-base">Live Inspection</h2>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />
          Auto-refresh (1 s)
        </label>
        <span className="text-xs text-gray-500">
          Memory: {memInfo?.used_memory_human || '—'} / peak {memInfo?.used_memory_peak_human || '—'}
        </span>
      </div>

      <Section title="pg_locks (relation locks)" rows={locks}
        cols={['pid','relation','mode','granted','xid','wait_event','query']} />
      <Section title="pg_stat_activity (non-idle)" rows={activity}
        cols={['pid','state','wait_event_type','wait_event','query','xact_start']} />
      <Section title="redis CLIENT LIST" rows={clients}
        cols={['id','addr','idle','db','name','cmd']} />
    </div>
  )
}

function Section({ title, rows, cols }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-3">
      <h3 className="font-bold text-sm mb-2">{title} <span className="text-xs text-gray-400">({rows.length})</span></h3>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 italic">empty</p>
      ) : (
        <div className="overflow-auto max-h-72">
          <table className="text-xs w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>{cols.map(c => <th key={c} className="border px-2 py-1 text-left">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {cols.map(c => (
                    <td key={c} className="border px-2 py-1 font-mono text-gray-700 max-w-md truncate"
                        title={String(r[c] ?? '')}>
                      {r[c] === true ? '✓' : r[c] === false ? '·' : (r[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
