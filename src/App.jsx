import { useMemo } from 'react'
import ChickenCrash from './components/ChickenCrash'

function App() {
  const backend = useMemo(() => import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000', [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(250,204,21,0.08),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.08),transparent_40%)]" />
      <header className="relative z-10 px-6 py-5 flex items-center justify-between">
        <div className="text-white font-bold text-xl">Chicken Road</div>
        <a href="/test" className="text-sm text-amber-300 hover:text-amber-200">Backend Test</a>
      </header>
      <main className="relative z-10">
        <ChickenCrash backend={backend} />
      </main>
    </div>
  )
}

export default App
