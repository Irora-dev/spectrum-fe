import {
  encodePacked,
  formatUnits,
  keccak256,
  toHex,
  zeroAddress,
  type Address,
} from 'viem'
import { clientFor, hasAlchemyKey } from '../chain/rpc'
import { chainCfg, type ChainCfg } from '../chain/chains'
import { V4_POOLS_SLOT } from '../chain/constants'
import {
  aerodromeFactoryAbi,
  erc20MetaAbi,
  poolManagerExtsloadAbi,
  v2FactoryAbi,
  v2PairAbi,
  v3FactoryAbi,
  v4InitializeEvent,
} from './abis'
import {
  DYNAMIC_FEE_FLAG,
  NATIVE_ETH,
  PoolDetectionError,
  VENUE_LABEL,
  Venue,
  ZERO_POOL_KEY,
  type BasketRoute,
  type BestPoolResult,
  type PoolCandidate,
} from './types'

type Client = ReturnType<typeof clientFor>

// Standard Uniswap V3 fee tiers (pip fee → tick spacing).
const V3_FEE_TIERS: { fee: number; tickSpacing: number }[] = [
  { fee: 100, tickSpacing: 1 },
  { fee: 500, tickSpacing: 10 },
  { fee: 3000, tickSpacing: 60 },
  { fee: 10000, tickSpacing: 200 },
]

const SHALLOW_USD_THRESHOLD = 10_000

// ── V2 ───────────────────────────────────────────────────────────────────────
async function findV2(client: Client, cfg: ChainCfg, asset: Address): Promise<PoolCandidate | null> {
  const pair = await client
    .readContract({ address: cfg.uniV2Factory, abi: v2FactoryAbi, functionName: 'getPair', args: [asset, cfg.weth] })
    .catch(() => zeroAddress)
  if (!pair || pair.toLowerCase() === zeroAddress) return null
  try {
    const [reserves, token0] = await Promise.all([
      client.readContract({ address: pair, abi: v2PairAbi, functionName: 'getReserves' }),
      client.readContract({ address: pair, abi: v2PairAbi, functionName: 'token0' }),
    ])
    const wethReserve = token0.toLowerCase() === cfg.weth.toLowerCase() ? reserves[0] : reserves[1]
    const depthEth = Number(formatUnits(wethReserve, 18))
    if (depthEth <= 0) return null
    return {
      venue: Venue.V2,
      label: VENUE_LABEL[Venue.V2],
      fee: 3000,
      tickSpacing: 0,
      poolAddress: pair,
      poolId: null,
      ethPoolKey: null,
      depthEth,
      depthUsd: null,
    }
  } catch {
    return null
  }
}

// ── V3 (sweep all standard fee tiers) ─────────────────────────────────────────
async function findV3(client: Client, cfg: ChainCfg, asset: Address): Promise<PoolCandidate[]> {
  const results = await Promise.all(
    V3_FEE_TIERS.map(async (tier): Promise<PoolCandidate | null> => {
      const pool = await client
        .readContract({ address: cfg.uniV3Factory, abi: v3FactoryAbi, functionName: 'getPool', args: [asset, cfg.weth, tier.fee] })
        .catch(() => zeroAddress)
      if (!pool || pool.toLowerCase() === zeroAddress) return null
      // Depth = the WETH the pool actually holds (real reserves, not a heuristic).
      const wethBal = await client
        .readContract({ address: cfg.weth, abi: erc20MetaAbi, functionName: 'balanceOf', args: [pool] })
        .catch(() => 0n)
      const depthEth = Number(formatUnits(wethBal, 18))
      if (depthEth <= 0) return null
      return {
        venue: Venue.V3,
        label: VENUE_LABEL[Venue.V3],
        fee: tier.fee,
        tickSpacing: tier.tickSpacing,
        poolAddress: pool,
        poolId: null,
        ethPoolKey: null,
        depthEth,
        depthUsd: null,
      }
    }),
  )
  return results.filter((c): c is PoolCandidate => c !== null)
}

// ── V4 (discover via Initialize logs; depth via PoolManager storage) ──────────
interface V4Init {
  id: `0x${string}`
  fee: number
  tickSpacing: number
  hooks: Address
}

function toRecs(
  logs: { args: { id?: `0x${string}`; fee?: number; tickSpacing?: number; hooks?: `0x${string}` } }[],
): V4Init[] {
  return logs
    .filter((l) => l.args.id)
    .map((l) => ({
      id: l.args.id as `0x${string}`,
      fee: l.args.fee ?? 0,
      tickSpacing: l.args.tickSpacing ?? 0,
      hooks: (l.args.hooks ?? zeroAddress) as Address,
    }))
}

// V4 ETH pools are native-ETH (currency0 = address(0), currency1 = asset). Discovery
// is by Initialize logs. With an Alchemy key, one filtered full-range call is instant;
// public RPCs choke on wide ranges, so fall back to a bounded, PARALLEL recent scan
// (and flag partial coverage so the caller can warn).
async function scanV4Initialize(
  client: Client,
  poolManager: Address,
  asset: Address,
): Promise<{ inits: V4Init[]; partial: boolean }> {
  // V4 has no factory getPool — discovery is by Initialize logs over the full range.
  // Only Alchemy-class endpoints serve a wide filtered getLogs quickly; public RPCs
  // rate-limit/time out. So without a key we skip V4 and flag partial coverage
  // rather than hang. (One filtered full-range call is instant on Alchemy.)
  if (!hasAlchemyKey()) return { inits: [], partial: true }
  try {
    const logs = await client.getLogs({
      address: poolManager,
      event: v4InitializeEvent,
      args: { currency0: NATIVE_ETH, currency1: asset },
      fromBlock: 0n,
      toBlock: 'latest',
    })
    return { inits: toRecs(logs), partial: false }
  } catch {
    return { inits: [], partial: true }
  }
}

// Virtual ETH-side reserve from PoolManager storage: amount0 ≈ L · 2^96 / sqrtPriceX96.
async function v4DepthEth(client: Client, poolManager: Address, id: `0x${string}`): Promise<number> {
  try {
    const base = keccak256(encodePacked(['bytes32', 'uint256'], [id, V4_POOLS_SLOT]))
    const liquiditySlot = toHex(BigInt(base) + 3n, { size: 32 }) // StateLibrary: liquidity at base+3
    const [slot0Word, liqWord] = await Promise.all([
      client.readContract({ address: poolManager, abi: poolManagerExtsloadAbi, functionName: 'extsload', args: [base] }),
      client.readContract({ address: poolManager, abi: poolManagerExtsloadAbi, functionName: 'extsload', args: [liquiditySlot] }),
    ])
    const sqrtP = BigInt(slot0Word) & ((1n << 160n) - 1n)
    const liquidity = BigInt(liqWord) & ((1n << 128n) - 1n)
    if (sqrtP === 0n || liquidity === 0n) return 0
    const ethWei = (liquidity << 96n) / sqrtP
    return Number(formatUnits(ethWei, 18))
  } catch {
    return 0
  }
}

async function findV4(
  client: Client,
  cfg: ChainCfg,
  asset: Address,
): Promise<{ candidates: PoolCandidate[]; partial: boolean }> {
  const { inits, partial } = await scanV4Initialize(client, cfg.poolManager, asset)
  const seen = new Set<string>()
  const out: PoolCandidate[] = []
  for (const init of inits) {
    if (seen.has(init.id)) continue
    seen.add(init.id)
    if (init.hooks.toLowerCase() !== zeroAddress) continue // only no-hook pools can be routed
    if (init.fee === DYNAMIC_FEE_FLAG) continue // reject dynamic-fee pools
    const depthEth = await v4DepthEth(client, cfg.poolManager, init.id)
    if (depthEth <= 0) continue
    out.push({
      venue: Venue.V4,
      label: VENUE_LABEL[Venue.V4],
      fee: init.fee,
      tickSpacing: init.tickSpacing,
      poolAddress: null,
      poolId: init.id,
      ethPoolKey: {
        currency0: NATIVE_ETH,
        currency1: asset,
        fee: init.fee,
        tickSpacing: init.tickSpacing,
        hooks: zeroAddress,
      },
      depthEth,
      depthUsd: null,
    })
  }
  return { candidates: out, partial }
}

// ── Aerodrome (Base) — detect so we can warn (can't host hooks) ───────────────
async function aerodromeExists(client: Client, cfg: ChainCfg, asset: Address): Promise<boolean> {
  if (!cfg.aerodromeFactory) return false
  const factory = cfg.aerodromeFactory
  try {
    const [volatile, stable] = await Promise.all([
      client.readContract({ address: factory, abi: aerodromeFactoryAbi, functionName: 'getPool', args: [asset, cfg.weth, false] }).catch(() => zeroAddress),
      client.readContract({ address: factory, abi: aerodromeFactoryAbi, functionName: 'getPool', args: [asset, cfg.weth, true] }).catch(() => zeroAddress),
    ])
    return volatile.toLowerCase() !== zeroAddress || stable.toLowerCase() !== zeroAddress
  } catch {
    return false
  }
}

async function wethUsdPrice(slug: string, weth: Address): Promise<number | null> {
  try {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/${slug}/${weth}`, { headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    const pairs = (await r.json()) as { priceUsd?: string; liquidity?: { usd?: number } }[]
    let best: number | null = null
    let bestLiq = -1
    for (const p of pairs) {
      const liq = p?.liquidity?.usd ?? 0
      if (liq > bestLiq && p?.priceUsd) {
        bestLiq = liq
        best = parseFloat(p.priceUsd)
      }
    }
    return best
  } catch {
    return null
  }
}

// Real USD liquidity per pool, keyed by the pool's on-chain identifier — V2/V3 pool
// CONTRACT address, V4 pool id (DexScreener uses the 32-byte poolId as `pairAddress`
// for v4). This is the cross-venue-consistent depth metric (pool TVL, the same way
// for every DEX version) and matches what users see in the asset search.
async function fetchPoolLiquidity(slug: string, asset: Address): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const r = await fetch(`https://api.dexscreener.com/token-pairs/v1/${slug}/${asset}`, {
      headers: { Accept: 'application/json' },
    })
    if (!r.ok) return map
    const pairs = (await r.json()) as { pairAddress?: string; liquidity?: { usd?: number } }[]
    for (const p of pairs ?? []) {
      const key = p.pairAddress?.toLowerCase()
      if (key) map.set(key, p.liquidity?.usd ?? 0)
    }
  } catch {
    /* DexScreener unavailable → caller falls back to on-chain depth */
  }
  return map
}

async function readDecimals(client: Client, asset: Address): Promise<number> {
  try {
    return Number(await client.readContract({ address: asset, abi: erc20MetaAbi, functionName: 'decimals' }))
  } catch {
    return 18
  }
}

function toRoute(c: PoolCandidate): BasketRoute {
  if (c.venue === Venue.V4) return { venue: Venue.V4, ethPool: c.ethPoolKey!, v3Fee: 0, v2Pair: zeroAddress }
  if (c.venue === Venue.V3) return { venue: Venue.V3, ethPool: ZERO_POOL_KEY, v3Fee: c.fee, v2Pair: zeroAddress }
  return { venue: Venue.V2, ethPool: ZERO_POOL_KEY, v3Fee: 0, v2Pair: c.poolAddress! }
}

/**
 * Find the deepest valid Uniswap pool (v2/v3/v4 vs ETH/WETH) for `asset` on `chainId`.
 * Rejects dynamic-fee and hooked V4 pools; throws if none (noting an Aerodrome-only
 * asset). Returns the chosen route ready for a `deployIndex` basket entry + all
 * candidates (deepest-first) + warnings.
 */
export async function findBestPool(asset: Address, chainId: number): Promise<BestPoolResult> {
  const cfg = chainCfg(chainId)
  const client = clientFor(chainId)

  const lower = asset.toLowerCase()
  if (lower === cfg.weth.toLowerCase() || lower === NATIVE_ETH) {
    throw new PoolDetectionError('Asset cannot be ETH/WETH.', 'BAD_ASSET')
  }

  const [decimals, v2, v3s, v4] = await Promise.all([
    readDecimals(client, asset),
    findV2(client, cfg, asset),
    findV3(client, cfg, asset),
    findV4(client, cfg, asset),
  ])

  const candidates: PoolCandidate[] = []
  if (v2) candidates.push(v2)
  candidates.push(...v3s, ...v4.candidates)

  if (candidates.length === 0) {
    if (await aerodromeExists(client, cfg, asset)) {
      throw new PoolDetectionError(
        "Only an Aerodrome pool exists for this asset — Aerodrome can't host Spectrum's V4 hook. Choose a token with a Uniswap v2/v3/v4 pool.",
        'ONLY_AERODROME',
      )
    }
    throw new PoolDetectionError('No Uniswap v2/v3/v4 ETH pool found for this asset.', 'NO_POOL')
  }

  // Rank by REAL USD liquidity (DexScreener pool TVL) — measured the same way for
  // every venue. The on-chain `depthEth` is NOT comparable across versions (V2/V3 are
  // real reserves; V4's virtual reserve is inflated for concentrated liquidity), which
  // let tiny tightly-concentrated V4 pools out-rank genuinely deep pools. Match each
  // candidate to its DexScreener pool (V4 by poolId, V2/V3 by pool address).
  const [ethUsd, liqByPool] = await Promise.all([
    wethUsdPrice(cfg.dexscreenerSlug, cfg.weth),
    fetchPoolLiquidity(cfg.dexscreenerSlug, asset),
  ])
  for (const c of candidates) {
    const key = (c.venue === Venue.V4 ? c.poolId : c.poolAddress)?.toLowerCase()
    const listedUsd = key ? liqByPool.get(key) : undefined
    c.dexListed = listedUsd != null
    // DexScreener TVL when the pool is indexed; otherwise an on-chain ETH-side estimate.
    c.depthUsd = listedUsd != null ? listedUsd : ethUsd != null ? c.depthEth * ethUsd : null
  }

  // DexScreener-listed pools (real, comparable TVL) always rank above unlisted dust;
  // among listed, deepest USD wins; unlisted fall back to on-chain ETH depth.
  candidates.sort((a, b) => {
    if (!!a.dexListed !== !!b.dexListed) return a.dexListed ? -1 : 1
    if (a.dexListed && b.dexListed) return (b.depthUsd ?? 0) - (a.depthUsd ?? 0)
    return b.depthEth - a.depthEth
  })
  const best = candidates[0]

  const warnings: string[] = []
  if (best.depthUsd != null && best.depthUsd < SHALLOW_USD_THRESHOLD) {
    warnings.push(
      `Deepest pool is shallow (~$${Math.round(best.depthUsd).toLocaleString()} ETH-side) — sizable trades may slip.`,
    )
  }
  if (v4.partial) {
    warnings.push(
      'V4 pool scan was limited (no Alchemy key) — set VITE_ALCHEMY_API_KEY for complete V4 coverage; a deeper V4 pool may exist.',
    )
  }

  return { asset, chainId, decimals, best, route: toRoute(best), candidates, warnings }
}
