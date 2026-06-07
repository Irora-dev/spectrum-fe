import { useMemo, useState, type ReactNode } from 'react'
import { useAllIndexes } from '../lib/spectrum/hooks'
import { BasketGrid } from '../components/BasketGrid'
import { IndexListRow } from '../components/IndexListRow'
import { getIndexMeta } from '../lib/spectrum/metadata'
import { SECTOR_COLOR, SECTORS, sectorOf, type Sector } from '../lib/spectrum/sectors'
import { formatUsdCompact } from '../lib/spectrum/format'
import { useCountUp } from '../lib/motion'

type ChainFilter = 'all' | 1 | 8453
type SortKey = 'aum' | 'change' | 'name'
type ViewMode = 'grid' | 'list'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'aum', label: 'AUM' },
  { key: 'change', label: '24h change' },
  { key: 'name', label: 'Name A–Z' },
]

// The full, searchable catalogue: a cinematic masthead with live stats, a sticky
// frosted toolbar (search · chain/sector filters · sort · grid⇄list), then every
// index as cards or calm list rows.
export function Explore() {
  const { data, isLoading, isError } = useAllIndexes()
  const [q, setQ] = useState('')
  const [chain, setChain] = useState<ChainFilter>('all')
  const [sector, setSector] = useState<Sector | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('aum')
  const [view, setView] = useState<ViewMode>('grid')

  const all = data ?? []
  const totalTvl = all.reduce((s, ix) => s + (ix.aumUsd || 0), 0)
  const hasBoth = all.some((i) => i.chainId === 1) && all.some((i) => i.chainId === 8453)
  const chainCount = new Set(all.map((i) => i.chainId)).size
  const creatorCount = useMemo(
    () => new Set(all.map((i) => i.deployer?.toLowerCase()).filter(Boolean)).size,
    [all],
  )

  // headline stats count up once the catalogue resolves
  const tvlNum = useCountUp(totalTvl, !isLoading)
  const idxNum = useCountUp(all.length, !isLoading)

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const filtered = all.filter((ix) => {
      if (chain !== 'all' && ix.chainId !== chain) return false
      if (sector !== 'all' && sectorOf(ix.address) !== sector) return false
      if (ql) {
        const m = getIndexMeta(ix.address)
        const hay = [ix.symbol, ix.name, ix.address, ix.deployer ?? '', m.creatorHandle ?? '', m.creatorName ?? '']
          .join(' ')
          .toLowerCase()
        if (!hay.includes(ql)) return false
      }
      return true
    })
    return [...filtered].sort((a, b) => {
      if (sort === 'change') return (b.change24hPct ?? -Infinity) - (a.change24hPct ?? -Infinity)
      if (sort === 'name') return (a.name || a.symbol).localeCompare(b.name || b.symbol)
      return (b.aumUsd || 0) - (a.aumUsd || 0)
    })
  }, [all, q, chain, sector, sort])

  const hasFilters = !!q || chain !== 'all' || sector !== 'all'
  const clearAll = () => {
    setQ('')
    setChain('all')
    setSector('all')
  }

  return (
    <div className="space-y-7 py-4">
      {/* ── masthead: aurora · spectral title · live stats ───────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-9 backdrop-blur-md sm:px-10 sm:py-12">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-cyan/20 blur-[110px]" />
          <div className="absolute right-0 -top-20 h-64 w-64 rounded-full bg-magenta/15 blur-[120px]" />
          <div className="absolute left-1/3 top-10 h-60 w-60 rounded-full bg-violet/15 blur-[130px]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </div>

        <div className="relative">
          <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-ink-faint">The catalogue</div>
          <h1 className="spectral-text mt-3 font-display text-5xl font-black uppercase leading-[0.9] tracking-tight sm:text-7xl">
            Explore
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-dim sm:text-base">
            Every onchain index on Spectrum, across Base and Ethereum, priced in DSTABLE. Search, filter and
            sort the whole catalogue.
          </p>

          {/* live stats ribbon */}
          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
            <Stat label="Total value" value={isLoading ? '—' : formatUsdCompact(tvlNum)} />
            <Stat label="Indexes" value={isLoading ? '—' : String(Math.round(idxNum))} />
            <Stat label="Creators" value={isLoading ? '—' : String(creatorCount)} />
            <Stat label="Networks" value={isLoading ? '—' : `${chainCount}`} sub={hasBoth ? 'Base · ETH' : undefined} />
          </div>
        </div>
      </section>

      {/* ── sticky toolbar: search · filters · sort · view ───────────────── */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-white/10 bg-void/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* search */}
          <div className="relative flex-1">
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, ticker, or creator…"
              className="w-full rounded-xl border border-white/12 bg-white/[0.03] py-2.5 pl-11 pr-10 font-mono text-sm text-ink transition-shadow placeholder:text-ink-faint focus:border-cyan/50 focus:shadow-[0_0_0_3px_rgba(53,224,255,0.12),0_10px_30px_-12px_rgba(53,224,255,0.4)] focus:outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>

          {/* sort + view */}
          <div className="flex shrink-0 items-center gap-2">
            <label className="relative">
              <span className="sr-only">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="cursor-pointer appearance-none rounded-xl border border-white/12 bg-white/[0.03] py-2.5 pl-3 pr-8 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-dim transition-colors hover:text-ink focus:border-cyan/50 focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key} className="bg-void text-ink">
                    Sort · {s.label}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </label>

            <div className="inline-flex rounded-xl border border-white/12 p-0.5">
              <ViewBtn active={view === 'grid'} onClick={() => setView('grid')} label="Grid view">
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
              </ViewBtn>
              <ViewBtn active={view === 'list'} onClick={() => setView('list')} label="List view">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </ViewBtn>
            </div>
          </div>
        </div>

        {/* filter chips */}
        <div className="no-scrollbar mt-2.5 flex items-center gap-2 overflow-x-auto">
          {hasBoth &&
            (
              [
                ['all', 'All'],
                [8453, 'Base'],
                [1, 'ETH'],
              ] as const
            ).map(([id, label]) => (
              <FilterPill key={String(id)} active={chain === id} onClick={() => setChain(id as ChainFilter)}>
                {label}
              </FilterPill>
            ))}
          {hasBoth && <span className="mx-0.5 h-4 w-px shrink-0 bg-white/10" />}
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

      {/* ── results ──────────────────────────────────────────────────────── */}
      <div>
        {!isLoading && !isError && (
          <div className="mb-4 flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
              {shown.length} {shown.length === 1 ? 'basket' : 'baskets'}
              {hasFilters && <span className="text-ink-faint/60"> · of {all.length}</span>}
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-cyan"
              >
                Clear ✕
              </button>
            )}
          </div>
        )}

        {isError && (
          <Empty>Couldn’t load indexes. The public RPC may be rate-limiting. With an Alchemy key it’s reliable.</Empty>
        )}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]" />
            ))}
          </div>
        )}
        {!isLoading && !isError && shown.length === 0 && (
          <Empty>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.03]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </div>
            {q ? `No baskets match “${q}”.` : 'No indexes match these filters.'}
          </Empty>
        )}
        {!isLoading && shown.length > 0 &&
          (view === 'grid' ? (
            <BasketGrid indexes={shown} />
          ) : (
            <div className="space-y-3">
              {shown.map((ix) => (
                <IndexListRow key={`${ix.chainId}:${ix.address}`} ix={ix} />
              ))}
            </div>
          ))}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  subColor,
}: {
  label: string
  value: string
  sub?: string
  subColor?: string
}) {
  return (
    <div className="bg-void/40 px-4 py-3.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-num text-xl font-light tabular-nums text-ink">{value}</span>
        {sub && (
          <span className="font-num text-[11px] font-semibold tabular-nums" style={{ color: subColor ?? '#7e8190' }}>
            {sub}
          </span>
        )}
      </div>
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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
        active ? 'border-white/25 bg-white/10 text-ink' : 'border-white/10 text-ink-faint hover:text-ink-dim'
      }`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  )
}

function ViewBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
        active ? 'bg-white/12 text-ink' : 'text-ink-faint hover:text-ink-dim'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-ink-faint">
      {children}
    </div>
  )
}
