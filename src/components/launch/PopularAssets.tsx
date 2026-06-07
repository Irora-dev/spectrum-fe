import { useEffect, useMemo, useRef, useState } from 'react'
import { AssetLogo } from '../AssetLogo'
import { fetchTokenPerf } from '../../lib/spectrum/token-perf'
import { tokenVisual } from '../../lib/spectrum/token-meta'
import { formatPct } from '../../lib/spectrum/format'

interface Candidate {
  address: string
  symbol: string
}

interface PerfLite {
  change24h: number | null
  name: string
}

// "Trending on {chain}" — popular tokens ranked by recent (24h) price performance,
// in a free-scrolling rail (scroll / swipe / arrows) so every token is one tap away.
// Click a card to add it to the basket.
export function PopularAssets({
  chainId,
  chainName,
  candidates,
  excludeAddresses = [],
  onPick,
  busy = false,
}: {
  chainId: number
  chainName: string
  candidates: Candidate[]
  excludeAddresses?: string[]
  onPick: (address: string, symbol?: string) => void
  busy?: boolean
}) {
  const [perf, setPerf] = useState<Map<string, PerfLite>>(new Map())
  const railRef = useRef<HTMLDivElement>(null)

  const exclude = useMemo(
    () => new Set(excludeAddresses.map((a) => a.toLowerCase())),
    [excludeAddresses],
  )
  const pool = useMemo(
    () => candidates.filter((c) => !exclude.has(c.address.toLowerCase())).slice(0, 24),
    [candidates, exclude],
  )
  const poolKey = pool.map((c) => c.address.toLowerCase()).join(',')

  useEffect(() => {
    if (pool.length === 0) return
    let alive = true
    fetchTokenPerf(
      pool.map((c) => c.address),
      chainId,
    ).then((m) => {
      if (!alive) return
      const lite = new Map<string, PerfLite>()
      m.forEach((v, k) => lite.set(k, { change24h: v.change24h, name: v.name }))
      setPerf(lite)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKey, chainId])

  const ranked = useMemo(
    () =>
      pool
        .map((c) => {
          const p = perf.get(c.address.toLowerCase())
          return { ...c, change24h: p?.change24h ?? null, name: p?.name ?? '' }
        })
        .sort((a, b) => {
          if (a.change24h == null && b.change24h == null) return 0
          if (a.change24h == null) return 1
          if (b.change24h == null) return -1
          return b.change24h - a.change24h
        }),
    [pool, perf],
  )

  if (ranked.length === 0) return null

  const scroll = (dir: 1 | -1) => railRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' })

  return (
    <div className="mt-5 border-t border-white/8 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-ink-dim">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
          Trending on {chainName} · 24h
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/12 text-ink-dim transition-colors hover:border-cyan/60 hover:text-cyan"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Scroll right"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/12 text-ink-dim transition-colors hover:border-cyan/60 hover:text-cyan"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* -my-3/py-3 give vertical slack so the hover lift + glow aren't clipped by
          overflow-x-auto (which forces overflow-y to clip); margins keep layout put. */}
      <div ref={railRef} className="no-scrollbar -mx-2 -my-3 flex gap-3 overflow-x-auto scroll-smooth px-2 py-3">
        {ranked.map((t) => {
          const color = tokenVisual(t.symbol, t.address).color
          const up = (t.change24h ?? 0) >= 0
          const c = up ? '#35e0ff' : '#ff4db8'
          const unknown = t.change24h == null
          return (
            <button
              key={t.address}
              type="button"
              disabled={busy}
              aria-label={`Add ${t.symbol} to basket`}
              onClick={() => onPick(t.address, t.symbol)}
              className="group relative flex w-[156px] shrink-0 flex-col justify-between gap-3 overflow-hidden rounded-2xl border border-white/10 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              style={{ background: `linear-gradient(160deg, ${color}26, ${color}0a 44%, rgba(255,255,255,0.02))` }}
            >
              {/* hover glow ring in the token's brand color */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{ boxShadow: `inset 0 0 0 1px ${color}55, 0 8px 18px -10px ${color}` }}
              />
              <div className="relative flex items-start justify-between">
                <AssetLogo
                  address={t.address}
                  symbol={t.symbol}
                  chainId={chainId}
                  size={36}
                  discColor={`color-mix(in srgb, ${color} 55%, #000)`}
                />
                <span
                  aria-hidden
                  className="grid h-6 w-6 place-items-center rounded-full border border-white/15 font-num text-base leading-none text-ink-dim transition-colors group-hover:border-cyan group-hover:text-cyan"
                >
                  +
                </span>
              </div>
              <div className="relative min-w-0">
                <div className="truncate font-display text-sm font-bold uppercase tracking-wide text-ink">{t.symbol}</div>
                {t.name && <div className="truncate font-mono text-[10px] text-ink-faint">{t.name}</div>}
                <span
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-num text-xs font-semibold tabular-nums"
                  style={{ color: unknown ? '#565669' : c, background: unknown ? 'transparent' : `${c}1a` }}
                >
                  {!unknown && <span aria-hidden className="text-[9px]">{up ? '▲' : '▼'}</span>}
                  {unknown ? '—' : formatPct(t.change24h)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
