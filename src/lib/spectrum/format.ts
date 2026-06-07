// Display helpers shared by Explore + Token. Numbers stay tabular (`tnum`) in the UI.

export function formatNav(n: number, dp = 4): string {
  if (!isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function formatGrouped(n: number, dp = 0): string {
  if (!isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function formatUsdCompact(n: number): string {
  if (!isFinite(n) || n <= 0) return '—'
  if (n >= 1_000)
    return '$' + n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function formatPct(n: number | null | undefined, dp = 2): string {
  if (n == null || !isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(dp)}%`
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// USD price across a wide magnitude range (tiny memecoins → 4-figure majors).
export function formatPrice(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n <= 0) return '—'
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  if (n >= 0.01) return '$' + n.toFixed(4)
  // Sub-cent (incl. tiny memecoins): plain decimal with a few significant
  // figures — never scientific notation, so "$2.3e-6" reads as "$0.0000023".
  return '$' + n.toLocaleString('en-US', { maximumSignificantDigits: 4 })
}

// Compact "time since" for inception / freshness labels.
export function formatAge(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec) || sec <= 0) return '—'
  const d = sec / 86400
  if (d >= 1) return `${Math.round(d)}d`
  const h = sec / 3600
  if (h >= 1) return `${Math.round(h)}h`
  return `${Math.max(1, Math.round(sec / 60))}m`
}

// Maps a 24h change to the design system's accent for coloring.
export function changeAccent(n: number | null | undefined): 'teal' | 'alert' | 'ink' {
  if (n == null || !isFinite(n)) return 'ink'
  return n >= 0 ? 'teal' : 'alert'
}
