import { useEffect, useState } from 'react'
import { sale } from '../api'

export default function Compare() {
  const [latest, setLatest] = useState([])
  const [agg, setAgg] = useState([])
  const [copied, setCopied] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)

  async function refresh() {
    const [l, a] = await Promise.all([sale.latestPerStrategy(), sale.aggregate()])
    setLatest(l); setAgg(a); setUpdatedAt(new Date())
  }
  // Auto-refresh every 3s so new sales run on the FlashSale tab show up here
  // without the user having to remember the manual Refresh button.
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [])

  const md = buildMarkdown(latest, agg)

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Comparison Report</h2>
          <div className="flex gap-2">
            <button onClick={refresh} className="bg-gray-200 px-3 py-1.5 rounded text-xs">Refresh</button>
            <button
              onClick={() => { navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
              className="bg-red-600 text-white px-3 py-1.5 rounded text-xs"
            >
              {copied ? 'Copied!' : 'Copy markdown'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Auto-generated from <code>/sale/runs/latest-per-strategy</code> and <code>/sale/runs/aggregate</code>.
          {updatedAt && <span className="ml-2">— updated {updatedAt.toLocaleTimeString()} (auto every 3s)</span>}
        </p>
      </div>

      <Block title="Latest run per strategy" rows={latest}
        cols={['strategy','buyers','sold','oversold','p99_ms']} />
      <Block title="Aggregate (avg across runs)" rows={agg}
        cols={['strategy','runs','avg_p99_ms','avg_oversold']} />

      <div className="bg-gray-900 text-green-200 rounded-xl p-4 text-xs font-mono whitespace-pre overflow-auto">
{md}
      </div>
    </div>
  )
}

function Block({ title, rows, cols }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-3">
      <h3 className="text-sm font-bold mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 italic">no data — run some sales first</p>
      ) : (
        <table className="text-xs w-full">
          <thead className="bg-gray-50">
            <tr>{cols.map(c => <th key={c} className="border px-2 py-1 text-left">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {cols.map(c => <td key={c} className="border px-2 py-1 font-mono">{String(r[c] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function buildMarkdown(latest, agg) {
  const lines = ['## Concurrency strategies — comparison', '']
  if (latest.length) {
    lines.push('### Latest run per strategy', '')
    lines.push('| strategy | buyers | sold | oversold | p99 (ms) |')
    lines.push('|---|---:|---:|---:|---:|')
    for (const r of latest) {
      lines.push(`| ${r.strategy} | ${r.buyers} | ${r.sold} | ${r.oversold} | ${r.p99_ms} |`)
    }
    lines.push('')
  }
  if (agg.length) {
    lines.push('### Average across all runs', '')
    lines.push('| strategy | runs | avg p99 (ms) | avg oversold |')
    lines.push('|---|---:|---:|---:|')
    for (const r of agg) {
      lines.push(`| ${r.strategy} | ${r.runs} | ${r.avg_p99_ms} | ${r.avg_oversold} |`)
    }
    lines.push('')
  }
  if (!latest.length && !agg.length) lines.push('_(no data yet — run some flash sales first)_')
  return lines.join('\n')
}
