import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { getWardrobe, addItem, delItem, recommend, hex } from '../api'

const OCC = ['College', 'Café', 'Casual outing', 'Office', 'Party', 'Gym', 'Date night', 'Interview']

export default function Wardrobe() {
  const [items, setItems] = useState([])
  const [file, setFile] = useState(null)
  const [cat, setCat] = useState('Top')
  const [occ, setOcc] = useState(['College'])
  const [want, setWant] = useState('College')
  const [recs, setRecs] = useState([])
  const [err, setErr] = useState('')

  const load = () => getWardrobe().then(setItems)
  useEffect(() => { load() }, [])

  const toggle = (o) => setOcc((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]))
  const add = async () => {
    if (!file) return setErr('Choose a photo first')
    setErr(''); await addItem(file, cat, occ); setFile(null); load()
  }
  const rec = async () => {
    try { setErr(''); setRecs(await recommend(want)) } catch (e) { setErr(e.message); setRecs([]) }
  }

  return (
    <>
      <div className="page-head"><div className="eyebrow">Virtual wardrobe</div><h2>Your clothes, your combinations</h2></div>
      <div className="two">
        <div className="card">
          <div className="label">Add an item</div>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
          <div className="seg">{['Top', 'Bottom', 'Shoes'].map((c) => (
            <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>))}</div>
          <div className="label">Suitable for</div>
          <div>{OCC.map((o) => <button key={o} className={'tag btn-tag ' + (occ.includes(o) ? 'on' : '')} onClick={() => toggle(o)}>{o}</button>)}</div>
          <button className="btn" style={{ marginTop: 14 }} onClick={add}>Add to wardrobe</button>
          {err && <p className="error">{err}</p>}
        </div>
        <div className="card">
          <div className="label">Wardrobe · {items.length} items</div>
          {items.length === 0 && <p className="muted">Add at least one top and one bottom.</p>}
          <div className="grid4">
            {items.map((it) => (
              <div className="item" key={it.id}>
                <img src={it.img} alt={it.cat} />
                <div className="cap"><span><i className="dot" style={{ background: hex(it.rgb) }} />{it.cat} · {it.cname}</span>
                  <button className="x" onClick={() => delItem(it.id).then(load)}><Trash2 size={14} /></button></div>
              </div>))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="label">Give me an outfit for…</div>
        <div className="row2">
          <select value={want} onChange={(e) => setWant(e.target.value)}>{OCC.map((o) => <option key={o}>{o}</option>)}</select>
          <button className="btn" onClick={rec}>Recommend</button>
        </div>
        {recs.map((r, i) => (
          <div className="rec" key={i}>
            <div className="label">Option {i + 1} · match {Math.round(r.score * 100)}% · harmony {r.harmony_label}</div>
            <div className="row2">{r.items.map((it) => (
              <div className="item small" key={it.id}><img src={it.img} alt="" /><div className="cap">{it.cat} · {it.cname}</div></div>))}</div>
          </div>))}
      </div>
    </>
  )
}