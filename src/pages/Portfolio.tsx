import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { WALLET_ENABLED } from '../lib/config/features'
import { usePortfolio, type Portfolio as PortfolioData, type PortfolioHolding } from '../lib/spectrum/hooks'
import { IndexCard } from '../components/IndexCard'
import { IndexAvatar } from '../components/IndexAvatar'
import { ChainBadge } from '../components/ChainBadge'
import { WalletButton } from '../components/WalletButton'
import { chainCfg } from '../lib/chain/chains'
import { formatPct, formatUsdCompact, shortAddr } from '../lib/spectrum/format'

// Portfolio / "my positions": the connected wallet's held indexes (balance × NAV)
// and the indexes it deployed. Per-wallet balances are the only fresh read (see
// usePortfolio); the created list + NAVs ride the cached index query.

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-ink-faint">
      {children}
    </div>
  )
}

function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-end justify-between border-b border-white/10 pb-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink">{title}</h2>
      {right && <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">{right}</span>}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">{label}</div>
      <div className="mt-1.5 font-num text-xl font-light leading-none tabular-nums text-ink sm:text-2xl">{value}</div>
    </div>
  )
}

function HoldingRow({ h }: { h: PortfolioHolding }) {
  const ix = h.index
  const change = ix.change24hPct
  const up = (change ?? 0) >= 0
  return (
    <Link
      to={`/token?addr=${ix.address}&chain=${ix.chainId}`}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/25 hover:bg-white/[0.05]"
    >
      <IndexAvatar address={ix.address} symbol={ix.symbol} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-ink">${ix.symbol}</span>
          <ChainBadge chainId={ix.chainId} />
        </div>
        <div className="mt-0.5 truncate text-xs text-ink-dim">{ix.name?.trim() || '—'}</div>
      </div>
      {change != null && (
        <div
          className="hidden w-16 shrink-0 text-right font-num text-xs tabular-nums sm:block"
          style={{ color: up ? '#35e0ff' : '#ff4db8' }}
        >
          {formatPct(change)}
        </div>
      )}
      <div className="shrink-0 text-right">
        <div className="font-num text-sm font-medium tabular-nums text-ink">{formatUsdCompact(h.valueUsd)}</div>
        <div className="font-mono text-[10px] text-ink-faint">
          {h.balance.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${ix.symbol}
        </div>
      </div>
    </Link>
  )
}

function Hero({ p }: { p: PortfolioData }) {
  const chains = Array.from(new Set([...p.holdings.map((h) => h.index.chainId), ...p.created.map((c) => c.chainId)]))
  return (
    <header className="relative overflow-hidden rounded-3xl card-surface backdrop-blur-md">
      <div aria-hidden className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#ff9248,#ff4db8,#35e0ff)' }} />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan opacity-15 blur-3xl" />
      <div className="relative p-6 sm:p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">Portfolio</div>
        <div
          className="mt-2 font-num text-4xl font-light leading-none tabular-nums text-ink sm:text-5xl"
          style={{ textShadow: '0 0 40px rgba(53,224,255,0.12)' }}
        >
          {formatUsdCompact(p.totalValueUsd)}
        </div>
        <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">{shortAddr(p.address)}</div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatTile label="Holding" value={p.heldCount} />
          <StatTile label="Created" value={p.createdCount} />
          <StatTile label="Networks" value={chains.map((c) => chainCfg(c).name).join(' · ') || '—'} />
        </div>
      </div>
    </header>
  )
}

function ConnectGate() {
  return (
    <div className="py-16">
      <div className="mx-auto max-w-md rounded-3xl card-surface p-8 text-center backdrop-blur-md">
        <div aria-hidden className="h-1 w-full -mt-8 mb-7 rounded-t-3xl" style={{ background: 'linear-gradient(90deg,#ff9248,#ff4db8,#35e0ff)' }} />
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Your portfolio</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-dim">
          Connect a wallet to see the indexes you hold and the ones you’ve launched.
        </p>
        <div className="mt-6 flex justify-center">
          <WalletButton />
        </div>
      </div>
    </div>
  )
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-8 py-4">
      <div className="h-44 animate-pulse rounded-3xl border border-white/5 bg-white/[0.02]" />
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-white/5 bg-white/[0.02]" />
        ))}
      </div>
    </div>
  )
}

export function Portfolio() {
  const { address, isConnected } = useAccount()
  const { data: p, isLoading, isError } = usePortfolio(address)

  // Read-only holdings view — needs a connected wallet but no trading. Gated on
  // WALLET_ENABLED so it's available in deploy-only mode; direct URLs redirect home
  // when wallets are off. The page + infra stay in the tree regardless.
  if (!WALLET_ENABLED) return <Navigate to="/" replace />

  if (!isConnected || !address) return <ConnectGate />
  if (isError) return <div className="py-10"><Notice>Couldn’t load your portfolio — the public RPC may be rate-limiting. With an Alchemy key it’s reliable.</Notice></div>
  if (isLoading || !p) return <PortfolioSkeleton />

  const empty = p.heldCount === 0 && p.createdCount === 0

  return (
    <div className="space-y-8 py-4">
      <Hero p={p} />

      {empty && (
        <Notice>
          No positions yet.{' '}
          <Link to="/" className="text-cyan hover:underline">Explore indexes</Link> or{' '}
          <Link to="/launch" className="text-cyan hover:underline">launch your own</Link>.
        </Notice>
      )}

      {p.heldCount > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Holdings" right={`${p.heldCount} held`} />
          <div className="space-y-2.5">
            {p.holdings.map((h) => (
              <HoldingRow key={`${h.index.chainId}:${h.index.address}`} h={h} />
            ))}
          </div>
        </section>
      )}

      {p.createdCount > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Created" right={`${p.createdCount} launched`} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {p.created.map((ix) => (
              <IndexCard key={`${ix.chainId}:${ix.address}`} ix={ix} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
