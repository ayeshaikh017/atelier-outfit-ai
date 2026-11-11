import { Shirt, Star, Palette, ArrowRight } from 'lucide-react'

const FLOW = [
  ['Zone split', 'Image divided into top, bottom and shoes regions'],
  ['Garment type', 'HOG features + RBF-SVM with Platt calibration'],
  ['Colour', 'K-Means clustering, named via LAB distance'],
  ['Style', 'Naive Bayes posterior over style classes'],
  ['Uncertainty', 'Confidence, Shannon entropy and reject option'],
]

export default function Dashboard({ analysis, history, go }) {
  const avg = history.length ? (history.reduce((a, h) => a + h.score, 0) / history.length).toFixed(1) : '–'
  return (
    <>
      <div className="banner">
        <div className="eyebrow">AI Outfit Intelligence System</div>
        <h1>Know what you're wearing. Know how to wear it better.</h1>
        <p>Upload a photo and get garment detection, colour analysis, style, a score and honest uncertainty for every prediction.</p>
        <button className="btn" onClick={() => go('analyzer')}>Analyse an outfit <ArrowRight size={16} /></button>
        <div className="tech"><span>HOG + SVM</span><span>K-Means</span><span>Naive Bayes</span><span>Entropy</span></div>
      </div>

      <div className="grid3">
        <div className="card stat"><div className="stat-ic"><Shirt size={20} /></div><div className="label">Outfits analysed</div><div className="big">{history.length}</div></div>
        <div className="card stat"><div className="stat-ic"><Star size={20} /></div><div className="label">Average score</div><div className="big">{avg}</div></div>
        <div className="card stat"><div className="stat-ic"><Palette size={20} /></div><div className="label">Last style</div><div className="big sm">{analysis?.style || '–'}</div></div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="label">How it works</div>
          <ol className="flow">
            {FLOW.map(([t, d], i) => (
              <li key={t}><div className="n">{i + 1}</div><div><b>{t}</b><span>{d}</span></div></li>
            ))}
          </ol>
        </div>
        <div className="card">
          <div className="label">Recent analyses</div>
          {history.length === 0 && <p className="muted">Nothing yet. Upload a photo in Outfit Analyzer.</p>}
          {history.slice(0, 6).map((h, i) => (
            <div className="line" key={i}>
              <span><b>{h.style}</b></span><span className="muted">{h.t}</span>
              <span className="pill ok">{h.score}/10</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}