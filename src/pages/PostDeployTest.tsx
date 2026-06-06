import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAllIndexes } from '../lib/spectrum/hooks'
import type { IndexSummary } from '../lib/spectrum/index-data'
import { readableInk, tokenVisual } from '../lib/spectrum/token-meta'
import { getIndexMeta } from '../lib/spectrum/metadata'
import { SECTOR_COLOR, sectorOf } from '../lib/spectrum/sectors'
import { indexSignatureColor } from '../lib/spectrum/signature'
import { formatNav, formatPct, formatUsdCompact } from '../lib/spectrum/format'
import { resolveCreatorFromMeta } from '../lib/spectrum/creator'
import { IndexAvatar } from '../components/IndexAvatar'
import { BasketBento } from '../components/BasketBento'
import { ChainBadge } from '../components/ChainBadge'
import { SpectralSparkline } from '../components/SpectralSparkline'

// ── One orb = one basket asset (brand color sphere + the token's logo) ───────
const SLUG: Record<number, string> = { 1: 'ethereum', 8453: 'base' }

const Orb = forwardRef<
  HTMLDivElement,
  { address: string; symbol: string; chainId: number; size: number }
>(({ address, symbol, chainId, size }, ref) => {
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
      {/* glossy top highlight — gives the sphere its dimension */}
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
        <span
          className="relative font-display font-bold uppercase leading-none"
          style={{ color: vis.ink, fontSize: Math.round(size * 0.3) }}
        >
          {(symbol || '?').replace(/^\$/, '').slice(0, 3)}
        </span>
      )}
    </div>
  )
})
Orb.displayName = 'Orb'

// ── The reveal target: a mock of the real index page (mirrors pages/Token) ───
function MockIndexPage({ ix, show }: { ix: IndexSummary; show: boolean }) {
  const meta = getIndexMeta(ix.address)
  const sector = sectorOf(ix.address)
  const sc = SECTOR_COLOR[sector]
  const up = (ix.change24hPct ?? 0) >= 0
  const accent = up ? '#35e0ff' : '#ff4db8'
  const bentoItems = ix.top.map((t) => ({
    symbol: t.symbol,
    address: t.address,
    weightPct: t.weightPct,
    chainId: ix.chainId,
  }))
  const dom = ix.top[0]
  const sig = indexSignatureColor(ix.address, dom ? { symbol: dom.symbol, address: dom.address } : undefined)
  const buyInk = /^#[0-9a-fA-F]{6}$/.test(sig) ? readableInk(sig) : '#0b0b12'

  // Staggered entrance once revealed: card → text → chart → tokens (by weight).
  // Everything starts hidden (opacity 0), so the page never flashes before reveal.
  const [play, setPlay] = useState(false)
  useEffect(() => {
    if (!show) {
      setPlay(false)
      return
    }
    const id = requestAnimationFrame(() => setPlay(true))
    return () => cancelAnimationFrame(id)
  }, [show])
  const stage = (delay: number, y = 10): CSSProperties => ({
    opacity: play ? 1 : 0,
    transform: play ? 'translateY(0)' : `translateY(${y}px)`,
    transition: 'opacity 0.5s ease, transform 0.5s ease',
    transitionDelay: `${delay}ms`,
  })

  return (
    <div className="py-6">
      <Link
        to="/"
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
        style={stage(0)}
      >
        ← All indexes
      </Link>

      <div
        className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-md"
        style={stage(0, 18)}
      >
        <div aria-hidden className="h-1 w-full" style={{ background: sig }} />
        {/* ── top: identity (left) · price + chart (right) ─────────── */}
        <div className="grid gap-6 border-b border-white/10 p-6 lg:grid-cols-2 lg:gap-10">
          {/* identity */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3" style={stage(380)}>
              <IndexAvatar address={ix.address} symbol={ix.symbol} imageUrl={meta.imageUrl} size={52} />
              <div>
                <span className="inline-block rounded-md bg-white/10 px-2 py-0.5 font-mono text-[12px] font-semibold text-cyan">
                  ${ix.symbol}
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <ChainBadge chainId={ix.chainId} />
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: sc, border: `1px solid ${sc}33`, background: `${sc}14` }}
                  >
                    {sector}
                  </span>
                </div>
              </div>
            </div>

            <h1
              className="font-display text-4xl font-bold uppercase leading-[0.92] tracking-tight text-ink"
              style={stage(470)}
            >
              {ix.name || ix.symbol}
            </h1>

            <div className="flex items-center gap-2" style={stage(610)}>
              <IndexAvatar
                address={meta.creatorAddress ?? resolveCreatorFromMeta(meta, ix.deployer, ix.address).address ?? ix.address}
                symbol={(meta.creatorHandle ?? 'x').replace(/^@/, '')}
                imageUrl={meta.creatorAvatarUrl}
                size={22}
              />
              <span className="text-xs text-ink-faint">
                created by{' '}
                <span className="text-ink-dim">{resolveCreatorFromMeta(meta, ix.deployer, ix.address).label}</span>
              </span>
            </div>
          </div>

          {/* price + chart */}
          <div className="flex flex-col justify-between gap-4 lg:items-end">
            <div className="lg:text-right" style={stage(700)}>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Price (${ix.symbol})
              </div>
              <div className="mt-1 flex items-end gap-2 lg:justify-end">
                <span className="font-num text-4xl leading-none tabular-nums text-ink sm:text-5xl">
                  ${formatNav(ix.navPerToken)}
                </span>
                <span
                  className="mb-0.5 rounded-full px-2 py-0.5 font-num text-xs font-semibold tabular-nums"
                  style={{ color: accent, background: `${accent}1a` }}
                >
                  {formatPct(ix.change24hPct)}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-ink-faint">
                DSTABLE · NAV per token · AUM {formatUsdCompact(ix.aumUsd)}
              </div>
            </div>
            <div className="h-24 w-full" style={stage(820)}>
              <SpectralSparkline values={ix.navSeries.map((p) => p.value)} />
            </div>
          </div>
        </div>

        {/* ── thesis / description ───────────────────────────────── */}
        <div className="border-b border-white/10 px-6 py-5" style={stage(900)}>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            {meta.tagline ?? 'About'}
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-ink-dim">
            {meta.description ?? `A ${ix.basketLength}-asset onchain index, priced in DSTABLE.`}
          </p>
        </div>

        {/* ── bottom: all assets, full width (reveal one-by-one by weight) ── */}
        <div className="border-b border-white/10 p-4 sm:px-6">
          <BasketBento items={bentoItems} aspect={3.2} reveal={{ delayMs: 1050, stepMs: 130 }} show={play} />
        </div>

        {/* ── buy bar (button takes the index's signature colour) ─────── */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.03] px-6 py-4"
          style={stage(900)}
        >
          <div className="font-mono text-xs text-ink-dim">{ix.basketLength} assets</div>
          <button
            type="button"
            className="rounded-lg px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] transition-opacity hover:opacity-90"
            style={{ background: sig, color: buyInk }}
          >
            Buy ${ix.symbol}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Easing helpers (ported from the source animation) ────────────────────────
const easeOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
const easeInOutBack = (x: number) => {
  const c1 = 1.70158
  const c2 = c1 * 1.525
  return x < 0.5
    ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
    : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2
}
const easeInQuint = (x: number) => x * x * x * x * x
const easeOutExpo = (x: number) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x))
const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end

type Phase = 'FADE_IN' | 'ORBIT' | 'BUNCH' | 'DROP' | 'WAIT' | 'FADE_OUT'

const CONFIG = {
  fadeIn: 600,
  orbit: 3600,
  bunch: 1800,
  drop: 1200,
  wait: 1900,
  fadeOut: 1000,
  orbitSpeed: 0.002,
}

export function PostDeployTest() {
  const { data, isError } = useAllIndexes()
  const target = useMemo(() => {
    if (!data?.length) return undefined
    return data.find((d) => d.symbol?.toUpperCase() === 'BASEAI') ?? data[0]
  }, [data])

  const orbTokens = useMemo(() => (target ? target.top.slice(0, 14) : []), [target])

  const [revealed, setRevealed] = useState(false)
  const [runId, setRunId] = useState(0)

  // refs into the animated DOM
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

  const ORB = 58

  useEffect(() => {
    if (!target) return
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
      return

    let radius = 200
    let bunchTargetY = -250
    let dropTargetY = 300
    let orbitCenterY = 0
    let orbitRy = 100

    const nodes = orbs.map((el, index) => {
      const angle = (index / orbs.length) * Math.PI * 2
      return {
        el,
        initialAngle: angle,
        currentX: 0,
        currentY: 0,
        startX: 0,
        startY: 0,
        bunchTargetX: Math.cos(angle) * 20,
        bunchTargetY: 0,
      }
    })

    function calculateLayout() {
      const minDim = Math.min(window.innerWidth, window.innerHeight)
      radius = minDim > 800 ? 280 : minDim > 500 ? 200 : 140
      const pr = ring!.getBoundingClientRect()
      const sr = scene!.getBoundingClientRect()
      const hr = header!.getBoundingClientRect()
      dropTargetY = pr.top + pr.height / 2 - sr.top
      // Constrain the orbit + bunch to a band BELOW the status text and ABOVE the
      // portal so the orbs never rise high enough to clip the heading.
      const bandTop = hr.bottom + 80 // clearance under the text (covers orb radius + bob)
      const bandBottom = pr.top - 24 // just above the portal
      const bandCenter = (bandTop + bandBottom) / 2
      orbitCenterY = bandCenter - sr.top
      orbitRy = Math.max(48, Math.min(radius * 0.4, (bandBottom - bandTop) / 2 - ORB / 2 - 12))
      // Gather slightly above the orbit centre — a gentle wind-up that stays in band.
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
        // Done — keep the portal exactly where it is and cross-fade: the overlay
        // (orbs/portal/success) fades out while the index page fades in beneath.
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
          const total = CONFIG.fadeIn + elapsed
          const a = n.initialAngle + total * CONFIG.orbitSpeed
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
          // Orbs have dropped through — keep them hidden (otherwise they snap
          // back to full size/opacity and pile up behind the portal).
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
    setRevealed(false)
    phase = 'FADE_IN'
    phaseStart = performance.now()
    updateUIState('FADE_IN')
    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', calculateLayout)
    }
  }, [target, orbTokens.length, runId])

  if (isError) {
    return (
      <div className="py-20 text-center font-mono text-sm text-ink-faint">
        Couldn’t load a sample index to animate.
      </div>
    )
  }
  if (!target) {
    return <div className="py-20 text-center font-mono text-sm text-ink-faint">Loading a sample index…</div>
  }

  return (
    <>
      {/* reveal target sits underneath the overlay. Its sections start hidden
          (opacity 0) so nothing shows before the animation finishes; once the
          portal completes it plays a staggered entrance (card → text → chart →
          tokens) while the overlay fades out. */}
      <div className={revealed ? '' : 'pointer-events-none'}>
        <MockIndexPage ix={target} show={revealed} />
      </div>

      {/* ── animation overlay (transparent → the site's void + edge-spectrum
          background shows behind the orbs and portal) ───────────────────── */}
      <div
        ref={overlayRef}
        className="pointer-events-none fixed inset-0 z-50 overflow-hidden transition-opacity duration-1000"
      >
        {/* status header */}
        <div
          ref={headerRef}
          className="absolute left-1/2 top-28 z-20 flex w-full -translate-x-1/2 flex-col items-center gap-2 text-center transition-opacity duration-300"
        >
          <div className="flex items-center gap-3">
            <div ref={indicatorRef} className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: '#6366f1' }} />
            <h1
              ref={statusTextRef}
              className="text-sm font-medium uppercase tracking-[0.4em] md:text-base"
              style={{ color: '#c7d2fe' }}
            >
              Gathering Assets
            </h1>
          </div>
          <p ref={statusSubRef} className="text-xs uppercase tracking-wider text-slate-500">
            Phase 1 of 3
          </p>
        </div>

        {/* scene: central core + orbs */}
        <div ref={sceneRef} className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-0 w-0">
          <div
            ref={coreRef}
            className="absolute -left-10 -top-10 flex h-20 w-20 items-center justify-center rounded-full border border-indigo-500/20 shadow-[0_0_60px_rgba(99,102,241,0.15)] transition-all duration-700 ease-in-out"
          >
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
              chainId={target.chainId}
              size={ORB}
            />
          ))}
        </div>

        {/* portal — sits ABOVE the scene (z-30 > z-10) so the dropping orbs
            disappear behind its opaque black ring instead of in front of it. */}
        <div className="absolute bottom-[15vh] left-0 right-0 z-30 mx-auto flex w-[400px] flex-col items-center justify-center">
          <div className="relative flex h-[100px] w-full items-center justify-center" style={{ perspective: '1000px' }}>
            <div
              ref={glowRef}
              className="absolute inset-0 m-auto h-[120px] w-[350px] rounded-[100%] blur-[50px] transition-all duration-500"
              style={{ backgroundColor: 'rgba(6,182,212,0.10)' }}
            />
            <div
              ref={ringRef}
              className="absolute inset-0 m-auto flex h-[70px] w-[280px] items-center justify-center overflow-hidden rounded-[100%] border-[2px] transition-all duration-500"
              style={{
                borderColor: 'rgba(6,182,212,0.4)',
                boxShadow: '0 0 40px rgba(6,182,212,0.3), inset 0 0 20px rgba(6,182,212,0.3)',
                backgroundColor: '#050914',
              }}
            >
              <div ref={energyRef} className="absolute inset-0 transition-opacity duration-300" style={{ opacity: 0.6 }}>
                <div
                  className="portal-spin absolute inset-[-50%]"
                  style={{ backgroundImage: 'conic-gradient(from 0deg, transparent 0 340deg, rgba(6,182,212,0.8) 360deg)' }}
                />
                <div
                  className="portal-spin-reverse absolute inset-[-50%]"
                  style={{ backgroundImage: 'conic-gradient(from 0deg, transparent 0 340deg, rgba(99,102,241,0.8) 360deg)' }}
                />
              </div>
              <div
                ref={holeRef}
                className="absolute flex h-[55px] w-[260px] items-center justify-center rounded-[100%] border border-cyan-900/50 shadow-[inset_0_0_30px_rgba(0,0,0,1)] transition-colors duration-500"
                style={{ backgroundColor: '#02040a' }}
              >
                <div
                  ref={coreLightRef}
                  className="h-[20px] w-[100px] rounded-[100%] blur-xl transition-all duration-500"
                  style={{ backgroundColor: 'rgba(34,211,238,0.2)' }}
                />
              </div>
            </div>
            <div
              ref={frontLipRef}
              className="pointer-events-none absolute inset-0 z-30 m-auto h-[70px] w-[280px] rounded-[100%] border-b-[3px] transition-colors duration-500"
              style={{ borderBottomColor: 'rgba(34,211,238,0.6)' }}
            />
          </div>
        </div>

        {/* success message */}
        <div
          ref={successRef}
          className="pointer-events-none absolute inset-0 z-40 flex scale-95 items-center justify-center opacity-0 transition-all duration-1000"
        >
          <div className="text-center">
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_60px_rgba(16,185,129,0.3)]">
              <svg
                viewBox="0 0 24 24"
                className="h-9 w-9 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mb-3 font-display text-4xl font-bold tracking-tight text-white md:text-5xl">Index Deployed</h2>
            <p className="text-sm uppercase tracking-widest text-emerald-200/80">${target.symbol} is live</p>
          </div>
        </div>
      </div>

      {/* replay control — outside the overlay so it's always clickable */}
      <button
        type="button"
        onClick={() => setRunId((n) => n + 1)}
        className="fixed bottom-5 right-5 z-[60] rounded-lg border border-white/20 bg-black/60 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink backdrop-blur transition-colors hover:border-cyan hover:text-cyan"
      >
        ↻ Replay
      </button>
    </>
  )
}
