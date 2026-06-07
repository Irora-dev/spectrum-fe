import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { IndexSummary } from '../lib/spectrum/index-data'
import { IndexAvatar } from './IndexAvatar'
import { AssetLogo } from './AssetLogo'
import { AssetHoverCard } from './AssetHoverCard'
import { IndexSpark } from './IndexSpark'
import { ChainBadge } from './ChainBadge'
import { SECTOR_COLOR, sectorOf } from '../lib/spectrum/sectors'
import { getIndexMeta } from '../lib/spectrum/metadata'
import { indexSignatureColor } from '../lib/spectrum/signature'
import { readableInk } from '../lib/spectrum/token-meta'
import { formatNav, formatPct } from '../lib/spectrum/format'
import { useCountUp, useInViewOnce } from '../lib/motion'

const keyOf = (ix: IndexSummary) => `${ix.chainId}:${ix.address}`

// The non-highlighted baskets as a calm three-up grid. Each card shows the
// essentials — name, ticker, price and a real 7d NAV chart — plus the basket's
// token icons. Hovering a token icon pops its live price; hovering the card
// reveals a "Visit" button (to the live deploy site). Cards reveal on scroll,
// the price counts up, and the day's best performers wear a ▲ badge.
export function BasketGrid({ indexes }: { indexes: IndexSummary[] }) {
  // Flag the two strongest 24h movers (positive only) for a top-gainer ribbon.
  const topGainers = useMemo(() => {
    return new Set(
      [...indexes]
        .filter((i) => (i.change24hPct ?? 0) > 0)
        .sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0))
        .slice(0, 2)
        .map(keyOf),
    )
  }, [indexes])

  if (indexes.length === 0) return null
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {indexes.map((ix, i) => (
        <Card key={keyOf(ix)} ix={ix} index={i} topGainer={topGainers.has(keyOf(ix))} />
      ))}
    </div>
  )
}

function Card({ ix, index, topGainer }: { ix: IndexSummary; index: number; topGainer: boolean }) {
  const [tok, setTok] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const shown = useInViewOnce(ref)
  const price = useCountUp(ix.navPerToken, shown)

  const meta = getIndexMeta(ix.address)
  const sector = sectorOf(ix.address)
  const sc = SECTOR_COLOR[sector]
  const sig = indexSignatureColor(ix.address, ix.top[0])
  const buyInk = /^#[0-9a-fA-F]{6}$/.test(sig) ? readableInk(sig) : '#0b0b12'
  const up = (ix.change24hPct ?? 0) >= 0
  const accent = up ? '#35e0ff' : '#ff4db8'
  const icons = ix.top.slice(0, 7)
  const more = Math.max(0, ix.basketLength - icons.length)
  const to = `/token?addr=${ix.address}&chain=${ix.chainId}`

  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(14px)',
        transition: 'opacity 0.5s ease, transform 0.55s cubic-bezier(0.16,1,0.3,1)',
        transitionDelay: `${Math.min(index, 8) * 45}ms`,
      }}
    >
      <div
        className="group/card relative rounded-2xl border border-white/[0.12] bg-white/[0.04] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-md transition-[transform,border-color,background-color] duration-200 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06]"
        // lift the card (+ its token popover) above grid neighbours while a token is hovered
        style={{ zIndex: tok ? 30 : undefined }}
      >
        {/* signature glow on hover */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 h-32 w-2/3 -translate-x-1/2 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover/card:opacity-25"
          style={{ background: sig }}
        />

        {/* top-gainer ribbon */}
        {topGainer && (
          <div className="absolute -left-px -top-px z-10 rounded-br-xl rounded-tl-2xl bg-cyan/15 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-cyan">
            ▲ Top gainer
          </div>
        )}

        {/* identity · price (header links to the index page) */}
        <Link to={to} className="relative flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <IndexAvatar address={ix.address} symbol={ix.symbol} imageUrl={meta.imageUrl} size={38} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-display text-base font-semibold leading-none text-ink">${ix.symbol}</span>
                <ChainBadge chainId={ix.chainId} />
                <span
                  className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: sc, border: `1px solid ${sc}33`, background: `${sc}14` }}
                >
                  {sector}
                </span>
              </div>
              <div className="mt-1 truncate text-xs text-ink-dim">{ix.name?.trim() || ix.symbol}</div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="font-num text-lg leading-none tabular-nums text-ink">${formatNav(price, 4)}</div>
            <span
              className="rounded-full px-1.5 py-0.5 font-num text-[11px] font-semibold tabular-nums"
              style={{ color: accent, background: `${accent}1a` }}
            >
              {formatPct(ix.change24hPct)}
            </span>
          </div>
        </Link>

        {/* real reconstructed 7d NAV chart */}
        <div className="mt-3 h-20">
          <IndexSpark
            chainId={ix.chainId}
            assets={ix.top.map((t) => ({ address: t.address, weight: t.weightPct }))}
            navPerToken={ix.navPerToken}
            fallback={ix.navSeries}
            range="7D"
          />
        </div>

        {/* basket token icons — hover one for its live price */}
        <div className="relative mt-3 flex items-center gap-1.5">
          {icons.map((t) => {
            const k = t.address.toLowerCase()
            return (
              <div
                key={t.address}
                className="relative"
                onMouseEnter={() => setTok(k)}
                onMouseLeave={() => setTok((p) => (p === k ? null : p))}
              >
                <span className="block cursor-pointer transition-transform duration-150 hover:scale-110">
                  <AssetLogo address={t.address} symbol={t.symbol} chainId={ix.chainId} size={26} />
                </span>
                {tok === k && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2">
                    <AssetHoverCard chainId={ix.chainId} address={t.address} symbol={t.symbol} weightPct={t.weightPct} />
                  </div>
                )}
              </div>
            )
          })}
          {more > 0 && <span className="ml-0.5 font-mono text-[10px] text-ink-faint">+{more}</span>}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            {ix.basketLength} assets
          </span>
        </div>

        {/* visit button — opens the dedicated index page; revealed on card hover
            (space reserved to avoid reflow) */}
        <div className="mt-3 h-9">
          <Link
            to={to}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg font-mono text-[11px] font-bold uppercase tracking-[0.14em] opacity-0 transition-opacity duration-200 group-hover/card:opacity-100"
            style={{ background: sig, color: buyInk }}
          >
            Visit ${ix.symbol}
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}
