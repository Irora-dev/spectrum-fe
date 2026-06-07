import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { IndexSummary } from '../lib/spectrum/index-data'
import { IndexAvatar } from './IndexAvatar'
import { BasketBento } from './BasketBento'
import { ChainBadge } from './ChainBadge'
import { IndexSpark } from './IndexSpark'
import { SECTOR_COLOR, sectorOf } from '../lib/spectrum/sectors'
import { getIndexMeta } from '../lib/spectrum/metadata'
import { indexSignatureColor } from '../lib/spectrum/signature'
import { readableInk } from '../lib/spectrum/token-meta'
import { formatNav, formatPct, formatUsdCompact } from '../lib/spectrum/format'
import { resolveCreatorFromMeta } from '../lib/spectrum/creator'
import { useCountUp } from '../lib/motion'

const ADVANCE_MS = 6500

// Featured indexes, one at a time, sliding horizontally. Auto-advances (with a
// progress bar), pauses on hover, and has dot controls. The active slide scales
// in for a parallax feel and counts its price + AUM up. This is the one place the
// full bento shows on the home page — the grid below keeps baskets tucked away.
export function IndexSpotlight({ indexes }: { indexes: IndexSummary[] }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = indexes.length

  useEffect(() => {
    if (active >= n && n > 0) setActive(0)
  }, [n, active])

  useEffect(() => {
    if (paused || n <= 1) return
    const id = window.setInterval(() => setActive((a) => (a + 1) % n), ADVANCE_MS)
    return () => clearInterval(id)
  }, [paused, n, active])

  if (n === 0) return null
  const current = Math.min(active, n - 1)

  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-md">
        {/* auto-advance progress bar */}
        {n > 1 && (
          <div className="absolute inset-x-0 top-0 z-20 h-[3px] bg-white/[0.06]">
            <div
              key={current}
              className="h-full origin-left bg-cyan/80"
              style={{
                animation: `spotlight-fill ${ADVANCE_MS}ms linear forwards`,
                animationPlayState: paused ? 'paused' : 'running',
              }}
            />
          </div>
        )}

        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {indexes.map((ix, i) => (
            <SpotlightSlide key={`${ix.chainId}:${ix.address}`} ix={ix} active={i === current} />
          ))}
        </div>
      </div>

      {n > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {indexes.map((ix, i) => (
            <button
              key={`${ix.chainId}:${ix.address}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show ${ix.symbol}`}
              aria-current={i === current}
              className={`h-1.5 overflow-hidden rounded-full transition-all ${
                i === current ? 'w-6 bg-white/10' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
            >
              {i === current && (
                <span
                  key={current}
                  className="block h-full w-full origin-left rounded-full bg-cyan"
                  style={{
                    animation: `spotlight-fill ${ADVANCE_MS}ms linear forwards`,
                    animationPlayState: paused ? 'paused' : 'running',
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SpotlightSlide({ ix, active }: { ix: IndexSummary; active: boolean }) {
  const meta = getIndexMeta(ix.address)
  const sector = sectorOf(ix.address)
  const sc = SECTOR_COLOR[sector]
  const up = (ix.change24hPct ?? 0) >= 0
  const accent = up ? '#35e0ff' : '#ff4db8'
  const sig = indexSignatureColor(ix.address, ix.top[0])
  const buyInk = /^#[0-9a-fA-F]{6}$/.test(sig) ? readableInk(sig) : '#0b0b12'
  const nav = useCountUp(ix.navPerToken, active)
  const aum = useCountUp(ix.aumUsd, active)
  const bentoItems = ix.top.map((t) => ({
    symbol: t.symbol,
    address: t.address,
    weightPct: t.weightPct,
    chainId: ix.chainId,
  }))

  return (
    <div
      className="w-full shrink-0 transition-all duration-500 ease-out"
      style={{ transform: active ? 'scale(1)' : 'scale(0.96)', opacity: active ? 1 : 0.4 }}
    >
      <div aria-hidden className="h-1 w-full" style={{ background: sig }} />
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-8">
        {/* details */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <IndexAvatar address={ix.address} symbol={ix.symbol} imageUrl={meta.imageUrl} size={48} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-semibold leading-none text-ink">${ix.symbol}</span>
                <ChainBadge chainId={ix.chainId} />
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: sc, border: `1px solid ${sc}33`, background: `${sc}14` }}
                >
                  {sector}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                by {resolveCreatorFromMeta(meta, ix.deployer, ix.address).label}
              </div>
            </div>
          </div>

          <h2 className="font-display text-2xl font-bold uppercase leading-[0.95] tracking-tight text-ink sm:text-3xl">
            {ix.name || ix.symbol}
          </h2>
          <p className="line-clamp-3 text-sm leading-relaxed text-ink-dim">
            {meta.description ?? `A ${ix.basketLength}-asset onchain index, priced in DSTABLE.`}
          </p>

          <div className="mt-auto flex items-end justify-between gap-3">
            <div>
              <div className="flex items-end gap-2">
                <span className="font-num text-3xl leading-none tabular-nums text-ink">${formatNav(nav)}</span>
                <span
                  className="mb-0.5 rounded-full px-2 py-0.5 font-num text-xs font-semibold tabular-nums"
                  style={{ color: accent, background: `${accent}1a` }}
                >
                  {formatPct(ix.change24hPct)}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-ink-faint">DSTABLE · AUM {formatUsdCompact(aum)}</div>
            </div>
            <div className="h-12 w-28 shrink-0">
              <IndexSpark
                chainId={ix.chainId}
                assets={ix.top.map((t) => ({ address: t.address, weight: t.weightPct }))}
                navPerToken={ix.navPerToken}
                fallback={ix.navSeries}
                range="7D"
              />
            </div>
          </div>

          <Link
            to={`/token?addr=${ix.address}&chain=${ix.chainId}`}
            className="rounded-lg px-5 py-2.5 text-center font-mono text-xs font-bold uppercase tracking-[0.15em] transition-opacity hover:opacity-90"
            style={{ background: sig, color: buyInk }}
          >
            View ${ix.symbol}
          </Link>
        </div>

        {/* the basket — the spotlight's full bento */}
        <div className="flex items-center">
          <BasketBento items={bentoItems} aspect={1.5} className="w-full" />
        </div>
      </div>
    </div>
  )
}
