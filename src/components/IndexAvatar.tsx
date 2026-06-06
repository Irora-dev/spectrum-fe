// Per-index image. Creators set a custom image at launch (wired via the metadata
// layer, task #8 — pass `imageUrl`). Until then every index gets a deterministic
// spectral default derived from its address, so early/un-set indexes still look intentional.

const PALETTE = ['#35e0ff', '#ff4db8', '#ff9248', '#a48bff', '#5cff8f']

function hashAddr(addr: string): number {
  let h = 0
  for (let i = 2; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0
  return h
}

export function IndexAvatar({
  address,
  symbol,
  imageUrl,
  size = 44,
  className = '',
}: {
  address: string
  symbol: string
  imageUrl?: string
  size?: number
  className?: string
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={symbol}
        width={size}
        height={size}
        className={`shrink-0 rounded-xl object-cover ring-1 ring-white/10 ${className}`}
      />
    )
  }

  const h = hashAddr(address)
  const len = PALETTE.length
  const i1 = h % len
  const i2 = (i1 + 1 + (h % (len - 1))) % len // always differs from i1
  const angle = h % 360
  const letter = (symbol || '?').replace(/^\$/, '').slice(0, 1).toUpperCase()

  return (
    <div
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-white/10 ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(${angle}deg, ${PALETTE[i1]}, ${PALETTE[i2]})` }}
    >
      {/* refracted light streak — ties the default into the spectrum motif */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.55) 50%, transparent 62%)' }}
      />
      <span className="relative font-display font-bold text-black/80" style={{ fontSize: size * 0.42 }}>
        {letter}
      </span>
    </div>
  )
}
