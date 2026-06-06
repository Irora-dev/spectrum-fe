import { Navigate } from 'react-router-dom'
import { TRADING_ENABLED } from '../lib/config/features'

export function Flush() {
  // Fee-claim is a transactional surface — gated with buy/sell (TRADING_ENABLED), the
  // last flag to flip. Direct URLs redirect home; the page stays in the tree.
  if (!TRADING_ENABLED) return <Navigate to="/" replace />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Fee payout</h1>
      <p className="max-w-2xl text-sm text-neutral-400">
        1% on every mint and burn, split 60% holders / 30% creator / 10% buy &amp;
        burn PRISM. Flush accrued fees here.
      </p>
      <div className="rounded-lg border border-dashed border-neutral-800 p-10 text-center text-neutral-600">
        Flush flow — coming later.
      </div>
    </div>
  )
}
