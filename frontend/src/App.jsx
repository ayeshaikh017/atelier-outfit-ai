import { useState } from 'react'
import { LayoutDashboard, Sparkles, Gauge, Shirt, Activity, Hexagon, Camera } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Analyzer from './pages/Analyzer'
import Uncertainty from './pages/Uncertainty'
import Wardrobe from './pages/Wardrobe'
import Insights from './pages/Insights'
import TryOn from './pages/TryOn'

const NAV = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['analyzer', 'Outfit Analyzer', Sparkles],
  ['uncertainty', 'Uncertainty', Gauge],
  ['tryon', 'Virtual Try-On', Camera],
  ['wardrobe', 'Virtual Wardrobe', Shirt],
  ['insights', 'Model Insights', Activity],
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [analysis, setAnalysis] = useState(null)
  const [preview, setPreview] = useState(null)
  const [history, setHistory] = useState([])

  const onResult = (res, url) => {
    setAnalysis(res); setPreview(url)
    setHistory((h) => [{ style: res.style, score: res.score, t: new Date().toLocaleTimeString() }, ...h])
  }
  const current = NAV.find((n) => n[0] === page)[1]

  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">
          <div className="logo-mark"><Hexagon size={20} /></div>
          <div>
            <div className="brand">Atelier<span>.</span></div>
            <div className="eyebrow">Outfit Intelligence</div>
          </div>
        </div>
        <nav>
          {NAV.map(([id, label, Icon]) => (
            <button key={id} className={page === id ? 'nav on' : 'nav'} onClick={() => setPage(id)}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="crumb">Atelier / <b>{current}</b></div>
          <div className="chip"><i /> Model ready</div>
        </div>
        <div className="page" key={page}>
          {page === 'dashboard' && <Dashboard analysis={analysis} history={history} go={setPage} />}
          {page === 'analyzer' && <Analyzer analysis={analysis} preview={preview} onResult={onResult} />}
          {page === 'uncertainty' && <Uncertainty analysis={analysis} go={setPage} />}
          {page === 'tryon' && <TryOn onResult={onResult} go={setPage} />}
          {page === 'wardrobe' && <Wardrobe />}
          {page === 'insights' && <Insights />}
        </div>
      </main>
    </div>
  )
}