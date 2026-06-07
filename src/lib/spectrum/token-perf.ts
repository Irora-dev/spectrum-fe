import { chainCfg } from '../chain/chains'

// Recent price performance for a set of tokens, for the launch "trending" slideshow.
// DexScreener (keyless, per-chain): up to 30 addresses per call; we keep each token's
// deepest pair (so the % reflects the real market, not a dust pool).
export interface TokenPerf {
  address: string
  name: string
  priceUsd: number
  change24h: number | null
  liquidityUsd: number
}

interface DexPair {
  baseToken?: { address?: string; name?: string }
  priceUsd?: string | null
  priceChange?: { h24?: number }
  liquidity?: { usd?: number }
}

export async function fetchTokenPerf(addresses: string[], chainId: number): Promise<Map<string, TokenPerf>> {
  const out = new Map<string, TokenPerf>()
  const uniq = [...new Set(addresses.map((a) => a.toLowerCase()))].slice(0, 30)
  if (uniq.length === 0) return out
  const slug = chainCfg(chainId).dexscreenerSlug
  try {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/${slug}/${uniq.join(',')}`, {
      headers: { Accept: 'application/json' },
    })
    if (!r.ok) return out
    const pairs = (await r.json()) as DexPair[]
    for (const p of pairs ?? []) {
      const a = p.baseToken?.address?.toLowerCase()
      if (!a) continue
      const liquidityUsd = p.liquidity?.usd ?? 0
      const prev = out.get(a)
      if (prev && prev.liquidityUsd >= liquidityUsd) continue // keep the deepest pair
      out.set(a, {
        address: a,
        name: p.baseToken?.name ?? '',
        priceUsd: p.priceUsd ? parseFloat(p.priceUsd) : 0,
        change24h: p.priceChange?.h24 ?? null,
        liquidityUsd,
      })
    }
  } catch {
    /* leave empty → caller falls back to usage order */
  }
  return out
}
