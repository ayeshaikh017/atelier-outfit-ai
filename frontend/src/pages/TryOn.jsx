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
const KEYS = ['ls', 'rs', 'lh', 'rh', 'lk', 'rk', 'la', 'ra']
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const smooth = (a, b) => {
  if (!a) return b
  const o = { W: b.W, H: b.H }
  KEYS.forEach((k) => { o[k] = { x: a[k].x + (b[k].x - a[k].x) * 0.35, y: a[k].y + (b[k].y - a[k].y) * 0.35, ok: b[k].ok } })
  return o
}
// fit a garment to the detected body. SVGs are stretchable, so width and height are set separately.
function fit(cat, item, p) {
  const sh = mid(p.ls, p.rs), Sw = Math.hypot(p.ls.x - p.rs.x, p.ls.y - p.rs.y)
  const hipOk = p.lh.ok && p.rh.ok
  const Th = hipOk ? Math.max(mid(p.lh, p.rh).y - sh.y, Sw * 0.8) : Sw * 1.4
  const hipY = sh.y + Th
  const hw = Math.max(hipOk ? Math.hypot(p.lh.x - p.rh.x, p.lh.y - p.rh.y) : Sw * 0.8, Sw * 0.7) * 1.3
  const kneeY = p.lk.ok && p.rk.ok ? (p.lk.y + p.rk.y) / 2 : hipY + Th * 0.95
  const ankY = p.la.ok && p.ra.ok ? (p.la.y + p.ra.y) / 2 : hipY + Th * 1.9
  let w, h, top
  if (cat === 'Top' || cat === 'Jacket') {
    w = Sw * (cat === 'Jacket' ? 1.75 : 1.8)
    const t = sh.y - 0.06 * Sw, b = hipY + (cat === 'Jacket' ? 0.28 : 0.15) * Th
    h = ((b - t) / 200) * 240; top = t - (20 / 240) * h
  } else if (cat === 'Dress') {
    w = Sw * 2.15
    const t = sh.y - 0.05 * Sw, b = kneeY + (ankY - kneeY) * 0.15
    h = ((b - t) / 225) * 240; top = t - (10 / 240) * h
  } else {
    const n = item.name.toLowerCase(), skirt = n.includes('skirt'), shorts = n.includes('shorts')
    const waist = hipY - 0.18 * Th
    const end = shorts ? kneeY : skirt ? hipY + (kneeY - hipY) * 0.9 : ankY
    const ch = shorts ? 110 : skirt ? 160 : 225
    w = skirt ? hw * 1.5 * 1.25 : hw * 1.72
    h = ((end - waist) / ch) * 240; top = waist - (10 / 240) * h
  }
  return { x: (sh.x / p.W) * 100, y: (top / p.H) * 100, w: (w / p.W) * 100, h: (h / p.H) * 100 }
}

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
  const [pose, setPose] = useState(null)
  const [auto, setAuto] = useState(true)
  const [poseMsg, setPoseMsg] = useState('')
  const lmRef = useRef(null), raf = useRef(0), lastT = useRef(-1), poseRef = useRef(null)
  const fitted = auto && pose

  useEffect(() => { getCatalog().then(setCatalog).catch((e) => setErr(e.message)); return () => { cancelAnimationFrame(raf.current); streamRef.current?.getTracks().forEach((t) => t.stop()) } }, [])

  const start = async () => {
    setErr('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = s; videoRef.current.srcObject = s; await videoRef.current.play(); setOn(true); initPose()
    } catch (e) { setErr('Camera unavailable. Allow camera permission in your browser (needs localhost or https).') }
  }
  function stop() {
    cancelAnimationFrame(raf.current); streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null; poseRef.current = null; setPose(null); setOn(false)
  }
  const make = (fs, delegate) => window.__PL.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1 })
  const initPose = async () => {
    try {
      if (!lmRef.current) {
        setPoseMsg('Loading body detector…')
        const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
        window.__PL = PoseLandmarker
        const fs = await FilesetResolver.forVisionTasks(WASM)
        lmRef.current = await make(fs, 'GPU').catch(() => make(fs, 'CPU'))
      }
      setPoseMsg(''); loop()
    } catch { setPoseMsg('Body detector could not load (check internet). Manual mode is on.'); setAuto(false) }
  }
  const loop = () => {
    const v = videoRef.current, st = stageRef.current
    if (!v || !st || !streamRef.current) return
    if (v.readyState >= 2 && v.currentTime !== lastT.current) {
      lastT.current = v.currentTime
      const lm = lmRef.current.detectForVideo(v, performance.now()).landmarks?.[0]
      if (lm && (lm[11].visibility ?? 1) > 0.5 && (lm[12].visibility ?? 1) > 0.5) {
        const W = st.clientWidth, H = st.clientHeight
        const s = Math.max(W / v.videoWidth, H / v.videoHeight)
        const ox = (W - v.videoWidth * s) / 2, oy = (H - v.videoHeight * s) / 2
        const P = (i) => ({ x: W - (lm[i].x * v.videoWidth * s + ox), y: lm[i].y * v.videoHeight * s + oy, ok: (lm[i].visibility ?? 1) > 0.5 })
        poseRef.current = smooth(poseRef.current, { W, H, ls: P(11), rs: P(12), lh: P(23), rh: P(24), lk: P(25), rk: P(26), la: P(27), ra: P(28) })
        setPose(poseRef.current)
      } else if (poseRef.current) { poseRef.current = null; setPose(null) }
    }
    raf.current = requestAnimationFrame(loop)
  }
  const geom = (k, L) => {
    if (fitted) return fit(k, L.item, pose)
    const st = stageRef.current, W = st?.clientWidth || 1, H = st?.clientHeight || 1
    return { x: L.x, y: L.y, w: L.w, h: ((L.w / 100) * W * ASPECT / H) * 100 }
  }


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
    if (fitted) return
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
      const fin = () => { if (--left === 0) c.toBlob(resolve, 'image/png') }
      im.onerror = fin
      im.onload = () => {
        const q = geom(k, L), w = (q.w / 100) * W, h = (q.h / 100) * H
        g.drawImage(im, (q.x / 100) * W - w / 2, (q.y / 100) * H, w, h)
        fin()
      }
      im.src = garmentUrl(L.item.image)
    })
  })
  const snap = async () => {
    if (!videoRef.current?.videoWidth) return setErr('Camera is not ready yet')
    const b = await capture(); const a = document.createElement('a')
    a.href = URL.createObjectURL(b); a.download = 'tryon.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
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
                <p>Start the camera, then pick your clothes</p>
                <small>Stand back so your full body is visible</small></div>
            )}
            {on && ['Dress', 'Bottom', 'Top', 'Jacket'].filter((k) => layers[k]).map((k) => {
              const L = layers[k], q = geom(k, L)
              return (
                <img key={k} className={'layer' + (sel === k ? ' sel' : '')} alt={L.item.name}
                  src={garmentUrl(L.item.image)} draggable={false} onPointerDown={(e) => down(e, k)}
                  style={{ left: q.x + '%', top: q.y + '%', width: q.w + '%', height: q.h + '%', pointerEvents: fitted ? 'none' : 'auto' }} />
              )
            })}
          </div>

          <div className="tbar">
            {!on ? <button className="btn" onClick={start}><Camera size={16} /> Start camera</button>
                 : <button className="btn" onClick={stop}><CameraOff size={16} /> Stop</button>}
            <button className="btn" disabled={!on} onClick={snap}><Download size={16} /> Snapshot</button>
            <button className="btn" disabled={!on || busy || !Object.keys(layers).length} onClick={analyse}>
              <Sparkles size={16} /> {busy ? 'Analysing…' : 'Analyse my look'}</button>
            <button className="btn" disabled={!on} onClick={() => setAuto((a) => !a)}>{auto ? 'Auto-fit: On' : 'Auto-fit: Off'}</button>
            <button className="btn" onClick={() => { setLayers({}); setSel(null) }}><RotateCcw size={16} /> Reset</button>
          </div>

          {on && <p className="muted sm">{pose ? '✓ Body detected, clothes follow you. Hold still for best fit.' : (poseMsg || 'Step back so head to knees are visible.')}</p>}
          {sel && layers[sel] && !fitted && (
            <div className="tctl">Size ({sel})
              <input type="range" min="20" max="80" value={layers[sel].w}
                onChange={(e) => patch(sel, { w: +e.target.value })} /></div>
          )}
          <p className="muted sm">Drag a garment to position it · use the slider to resize.</p>
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
