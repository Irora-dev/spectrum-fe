// Mechanical "basket health" readout for the weights step — diversification (how
// concentrated the weights are) + an aggregate slippage estimate from the routing
// pools' real depth. Factual liquidity math, NOT a performance/return projection.

const REF_MINT = 1000 // reference mint size for the slippage estimate, USD

interface HealthAsset {
  symbol: string
  address: string
  depthUsd: number | null
}

function fmtPct(n: number): string {
  if (n < 0.01) return '<0.01%'
  return `${n < 1 ? n.toFixed(2) : n.toFixed(1)}%`
}

export function BasketHealth({ assets, weights }: { assets: HealthAsset[]; weights: number[] }) {
  if (assets.length < 2) return null

  const total = weights.reduce((a, b) => a + (b || 0), 0) || 100
  const fracs = weights.map((w) => (w || 0) / total)
  const top = Math.round(Math.max(...weights.map((w) => w || 0)))

  // Aggregate price impact for a reference mint: each asset takes w·T through its pool,
  // impact_i ≈ (w·T)/depth_i; NAV-weighted ⇒ T·Σ(w_frac² / depth_i).
  let impact = 0
  let unpriced = 0
  fracs.forEach((f, i) => {
    const d = assets[i]?.depthUsd
    if (d == null || d <= 0) {
      unpriced++
      return
    }
    impact += (f * f * REF_MINT) / d
  })
  const slip = impact * 100
  const allUnpriced = unpriced === assets.length

  const conc =
    top <= 45 ? { c: '#34d6c4', t: 'Balanced' } : top <= 70 ? { c: '#ff9248', t: 'Tilted' } : { c: '#ff4d6d', t: 'Concentrated' }
  const liq = slip < 0.5 ? { c: '#34d6c4', t: 'Deep' } : slip < 2 ? { c: '#ff9248', t: 'Moderate' } : { c: '#ff4d6d', t: 'Thin' }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Basket health</span>
        <span className="font-mono text-[9px] uppercase tracking-wide text-ink-faint/70">estimate</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* diversification / concentration */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Spread</span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wide" style={{ color: conc.c }}>
              {conc.t}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-num text-lg font-bold tabular-nums text-ink">{assets.length}</span>
            <span className="font-mono text-[10px] text-ink-dim">assets · top {top}%</span>
          </div>
          <div aria-hidden className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${top}%`, background: conc.c }} />
          </div>
        </div>

        {/* routing liquidity / slippage */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Liquidity</span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wide" style={{ color: liq.c }}>
              {allUnpriced ? '—' : liq.t}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-num text-lg font-bold tabular-nums" style={{ color: allUnpriced ? '#a7a8bb' : liq.c }}>
              {allUnpriced ? '—' : `≈${fmtPct(slip)}`}
            </span>
            <span className="font-mono text-[10px] text-ink-dim">slip · $1k mint</span>
          </div>
          <div className="mt-2 font-mono text-[9.5px] leading-tight text-ink-faint">
            {unpriced > 0 ? `${unpriced} pool${unpriced > 1 ? 's' : ''} unmeasured` : 'from live routing-pool depth'}
          </div>
        </div>
      </div>
    </div>
  )
}
