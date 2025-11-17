import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Square, Rocket, Trophy, Coins, Zap } from 'lucide-react'

const useTicker = (isRunning) => {
  const [t, setT] = useState(0)
  const raf = useRef()
  const startRef = useRef()

  useEffect(() => {
    if (!isRunning) return
    startRef.current = performance.now()
    const loop = (now) => {
      const dt = (now - startRef.current) / 1000
      setT(dt)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [isRunning])

  return t
}

const formatMult = (m) => `${m.toFixed(2)}x`

export default function ChickenCrash({ backend }) {
  const [round, setRound] = useState(null)
  const [status, setStatus] = useState('loading') // loading|betting|running|crashed
  const [betAmount, setBetAmount] = useState(1)
  const [autoCashout, setAutoCashout] = useState(2.0)
  const [playerId] = useState(() => localStorage.getItem('player_id') || crypto.randomUUID())
  const [hasBet, setHasBet] = useState(false)
  const [cashoutAt, setCashoutAt] = useState(null)

  useEffect(() => {
    localStorage.setItem('player_id', playerId)
  }, [playerId])

  const t = useTicker(status === 'running')

  const currentMultiplier = useMemo(() => {
    if (!round) return 1
    const k = round.k || 0.25
    const elapsed = Math.max(0, t)
    return Math.min(round.crash_at, Math.exp(k * elapsed))
  }, [t, round])

  useEffect(() => {
    if (!round) return
    if (currentMultiplier >= round.crash_at - 1e-3) {
      setStatus('crashed')
    }
  }, [currentMultiplier, round])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const res = await fetch(`${backend}/api/round/current`)
        const data = await res.json()
        if (!mounted) return
        setRound(data)
        const now = Date.now() / 1000
        if (now < data.start_time) {
          setStatus('betting')
          // Auto start running when time reached
          const delay = Math.max(0, (data.start_time - now) * 1000)
          setTimeout(() => setStatus('running'), delay)
        } else {
          setStatus('running')
        }
      } catch (e) {
        console.error(e)
      }
    }
    init()
    return () => { mounted = false }
  }, [backend])

  const placeBet = async () => {
    if (!round) return
    try {
      await fetch(`${backend}/api/round/${round.id}/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, amount: Number(betAmount), auto_cashout: Number(autoCashout) })
      })
      setHasBet(true)
    } catch (e) {}
  }

  const cashout = async () => {
    if (!round) return
    try {
      const m = Number(currentMultiplier)
      const res = await fetch(`${backend}/api/round/${round.id}/cashout?at_multiplier=${m}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId })
      })
      const data = await res.json()
      if (data && (data.profit === null || data.profit >= 0)) {
        setCashoutAt(m)
      }
    } catch (e) {}
  }

  const resetNext = async () => {
    setStatus('loading')
    setHasBet(false)
    setCashoutAt(null)
    try {
      const res = await fetch(`${backend}/api/round`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      setRound(data)
      const now = Date.now() / 1000
      if (now < data.start_time) {
        setStatus('betting')
        const delay = Math.max(0, (data.start_time - now) * 1000)
        setTimeout(() => setStatus('running'), delay)
      } else {
        setStatus('running')
      }
    } catch (e) {}
  }

  const roadLen = 100
  const progress = round ? Math.min(1, currentMultiplier / round.crash_at) : 0

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="text-amber-400" />
            <h2 className="text-white text-xl font-semibold">Chicken Road Crash</h2>
          </div>
          <div className="text-emerald-400 font-mono text-lg">{formatMult(currentMultiplier)}</div>
        </div>

        <div className="relative h-64 bg-gradient-to-b from-slate-800 to-slate-900">
          {/* Road */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-24 bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_40px,rgba(255,255,255,0.08)_40px,rgba(255,255,255,0.08)_60px)]" />
            {/* Chicken */}
            <motion.div
              className="absolute -bottom-2"
              style={{ left: `${progress * 92 + 2}%` }}
              animate={{ y: status === 'running' ? [0, -6, 0] : 0 }}
              transition={{ duration: 0.8, repeat: status === 'running' ? Infinity : 0 }}
            >
              <div className="w-16 h-16 relative">
                <div className="absolute -top-3 -left-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-mono">
                  {formatMult(currentMultiplier)}
                </div>
                <ChickenIcon crashed={status === 'crashed'} />
              </div>
            </motion.div>
          </div>
          {/* Crash flame */}
          <AnimatePresence>
            {status === 'crashed' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <CrashBoom />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3">
              <Coins className="text-yellow-300" />
              <input value={betAmount} onChange={(e)=>setBetAmount(Number(e.target.value))} type="number" min="0.1" step="0.1" className="bg-transparent outline-none text-white w-24" />
              <div className="text-slate-400 text-sm">Bet</div>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3">
              <Zap className="text-cyan-300" />
              <input value={autoCashout} onChange={(e)=>setAutoCashout(Number(e.target.value))} type="number" min="1.01" step="0.01" className="bg-transparent outline-none text-white w-24" />
              <div className="text-slate-400 text-sm">Auto</div>
            </div>
            {!hasBet ? (
              <button onClick={placeBet} disabled={status!=='betting'} className="ml-auto bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl flex items-center gap-2">
                <Play size={18}/> Place Bet
              </button>
            ) : (
              <button onClick={cashout} disabled={status!=='running' || cashoutAt} className="ml-auto bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl flex items-center gap-2">
                <Square size={18}/> Cashout
              </button>
            )}
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-xs mb-1">Round status</div>
            <div className="text-white font-semibold capitalize">{status}</div>
            {cashoutAt && <div className="text-emerald-400 font-mono">Cashed out at {formatMult(cashoutAt)}</div>}
          </div>
        </div>
      </div>
      <div className="mt-6 text-center text-slate-400 text-sm">Provably-fair seed on server. This is a demo; not real gambling.</div>
    </div>
  )
}

function ChickenIcon({ crashed }){
  return (
    <div className="relative">
      <div className={`w-12 h-8 rounded-full ${crashed ? 'bg-red-500' : 'bg-amber-300'} border-4 border-yellow-700 shadow-inner`}></div>
      <div className="w-4 h-4 bg-white rounded-full absolute -top-2 left-6 border border-slate-700"></div>
      <div className="w-1 h-1 bg-black rounded-full absolute -top-1 left-[34px]"></div>
      <div className="w-3 h-3 bg-orange-500 rounded-tr-full absolute -top-1 left-9 rotate-45"></div>
      <div className="w-10 h-2 bg-yellow-400 rounded-full absolute top-6 -left-3 rotate-6"></div>
      <div className="w-8 h-2 bg-yellow-400 rounded-full absolute top-6 left-5 -rotate-6"></div>
    </div>
  )
}

function CrashBoom(){
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: [0.6, 1.4, 1], opacity: [0, 1, 0.9] }}
      transition={{ times: [0, 0.4, 1], duration: 0.8 }}
      className="relative"
    >
      <div className="w-40 h-40 rounded-full bg-gradient-to-br from-amber-400 to-red-600 blur-2xl opacity-70" />
      <div className="absolute inset-0 flex items-center justify-center text-3xl font-extrabold text-white drop-shadow">CRASH!</div>
    </motion.div>
  )
}
