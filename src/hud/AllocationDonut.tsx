export type Allocation = {
  label: string
  value: number
  color: string
}

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
}

function donutSegment(
  cx: number,
  cy: number,
  R: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const startOuter = polar(cx, cy, R, startAngle)
  const endOuter = polar(cx, cy, R, endAngle)
  const startInner = polar(cx, cy, r, endAngle)
  const endInner = polar(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
    `A ${R} ${R} 0 ${largeArc} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
    `L ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

export function AllocationDonut({
  data,
  ticker,
  sublabel,
  size = 260,
}: {
  data: Allocation[]
  ticker: string
  sublabel?: string
  size?: number
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const gap = 1.6
  let cursor = 0
  const segments = data.map((d) => {
    const start = (cursor / total) * 360
    cursor += d.value
    const end = (cursor / total) * 360
    return {
      ...d,
      path: donutSegment(100, 100, 92, 58, start + gap / 2, end - gap / 2),
    }
  })

  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: size, maxWidth: '100%' }}
    >
      <svg viewBox="0 0 200 200" className="h-full w-full">
        {/* faint connective track read through the segment gaps */}
        <circle
          cx="100"
          cy="100"
          r="75"
          fill="none"
          stroke="var(--color-line)"
          strokeWidth="34"
          opacity="0.3"
        />
        {segments.map((s) => (
          <path key={s.label} d={s.path} fill={s.color}>
            <title>
              {s.label}: {s.value}%
            </title>
          </path>
        ))}
        {/* inner + outer hairlines for the instrument-readout feel */}
        <circle
          cx="100"
          cy="100"
          r="56"
          fill="none"
          stroke="var(--color-line-bright)"
          strokeWidth="1"
        />
        <circle
          cx="100"
          cy="100"
          r="94"
          fill="none"
          stroke="var(--color-line-bright)"
          strokeWidth="1"
          opacity="0.6"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-ink-faint">+</span>
        <span className="font-display text-lg font-bold tracking-wide text-ink">
          {ticker}
        </span>
        {sublabel && (
          <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-ink-faint">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}
