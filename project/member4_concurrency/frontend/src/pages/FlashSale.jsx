import { useEffect, useState } from 'react'
import { sale } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'

const STRATEGY_COLORS = {
  pg_no_lock:        '#dc2626',
  pg_for_update:     '#2563eb',
  pg_serializable:   '#7c3aed',
  pg_optimistic:     '#0891b2',
  redis_decr:        '#16a34a',
  redis_watch:       '#65a30d',
  redis_setnx_pg:    '#ea580c',
}

const OUTCOME_COLOR = {
  sold:     '#16a34a',
  oversold: '#dc2626',
  rejected: '#9ca3af',
  error:    '#000000',
}

export default function FlashSale() {
  const [strategies, setStrategies] = useState([])
  const [strategy, setStrategy] = useState('pg_no_lock')
  const [buyers, setBuyers] = useState(25)
  const [stock, setStock] = useState(10)
  const [running, setRunning] = useState(false)
  const [last, setLast] = useState(null)
  const [history, setHistory] = useState([])
  const [stockInfo, setStockInfo] = useState(null)

  useEffect(() => {
    sale.strategies().then(d => setStrategies(d.strategies || []))
    sale.runs(50).then(setHistory)
    sale.stockInfo().then(rows => setStockInfo(rows[0]))
  }, [])

  // Clear stale result card when strategy changes — avoids showing the
  // previous strategy's outcome while user thinks they're seeing the new one.
  useEffect(() => { setLast(null) }, [strategy])

  async function run() {
    setRunning(true)
    try {
      const res = await sale.run({ strategy, buyers, stock_init: stock })
      setLast(res)
      const newHist = await sale.runs(50)
      setHistory(newHist)
    } finally { setRunning(false) }
  }
  async function reset() {
    await sale.reset()
    setLast(null)
    setHistory([])
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h2 className="text-lg font-bold mb-2">Flash Sale Simulator</h2>
        {stockInfo && (
          <p className="text-xs text-gray-600 mb-3">
            Target product: <code className="bg-gray-100 px-1">{stockInfo.product_id}</code>
            {' '}— category <i>{stockInfo.product_category_name || '(uncategorized)'}</i>
          </p>
        )}
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <label className="flex items-center gap-2">
            Strategy
            <select className="border rounded px-2 py-1" value={strategy}
                    onChange={e => setStrategy(e.target.value)}>
              {strategies.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <Slider label="Buyers" value={buyers} setValue={setBuyers} min={1} max={100} />
          <Slider label="Stock"  value={stock}  setValue={setStock}  min={1} max={50} />
          <button className="bg-red-600 text-white px-4 py-1.5 rounded" onClick={run} disabled={running}>
            {running ? 'Running…' : 'Run sale'}
          </button>
          <button className="bg-gray-200 px-3 py-1.5 rounded text-xs" onClick={reset}>
            Reset all runs
          </button>
        </div>
      </div>

      {last && <RunResult res={last} />}

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="text-sm font-bold mb-2">Cumulative comparison</h3>
        <CompareTable history={history} />
      </div>
    </div>
  )
}

function Slider({ label, value, setValue, min, max }) {
  return (
    <label className="flex items-center gap-2">
      {label}
      <input type="range" min={min} max={max} value={value}
             onChange={e => setValue(Number(e.target.value))} className="w-32" />
      <span className="font-mono text-gray-700 w-8 text-right">{value}</span>
    </label>
  )
}

function RunResult({ res }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <Metric label="strategy" value={res.strategy} />
        <Metric label="sold" value={res.sold} good={res.oversold === 0} />
        <Metric label="oversold" value={res.oversold} bad={res.oversold > 0} />
        <Metric label="rejected" value={res.rejected} />
        <Metric label="stock_after" value={res.stock_after} bad={res.stock_after < 0} />
        <Metric label="elapsed" value={`${res.elapsed_ms} ms`} />
        <Metric label="p50" value={`${res.p50_ms} ms`} />
        <Metric label="p99" value={`${res.p99_ms} ms`} />
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={res.timeline}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="buyer" />
            <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Bar dataKey="ms">
              {res.timeline.map((t, i) => (
                <Cell key={i} fill={OUTCOME_COLOR[t.outcome] || '#888'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-gray-600 flex gap-4">
        <Legend color={OUTCOME_COLOR.sold}>sold</Legend>
        <Legend color={OUTCOME_COLOR.oversold}>oversold</Legend>
        <Legend color={OUTCOME_COLOR.rejected}>rejected</Legend>
      </div>
    </div>
  )
}

function Metric({ label, value, good, bad }) {
  return (
    <div className={`px-3 py-1 rounded ${
      bad ? 'bg-red-100 text-red-800' : good ? 'bg-green-100 text-green-800' : 'bg-gray-100'
    }`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-mono font-semibold">{value}</div>
    </div>
  )
}

function Legend({ color, children }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded" style={{ background: color }} />
      {children}
    </span>
  )
}

function CompareTable({ history }) {
  if (!history?.length) return <p className="text-xs text-gray-500">No runs yet — hit “Run sale” above.</p>
  return (
    <div className="overflow-auto">
      <table className="text-xs w-full">
        <thead className="bg-gray-50">
          <tr>
            {['id','strategy','buyers','stock','sold','oversold','elapsed_ms','p99_ms','notes'].map(h => (
              <th key={h} className="border px-2 py-1 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="border px-2 py-1 font-mono text-gray-500">{r.id}</td>
              <td className="border px-2 py-1 font-semibold"
                  style={{ color: STRATEGY_COLORS[r.strategy] || 'inherit' }}>
                {r.strategy}
              </td>
              <td className="border px-2 py-1">{r.buyers}</td>
              <td className="border px-2 py-1">{r.initial_stock}</td>
              <td className="border px-2 py-1">{r.sold}</td>
              <td className={`border px-2 py-1 ${r.oversold > 0 ? 'bg-red-50 text-red-700 font-bold' : ''}`}>
                {r.oversold}
              </td>
              <td className="border px-2 py-1">{r.elapsed_ms}</td>
              <td className="border px-2 py-1">{r.p99_ms}</td>
              <td className="border px-2 py-1 text-gray-500">{r.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
