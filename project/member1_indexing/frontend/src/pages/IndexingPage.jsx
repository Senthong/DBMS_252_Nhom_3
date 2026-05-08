import { useState } from 'react'
import axios from 'axios'

export default function IndexingPage() {
    const [orderId, setOrderId] = useState('')
    const [result, setResult] = useState(null)
    const [plan, setPlan] = useState(null)

    const benchmark = async () => {
        const res = await axios.get(`/api/indexing/benchmark?order_id=${orderId}`)
        setResult(res.data)
    }
    const explain = async () => {
        const res = await axios.get('/api/indexing/explain')
        setPlan(res.data.plan)
    }
    const createIndex = async () => {
        const res = await axios.post('/api/indexing/create-index')
        alert(res.data.message)
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-purple-700">Topic II – Indexing</h1>

        <div className="bg-white rounded-xl shadow p-4 mb-4">
            <h2 className="font-semibold mb-2">Benchmark: with vs without index</h2>
            <input className="border rounded px-3 py-1 mr-2 w-64" placeholder="Enter order_id"
            value={orderId} onChange={e => setOrderId(e.target.value)} />
            <button className="bg-purple-600 text-white px-4 py-1 rounded" onClick={benchmark}>Run</button>
            {result && (
            <div className="mt-3 text-sm">
                <p>No index: <strong>{result.no_index_ms} ms</strong></p>
                <p>With index: <strong>{result.with_index_ms} ms</strong></p>
            </div>
            )}
        </div>

        <div className="bg-white rounded-xl shadow p-4 mb-4">
            <h2 className="font-semibold mb-2">EXPLAIN ANALYZE</h2>
            <button className="bg-blue-600 text-white px-4 py-1 rounded" onClick={explain}>Show Plan</button>
            {plan && <pre className="mt-3 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-48">{plan.join('\n')}</pre>}
        </div>

        <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-2">Create B-tree Index</h2>
            <button className="bg-green-600 text-white px-4 py-1 rounded" onClick={createIndex}>Create Index</button>
        </div>
        </div>
    )
}