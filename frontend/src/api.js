const B = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'

const j = async (r) => {
  const d = await r.json()
  if (!r.ok) throw new Error(d.error || 'Something went wrong')
  return d
}

export const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

export const analyze = (file) => {
  const f = new FormData(); f.append('image', file)
  return fetch(B + '/api/analyze', { method: 'POST', body: f }).then(j)
}
export const getWardrobe = () => fetch(B + '/api/wardrobe').then(j)
export const addItem = (file, cat, occ) => {
  const f = new FormData()
  f.append('image', file); f.append('cat', cat); f.append('occ', occ.join(','))
  return fetch(B + '/api/wardrobe', { method: 'POST', body: f }).then(j)
}
export const delItem = (id) => fetch(`${B}/api/wardrobe/${id}`, { method: 'DELETE' }).then(j)
export const recommend = (occasion) =>
  fetch(B + '/api/recommend', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ occasion }),
  }).then(j)
export const getInsights = () => fetch(B + '/api/insights').then(j)
export const getCatalog = () => fetch(B + '/api/catalog').then(j)
export const garmentUrl = (f) => `${B}/api/garments/${f}`
