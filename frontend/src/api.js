const B = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'

const net = (u, o) => fetch(u, o).catch(() => { throw new Error('Cannot reach the server. Run "python app.py" first.') })
const j = async (r) => {
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'Something went wrong')
  return d
}

export const plotUrl = (n) => `${B}/api/plots/${n}`
export const health = () => net(B + '/api/health').then(j)
export const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

export const analyze = (file) => {
  const f = new FormData(); f.append('image', file)
  return net(B + '/api/analyze', { method: 'POST', body: f }).then(j)
}
export const getWardrobe = () => net(B + '/api/wardrobe').then(j)
export const addItem = (file, cat, occ) => {
  const f = new FormData()
  f.append('image', file); f.append('cat', cat); f.append('occ', occ.join(','))
  return net(B + '/api/wardrobe', { method: 'POST', body: f }).then(j)
}
export const delItem = (id) => net(`${B}/api/wardrobe/${id}`, { method: 'DELETE' }).then(j)
export const recommend = (occasion) =>
  net(B + '/api/recommend', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ occasion }),
  }).then(j)
export const getInsights = () => net(B + '/api/insights').then(j)
export const getCatalog = () => net(B + '/api/catalog').then(j)
export const garmentUrl = (f) => `${B}/api/garments/${f}`
