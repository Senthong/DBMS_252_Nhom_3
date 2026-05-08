import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom'
import Overview from './pages/Overview'
import PhenomenaLab from './pages/PhenomenaLab'
import FlashSale from './pages/FlashSale'
import Inspect from './pages/Inspect'
import Compare from './pages/Compare'

const tabs = [
  { to: '/overview', label: 'Overview' },
  { to: '/phenomena', label: 'Phenomena Lab' },
  { to: '/sale', label: 'Flash Sale' },
  { to: '/inspect', label: 'Live Inspection' },
  { to: '/compare', label: 'Comparison Report' },
]

export default function App() {
  return (
    <BrowserRouter basename="/concurrency">
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
            <h1 className="text-lg font-bold text-red-700">
              Topic V — Concurrency Control
            </h1>
            <nav className="flex gap-1 text-sm">
              {tabs.map(t => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded font-medium ${
                      isActive ? 'bg-red-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto p-4">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/phenomena/*" element={<PhenomenaLab />} />
            <Route path="/sale" element={<FlashSale />} />
            <Route path="/inspect" element={<Inspect />} />
            <Route path="/compare" element={<Compare />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
