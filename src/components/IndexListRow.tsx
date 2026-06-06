import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { IndexSummary } from '../lib/spectrum/index-data'
import { IndexAvatar } from './IndexAvatar'
import { AssetLogo } from './AssetLogo'
import { BasketBento } from './BasketBento'
import { ChainBadge } from './ChainBadge'
import { SpectralSparkline } from './SpectralSparkline'
import { SECTOR_COLOR, sectorOf } from '../lib/spectrum/sectors'
import { getIndexMeta } from '../lib/spectrum/metadata'
import { formatNav, formatPct } from '../lib/spectrum/format'

// Calm, scannable row: ticker, name, description, a basket-logo preview, and a
// trend sparkline — the full bento stays hidden until you expand the row. The
// Visit button jumps to the dedicated index page.
export function IndexListRow({ ix }: { ix: IndexSummary }) {
  const [open, setOpen] = useState(false)
  const up = (ix.change24hPct ?? 0) >= 0
  const accent = up ? '#35e0ff' : '#ff4db8'
  const sector = sectorOf(ix.address)
  const sc = SECTOR_COLOR[sector]
  const meta = getIndexMeta(ix.address)
  const logos = ix.top.slice(0, 6)
  const moreLogos = Math.max(0, ix.top.length - logos.length)
  const bentoItems = ix.top.map((t) => ({
    symbol: t.symbol,
    address: t.address,
    weightPct: t.weightPct,
    chainId: ix.chainId,
  }))

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] transition-colors hover:border-white/20">
      {/* header — click anywhere (except Visit) to expand the basket */}
      <div className="relative flex items-center gap-4 px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`Toggle ${ix.symbol} basket`}
          className="absolute inset-0"
        />

        {/* identity: ticker · name · description */}
        <div className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-3">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={`h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
          <IndexAvatar address={ix.address} symbol={ix.symbol} imageUrl={meta.imageUrl} size={38} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-semibold leading-none text-ink">${ix.symbol}</span>
              <ChainBadge chainId={ix.chainId} />
              <span
                className="hidden rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] sm:inline-block"
                style={{ color: sc, border: `1px solid ${sc}33`, background: `${sc}14` }}
              >
                {sector}
              </span>
            </div>
            <div className="mt-1 line-clamp-1 text-xs font-medium text-ink">{ix.name?.trim() || '—'}</div>
            <div className="mt-0.5 line-clamp-1 text-[11px] text-ink-faint">
              {meta.description ?? `A ${ix.basketLength}-asset onchain index, priced in DSTABLE.`}
            </div>
          </div>
        </div>

        {/* basket logo preview */}
        <div className="pointer-events-none relative hidden items-center lg:flex">
          <div className="flex -space-x-2">
            {logos.map((t) => (
              <AssetLogo key={t.address} address={t.address} symbol={t.symbol} chainId={ix.chainId} size={22} />
            ))}
          </div>
          {moreLogos > 0 && <span className="ml-1.5 font-mono text-[10px] text-ink-faint">+{moreLogos}</span>}
        </div>

        {/* trend */}
        <div className="pointer-events-none relative hidden h-8 w-24 md:block">
          <SpectralSparkline values={ix.navSeries.map((p) => p.value)} />
        </div>

        {/* price */}
        <div className="pointer-events-none relative hidden text-right sm:block">
          <div className="font-num text-sm tabular-nums text-ink">${formatNav(ix.navPerToken, 4)}</div>
          <div className="font-num text-[11px] font-semibold tabular-nums" style={{ color: accent }}>
            {formatPct(ix.change24hPct)}
          </div>
        </div>

        {/* visit — sits above the row-toggle overlay */}
        <Link
          to={`/token?addr=${ix.address}&chain=${ix.chainId}`}
          className="pointer-events-auto relative shrink-0 rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim transition-colors hover:border-cyan hover:text-cyan"
        >
          Visit
        </Link>
      </div>

      {/* expandable bento */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-white/10 p-3">
            <BasketBento items={bentoItems} aspect={3.2} />
          </div>
        </div>
      </div>
    </div>
  )
}
