import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useIndexData } from '../lib/spectrum/hooks'
import { getIndexMeta } from '../lib/spectrum/metadata'
import { SECTOR_COLOR, sectorOf } from '../lib/spectrum/sectors'
import { chainCfg } from '../lib/chain/chains'
import { IndexAvatar } from '../components/IndexAvatar'
import { ChainBadge } from '../components/ChainBadge'
import { IndexChart } from '../components/IndexChart'
import { IndexStats } from '../components/IndexStats'
import { HoldingsView } from '../components/HoldingsView'
import { TradePanel } from '../components/TradePanel'
import { CopyChip } from '../components/DocKit'
import { indexSignatureColor } from '../lib/spectrum/signature'
import { readableInk } from '../lib/spectrum/token-meta'
import { formatNav, formatPct, shortAddr } from '../lib/spectrum/format'
import { resolveCreator } from '../lib/spectrum/creator'
import { TRADING_ENABLED } from '../lib/config/features'

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="py-10">
      <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-ink-faint">
        {children}
      </div>
    </div>
  )
}

function ShareButton() {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:border-cyan/50 hover:text-cyan"
    >
      {copied ? 'Link copied' : 'Share'}
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17L17 7M7 7h10v10" />
      </svg>
    </button>
  )
}

function LoadingSkeleton() {
  return (
    <div className="py-6">
      <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
      <div className="mt-4 overflow-hidden rounded-2xl card-surface">
        <div className="h-1 w-full bg-white/10" />
        <div className="flex flex-wrap justify-between gap-6 border-b border-white/10 p-6">
          <div className="space-y-3">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-white/10" />
            <div className="h-8 w-64 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
          </div>
          <div className="h-12 w-40 animate-pulse rounded bg-white/10" />
        </div>
        <div className="border-b border-white/10 p-6">
          <div className="h-64 animate-pulse rounded-lg bg-white/[0.04]" />
        </div>
        <div className="grid grid-cols-3 gap-4 border-b border-white/10 p-6 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-white/[0.04]" />
          ))}
        </div>
        <div className="p-6">
          <div className="h-40 animate-pulse rounded-lg bg-white/[0.04]" />
        </div>
      </div>
    </div>
  )
}

export function Token() {
  const [params] = useSearchParams()
  const addr = params.get('addr') ?? undefined
  const chainId = Number(params.get('chain')) || 8453
  const { data: ix, isLoading, isError } = useIndexData(addr, chainId)

  if (!addr) return <Notice>No index address provided (?addr=0x…).</Notice>
  if (isLoading) return <LoadingSkeleton />
  if (isError || !ix) return <Notice>Couldn’t load this index — try again, or set an Alchemy key for reliable reads.</Notice>

  const meta = getIndexMeta(addr)
  const creator = resolveCreator({
    handle: meta.creatorHandle,
    name: meta.creatorName,
    xUrl: meta.xUrl,
    deployer: ix.deployer,
    indexAddress: addr,
  })
  const sector = sectorOf(addr)
  const sc = SECTOR_COLOR[sector]
  const accent = (ix.change24hPct ?? 0) >= 0 ? '#35e0ff' : '#ff4db8'
  const dom = ix.holdings.reduce(
    (a, b) => (b.targetWeightPct > (a?.targetWeightPct ?? -1) ? b : a),
    ix.holdings[0] as (typeof ix.holdings)[number] | undefined,
  )
  const sig = indexSignatureColor(addr, dom ? { symbol: dom.symbol, address: dom.asset } : undefined)
  const buyInk = /^#[0-9a-fA-F]{6}$/.test(sig) ? readableInk(sig) : '#0b0b12'
  const explorerName = chainId === 1 ? 'Etherscan' : 'Basescan'

  return (
    <div className="py-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
        >
          ← All indexes
        </Link>
        <ShareButton />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl card-surface backdrop-blur-md">
        <div aria-hidden className="h-1 w-full" style={{ background: sig }} />

        {/* ── header: identity (left) · price (right) ─────────────── */}
        <div className="flex flex-col gap-6 border-b border-white/10 p-6 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          {/* identity */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <IndexAvatar address={addr} symbol={ix.symbol} imageUrl={meta.imageUrl} size={52} />
              <div>
                <span className="inline-block rounded-md bg-white/10 px-2 py-0.5 font-mono text-[12px] font-semibold text-cyan">
                  ${ix.symbol}
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <ChainBadge chainId={chainId} />
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: sc, border: `1px solid ${sc}33`, background: `${sc}14` }}
                  >
                    {sector}
                  </span>
                </div>
              </div>
            </div>

            <h1 className="font-display text-4xl font-bold uppercase leading-[0.92] tracking-tight text-ink">
              {ix.name || ix.symbol}
            </h1>

            <div className="flex items-center gap-2">
              <IndexAvatar
                address={meta.creatorAddress ?? creator.address ?? addr}
                symbol={creator.kind === 'address' ? 'x' : creator.label.replace(/^@/, '')}
                imageUrl={meta.creatorAvatarUrl}
                size={22}
              />
              <span className="text-xs text-ink-faint">
                created by{' '}
                {creator.xUrl ? (
                  <a
                    href={creator.xUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-dim underline-offset-4 hover:text-cyan hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {creator.label}
                  </a>
                ) : (
                  <span className="text-ink-dim">{creator.label}</span>
                )}
              </span>
            </div>
          </div>

          {/* price */}
          <div className="shrink-0 sm:text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Price (${ix.symbol})
            </div>
            <div className="mt-1 flex items-end gap-2 sm:justify-end">
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
            <div className="mt-1 font-mono text-[10px] text-ink-faint">DSTABLE · NAV per token</div>
          </div>
        </div>

        {/* ── chart: full width ───────────────────────────────────── */}
        <div className="border-b border-white/10 px-4 py-5 sm:px-6">
          <IndexChart
            chainId={chainId}
            assets={ix.holdings.map((h) => ({
              address: h.asset,
              weight: h.liveWeightPct > 0 ? h.liveWeightPct : h.targetWeightPct,
            }))}
            navPerToken={ix.navPerToken}
            ageSec={ix.ageHours != null ? ix.ageHours * 3600 : null}
            symbol={`$${ix.symbol}`}
            fallback={ix.navSeries}
            heightClass="h-64 sm:h-72"
            className="w-full"
          />
        </div>

        {/* ── key stats + returns ─────────────────────────────────── */}
        <div className="border-b border-white/10 px-6 py-5">
          <IndexStats ix={ix} chainId={chainId} />
        </div>

        {/* ── thesis / description ───────────────────────────────── */}
        <div className="border-b border-white/10 px-6 py-5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            {meta.tagline ?? 'About'}
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-ink-dim">
            {meta.description ?? `A ${ix.totalCount}-asset onchain index, priced in DSTABLE.`}
          </p>
        </div>

        {/* ── holdings (left) · trade + contract (right rail) ─────── */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-4 sm:p-6 lg:border-r lg:border-white/10">
            <HoldingsView holdings={ix.holdings} chainId={chainId} />
          </div>
          <div className="space-y-4 border-t border-white/10 p-4 sm:p-6 lg:border-t-0">
            {TRADING_ENABLED && <TradePanel ix={ix} sig={sig} buyInk={buyInk} />}

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">Contract</div>
              <div className="flex flex-wrap items-center gap-2">
                <CopyChip text={addr} label={shortAddr(addr)} />
                <a
                  href={`${chainCfg(chainId).explorer}/token/${addr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-dim transition-colors hover:text-cyan"
                >
                  {explorerName}
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M7 7h10v10" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
