import { forwardRef, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatEther } from 'viem'
import { tokenVisual } from '../../lib/spectrum/token-meta'
import { resolveCreator } from '../../lib/spectrum/creator'
import { chainCfg } from '../../lib/chain/chains'
import type { DeployStatus } from '../../lib/spectrum/use-deploy'
import { BasketBento, type BentoItem } from '../BasketBento'

// ─────────────────────────────────────────────────────────────────────────────
// The deploy ceremony — the orbit → gather → drop-through-portal → "Index Deployed"
// animation from /post-deploy-test, run on the real Launch deploy with the creator's
// own basket, then crossfading to a "ready" reveal card.
//
// The motion is rAF-driven (smooth in a live browser). A real-time backstop timer
// forces the reveal even if rAF is throttled (backgrounded tab / headless preview),
// so the flow always completes.
// ─────────────────────────────────────────────────────────────────────────────

const SLUG: Record<number, string> = { 1: 'ethereum', 8453: 'base' }

// One orb = one basket asset (brand-color sphere + the token's logo).
const Orb = forwardRef<HTMLDivElement, { address: string; symbol: string; chainId: number; size: number }>(
  ({ address, symbol, chainId, size }, ref) => {
    const vis = tokenVisual(symbol, address)
    const [ok, setOk] = useState(true)
    const inner = Math.round(size * 0.66)
    return (
      <div
        ref={ref}
        className="absolute left-0 top-0 flex items-center justify-center rounded-full opacity-0"
        style={{
          width: size,
          height: size,
          background: vis.color,
          border: '1px solid rgba(255,255,255,0.25)',
          boxShadow: `0 12px 30px -6px color-mix(in srgb, ${vis.color} 60%, transparent), inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -6px 12px rgba(0,0,0,0.3)`,
          willChange: 'transform, opacity',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 46%)' }}
        />
        {ok ? (
          <img
            src={`https://dd.dexscreener.com/ds-data/tokens/${SLUG[chainId] ?? 'base'}/${address.toLowerCase()}.png?size=lg`}
            alt={symbol}
            onError={() => setOk(false)}
            className="relative rounded-full object-cover"
            style={{ width: inner, height: inner }}
          />
        ) : (
          <span className="relative font-display font-bold uppercase leading-none" style={{ color: vis.ink, fontSize: Math.round(size * 0.3) }}>
            {(symbol || '?').replace(/^\$/, '').slice(0, 3)}
          </span>
        )}
      </div>
    )
  },
)
Orb.displayName = 'Orb'

const easeOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
const easeInOutBack = (x: number) => {
  const c1 = 1.70158
  const c2 = c1 * 1.525
  return x < 0.5 ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2 : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2
}
const easeInQuint = (x: number) => x * x * x * x * x
const easeOutExpo = (x: number) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x))
const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end

type Phase = 'FADE_IN' | 'ORBIT' | 'BUNCH' | 'DROP' | 'WAIT' | 'FADE_OUT'

const CONFIG = { fadeIn: 600, orbit: 3600, bunch: 1800, drop: 1200, wait: 1900, fadeOut: 1000, orbitSpeed: 0.002 }
const TOTAL = CONFIG.fadeIn + CONFIG.orbit + CONFIG.bunch + CONFIG.drop + CONFIG.wait + 400

export interface DeployPortalProps {
  open: boolean
  onClose: () => void
  onStartOver: () => void
  chainId: number
  name: string
  symbol: string
  grad: string
  blend: string[]
  sector?: string
  sectorColor?: string
  tagline?: string
  thesis?: string
  creatorHandle?: string
  creatorName?: string
  creatorAddress?: string
  assets: { address: string; symbol: string }[]
  bentoItems: BentoItem[]
  /** Live on-chain deploy state (from useDeployIndex). Omit for a pure-preview ceremony. */
  deploy?: DeployPortalDeploy
}

// Narrow view of useDeployIndex the reveal card renders — the builder maps the hook to
// this so the ceremony stays decoupled from the deploy internals.
export interface DeployPortalDeploy {
  status: DeployStatus
  attempts: number
  predicted: string | null
  priceWei: bigint | null
  txHash: string | null
  token: string | null
  error: string | null
  /** DEPLOY_ENABLED && wallet connected on this chain — gates the sign button. */
  enabled: boolean
  onSign: () => void
}

const shortHex = (h?: string | null) => (h ? `${h.slice(0, 6)}…${h.slice(-4)}` : '—')

export function DeployPortal({
  open,
  onClose,
  onStartOver,
  chainId,
  name,
  symbol,
  grad,
  sector,
  sectorColor,
  tagline,
  thesis,
  creatorHandle,
  creatorName,
  creatorAddress,
  assets,
  bentoItems,
  deploy,
}: DeployPortalProps) {
  const creator = resolveCreator({ handle: creatorHandle, name: creatorName, deployer: creatorAddress })
  const orbTokens = assets.slice(0, 14)
  const [revealed, setRevealed] = useState(false)
  const [runId, setRunId] = useState(0)

  const overlayRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const orbRefs = useRef<(HTMLDivElement | null)[]>([])
  const coreRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const holeRef = useRef<HTMLDivElement>(null)
  const coreLightRef = useRef<HTMLDivElement>(null)
  const frontLipRef = useRef<HTMLDivElement>(null)
  const energyRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const statusTextRef = useRef<HTMLHeadingElement>(null)
  const statusSubRef = useRef<HTMLParagraphElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const successRef = useRef<HTMLDivElement>(null)

  const ORB = 56

  useEffect(() => {
    if (!open) {
      setRevealed(false)
      return
    }
    setRevealed(false)

    // Real-time backstop: guarantees the reveal even if rAF is throttled.
    const backstop = window.setTimeout(() => {
      if (overlayRef.current) overlayRef.current.style.opacity = '0'
      setRevealed(true)
    }, TOTAL + 400)

    const orbs = orbRefs.current.slice(0, orbTokens.length).filter(Boolean) as HTMLDivElement[]
    const scene = sceneRef.current
    const overlay = overlayRef.current
    const ring = ringRef.current
    const glow = glowRef.current
    const hole = holeRef.current
    const coreLight = coreLightRef.current
    const frontLip = frontLipRef.current
    const energy = energyRef.current
    const core = coreRef.current
    const header = headerRef.current
    const statusText = statusTextRef.current
    const statusSub = statusSubRef.current
    const indicator = indicatorRef.current
    const success = successRef.current
    if (!orbs.length || !scene || !overlay || !ring || !glow || !hole || !coreLight || !frontLip || !energy || !core || !header || !statusText || !statusSub || !indicator || !success)
      return () => window.clearTimeout(backstop)

    let radius = 200
    let bunchTargetY = -250
    let dropTargetY = 300
    let orbitCenterY = 0
    let orbitRy = 100

    const nodes = orbs.map((el, index) => {
      const angle = (index / orbs.length) * Math.PI * 2
      return { el, initialAngle: angle, currentX: 0, currentY: 0, startX: 0, startY: 0, bunchTargetX: Math.cos(angle) * 20, bunchTargetY: 0 }
    })

    function calculateLayout() {
      const minDim = Math.min(window.innerWidth, window.innerHeight)
      radius = minDim > 800 ? 280 : minDim > 500 ? 200 : 140
      const pr = ring!.getBoundingClientRect()
      const sr = scene!.getBoundingClientRect()
      const hr = header!.getBoundingClientRect()
      dropTargetY = pr.top + pr.height / 2 - sr.top
      const bandTop = hr.bottom + 80
      const bandBottom = pr.top - 24
      const bandCenter = (bandTop + bandBottom) / 2
      orbitCenterY = bandCenter - sr.top
      orbitRy = Math.max(48, Math.min(radius * 0.4, (bandBottom - bandTop) / 2 - ORB / 2 - 12))
      bunchTargetY = orbitCenterY - orbitRy * 0.55
      nodes.forEach((n) => {
        n.bunchTargetY = bunchTargetY + Math.sin(n.initialAngle) * 16
      })
    }

    function setStatus(text: string, sub: string, color: string, dot: string) {
      statusText!.textContent = text
      statusText!.style.color = color
      statusSub!.textContent = sub
      indicator!.style.backgroundColor = dot
    }

    function updateUIState(phase: Phase) {
      if (phase === 'FADE_IN') {
        setStatus('GATHERING ASSETS', 'Phase 1 of 3', '#c7d2fe', '#6366f1')
      } else if (phase === 'BUNCH') {
        setStatus('ASSEMBLING BASKET', 'Phase 2 of 3', '#f0abfc', '#d946ef')
        core!.style.transform = 'scale(0.5)'
        core!.style.opacity = '0'
        ring!.style.borderColor = 'rgba(217,70,219,0.4)'
        ring!.style.boxShadow = '0 0 50px rgba(192,38,211,0.4), inset 0 0 20px rgba(192,38,211,0.3)'
        frontLip!.style.borderBottomColor = 'rgba(232,121,249,0.6)'
        glow!.style.backgroundColor = 'rgba(217,70,219,0.12)'
      } else if (phase === 'DROP') {
        setStatus('DEPLOYING INDEX', 'Phase 3 of 3', '#a5f3fc', '#22d3ee')
        ring!.style.transform = 'scale(1.05)'
        ring!.style.borderColor = 'rgba(34,211,238,0.8)'
        ring!.style.boxShadow = '0 0 80px rgba(34,211,238,0.6), inset 0 0 40px rgba(34,211,238,0.5)'
        frontLip!.style.borderBottomColor = 'rgba(103,232,249,0.8)'
        glow!.style.backgroundColor = 'rgba(34,211,238,0.2)'
        hole!.style.backgroundColor = '#041224'
      } else if (phase === 'WAIT') {
        header!.style.opacity = '0'
        ring!.classList.add('portal-success-pulse')
        ring!.style.borderColor = 'rgba(52,211,153,0.85)'
        frontLip!.style.borderBottomColor = 'rgba(110,231,183,0.85)'
        coreLight!.style.backgroundColor = 'rgba(52,211,153,0.85)'
        coreLight!.style.boxShadow = '0 0 100px 30px rgba(52,211,153,0.6)'
        glow!.style.backgroundColor = 'rgba(16,185,129,0.22)'
        success!.style.opacity = '1'
        success!.style.transform = 'scale(1)'
      }
    }

    function reset() {
      core!.style.transform = 'scale(1)'
      core!.style.opacity = '1'
      ring!.classList.remove('portal-success-pulse')
      ring!.style.transform = 'scale(1)'
      ring!.style.borderColor = 'rgba(6,182,212,0.4)'
      ring!.style.boxShadow = '0 0 40px rgba(6,182,212,0.3), inset 0 0 20px rgba(6,182,212,0.3)'
      frontLip!.style.borderBottomColor = 'rgba(34,211,238,0.6)'
      hole!.style.backgroundColor = '#02040a'
      coreLight!.style.transform = 'scale(1)'
      coreLight!.style.opacity = '0.5'
      coreLight!.style.backgroundColor = 'rgba(34,211,238,0.2)'
      coreLight!.style.boxShadow = 'none'
      energy!.style.opacity = '0.6'
      glow!.style.backgroundColor = 'rgba(6,182,212,0.10)'
      header!.style.opacity = '1'
      success!.style.opacity = '0'
      success!.style.transform = 'scale(0.95)'
      setStatus('GATHERING ASSETS', 'Phase 1 of 3', '#c7d2fe', '#6366f1')
      nodes.forEach((n) => {
        n.el.style.opacity = '0'
        n.el.style.transform = 'translate(-50%, -50%) scale(0)'
        n.currentX = 0
        n.currentY = 0
        n.startX = 0
        n.startY = 0
      })
    }

    let phase: Phase = 'FADE_IN'
    let phaseStart = performance.now()
    let rafId = 0

    function animate(time: number) {
      let elapsed = time - phaseStart
      const prev = phase

      if (phase === 'FADE_IN' && elapsed > CONFIG.fadeIn) {
        phase = 'ORBIT'
        phaseStart = time
        elapsed = 0
      } else if (phase === 'ORBIT' && elapsed > CONFIG.orbit) {
        phase = 'BUNCH'
        phaseStart = time
        elapsed = 0
        nodes.forEach((n) => {
          n.startX = n.currentX
          n.startY = n.currentY
        })
      } else if (phase === 'BUNCH' && elapsed > CONFIG.bunch) {
        phase = 'DROP'
        phaseStart = time
        elapsed = 0
        nodes.forEach((n) => {
          n.startX = n.currentX
          n.startY = n.currentY
        })
      } else if (phase === 'DROP' && elapsed > CONFIG.drop) {
        phase = 'WAIT'
        phaseStart = time
        elapsed = 0
      } else if (phase === 'WAIT' && elapsed > CONFIG.wait) {
        phase = 'FADE_OUT'
        overlay!.style.opacity = '0'
        setRevealed(true)
        return
      }

      if (phase !== prev) updateUIState(phase)

      nodes.forEach((n, i) => {
        let x = 0
        let y = 0
        let scale = 1
        let opacity = 1

        if (phase === 'FADE_IN') {
          const p = Math.min(elapsed / CONFIG.fadeIn, 1)
          const a = n.initialAngle + elapsed * CONFIG.orbitSpeed
          x = Math.cos(a) * radius
          y = orbitCenterY + Math.sin(a) * orbitRy
          scale = lerp(0, 1, easeOutBack(p))
          opacity = easeOutExpo(p)
          n.currentX = x
          n.currentY = y
        } else if (phase === 'ORBIT') {
          const totalT = CONFIG.fadeIn + elapsed
          const a = n.initialAngle + totalT * CONFIG.orbitSpeed
          x = Math.cos(a) * radius
          y = orbitCenterY + Math.sin(a) * orbitRy + Math.sin(time * 0.002 + i) * 12
          n.el.style.zIndex = String(Math.round(y) + 100)
          n.currentX = x
          n.currentY = y
        } else if (phase === 'BUNCH') {
          const p = Math.min(elapsed / CONFIG.bunch, 1)
          const e = easeInOutBack(p)
          x = lerp(n.startX, n.bunchTargetX, e)
          y = lerp(n.startY, n.bunchTargetY, e)
          n.el.style.zIndex = String(200 + i)
          n.currentX = x
          n.currentY = y
        } else if (phase === 'DROP') {
          const p = Math.min(elapsed / CONFIG.drop, 1)
          x = lerp(n.startX, n.bunchTargetX * 0.1, p)
          y = lerp(n.startY, dropTargetY, easeInQuint(p))
          scale = lerp(1, 0.2, p)
          if (p > 0.8) opacity = lerp(1, 0, (p - 0.8) * 5)
          n.el.style.zIndex = '10'
          n.currentX = x
          n.currentY = y
        } else if (phase === 'WAIT' || phase === 'FADE_OUT') {
          scale = 0
          opacity = 0
        }

        n.el.style.transform = `translate(-50%, -50%) translate(${n.currentX}px, ${n.currentY}px) scale(${scale})`
        n.el.style.opacity = String(opacity)
      })

      if (phase === 'DROP') {
        const p = Math.min(elapsed / CONFIG.drop, 1)
        if (p > 0.5) {
          const r = (p - 0.5) * 2
          coreLight!.style.transform = `scale(${lerp(1, 1.8, easeOutExpo(r))})`
          coreLight!.style.opacity = String(lerp(0.5, 1, r))
          energy!.style.opacity = String(lerp(0.6, 1, r))
        }
      }

      rafId = requestAnimationFrame(animate)
    }

    calculateLayout()
    window.addEventListener('resize', calculateLayout)
    reset()
    overlay.style.opacity = '1'
    phase = 'FADE_IN'
    phaseStart = performance.now()
    updateUIState('FADE_IN')
    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
      window.clearTimeout(backstop)
      window.removeEventListener('resize', calculateLayout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orbTokens.length, runId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* dark backdrop */}
      <div className="absolute inset-0 bg-void/92 backdrop-blur-sm" />

      {/* ── animation overlay (orbs + portal + success) ─────────────────── */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 transition-opacity duration-1000">
        {/* status header */}
        <div ref={headerRef} className="absolute left-1/2 top-28 z-20 flex w-full -translate-x-1/2 flex-col items-center gap-2 text-center transition-opacity duration-300">
          <div className="flex items-center gap-3">
            <div ref={indicatorRef} className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: '#6366f1' }} />
            <h1 ref={statusTextRef} className="text-sm font-medium uppercase tracking-[0.4em] md:text-base" style={{ color: '#c7d2fe' }}>
              Gathering Assets
            </h1>
          </div>
          <p ref={statusSubRef} className="text-xs uppercase tracking-wider text-slate-500">
            Phase 1 of 3
          </p>
        </div>

        {/* scene: central core + orbs */}
        <div ref={sceneRef} className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-0 w-0">
          <div ref={coreRef} className="absolute -left-10 -top-10 flex h-20 w-20 items-center justify-center rounded-full border border-indigo-500/20 shadow-[0_0_60px_rgba(99,102,241,0.15)] transition-all duration-700 ease-in-out">
            <div className="absolute inset-0 animate-pulse rounded-full bg-indigo-500/10 blur-xl" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-400/20 shadow-[inset_0_0_15px_rgba(255,255,255,0.2)] backdrop-blur-sm">
              <div className="h-2 w-2 animate-ping rounded-full bg-indigo-200" />
            </div>
          </div>

          {orbTokens.map((t, i) => (
            <Orb
              key={`${t.address}-${i}`}
              ref={(el) => {
                orbRefs.current[i] = el
              }}
              address={t.address}
              symbol={t.symbol}
              chainId={chainId}
              size={ORB}
            />
          ))}
        </div>

        {/* portal */}
        <div className="absolute bottom-[15vh] left-0 right-0 z-30 mx-auto flex w-[400px] flex-col items-center justify-center">
          <div className="relative flex h-[100px] w-full items-center justify-center" style={{ perspective: '1000px' }}>
            <div ref={glowRef} className="absolute inset-0 m-auto h-[120px] w-[350px] rounded-[100%] blur-[50px] transition-all duration-500" style={{ backgroundColor: 'rgba(6,182,212,0.10)' }} />
            <div
              ref={ringRef}
              className="absolute inset-0 m-auto flex h-[70px] w-[280px] items-center justify-center overflow-hidden rounded-[100%] border-[2px] transition-all duration-500"
              style={{ borderColor: 'rgba(6,182,212,0.4)', boxShadow: '0 0 40px rgba(6,182,212,0.3), inset 0 0 20px rgba(6,182,212,0.3)', backgroundColor: '#050914' }}
            >
              <div ref={energyRef} className="absolute inset-0 transition-opacity duration-300" style={{ opacity: 0.6 }}>
                <div className="portal-spin absolute inset-[-50%]" style={{ backgroundImage: 'conic-gradient(from 0deg, transparent 0 340deg, rgba(6,182,212,0.8) 360deg)' }} />
                <div className="portal-spin-reverse absolute inset-[-50%]" style={{ backgroundImage: 'conic-gradient(from 0deg, transparent 0 340deg, rgba(99,102,241,0.8) 360deg)' }} />
              </div>
              <div ref={holeRef} className="absolute flex h-[55px] w-[260px] items-center justify-center rounded-[100%] border border-cyan-900/50 shadow-[inset_0_0_30px_rgba(0,0,0,1)] transition-colors duration-500" style={{ backgroundColor: '#02040a' }}>
                <div ref={coreLightRef} className="h-[20px] w-[100px] rounded-[100%] blur-xl transition-all duration-500" style={{ backgroundColor: 'rgba(34,211,238,0.2)' }} />
              </div>
            </div>
            <div ref={frontLipRef} className="pointer-events-none absolute inset-0 z-30 m-auto h-[70px] w-[280px] rounded-[100%] border-b-[3px] transition-colors duration-500" style={{ borderBottomColor: 'rgba(34,211,238,0.6)' }} />
          </div>
        </div>

        {/* success message */}
        <div ref={successRef} className="pointer-events-none absolute inset-0 z-40 flex scale-95 items-center justify-center opacity-0 transition-all duration-1000">
          <div className="text-center">
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_60px_rgba(16,185,129,0.3)]">
              <svg viewBox="0 0 24 24" className="h-9 w-9 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mb-3 font-display text-4xl font-bold tracking-tight text-white md:text-5xl">Index Deployed</h2>
            <p className="text-sm uppercase tracking-widest text-emerald-200/80">${symbol || 'INDEX'} is live</p>
          </div>
        </div>
      </div>

      {/* ── reveal card ─────────────────────────────────────────────────── */}
      {revealed && (
        <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto p-4" onClick={onClose}>
          <div
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'portal-success-pulse 0.6s ease-out' }}
          >
            <div className="overflow-hidden rounded-3xl card-surface backdrop-blur-md">
              <div className="relative px-6 pt-6">
                <div className="absolute -top-20 left-1/2 h-40 w-[120%] -translate-x-1/2 opacity-50 blur-3xl" style={{ background: grad }} aria-hidden />
                <div className="relative flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="absolute -inset-1 rounded-2xl opacity-60 blur-md" style={{ background: grad }} aria-hidden />
                    <div className="relative grid h-14 w-14 place-items-center rounded-2xl ring-1 ring-white/25" style={{ background: grad }}>
                      <span className="font-display text-xl font-bold text-black/75">◆</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-cyan">${symbol || 'INDEX'}</span>
                      {sector && (
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: sectorColor, border: `1px solid ${sectorColor}33`, background: `${sectorColor}14` }}>
                          {sector}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 truncate font-display text-xl font-bold uppercase leading-tight tracking-tight text-ink">{name || symbol || 'Your index'}</div>
                  </div>
                </div>
                <div className="relative mt-3 inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal">Deployed · ready to trade</span>
                </div>
                <div className="relative mt-2 font-mono text-[11px] text-ink-dim">
                  created by{' '}
                  {creator.xUrl ? (
                    <a
                      href={creator.xUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink underline-offset-4 hover:text-cyan hover:underline"
                    >
                      {creator.label}
                    </a>
                  ) : (
                    <span className="text-ink">{creator.label}</span>
                  )}
                </div>
              </div>

              {(tagline || thesis) && (
                <div className="px-6 pt-4">
                  {tagline && <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim">{tagline}</div>}
                  {thesis && <p className="mt-1.5 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink-dim">{thesis}</p>}
                </div>
              )}

              <div className="mt-4 px-6">
                <BasketBento items={bentoItems} aspect={2.4} reveal={{ delayMs: 150, stepMs: 100 }} show={revealed} />
              </div>

              <div className="mt-4 px-6 font-mono text-[10px] leading-relaxed text-ink-dim">
                {!deploy || deploy.status === 'idle' ? (
                  <>{assets.length} assets · starts at $1.00 NAV.</>
                ) : deploy.status === 'mining' ? (
                  <>Mining the 0x88 hook address… {deploy.attempts.toLocaleString()} salts tried (CREATE2)</>
                ) : deploy.status === 'preparing' ? (
                  <>Hook address mined · reading the Dutch-auction price…</>
                ) : deploy.status === 'error' ? (
                  <span className="text-rose-300">Deploy halted: {deploy.error}</span>
                ) : deploy.status === 'success' ? (
                  <>
                    Deployed —{' '}
                    <a
                      href={`${chainCfg(chainId).explorer}/address/${deploy.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan underline-offset-4 hover:underline"
                    >
                      {shortHex(deploy.token)}
                    </a>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div>
                      Hook <span className="text-ink">{shortHex(deploy.predicted)}</span> · auction{' '}
                      {deploy.priceWei != null ? formatEther(deploy.priceWei) : '—'} ETH · starts at $1.00 NAV
                    </div>
                    {deploy.txHash && (
                      <div>
                        tx{' '}
                        <a
                          href={`${chainCfg(chainId).explorer}/tx/${deploy.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan underline-offset-4 hover:underline"
                        >
                          {shortHex(deploy.txHash)}
                        </a>
                      </div>
                    )}
                    {deploy.enabled ? (
                      <button
                        type="button"
                        onClick={deploy.onSign}
                        disabled={deploy.status !== 'ready'}
                        className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-ink transition-colors hover:enabled:border-white/35 disabled:opacity-60"
                      >
                        {deploy.status === 'signing'
                          ? 'Confirm in wallet…'
                          : deploy.status === 'confirming'
                            ? 'Deploying…'
                            : `Sign & deploy · ${deploy.priceWei != null ? formatEther(deploy.priceWei) : '—'} ETH`}
                      </button>
                    ) : (
                      <div className="text-ink-dim/70">
                        Index deploy is off on this build — but the hook address and auction price above are real
                        (mined + read live), not a mock.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2 border-t border-white/10 p-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl py-2.5 font-display text-sm font-bold uppercase tracking-[0.15em] text-black transition-transform hover:scale-[1.01]"
                  style={{ background: 'linear-gradient(90deg,#ff9248,#ff4db8,#35e0ff)' }}
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRevealed(false)
                    setRunId((n) => n + 1)
                  }}
                  className="rounded-xl border border-white/12 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wide text-ink-dim transition-colors hover:border-white/30 hover:text-ink"
                >
                  ↻ Replay
                </button>
                <button
                  type="button"
                  onClick={onStartOver}
                  className="rounded-xl border border-white/12 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wide text-ink-dim transition-colors hover:border-white/30 hover:text-ink"
                >
                  Start over
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
