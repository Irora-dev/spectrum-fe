import type { ReactNode } from 'react'
import { useNavHistory } from '../lib/spectrum/hooks'
import { computeReturns } from '../lib/spectrum/history'
import type { IndexData } from '../lib/spectrum/index-data'
import { formatAge, formatPct, formatUsdCompact } from '../lib/spectrum/format'
import { useCountUp } from '../lib/motion'

const DAY = 86400

function Stat({ label, children, accent }: { label: string; children: ReactNode; accent?: string }) {
  return (
    <div className="bg-void/40 px-4 py-3.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">{label}</div>
      <div
        className="mt-1.5 font-num text-lg leading-none tabular-nums text-ink"
        style={accent ? { color: accent } : undefined}
      >
        {children}
      </div>
    </div>
  )
}

// Key metrics + a multi-horizon returns strip. Returns are computed from the
// reconstructed history (one age-clamped fetch) and are immune to absolute NAV
// scaling since they're ratios.
export function IndexStats({ ix, chainId }: { ix: IndexData; chainId: number }) {
  const ageSec = ix.ageHours != null ? ix.ageHours * 3600 : null
  const range = ageSec != null && ageSec <= 30 * DAY ? 'ALL' : '30D'
  const assets = ix.holdings.map((h) => ({
    address: h.asset,
    weight: h.liveWeightPct > 0 ? h.liveWeightPct : h.targetWeightPct,
  }))
  const { data } = useNavHistory({ chainId, assets, navPerToken: ix.navPerToken, ageSec, range })
  const returns = computeReturns(data.length >= 2 ? data : ix.navSeries, ageSec)

  const changeColor =
    ix.change24hPct == null ? undefined : ix.change24hPct >= 0 ? '#35e0ff' : '#ff4db8'
  const fullyPriced = ix.pricedCount >= ix.totalCount
  const aumUp = useCountUp(ix.aumUsd, true)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="AUM">{formatUsdCompact(aumUp)}</Stat>
        <Stat label="24h" accent={changeColor}>
          {formatPct(ix.change24hPct)}
        </Stat>
        <Stat label="Assets">{ix.totalCount}</Stat>
        <Stat label="Priced" accent={fullyPriced ? undefined : '#ff9248'}>
          {ix.pricedCount}/{ix.totalCount}
        </Stat>
        <Stat label="Supply">
          {ix.totalSupply > 0
            ? ix.totalSupply.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })
            : '—'}
        </Stat>
        <Stat label="Launched">{ageSec != null ? `${formatAge(ageSec)} ago` : '—'}</Stat>
      </div>

      {returns.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-3.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">Return</span>
          {returns.map((r) => (
            <div key={r.range} className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                {r.range === 'ALL' ? 'All' : r.range}
              </span>
              <span
                className="font-num text-sm font-semibold tabular-nums"
                style={{ color: r.pct >= 0 ? '#35e0ff' : '#ff4db8' }}
              >
                {formatPct(r.pct)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
