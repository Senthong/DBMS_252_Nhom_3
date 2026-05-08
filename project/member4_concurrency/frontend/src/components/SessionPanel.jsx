/** One side of the side-by-side phenomena lab — shows the history of one session. */
export default function SessionPanel({ sessionId, history }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-3">
      <h3 className="font-bold text-sm mb-2 text-gray-700">Session {sessionId}</h3>
      {history.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No steps run yet.</p>
      ) : (
        <ol className="space-y-1.5 text-xs">
          {history.map((h, i) => (
            <li key={i} className="border-l-2 border-gray-200 pl-2">
              <div className="font-mono text-gray-700">
                {h.order != null && (
                  <span className="inline-block bg-purple-100 text-purple-800 px-1.5 rounded text-[10px] font-bold mr-1.5 align-middle">
                    #{h.order}
                  </span>
                )}
                {h.kind === 'sql' ? h.sql : h.kind.toUpperCase()}
              </div>
              {h.error ? (
                <div className="text-red-700 font-semibold">⚠ {h.error}</div>
              ) : h.rows ? (
                <div className="text-blue-700">
                  → {Array.isArray(h.rows) ? JSON.stringify(h.rows) : String(h.rows)}
                </div>
              ) : null}
              {h.txid && <div className="text-gray-400">txid={h.txid}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
