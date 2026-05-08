export default function Overview() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h2 className="text-xl font-bold mb-2">What this app demonstrates</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Concurrency control across two databases — <b>PostgreSQL 15</b> (MVCC, isolation
          levels, row locks) and <b>Redis 7</b> (single-thread atomicity, WATCH, distributed
          mutex) — using the Olist e-commerce dataset.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Phenomena Lab">
          <p>
            Reproduce the five canonical concurrency anomalies <i>live</i> on Postgres,
            then toggle isolation / lock mode and watch the bug disappear. Each phenomenon
            ships with the matching Redis behavior side-by-side.
          </p>
          <ul className="list-disc ml-5 mt-2 text-sm text-gray-600">
            <li>Lost update — RC vs SELECT FOR UPDATE</li>
            <li>Non-repeatable read — RC vs REPEATABLE READ</li>
            <li>Phantom read — RC vs PG snapshot RR (stronger than SQL standard)</li>
            <li>Write skew — RR vs SERIALIZABLE (SSI)</li>
            <li>Deadlock — auto-detected by PG with SQLSTATE 40P01</li>
          </ul>
        </Card>

        <Card title="Flash Sale Simulator">
          <p>
            Spawn N concurrent buyers against a shared stock counter using one of seven
            strategies — four PG, three Redis. Compare oversells, latency p99, and the
            resulting stock to decide which is fit for production.
          </p>
          <ul className="list-disc ml-5 mt-2 text-sm text-gray-600">
            <li>pg_no_lock <span className="text-red-600">(broken)</span></li>
            <li>pg_for_update / pg_serializable / pg_optimistic (fixed)</li>
            <li>redis_decr / redis_watch / redis_setnx_pg (fixed)</li>
          </ul>
        </Card>

        <Card title="Live Inspection">
          <p>
            Auto-refreshing tables for <code>pg_locks</code>, <code>pg_stat_activity</code>,
            and Redis <code>CLIENT LIST</code>. Pop this open during a sale to watch
            row locks build up and clear.
          </p>
        </Card>

        <Card title="Comparison Report">
          <p>
            Auto-generated markdown summary of the latest run-per-strategy plus an
            aggregate table — paste straight into the team report.
          </p>
        </Card>
      </div>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-5 text-sm">
      <h3 className="font-bold text-base mb-2">{title}</h3>
      {children}
    </div>
  )
}
