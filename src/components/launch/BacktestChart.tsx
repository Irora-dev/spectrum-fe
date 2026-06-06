import { useId, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useBasketBacktest } from '../../lib/spectrum/hooks'
import type { ChartRange, NavInput } from '../../lib/spectrum/history'
import type { NavPoint } from '../../lib/spectrum/index-data'
import { formatNav, formatPct, shortAddr } from '../../lib/spectrum/format'
import { tokenVisual } from '../../lib/spectrum/token-meta'
import { AssetLogo } from '../AssetLogo'

const UP = '#35e0ff'
const DOWN = '#ff4db8'
const START_NAV = 1

const RANGES: ChartRange[] = ['7D', '30D', 'ALL']
const RANGE_LABEL: Record<ChartRange, string> = { '24H': '24H', '7D': '7D', '30D': '30D', ALL: 'MAX' }

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

// Linear-interpolate a sorted series at time t (clamped at the ends).
function sampleAt(s: NavPoint[], t: number): number {
  if (s.length === 0) return NaN
  if (t <= s[0].time) return s[0].value
  const last = s[s.length - 1]
  if (t >= last.time) return last.value
  let lo = 0
  let hi = s.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (s[mid].time <= t) lo = mid
    else hi = mid
  }
  const a = s[lo]
  const b = s[hi]
  const f = b.time === a.time ? 0 : (t - a.time) / (b.time - a.time)
  return a.value + (b.value - a.value) * f
}

function maxDrawdown(series: NavPoint[]): number {
  let peak = -Infinity
  let mdd = 0
  for (const p of series) {
    if (p.value > peak) peak = p.value
    if (peak > 0) {
      const dd = (p.value / peak - 1) * 100
      if (dd < mdd) mdd = dd
    }
  }
  return mdd
}

// ── lightweight SVG sparkline (one per underlying asset; cheaper than recharts) ──
function Spark({ series, color, height = 50 }: { series: NavPoint[]; color: string; height?: number }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '')
  if (series.length < 2)
    return (
      <div
        className="grid place-items-center rounded-md bg-white/[0.02] font-mono text-[10px] uppercase tracking-widest text-ink-dim"
        style={{ height }}
      >
        no data
      </div>
    )
  const W = 100
  const H = height
  const ts = series.map((p) => p.time)
  const vs = series.map((p) => p.value)
  const minT = ts[0]
  const maxT = ts[ts.length - 1]
  let minV = Math.min(...vs, 100)
  let maxV = Math.max(...vs, 100)
  const pad = (maxV - minV) * 0.14 || 1
  minV -= pad
  maxV += pad
  const x = (t: number) => ((t - minT) / (maxT - minT || 1)) * W
  const y = (v: number) => H - ((v - minV) / (maxV - minV || 1)) * H
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(p.time).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' ')
  const area = `${line} L ${W.toFixed(2)} ${H} L 0 ${H} Z`
  const yBase = y(100)
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sp${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <line x1="0" y1={yBase} x2={W} y2={yBase} stroke="rgba(255,255,255,0.16)" strokeWidth={0.75} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <path d={area} fill={`url(#sp${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function IndexTooltip({ active, payload, symbol }: { active?: boolean; payload?: { payload: NavPoint }[]; symbol: string }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  const ret = (p.value / START_NAV - 1) * 100
  return (
    <div className="rounded-lg border border-white/15 bg-void/90 px-3 py-2 shadow-xl backdrop-blur">
      <div className="font-num text-sm font-semibold tabular-nums text-ink">
        ${formatNav(p.value, 4)}
        <span className="ml-1 text-[10px] font-normal text-ink-dim">{symbol || 'NAV'}</span>
      </div>
      <div className="font-num text-[11px] tabular-nums" style={{ color: ret < 0 ? DOWN : UP }}>
        {formatPct(ret)} vs ${formatNav(START_NAV, 2)}
      </div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-dim">{fmtFull(p.time)}</div>
    </div>
  )
}

interface OverlayPayload {
  dataKey: string
  value: number
  color?: string
  stroke?: string
}
function AssetsTooltip({
  active,
  payload,
  label,
  symbols,
}: {
  active?: boolean
  payload?: OverlayPayload[]
  label?: number
  symbols: Record<string, string>
}) {
  if (!active || !payload || payload.length === 0) return null
  const rows = [...payload].filter((p) => p.value != null).sort((a, b) => b.value - a.value)
  return (
    <div className="min-w-[140px] rounded-lg border border-white/15 bg-void/90 px-3 py-2 shadow-xl backdrop-blur">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-dim">
        {label != null ? fmtFull(label) : ''}
      </div>
      {rows.map((p) => {
        const pct = p.value - 100
        return (
          <div key={p.dataKey} className="flex items-center gap-2 py-0.5 text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color ?? p.stroke }} />
            <span className="font-display font-bold uppercase tracking-wide text-ink">
              {symbols[p.dataKey] ?? shortAddr(p.dataKey)}
            </span>
            <span className="ml-auto font-num tabular-nums" style={{ color: pct < 0 ? DOWN : UP }}>
              {formatPct(pct)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface Props {
  chainId: number
  assets: NavInput[]
  symbol?: string
  /** address → ticker. */
  symbols?: Record<string, string>
  /** Render without the outer card chrome (for embedding inside another card). */
  bare?: boolean
}

type View = 'index' | 'assets'

export function BacktestChart({ chainId, assets, symbol = '', symbols = {}, bare = false }: Props) {
  const cardCls = bare ? '' : 'rounded-2xl card-surface p-5 backdrop-blur-md'
  const [range, setRange] = useState<ChartRange>('30D')
  const [view, setView] = useState<View>('index')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showUnderlying, setShowUnderlying] = useState(true)
  const { curve, perAsset, isLoading } = useBasketBacktest({ chainId, assets, range, startNav: START_NAV })

  const strokeId = `bt${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const fillId = `bf${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  const colorFor = (addr: string) => tokenVisual(symbols[addr.toLowerCase()], addr).color
  const tickFor = (addr: string) => symbols[addr.toLowerCase()] ?? shortAddr(addr)

  // Index-mode geometry
  const { domain, accent, ret, drawdown, endNav } = useMemo(() => {
    if (curve.length < 2)
      return { domain: [0, 1] as [number, number], accent: UP, ret: null as number | null, drawdown: null as number | null, endNav: null as number | null }
    const vals = curve.map((p) => p.value)
    const min = Math.min(...vals, START_NAV)
    const max = Math.max(...vals, START_NAV)
    const pad = (max - min) * 0.12 || max * 0.04 || 1
    const last = curve[curve.length - 1].value
    const chg = (last / START_NAV - 1) * 100
    return { domain: [min - pad, max + pad] as [number, number], accent: chg < 0 ? DOWN : UP, ret: chg, drawdown: maxDrawdown(curve), endNav: last }
  }, [curve])

  // Legend = every priced constituent; sorted by weight.
  const legend = useMemo(
    () => perAsset.filter((a) => a.weight > 0 && a.series.length >= 2).sort((a, b) => b.weight - a.weight),
    [perAsset],
  )

  // Assets-mode overlay: merge normalized per-asset series onto one time grid.
  const overlay = useMemo(() => {
    const used = legend.filter((a) => !hidden.has(a.address.toLowerCase()))
    if (used.length === 0) return { rows: [] as Record<string, number>[], used, domain: [0, 1] as [number, number] }
    let grid = used[0].series
    for (const a of used) if (a.series.length > grid.length) grid = a.series
    const rows = grid.map((g) => {
      const row: Record<string, number> = { time: g.time }
      for (const a of used) row[a.address.toLowerCase()] = sampleAt(a.series, g.time)
      return row
    })
    let lo = Infinity
    let hi = -Infinity
    for (const a of used)
      for (const p of a.series) {
        if (p.value < lo) lo = p.value
        if (p.value > hi) hi = p.value
      }
    const pad = (hi - lo) * 0.08 || 1
    return { rows, used, domain: [lo - pad, hi + pad] as [number, number] }
  }, [legend, hidden])

  const hasData = curve.length >= 2
  const toggle = (addr: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      const k = addr.toLowerCase()
      if (next.has(k)) next.delete(k)
      else if (legend.length - next.size > 1) next.add(k) // keep ≥1 line visible
      return next
    })

  return (
    <>
      <section className={cardCls}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
              Projected return profile
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className="font-num text-3xl font-semibold leading-none tabular-nums"
                style={{ color: hasData && ret != null ? accent : '#565669' }}
              >
                {hasData && ret != null ? formatPct(ret) : '—'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-dim">past {RANGE_LABEL[range]}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                  range === r ? 'bg-white/12 text-ink' : 'text-ink-dim hover:text-ink-dim'
                }`}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Index / Assets segmented toggle */}
        <div className="mt-3 inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
          {(['index', 'assets'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
                view === v ? 'bg-white/12 text-ink' : 'text-ink-dim hover:text-ink-dim'
              }`}
            >
              {v === 'index' ? 'Index' : 'Assets'}
            </button>
          ))}
        </div>

        <div className="relative mt-3 h-48 w-full sm:h-56">
          {!hasData ? (
            <div className="grid h-full w-full place-items-center rounded-lg bg-white/[0.02] px-6 text-center font-mono text-[11px] uppercase tracking-widest text-ink-dim">
              {isLoading ? 'Backtesting basket…' : assets.length === 0 ? 'Add assets to project a return' : 'Not enough price history'}
            </div>
          ) : view === 'index' ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 6, right: 2, bottom: 0, left: 2 }}>
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
                  tickFormatter={(t) => fmtAxis(t as number, range)}
                  tick={{ fill: '#565669', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={48}
                />
                <YAxis domain={domain} hide />
                <ReferenceLine y={START_NAV} stroke="rgba(255,255,255,0.22)" strokeDasharray="3 5" strokeWidth={1} />
                <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.28)', strokeWidth: 1, strokeDasharray: '3 4' }} content={<IndexTooltip symbol={symbol} />} isAnimationActive={false} />
                <Area type="monotone" dataKey="value" stroke={`url(#${strokeId})`} strokeWidth={2} fill={`url(#${fillId})`} dot={false} activeDot={{ r: 3.5, fill: accent, stroke: '#07070b', strokeWidth: 2 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overlay.rows} margin={{ top: 6, right: 2, bottom: 0, left: 2 }}>
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(t) => fmtAxis(t as number, range)}
                  tick={{ fill: '#565669', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={48}
                />
                <YAxis domain={overlay.domain} hide />
                <ReferenceLine y={100} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 5" strokeWidth={1} />
                <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.28)', strokeWidth: 1, strokeDasharray: '3 4' }} content={<AssetsTooltip symbols={symbols} />} isAnimationActive={false} />
                {overlay.used.map((a) => (
                  <Line
                    key={a.address}
                    type="monotone"
                    dataKey={a.address.toLowerCase()}
                    stroke={colorFor(a.address)}
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{ r: 3, fill: colorFor(a.address), stroke: '#07070b', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* legend (interactive in Assets mode) */}
        {hasData && legend.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {legend.map((a) => {
              const off = hidden.has(a.address.toLowerCase())
              const color = colorFor(a.address)
              const interactive = view === 'assets'
              return (
                <button
                  key={a.address}
                  type="button"
                  disabled={!interactive}
                  onClick={() => interactive && toggle(a.address)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-opacity ${
                    interactive ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  style={{ borderColor: `${color}40`, background: `${color}12`, opacity: off ? 0.4 : 1 }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="font-display text-[10px] font-bold uppercase tracking-wide text-ink">{tickFor(a.address)}</span>
                  {a.pct != null && (
                    <span className="font-num text-[10px] tabular-nums" style={{ color: a.pct < 0 ? DOWN : UP }}>
                      {formatPct(a.pct)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* index-level stats */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Start NAV" value={`$${formatNav(START_NAV, 2)}`} />
          <Stat label="End NAV" value={hasData && endNav != null ? `$${formatNav(endNav, 2)}` : '—'} accent={hasData && ret != null ? accent : undefined} />
          <Stat label="Max drawdown" value={hasData && drawdown != null ? formatPct(drawdown) : '—'} accent={hasData && drawdown != null && drawdown < 0 ? DOWN : undefined} />
        </div>

        <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-dim">
          Backtest from real constituent prices — how this exact basket would have tracked, not a forecast. Every
          Spectrum index starts at $1.00 NAV.
        </p>
      </section>

      {/* ── Underlying asset charts (small multiples) ───────────────────────── */}
      {hasData && legend.length > 0 && (
        <section className={cardCls}>
          <div className="flex items-center justify-between">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
              Underlying assets · {legend.length}
            </div>
            <button
              type="button"
              onClick={() => setShowUnderlying((s) => !s)}
              className="rounded-md border border-white/12 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-dim transition-colors hover:border-white/30 hover:text-ink"
            >
              {showUnderlying ? 'Hide' : 'Show'}
            </button>
          </div>

          {showUnderlying && (
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {legend.map((a) => {
                const color = colorFor(a.address)
                const tick = tickFor(a.address)
                return (
                  <div key={a.address} className="rounded-xl border border-white/8 bg-black/25 p-2.5" style={{ boxShadow: `inset 0 0 0 1px ${color}1f` }}>
                    <div className="flex items-center gap-2">
                      <AssetLogo address={a.address} symbol={tick} chainId={chainId} size={18} />
                      <span className="truncate font-display text-[11px] font-bold uppercase tracking-wide text-ink">{tick}</span>
                      <span className="ml-auto font-mono text-[10px] text-ink-dim">{a.weight}%</span>
                    </div>
                    <div className="mt-2">
                      <Spark series={a.series} color={color} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-dim">past {RANGE_LABEL[range]}</span>
                      {a.pct != null && (
                        <span className="font-num text-[11px] font-semibold tabular-nums" style={{ color: a.pct < 0 ? DOWN : UP }}>
                          {formatPct(a.pct)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/30 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim">{label}</div>
      <div className="mt-0.5 font-num text-sm font-semibold tabular-nums" style={{ color: accent ?? '#e8e8f0' }}>
        {value}
      </div>
    </div>
  )
}
