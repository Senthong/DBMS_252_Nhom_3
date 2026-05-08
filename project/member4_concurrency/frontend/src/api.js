import axios from 'axios'

export const api = axios.create({ baseURL: '/api/concurrency' })

// convenience helpers — keep raw axios access via `api` for ad-hoc calls.
export const phenomenaPg = {
  list: () => api.get('/pheno/pg/phenomena').then(r => r.data),
  start: body => api.post('/pheno/pg/start', body).then(r => r.data),
  step: (rid, idx) => api.post(`/pheno/pg/${rid}/step/${idx}`).then(r => r.data),
  state: rid => api.get(`/pheno/pg/${rid}/state`).then(r => r.data),
  abort: rid => api.post(`/pheno/pg/${rid}/abort`).then(r => r.data),
}

export const phenomenaRedis = {
  atomicIncr: n => api.post('/pheno/redis/atomic-incr', null, { params: { n } }).then(r => r.data),
  nonAtomicSet: (n, delay_ms) => api.post('/pheno/redis/non-atomic-set', null, { params: { n, delay_ms } }).then(r => r.data),
  watch: n => api.post('/pheno/redis/watch', null, { params: { n } }).then(r => r.data),
  setnxMutex: px_ms => api.post('/pheno/redis/setnx-mutex', null, { params: { px_ms } }).then(r => r.data),
}

export const sale = {
  strategies: () => api.get('/sale/strategies').then(r => r.data),
  seed: body => api.post('/sale/seed', body).then(r => r.data),
  run: body => api.post('/sale/run', body).then(r => r.data),
  reset: () => api.post('/sale/reset').then(r => r.data),
  runs: limit => api.get('/sale/runs', { params: { limit } }).then(r => r.data),
  stockInfo: () => api.get('/sale/stock-info').then(r => r.data),
  aggregate: () => api.get('/sale/runs/aggregate').then(r => r.data),
  latestPerStrategy: () => api.get('/sale/runs/latest-per-strategy').then(r => r.data),
}

export const inspect = {
  pgLocks: () => api.get('/inspect/pg/locks').then(r => r.data),
  pgActivity: () => api.get('/inspect/pg/activity').then(r => r.data),
  redisClients: () => api.get('/inspect/redis/clients').then(r => r.data),
  redisInfo: () => api.get('/inspect/redis/info').then(r => r.data),
}

export const admin = {
  seed: () => api.post('/admin/seed').then(r => r.data),
  reset: () => api.post('/admin/reset').then(r => r.data),
}
