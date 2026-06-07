import { useState } from 'react'
import type { IndexData } from '../lib/spectrum/index-data'
import { formatNav } from '../lib/spectrum/format'

const FEE = 0.01 // 1% swap fee

// Mint/redeem preview. The estimate math is live (NAV-based); the actual on-chain
// trade wires up with the launch/router work (#9), so the button stays disabled.
export function TradePanel({ ix, sig, buyInk }: { ix: IndexData; sig: string; buyInk: string }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')

  const amt = parseFloat(amount)
  const valid = isFinite(amt) && amt > 0 && ix.navPerToken > 0
  const out = !valid
    ? 0
    : side === 'buy'
      ? (amt * (1 - FEE)) / ix.navPerToken
      : amt * ix.navPerToken * (1 - FEE)
  const feeAmt = valid ? amt * FEE : 0

  const inUnit = side === 'buy' ? 'DSTABLE' : `$${ix.symbol}`
  const outUnit = side === 'buy' ? `$${ix.symbol}` : 'DSTABLE'

  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
      {/* side toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 p-1">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`rounded-md py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              side === s ? 'bg-white/12 text-ink' : 'text-ink-faint hover:text-ink-dim'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* amount in */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          <span>{side === 'buy' ? 'You pay' : 'You sell'}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-void/40 px-3 py-2.5 focus-within:border-cyan/50">
          <input
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            className="min-w-0 flex-1 bg-transparent font-num text-xl tabular-nums text-ink outline-none placeholder:text-ink-faint"
          />
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-ink-dim">{inUnit}</span>
        </div>
      </div>

      {/* estimated out */}
      <div className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">You receive (est.)</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-num text-xl tabular-nums text-ink">{valid ? formatNav(out, side === 'buy' ? 4 : 2) : '0.0'}</span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-dim">{outUnit}</span>
        </div>
      </div>

      {/* details */}
      <dl className="mt-3 space-y-1.5 font-mono text-[11px] text-ink-faint">
        <div className="flex justify-between">
          <dt>Price</dt>
          <dd className="tabular-nums text-ink-dim">1 ${ix.symbol} = ${formatNav(ix.navPerToken)} DSTABLE</dd>
        </div>
        <div className="flex justify-between">
          <dt>Fee (1%)</dt>
          <dd className="tabular-nums text-ink-dim">{valid ? `${formatNav(feeAmt, 2)} ${inUnit}` : '—'}</dd>
        </div>
      </dl>

      {/* action (disabled until #9) */}
      <button
        type="button"
        disabled
        title="Trading wires up with the launch / router work (#9)"
        className="mt-4 w-full cursor-not-allowed rounded-lg px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] opacity-60"
        style={{ background: sig, color: buyInk }}
      >
        {side === 'buy' ? `Buy $${ix.symbol}` : `Sell $${ix.symbol}`}
      </button>
      <div className="mt-2 text-center font-mono text-[9px] uppercase tracking-wider text-ink-faint">
        Trading coming soon
      </div>

      {/* fee / flywheel callout */}
      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-cyan">1% protocol fee · split onchain</div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-ink-dim">
          <span><span className="text-ink">60%</span> holders</span>
          <span><span className="text-ink">30%</span> creator</span>
          <span><span className="text-ink">10%</span> burn PRISM</span>
        </div>
      </div>
    </div>
  )
}
