import type { ReactNode } from 'react'

export * from './icons'
export { PrismMark } from './PrismMark'
export { AllocationDonut } from './AllocationDonut'
export type { Allocation } from './AllocationDonut'

type Accent = 'violet' | 'alert' | 'teal' | 'ink'

const accentText: Record<Accent, string> = {
  violet: 'text-violet-bright',
  alert: 'text-alert',
  teal: 'text-teal',
  ink: 'text-ink',
}

const accentDot: Record<Accent, string> = {
  violet: 'bg-violet-bright',
  alert: 'bg-alert',
  teal: 'bg-teal',
  ink: 'bg-ink',
}

/* ------------------------------------------------------------------ Panel */

function Corner({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-2.5 w-2.5 ${className}`}
    />
  )
}

export function Panel({
  title,
  tag,
  accent = 'violet',
  className = '',
  bodyClassName = 'p-4',
  children,
}: {
  title?: ReactNode
  tag?: ReactNode
  accent?: Accent
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <section className={`relative border border-line bg-panel/70 ${className}`}>
      <Corner className="-left-px -top-px border-l border-t border-violet/50" />
      <Corner className="-right-px -top-px border-r border-t border-violet/50" />
      <Corner className="-bottom-px -left-px border-b border-l border-violet/50" />
      <Corner className="-bottom-px -right-px border-b border-r border-violet/50" />

      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2
            className={`font-display text-xs font-semibold uppercase tracking-[0.2em] ${accentText[accent]}`}
          >
            {title}
          </h2>
          {tag && (
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              {tag}
            </span>
          )}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/* ----------------------------------------------------------- Section label */

export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint ${className}`}
    >
      {children}
    </div>
  )
}

/* ----------------------------------------------------------------- Readout */

export function Readout({
  label,
  value,
  unit,
  hint,
  accent = 'ink',
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  hint?: ReactNode
  accent?: Accent
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        {label}
      </span>
      <span className="font-display text-2xl font-semibold leading-none tnum">
        <span className={accentText[accent]}>{value}</span>
        {unit && <span className="ml-1 text-sm text-ink-dim">{unit}</span>}
      </span>
      {hint && (
        <span className="font-mono text-[10px] tracking-wide text-ink-faint">
          {hint}
        </span>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- Status tag */

export function StatusTag({
  children = 'LIVE',
  accent = 'alert',
}: {
  children?: ReactNode
  accent?: Accent
}) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-line bg-panel-2 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim">
      <span
        className={`h-1.5 w-1.5 animate-pulse rounded-full ${accentDot[accent]}`}
      />
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------- Chip */

export function Chip({
  children,
  icon,
}: {
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-line bg-panel-2 px-2 py-1 font-mono text-[11px] tracking-wide text-ink-dim">
      {icon}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------- Glyph tile */

export function GlyphTile({
  children,
  accent = 'violet',
  size = 'md',
  className = '',
}: {
  children: ReactNode
  accent?: Accent
  size?: 'sm' | 'md'
  className?: string
}) {
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center border border-line bg-panel-2 ${accentText[accent]} ${className}`}
    >
      {children}
    </div>
  )
}

/* --------------------------------------------------------------- Sparkline */

export function Sparkline({
  data,
  className = 'text-violet-bright',
}: {
  data: number[]
  className?: string
}) {
  const w = 72
  const h = 20
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((d - min) / span) * (h - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
