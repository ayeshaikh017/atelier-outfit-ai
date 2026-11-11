import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Download, RotateCcw, Sparkles } from 'lucide-react'
import { getCatalog, garmentUrl, analyze } from '../api'

// default position/size (in % of the camera frame) for each category
const DEF = {
  Top:    { x: 50, y: 24, w: 46 },
  Jacket: { x: 50, y: 22, w: 54 },
  Dress:  { x: 50, y: 24, w: 46 },
  Bottom: { x: 50, y: 52, w: 36 },
}
const ASPECT = 240 / 200 // garment svg height / width

export default function TryOn({ onResult, go }) {
  const videoRef = useRef(null), stageRef = useRef(null), streamRef = useRef(null)
  const drag = useRef(null)
  const [on, setOn] = useState(false)
  const [err, setErr] = useState('')
  const [catalog, setCatalog] = useState(null)
  const [filter, setFilter] = useState('All')
  const [layers, setLayers] = useState({})   // cat -> {item, x, y, w}
  const [sel, setSel] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { getCatalog().then(setCatalog).catch((e) => setErr(e.message)); return stop }, [])

  const start = async () => {
    setErr('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = s; videoRef.current.srcObject = s; await videoRef.current.play(); setOn(true)
    } catch (e) { setErr('Camera access nahi mila. Browser me permission allow karo (localhost ya https chahiye).') }
  }
  function stop() { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setOn(false) }

  const pickItem = (item) => {
    setLayers((L) => {
      const n = { ...L }
      if (item.cat === 'Dress') { delete n.Top; delete n.Bottom } else if (item.cat === 'Top' || item.cat === 'Bottom') delete n.Dress
      n[item.cat] = { item, ...DEF[item.cat] }
      return n
    })
    setSel(item.cat)
  }
  const patch = (cat, p) => setLayers((L) => ({ ...L, [cat]: { ...L[cat], ...p } }))

  // drag a garment
  const down = (e, cat) => {
    e.preventDefault(); setSel(cat); e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { cat, sx: e.clientX, sy: e.clientY, ox: layers[cat].x, oy: layers[cat].y }
  }
  const move = (e) => {
    const d = drag.current; if (!d) return
    const r = stageRef.current.getBoundingClientRect()
    patch(d.cat, { x: d.ox + ((e.clientX - d.sx) / r.width) * 100, y: d.oy + ((e.clientY - d.sy) / r.height) * 100 })
  }
  const up = () => { drag.current = null }

  // draw camera + clothes into one canvas
  const capture = () => new Promise((resolve) => {
    const st = stageRef.current, v = videoRef.current
    const W = st.clientWidth, H = st.clientHeight
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d')
    const vr = v.videoWidth / v.videoHeight, sr = W / H
    let sw = v.videoWidth, sh = v.videoHeight, sx = 0, sy = 0
    if (vr > sr) { sw = sh * sr; sx = (v.videoWidth - sw) / 2 } else { sh = sw / sr; sy = (v.videoHeight - sh) / 2 }
    g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(v, sx, sy, sw, sh, 0, 0, W, H); g.restore()
    const order = ['Dress', 'Bottom', 'Top', 'Jacket'].filter((k) => layers[k])
    let left = order.length
    if (!left) return c.toBlob(resolve, 'image/png')
    order.forEach((k) => {
      const L = layers[k], im = new Image(); im.crossOrigin = 'anonymous'
      im.onload = () => {
        const w = (L.w / 100) * W, h = w * ASPECT
        g.drawImage(im, (L.x / 100) * W - w / 2, (L.y / 100) * H, w, h)
        if (--left === 0) c.toBlob(resolve, 'image/png')
      }
      im.src = garmentUrl(L.item.image)
    })
  })
  const snap = async () => {
    const b = await capture(); const a = document.createElement('a')
    a.href = URL.createObjectURL(b); a.download = 'tryon.png'; a.click()
  }
  const analyse = async () => {
    setBusy(true); setErr('')
    try {
      const b = await capture(); const f = new File([b], 'tryon.png', { type: 'image/png' })
      onResult(await analyze(f), URL.createObjectURL(f)); go('analyzer')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const items = catalog ? catalog.items.filter((i) => filter === 'All' || i.cat === filter) : []
  const total = Object.values(layers).reduce((s, l) => s + l.item.price, 0)

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">{catalog ? catalog.brand : 'Brand'} · Virtual Try-On</div>
        <h2>Try before you buy</h2>
      </div>
      <div className="tryon">
        <div>
          <div className="stage" ref={stageRef} onPointerMove={move} onPointerUp={up}>
            <video ref={videoRef} playsInline muted />
            {!on && (
              <div className="ph"><Camera size={34} />
                <p>Camera start karo, phir kapde chuno</p>
                <small>Stand back so your full body is visible</small></div>
            )}
            {on && ['Dress', 'Bottom', 'Top', 'Jacket'].filter((k) => layers[k]).map((k) => {
              const L = layers[k]
              return (
                <img key={k} className={'layer' + (sel === k ? ' sel' : '')} alt={L.item.name}
                  src={garmentUrl(L.item.image)} draggable={false} onPointerDown={(e) => down(e, k)}
                  style={{ left: L.x + '%', top: L.y + '%', width: L.w + '%' }} />
              )
            })}
          </div>

          <div className="tbar">
            {!on ? <button className="btn" onClick={start}><Camera size={16} /> Start camera</button>
                 : <button className="btn" onClick={stop}><CameraOff size={16} /> Stop</button>}
            <button className="btn" disabled={!on} onClick={snap}><Download size={16} /> Snapshot</button>
            <button className="btn" disabled={!on || busy || !Object.keys(layers).length} onClick={analyse}>
              <Sparkles size={16} /> {busy ? 'Analysing…' : 'Analyse my look'}</button>
            <button className="btn" onClick={() => { setLayers({}); setSel(null) }}><RotateCcw size={16} /> Reset</button>
          </div>

          {sel && layers[sel] && (
            <div className="tctl">Size ({sel})
              <input type="range" min="20" max="80" value={layers[sel].w}
                onChange={(e) => patch(sel, { w: +e.target.value })} /></div>
          )}
          <p className="muted sm">Kapde ko drag karke adjust karo · slider se size badlo.</p>
          {err && <p className="error">{err}</p>}
        </div>

        <div>
          <div className="card">
            <div className="label">{catalog ? catalog.brand : ''} collection</div>
            <div className="chips">
              {['All', 'Top', 'Bottom', 'Dress', 'Jacket'].map((c) => (
                <button key={c} className={'chipb' + (filter === c ? ' on' : '')} onClick={() => setFilter(c)}>{c}</button>
              ))}
            </div>
            <div className="cgrid">
              {items.map((i) => (
                <button key={i.id} className={'citem' + (layers[i.cat]?.item.id === i.id ? ' on' : '')} onClick={() => pickItem(i)}>
                  <img src={garmentUrl(i.image)} alt={i.name} />
                  <b>{i.name}</b><small>₹{i.price} · {i.style}</small>
                </button>
              ))}
            </div>
          </div>
          {total > 0 && <div className="card"><div className="label">Selected look</div>
            {Object.values(layers).map((l) => <div key={l.item.id} className="piece"><div className="nm">{l.item.name}</div><span className="pill ok">₹{l.item.price}</span></div>)}
            <h3>Total ₹{total}</h3></div>}
        </div>
      </div>
    </>
  )
}
