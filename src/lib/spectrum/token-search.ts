import { chainCfg } from '../chain/chains'

// ─────────────────────────────────────────────────────────────────────────────
// Token search by name/symbol for the launch basket builder.
//
// Source: DexScreener's keyless search (`/latest/dex/search?q=`) — the same
// provider used for pricing. It returns pairs across all chains; we filter to the
// active chain, require the query to actually appear in the token's symbol/name
// (drops fuzzy noise), dedupe by token address, and rank by pool liquidity so the
// real token surfaces above impostors. CORS-clean from the browser.
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenHit {
  address: string
  symbol: string
  name: string
  liquidityUsd: number
}

interface DexPair {
  chainId?: string
  baseToken?: { address?: string; name?: string; symbol?: string }
  liquidity?: { usd?: number }
}

export async function searchTokens(
  query: string,
  chainId: number,
  signal?: AbortSignal,
): Promise<TokenHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const slug = chainCfg(chainId).dexscreenerSlug // 'base' | 'ethereum' — matches DexScreener chainId
  const ql = q.toLowerCase()

  let pairs: DexPair[] = []
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const json = (await res.json()) as { pairs?: DexPair[] }
    pairs = json.pairs ?? []
  } catch {
    return []
  }

  const byAddr = new Map<string, TokenHit>()
  for (const p of pairs) {
    if (p.chainId !== slug) continue
    const address = p.baseToken?.address
    if (!address) continue
    const symbol = p.baseToken?.symbol ?? ''
    const name = p.baseToken?.name ?? ''
    // Relevance gate: the query must appear in the symbol or name.
    if (!symbol.toLowerCase().includes(ql) && !name.toLowerCase().includes(ql)) continue
    const liquidityUsd = p.liquidity?.usd ?? 0
    const key = address.toLowerCase()
    const cur = byAddr.get(key)
    if (!cur || liquidityUsd > cur.liquidityUsd) byAddr.set(key, { address, symbol, name, liquidityUsd })
  }

  return [...byAddr.values()]
    .sort((a, b) => {
      // exact symbol match first, then a symbol that starts with the query, then liquidity
      const score = (h: TokenHit) =>
        h.symbol.toLowerCase() === ql ? 2 : h.symbol.toLowerCase().startsWith(ql) ? 1 : 0
      const ds = score(b) - score(a)
      return ds !== 0 ? ds : b.liquidityUsd - a.liquidityUsd
    })
    .slice(0, 8)
}
