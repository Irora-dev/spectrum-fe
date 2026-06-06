import { useState } from 'react'

const SLUG: Record<number, string> = { 1: 'ethereum', 8453: 'base' }

// Token icon straight from DexScreener's hotlinkable CDN, with an initials fallback.
export function AssetLogo({
  address,
  symbol,
  chainId,
  size = 26,
  discColor,
}: {
  address: string
  symbol: string
  chainId: number
  size?: number
  // When set (bento tiles pass a darkened tile color), the logo is inset inside a
  // disc of this color so the rim shows around it — a softer, on-brand frame in
  // place of the hard black ring — lifted by a subtle drop shadow.
  discColor?: string
}) {
  const [ok, setOk] = useState(true)
  const box = { width: size, height: size }
  const src = `https://dd.dexscreener.com/ds-data/tokens/${SLUG[chainId] ?? 'base'}/${address.toLowerCase()}.png?size=lg`
  const initials = (symbol || '?').replace(/^\$/, '').slice(0, 3).toUpperCase()

  // Framed variant — used by the bento tiles. Padding makes the disc a visible
  // rim (most logos are opaque circles, so a plain bg behind them never shows).
  if (discColor) {
    const pad = Math.max(2, Math.round(size * 0.06))
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full"
        style={{ ...box, padding: pad, backgroundColor: discColor, boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}
      >
        {ok ? (
          <img
            src={src}
            alt={symbol}
            onError={() => setOk(false)}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span
            className="font-semibold leading-none text-white/90"
            style={{ fontSize: Math.max(6, Math.round(size * 0.26)) }}
          >
            {initials}
          </span>
        )}
      </span>
    )
  }

  // Default variant (unchanged) — thin black ring, no disc.
  if (!ok) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-white/10 font-semibold text-ink-dim ring-2 ring-black"
        style={{ ...box, fontSize: Math.max(7, Math.round(size * 0.3)) }}
      >
        {initials}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={symbol}
      onError={() => setOk(false)}
      className="shrink-0 rounded-full bg-white/5 object-cover ring-2 ring-black"
      style={box}
    />
  )
}
