import { useState } from 'react'
import { Upload } from 'lucide-react'
import { analyze, hex } from '../api'

export default function Analyzer({ analysis: R, preview, onResult }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const pick = async (file) => {
    if (!file) return
    setErr(''); setLoading(true)
    try { onResult(await analyze(file), URL.createObjectURL(file)) }
    catch (e) { setErr(e.message) }
    setLoading(false)
  }

  const zones = R ? (R.is_dress ? ['top', 'shoes'] : ['top', 'bottom', 'shoes']) : []

  return (
    <>
      <div className="page-head"><div className="eyebrow">Outfit Analyzer</div><h2>Upload your look</h2></div>
      <div className="two">
        <div>
          <label className="drop">
            <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files[0])} />
            {preview ? <img src={preview} alt="outfit" /> : (
              <div className="drop-empty"><Upload size={28} />
                <p>Click to upload a full-body photo</p>
                <small>Stand straight · plain background · good light</small></div>)}
          </label>
          {loading && <p className="muted">Analysing…</p>}
          {err && <p className="error">{err}</p>}
        </div>

        <div>
          {!R && <div className="card"><div className="label">Result</div><p className="muted">Your analysis will appear here.</p></div>}
          {R && (
            <>
              <div className="row2">
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