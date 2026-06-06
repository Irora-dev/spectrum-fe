import { useId, useMemo, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNavHistory } from '../lib/spectrum/hooks'
import { availableRanges, type ChartRange, type NavInput } from '../lib/spectrum/history'
import type { NavPoint } from '../lib/spectrum/index-data'
import { formatNav, formatPct } from '../lib/spectrum/format'

const UP = '#35e0ff'
const DOWN = '#ff4db8'

interface Props {
  chainId: number
  assets: NavInput[]
  navPerToken: number
  ageSec?: number | null
  symbol: string
  /** Cheap series to show while real history loads / if it fails. */
  fallback?: NavPoint[]
  /** Tailwind height classes for the plot area. */
  heightClass?: string
  className?: string
}

function fmtAxis(t: number, range: ChartRange): string {
  const d = new Date(t * 1000)
  if (range === '24H') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function fmtFull(t: number): string {
  return new Date(t * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ChartTooltip({
  active,
  payload,
  symbol,
}: {
  active?: boolean
  payload?: { payload: NavPoint }[]
  symbol: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-white/15 bg-void/90 px-3 py-2 shadow-xl backdrop-blur">
      <div className="font-num text-sm font-semibold tabular-nums text-ink">
        ${formatNav(p.value, 4)}
        <span className="ml-1 text-[10px] font-normal text-ink-faint">{symbol}</span>
      </div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
        {fmtFull(p.time)}
      </div>
    </div>
  )
}

export function IndexChart({
  chainId,
  assets,
  navPerToken,
  ageSec,
  symbol,
  fallback,
  heightClass = 'h-56 sm:h-64',
  className = '',
}: Props) {
  const ranges = useMemo(() => availableRanges(ageSec ?? null), [ageSec])
  const [range, setRange] = useState<ChartRange>(() =>
    ranges.includes('7D') ? '7D' : ranges[0],
  )
  const active = ranges.includes(range) ? range : ranges[0]

  const { data, isLoading } = useNavHistory({ chainId, assets, navPerToken, ageSec, range: active })
  const series = data.length >= 2 ? data : fallback ?? []

  const raw = useId().replace(/[^a-zA-Z0-9]/g, '')
  const strokeId = `cs${raw}`
  const fillId = `cf${raw}`

  const { domain, accent, change } = useMemo(() => {
    if (series.length < 2) return { domain: [0, 1] as [number, number], accent: UP, change: null as number | null }
    const vals = series.map((p) => p.value)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = (max - min) * 0.12 || max * 0.04 || 1
    const first = series[0].value
    const last = series[series.length - 1].value
    const chg = first > 0 ? ((last - first) / first) * 100 : null
    return {
      domain: [min - pad, max + pad] as [number, number],
      accent: chg != null && chg < 0 ? DOWN : UP,
      change: chg,
    }
  }, [series])

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {change != null && (
            <span
              className="font-num text-xs font-semibold tabular-nums"
              style={{ color: accent }}
            >
              {formatPct(change)}
            </span>
          )}
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            {active === 'ALL' ? 'since launch' : `past ${active}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                active === r ? 'bg-white/12 text-ink' : 'text-ink-faint hover:text-ink-dim'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className={`relative w-full ${heightClass}`}>
        {series.length < 2 ? (
          <div className="grid h-full w-full place-items-center rounded-lg bg-white/[0.02] font-mono text-[11px] uppercase tracking-widest text-ink-faint">
            {isLoading ? 'Loading price history…' : 'No price history yet'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 2, bottom: 0, left: 2 }}>
              <defs>
                <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ff9248" />
                  <stop offset="50%" stopColor="#ff4db8" />
                  <stop offset="100%" stopColor="#35e0ff" />
                </linearGradient>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t) => fmtAxis(t as number, active)}
                tick={{ fill: '#565669', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                minTickGap={48}
              />
              <YAxis domain={domain} hide />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.28)', strokeWidth: 1, strokeDasharray: '3 4' }}
                content={<ChartTooltip symbol={symbol} />}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={`url(#${strokeId})`}
                strokeWidth={2}
                fill={`url(#${fillId})`}
                dot={false}
                activeDot={{ r: 3.5, fill: accent, stroke: '#07070b', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
