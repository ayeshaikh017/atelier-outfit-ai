import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const toData = (o) => Object.entries(o).map(([name, v]) => ({ name, v: +v })).sort((a, b) => b.v - a.v)

export default function Uncertainty({ analysis: R, go }) {
  if (!R) return (
    <div className="card"><div className="label">Uncertainty analysis</div>
      <p className="muted">Analyse an outfit first.</p>
      <button className="btn" onClick={() => go('analyzer')}>Go to Analyzer</button></div>
  )
  const zones = R.is_dress ? ['top', 'shoes'] : ['top', 'bottom', 'shoes']
  return (
    <>
      <div className="page-head"><div className="eyebrow">Uncertainty analysis</div><h2>How sure is the model?</h2></div>
      <div className="grid3">
        <div className="card stat"><div className="label">Avg normalised entropy</div><div className="big">{R.avg_entropy.toFixed(2)}</div><small className="muted">0 = sure · 1 = clueless</small></div>
        <div className="card stat"><div className="label">Style confidence</div><div className="big">{Math.round(R.style_conf * 100)}%</div><small className="muted">Naive Bayes posterior</small></div>
        <div className="card stat"><div className="label">Colour harmony</div><div className="big">{R.harmony.toFixed(2)}</div><small className="muted">{R.harmony_label}</small></div>
      </div>

      <div className="grid3">
        {zones.map((z) => {
          const d = R.zones[z]
          return (
            <div className="card" key={z}>
              <div className="label">{z} · {d.label}</div>
              <div className="bar"><div style={{ width: `${d.conf * 100}%` }} /></div>
              <div className="line"><span>Confidence</span><b>{Math.round(d.conf * 100)}%</b></div>
              <div className="line"><span>Entropy</span><b>{d.entropy.toFixed(2)}</b></div>
              <span className={'pill ' + (d.status === 'Confident' ? 'ok' : 'warn')}>{d.status}</span>
              <div className="label" style={{ marginTop: 14 }}>Alternative predictions</div>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={toData(d.dist)} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide domain={[0, 1]} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Bar dataKey="v" radius={4}>{toData(d.dist).map((_, i) => <Cell key={i} fill={i === 0 ? '#3F7A63' : '#CFE1D8'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="label">Style posterior (Naive Bayes)</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={toData(R.style_dist)}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Bar dataKey="v" fill="#3F7A63" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="muted sm">Predictions below 50% confidence are flagged "Uncertain" (reject option).</p>
      </div>
    </>
  )
}