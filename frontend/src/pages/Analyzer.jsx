import { useState, useRef } from 'react'
import { Upload, Trash2 } from 'lucide-react'
import { analyze, hex } from '../api'

export default function Analyzer({ analysis: R, preview, onResult, onClear }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [over, setOver] = useState(false)
  const last = useRef(null)

  const pick = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setErr('Please choose an image file')
    setErr(''); setLoading(true)
    try {
      const res = await analyze(file)
      if (last.current) URL.revokeObjectURL(last.current)
      last.current = URL.createObjectURL(file); onResult(res, last.current)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const zones = R ? (R.is_dress ? ['top', 'shoes'] : ['top', 'bottom', 'shoes']) : []

  return (
    <>
      <div className="page-head"><div className="eyebrow">Outfit Analyzer</div><h2>Upload your look</h2></div>
      <div className="two">
        <div>
          <label className={'drop' + (over ? ' over' : '') + (loading ? ' busy' : '')}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]) }}>
            <input type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }} />
            {preview ? <img src={preview} alt="outfit" /> : (
              <div className="drop-empty"><Upload size={28} />
                <p>Click or drop a full-body photo</p>
                <small>Stand straight · plain background · good light</small></div>)}
          </label>
          {preview && !loading && <button className="btn ghost" onClick={() => { setErr(''); onClear() }}><Trash2 size={15} /> Remove photo</button>}
          {loading && <div className="progress"><i /></div>}
          {err && <p className="error">{err}</p>}
        </div>

        <div>
          {!R && <div className="card"><div className="label">Result</div><p className="muted">Your analysis will appear here.</p>{loading && <div className="skel" />}</div>}
          {R && (
            <>
              <div className="row2 stagger">
                <div className="card center">
                  <div className="ring" style={{ '--p': R.score * 10 }}><span>{R.score}<small>/10</small></span></div>
                  <div className="label" style={{ marginTop: 12 }}>Outfit score</div>
                </div>
                <div className="card grow">
                  <div className="label">Style</div>
                  <h3>{R.style} <span className="muted sm">/ {R.style2}</span></h3>
                  <div className="label">Colour combination</div>
                  <span className={'pill ' + (R.harmony_label === 'Good' ? 'ok' : 'warn')}>{R.harmony_label} · {R.harmony.toFixed(2)}</span>{' '}
                  <span className="pill lav">{R.palette} palette</span>
                </div>
              </div>

              <div className="card">
                <div className="label">Detected pieces</div>
                {zones.map((z) => {
                  const d = R.zones[z]; const ok = d.status === 'Confident'
                  return (
                    <div className="piece" key={z}>
                      <div className="sw" style={{ background: hex(d.rgb) }} />
                      <div className="zone">{z}</div>
                      <div className="nm">{ok ? d.name : `Not sure, maybe ${d.name}`}</div>
                      <span className={'pill ' + (ok ? 'ok' : 'warn')}>{Math.round(d.conf * 100)}% · {d.status}</span>
                    </div>
                  )
                })}
              </div>

              <div className="card">
                <div className="label">Colour palette (top)</div>
                <div className="palette">
                  {R.zones.top.colors.map(([c, w], i) => (
                    <div key={i} style={{ background: hex(c), flex: w }} title={`${Math.round(w * 100)}%`} />
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="label">Best for</div>
                {R.occasions.map((o) => <span className="tag" key={o}>{o}</span>)}
              </div>
              <div className="card"><div className="label">Suggestion</div><div className="tip">{R.suggestion}</div></div>
            </>
          )}
        </div>
      </div>
    </>
  )
}