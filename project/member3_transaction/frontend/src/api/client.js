import axios from 'axios'
const api = axios.create({ baseURL: '/api/transaction' })

export const commitDemo    = ()     => api.post('/commit-demo')
export const rollbackDemo  = ()     => api.post('/rollback-demo')
export const savepointDemo = ()     => api.post('/savepoint-demo')
export const transferDemo  = (body) => api.post('/transfer-demo', body)
export const redisMulti    = ()     => api.post('/redis-transaction')
export const redisDiscard  = ()     => api.post('/redis-discard')
export const getHistory    = ()     => api.get('/history')
export const getStats      = ()     => api.get('/stats')
export const clearHistory  = ()     => api.delete('/history/clear')
