import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAllIndexes } from '../lib/spectrum/hooks'
import { IndexCard } from '../components/IndexCard'
import { IndexSpotlight } from '../components/IndexSpotlight'
import { IndexBuilderDemo } from '../components/IndexBuilderDemo'
import { ConceptReveal } from '../components/ConceptReveal'
import { SpectrumWordmark } from '../components/SpectrumWordmark'
import { SECTOR_COLOR, SECTORS, sectorOf, type Sector } from '../lib/spectrum/sectors'
import { formatUsdCompact } from '../lib/spectrum/format'

type ChainFilter = 'all' | 1 | 8453

export function Explore() {
  const { data, isLoading, isError } = useAllIndexes()
  const [chain, setChain] = useState<ChainFilter>('all')
  const [sector, setSector] = useState<Sector | 'all'>('all')

  const all = data ?? []
  const totalTvl = all.reduce((s, ix) => s + (ix.aumUsd || 0), 0)
  const hasBoth = all.some((i) => i.chainId === 1) && all.some((i) => i.chainId === 8453)

  // already sorted by AUM desc from listAllIndexes
  const shown = useMemo(
    () =>
      all.filter((ix) => {
        if (chain !== 'all' && ix.chainId !== chain) return false
        if (sector !== 'all' && sectorOf(ix.address) !== sector) return false
        return true
      }),
    [all, chain, sector],
  )
  const featured = shown.slice(0, 5) // spotlight carousel (top by TVL)

  return (
    <div className="space-y-14 py-4">
      {/* ── hero: title (left) · TVL (right) aligned, centred pitch, live builder ─── */}
      <section className="pt-6">
        {/* centred: pill · logo */}
        <div className="text-center">
          <div>
            <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
              Live · Ethereum &amp; Base
            </div>
          </div>
          <SpectrumWordmark className="mt-6 text-6xl leading-[0.92] tracking-tight sm:text-7xl md:text-9xl lg:text-[9.5rem] xl:text-[11rem]" />
        </div>

        {/* centred pitch */}
        <div className="mt-5 text-center">
          <p className="mx-auto max-w-3xl text-xl leading-snug text-ink-dim sm:text-2xl">
            Spectrum lets anyone launch and trade onchain index tokens. Own a whole basket of assets in a
            single token, and earn from every trade with swap fees distributed automatically to holders.{' '}
            <Link
              to="/learn"
              aria-label="Learn more"
              className="inline-flex align-middle text-cyan transition-transform hover:-translate-y-0.5 hover:translate-x-0.5"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-[1.05em] w-[1.05em]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </Link>
          </p>

          {/* TVL — relocated below the pitch */}
          <div className="mt-8">
            <div
              className="font-num text-4xl font-light leading-none tabular-nums text-ink sm:text-5xl"
              style={{ textShadow: '0 0 40px rgba(53,224,255,0.12)' }}
            >
              {isLoading ? '—' : formatUsdCompact(totalTvl)}
            </div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-ink-faint">
              Total Value · {isLoading ? '—' : `${all.length} indexes`}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/launch"
              className="rounded-lg border border-white/20 bg-white/[0.04] px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:border-cyan hover:text-cyan"
            >
              Launch an index
            </Link>
            <a
              href="#indexes"
              className="rounded-lg border border-white/10 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink-dim transition-colors hover:text-ink"
            >
              Explore ↓
            </a>
          </div>
        </div>

        {/* how it works — cinematic concept reveal, then a hands-on builder */}
        <div className="mt-16 space-y-12">
          <div className="text-center font-mono text-[11px] uppercase tracking-[0.3em] text-ink-faint">
            How it works
          </div>
          <ConceptReveal />
          <IndexBuilderDemo />
        </div>
      </section>

      {/* ── index list: 2-up (top by TVL) then 3-up ──────────────── */}
      <section id="indexes" className="scroll-mt-20 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink">
            Active Indexes
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {hasBoth &&
              ([
                ['all', 'All'],
                [8453, 'Base'],
                [1, 'ETH'],
              ] as const).map(([id, label]) => (
                <FilterPill key={String(id)} active={chain === id} onClick={() => setChain(id as ChainFilter)}>
                  {label}
                </FilterPill>
              ))}
            <span className="mx-1 hidden h-4 w-px bg-white/10 sm:block" />
            <FilterPill active={sector === 'all'} onClick={() => setSector('all')}>
              All sectors
            </FilterPill>
            {SECTORS.map((s) => (
              <FilterPill key={s} active={sector === s} onClick={() => setSector(s)} dot={SECTOR_COLOR[s]}>
                {s}
              </FilterPill>
            ))}
          </div>
        </div>

        {isError && (
          <Empty>Couldn’t load indexes — the public RPC may be rate-limiting. With an Alchemy key it’s reliable.</Empty>
        )}
        {isLoading && (
          <div className="space-y-4">
            <div className="h-72 animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-xl border border-white/5 bg-white/[0.02]" />
            ))}
          </div>
        )}
        {!isLoading && !isError && shown.length === 0 && <Empty>No indexes match these filters.</Empty>}
        {!isLoading && shown.length > 0 && (
          <>
            {/* spotlight — featured indexes, one at a time */}
            <IndexSpotlight indexes={featured} />

            {/* every index, as cards (assets + nav trend), three up */}
            <div className="space-y-3 pt-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                All {shown.length} indexes
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((ix) => (
                  <IndexCard key={`${ix.chainId}:${ix.address}`} ix={ix} />
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
  dot,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  dot?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
        active ? 'border-white/25 bg-white/10 text-ink' : 'border-white/10 text-ink-faint hover:text-ink-dim'
      }`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-ink-faint">
      {children}
    </div>
  )
}
