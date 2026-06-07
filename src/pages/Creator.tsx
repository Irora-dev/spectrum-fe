import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCreatorProfile, type CreatorProfile } from '../lib/spectrum/hooks'
import { IndexCard } from '../components/IndexCard'
import { IndexAvatar } from '../components/IndexAvatar'
import { CopyChip } from '../components/DocKit'
import { indexSignatureColor } from '../lib/spectrum/signature'
import { chainCfg } from '../lib/chain/chains'
import { formatUsdCompact, shortAddr } from '../lib/spectrum/format'

// Creator profile: every index a given deployer has launched, with headline stats
// and their resolved identity (X handle → display name → address). Reachable from
// the "by …" line on index cards. Data comes from the cached index list
// (see useCreatorProfile) — opening a profile costs no extra network.

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="py-10">
      <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-ink-faint">
        {children}
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint transition-colors hover:border-white/25 hover:text-ink"
    >
      ← All indexes
    </Link>
  )
}

function StatTile({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">{label}</div>
      <div
        className="mt-1.5 font-num text-xl font-light leading-none tabular-nums text-ink sm:text-2xl"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  )
}

function XLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-ink-dim transition-colors hover:border-cyan/50 hover:text-cyan"
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      {label}
      <span aria-hidden>↗</span>
    </a>
  )
}

function Header({ profile }: { profile: CreatorProfile }) {
  const { identity } = profile
  const top = profile.indexes[0]
  // Tie the page to the creator's flagship index via its signature colour.
  const accent = top ? indexSignatureColor(top.address, top.top[0]) : '#7b5cff'
  const avatarSymbol = identity.kind === 'address' ? 'x' : identity.label.replace(/^@/, '')

  return (
    <header className="relative overflow-hidden rounded-3xl card-surface backdrop-blur-md">
      <div aria-hidden className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: accent }}
      />

      <div className="relative p-6 sm:p-8">
        <BackLink />

        <div className="mt-5 flex flex-wrap items-center gap-5">
          <div className="relative shrink-0">
            <div
              aria-hidden
              className="absolute -inset-1.5 rounded-3xl opacity-60 blur-md"
              style={{ background: `linear-gradient(135deg, ${accent}, #35e0ff)` }}
            />
            <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/20">
              <IndexAvatar address={profile.address} symbol={avatarSymbol} size={64} />
            </div>
          </div>

          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">Creator</div>
            <h1 className="mt-1 break-words font-display text-3xl font-bold leading-[0.95] tracking-tight text-ink sm:text-4xl">
              {identity.label}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              <CopyChip text={profile.address} label={shortAddr(profile.address)} />
              {identity.xUrl && <XLink url={identity.xUrl} label={identity.label} />}
            </div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Indexes" value={profile.indexCount} />
          <StatTile label="Total value" value={formatUsdCompact(profile.totalAumUsd)} />
          <StatTile label="Chains" value={profile.chains.map((c) => chainCfg(c).name).join(' · ') || '—'} />
          {profile.topPerformer && (
            <StatTile label="Top 24h" value={`$${profile.topPerformer.symbol}`} accent={accent} />
          )}
        </div>
      </div>
    </header>
  )
}

function CreatorSkeleton() {
  return (
    <div className="space-y-8 py-4">
      <div className="h-56 animate-pulse rounded-3xl border border-white/5 bg-white/[0.02]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]" />
        ))}
      </div>
    </div>
  )
}

export function Creator() {
  const { address } = useParams()
  const { data: profile, isLoading, isError } = useCreatorProfile(address)

  if (!address) return <Notice>No creator address provided.</Notice>
  if (isError) return <Notice>Couldn’t load creators. The public RPC may be rate-limiting. With an Alchemy key it’s reliable.</Notice>
  if (isLoading || !profile) return <CreatorSkeleton />

  if (profile.indexCount === 0) {
    return (
      <div className="space-y-8 py-4">
        <Header profile={profile} />
        <Notice>No indexes deployed by this address yet.</Notice>
      </div>
    )
  }

  return (
    <div className="space-y-8 py-4">
      <Header profile={profile} />
      <section className="space-y-4">
        <div className="flex items-end justify-between border-b border-white/10 pb-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink">Indexes</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            {profile.indexCount} total
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profile.indexes.map((ix) => (
            <IndexCard key={`${ix.chainId}:${ix.address}`} ix={ix} />
          ))}
        </div>
      </section>
    </div>
  )
}
