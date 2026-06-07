import { useState } from 'react'
import { BasketBento, type BentoItem } from './BasketBento'
import type { Holding } from '../lib/spectrum/index-data'

// Celebratory, shareable launch card shown on the index page right after a deploy
// (?deployed=1). Mini bento + a one-click "Share on X" (prefilled) and "Copy link".
export function LaunchBanner({
  symbol,
  name,
  addr,
  chainId,
  sig,
  buyInk,
  holdings,
}: {
  symbol: string
  name: string
  addr: string
  chainId: number
  sig: string
  buyInk: string
  holdings: Holding[]
}) {
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)
  if (dismissed) return null

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/token?addr=${addr}&chain=${chainId}`
      : `https://spectrum/token?addr=${addr}&chain=${chainId}`
  const text = `Just launched $${symbol} on Spectrum: ${holdings.length} assets, one token. Trade the whole basket in a single swap.`
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }
  const bentoItems: BentoItem[] = holdings.map((h) => ({
    symbol: h.symbol,
    address: h.asset,
    weightPct: h.targetWeightPct,
    chainId,
  }))

  return (
    <div
      className="relative mb-4 overflow-hidden rounded-2xl border p-5"
      style={{ borderColor: `${sig}55`, background: `linear-gradient(135deg, ${sig}24, rgba(255,255,255,0.02) 60%)` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 h-44 w-[130%] -translate-x-1/2 opacity-45 blur-3xl"
        style={{ background: sig }}
      />
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full text-ink-dim transition-colors hover:bg-white/10 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            Deployed · live
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold uppercase leading-tight tracking-tight text-ink sm:text-3xl">
            ${symbol} is live
          </h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-dim">
            {name} · {holdings.length} assets, one token. Share it, and earn from every trade.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <a
              href={xHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.02]"
              style={{ background: sig, color: buyInk }}
            >
              Share on X
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </a>
            <button
              type="button"
              onClick={copy}
              className="rounded-lg border border-white/15 px-4 py-2.5 font-mono text-xs uppercase tracking-wide text-ink-dim transition-colors hover:border-cyan/50 hover:text-cyan"
            >
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        </div>

        <div className="w-full shrink-0 sm:w-60">
          <BasketBento items={bentoItems} aspect={2} />
        </div>
      </div>
    </div>
  )
}
