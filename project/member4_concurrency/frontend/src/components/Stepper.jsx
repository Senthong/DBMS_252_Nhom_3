/** Per-session step button rows.

Sessions interleave and one session's step can block (row-lock wait) while the
other session continues. So instead of enforcing a single linear progression,
enable any step whose *same-session* predecessor is done. */
export default function Stepper({ steps, doneSet, busySet, onStep }) {
  const sessions = [1, 2]
  return (
    <div className="space-y-2">
      {sessions.map(sid => {
        const owned = steps.map((s, i) => ({ ...s, i }))
                           .filter(s => s.session === sid)
        return (
          <div key={sid} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-600 w-12">S{sid}</span>
            {owned.map((s, ord) => {
              const done = doneSet.has(s.i)
              const busy = busySet.has(s.i)
              // ready iff prior same-session step is done (or this is the first one)
              const prevDone = ord === 0 || doneSet.has(owned[ord - 1].i)
              const ready = prevDone && !done && !busy
              return (
                <button
                  key={s.i}
                  disabled={!ready}
                  onClick={() => onStep(s.i)}
                  className={`text-xs px-2.5 py-1.5 rounded font-mono border ${
                    done
                      ? 'bg-green-100 text-green-800 border-green-300'
                      : busy
                      ? 'bg-yellow-200 text-yellow-900 border-yellow-400 animate-pulse'
                      : ready
                      ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`}
                  title={s.sql || s.label}
                >
                  {s.i + 1}. {s.label || s.kind}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
