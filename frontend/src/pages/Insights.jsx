import { useEffect, useState } from 'react'
import { getInsights, plotUrl } from '../api'

export default function Insights() {
  const [m, setM] = useState(undefined)
  const [err, setErr] = useState('')
  useEffect(() => {
    getInsights().then((d) => setM(d.metrics)).catch(() => setErr('Backend not reachable. Run "python app.py" in the root folder.'))
  }, [])
  const classes = m ? Object.keys(m).filter((k) => !['accuracy', 'macro avg', 'weighted avg'].includes(k)) : []

  return (
    <>
      <div className="page-head"><div className="eyebrow">Model insights</div><h2>How good is the classifier?</h2>
        <p>Evaluation of the HOG + calibrated SVM on a held-out test set.</p></div>
      {err && <div className="card"><p className="error">{err}</p></div>}
      {m === null && <div className="card"><p className="muted">metrics.json not found. Re-run <code>python train.py</code>.</p></div>}
      {m && (
        <>
          <div className="grid3">
            <div className="card stat"><div className="label">Accuracy</div><div className="big">{(m.accuracy * 100).toFixed(1)}%</div></div>
            <div className="card stat"><div className="label">Macro F1</div><div className="big">{m['macro avg']['f1-score'].toFixed(2)}</div></div>
            <div className="card stat"><div className="label">Test samples</div><div className="big">{m['macro avg'].support}</div></div>
          </div>
          <div className="card">
            <div className="label">Per-class metrics</div>
            <table><thead><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead>
              <tbody>{classes.map((c) => (
                <tr key={c}><td>{c}</td><td>{m[c].precision.toFixed(2)}</td><td>{m[c].recall.toFixed(2)}</td><td>{m[c]['f1-score'].toFixed(2)}</td></tr>))}</tbody></table>
          </div>
        </>
      )}
      <div className="grid2">
        <div className="card"><div className="label">Confusion matrix</div><img className="plot" src={plotUrl('confusion_matrix.png')} alt="confusion matrix" /></div>
        <div className="card"><div className="label">Reliability diagram</div><img className="plot" src={plotUrl('reliability.png')} alt="reliability" />
          <p className="muted sm">Points near the diagonal mean predicted confidence matches real accuracy (well-calibrated).</p></div>
      </div>
    </>
  )
}