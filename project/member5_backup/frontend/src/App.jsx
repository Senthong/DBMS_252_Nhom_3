import { useState } from 'react'
import axios from 'axios'

export default function App() {
  const [backups, setBackups] = useState([])
  const [log, setLog] = useState([])
  const [redisInfo, setRedisInfo] = useState(null)

  const addLog = (label, data) => setLog(prev => [{ label, data, ts: new Date().toLocaleTimeString() }, ...prev.slice(0,9)])

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-blue-700">Topic VI – Backup & Recovery</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="font-semibold mb-3">PostgreSQL Backup</h2>
        <div className="flex gap-2 mb-3">
          <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
            onClick={async () => { const r = await axios.post('/api/backup/pg-dump'); addLog('pg_dump', r.data) }}>
            pg_dump
          </button>
          <button className="bg-gray-500 text-white px-3 py-1 rounded text-sm"
            onClick={async () => { const r = await axios.get('/api/backup/list-backups'); setBackups(r.data) }}>
            List backups
          </button>
        </div>
        {backups.length > 0 && (
          <table className="text-xs w-full border-collapse">
            <thead><tr><th className="border px-2 py-1 bg-gray-100 text-left">File</th><th className="border px-2 py-1 bg-gray-100">Size</th><th className="border px-2 py-1 bg-gray-100">Action</th></tr></thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.name}>
                  <td className="border px-2 py-1">{b.name}</td>
                  <td className="border px-2 py-1 text-center">{b.size_kb} KB</td>
                  <td className="border px-2 py-1 text-center">
                    <button className="text-red-600 underline"
                      onClick={async () => { const r = await axios.post(`/api/backup/pg-restore/${b.name}`); addLog('pg_restore', r.data) }}>
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="font-semibold mb-3">Redis Backup</h2>
        <div className="flex gap-2 mb-3">
          <button className="bg-red-600 text-white px-3 py-1 rounded text-sm"
            onClick={async () => { const r = await axios.post('/api/backup/redis-bgsave'); addLog('BGSAVE', r.data) }}>
            BGSAVE (RDB)
          </button>
          <button className="bg-orange-500 text-white px-3 py-1 rounded text-sm"
            onClick={async () => { const r = await axios.post('/api/backup/redis-aof-rewrite'); addLog('AOF rewrite', r.data) }}>
            AOF Rewrite
          </button>
          <button className="bg-gray-500 text-white px-3 py-1 rounded text-sm"
            onClick={async () => { const r = await axios.get('/api/backup/redis-info'); setRedisInfo(r.data) }}>
            Redis Info
          </button>
        </div>
        {redisInfo && <pre className="text-xs bg-gray-100 p-2 rounded">{JSON.stringify(redisInfo, null, 2)}</pre>}
      </div>

      <div className="space-y-2">
        {log.map((l,i) => (
          <div key={i} className="bg-white rounded-lg shadow p-3 text-xs">
            <span className="font-semibold text-blue-700">{l.label}</span>
            <span className="text-gray-400 ml-2">{l.ts}</span>
            <pre className="mt-1 text-gray-700">{JSON.stringify(l.data, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}
