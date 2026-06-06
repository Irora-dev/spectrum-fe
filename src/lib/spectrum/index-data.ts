import { encodePacked, formatUnits, keccak256, type Address } from 'viem'
import { clientFor } from '../chain/rpc'
import { DSTABLE_DECIMALS, V4_POOLS_SLOT, ZERO_ADDRESS } from '../chain/constants'
import { chainCfg, DEFAULT_CHAIN_ID, SUPPORTED_CHAIN_IDS } from '../chain/chains'
import {
  dstableAbi,
  erc20BalanceAbi,
  factoryAbi,
  indexAbi,
  launchedEvent,
  poolManagerAbi,
} from './abis'

// ─────────────────────────────────────────────────────────────────────────────
// Spectrum index-token data layer — dual-chain (Base 8453 + Ethereum 1), running
// fully client-side. viem port of the Prismbeat reader.
//
// NAV is NOT readable on-chain (valuation routes through the V4 PoolManager unlock
// callback → static eth_call reverts). We reconstruct it: read basket + balances,
// price each constituent via DexScreener, NAV = Σ(balance × price) / supply, scaled
// by the chain's dstable/ETH pool-price factor (Base). ETH has no pool id wired →
// factor 1 (aggregate spot).
//
// Discovery: scan the factory `Launched` event + per-chain seed list.
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

export interface Holding {
  asset: string
  symbol: string
  name: string
  decimals: number
  targetWeightPct: number
  balance: number
  priceUsd: number
  valueUsd: number
  liveWeightPct: number
  change24hPct: number | null
  priced: boolean
  series: NavPoint[]
}

export interface NavPoint {
  time: number
  value: number
}

export interface IndexData {
  chainId: number
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: number
  aumUsd: number
  navPerToken: number
  spotUsdNav: number
  dstableUsd: number | null
  change24hPct: number | null
  holdings: Holding[]
  navSeries: NavPoint[]
  pricedCount: number
  totalCount: number
  inceptionTs: number | null
  ageHours: number | null
  /** Creator (deployer) address from the factory registry; null if unknown. */
  deployer: string | null
  /** effectiveSupply() (yield-vesting can push this above totalSupply). Detail-only. */
  effectiveSupply: number | null
  /** Fees claimable by holders, in USD ($1-peg dstable). Detail-only. */
  feeReserveUsd: number | null
  /** Swap-fee cut queued for the bridge→PRISM buy-and-burn, in USD. Detail-only. */
  pendingBurnUsd: number | null
  updatedAt: string
}

export interface IndexTopHolding {
  address: string
  symbol: string
  weightPct: number
}

export interface IndexSummary {
  chainId: number
  address: string
  name: string
  symbol: string
  basketLength: number
  navPerToken: number
  aumUsd: number
  change24hPct: number | null
  pricedCount: number
  top: IndexTopHolding[]
  navSeries: NavPoint[]
  /** Creator (deployer) address from the factory registry; null if unknown. */
  deployer: string | null
}

// ── DexScreener pricing (per-chain, no key) ──────────────────────────────────

interface DexPair {
  baseToken?: { address?: string; symbol?: string; name?: string }
  priceUsd?: string | null
  priceChange?: { h1?: number; h6?: number; h24?: number }
  liquidity?: { usd?: number }
}

// Short-TTL spot-price cache, keyed by chain-slug + token. A homepage of cards
// shares many constituents (and every card re-derives the WETH price for the pool
// factor), so without this each refresh re-hits DexScreener once per card — wasteful
// and a 429 risk. Fresh hits (including known-unpriced, cached as null) skip the
// network; only stale/missing tokens are fetched. TTL < the 60s query refetch, so a
// refetch always re-reads.
const DEX_TTL_MS = 30_000
interface CachedDexPair {
  pair: DexPair | null
  ts: number
}
const dexCache = new Map<string, CachedDexPair>()

async function fetchDexPrices(
  addresses: string[],
  slug: string,
): Promise<Map<string, DexPair>> {
  const out = new Map<string, DexPair>()
  if (addresses.length === 0) return out
  const now = Date.now()
  const misses: string[] = []
  for (const a of addresses) {
    const cached = dexCache.get(`${slug}:${a}`)
    if (cached && now - cached.ts < DEX_TTL_MS) {
      if (cached.pair) out.set(a, cached.pair)
    } else {
      misses.push(a)
    }
  }
  if (misses.length === 0) return out

  // DexScreener accepts up to 30 contracts per call; a basket is <= ~12.
  const url = `https://api.dexscreener.com/tokens/v1/${slug}/${misses.join(',')}`
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) return out
    const pairs = (await r.json()) as DexPair[]
    // Deepest-liquidity pair per token among the fetched misses.
    const best = new Map<string, DexPair>()
    for (const p of pairs) {
      const a = p.baseToken?.address?.toLowerCase()
      if (!a) continue
      const prev = best.get(a)
      if (!prev || (p.liquidity?.usd ?? 0) > (prev.liquidity?.usd ?? 0)) best.set(a, p)
    }
    // Cache every miss (null when DexScreener returned nothing) so repeat lookups
    // across cards don't re-request it within the TTL.
    for (const a of misses) {
      const pair = best.get(a) ?? null
      dexCache.set(`${slug}:${a}`, { pair, ts: now })
      if (pair) out.set(a, pair)
    }
  } catch {
    /* network error — leave misses unpriced for this call; don't cache the failure */
  }
  return out
}

function priceAt(now: number, ch1: number, ch6: number, ch24: number, hoursAgo: number): number {
  const anchors: [number, number][] = [
    [24, 1 / (1 + (ch24 || 0) / 100)],
    [6, 1 / (1 + (ch6 || 0) / 100)],
    [1, 1 / (1 + (ch1 || 0) / 100)],
    [0, 1],
  ]
  if (hoursAgo >= 24) return now * anchors[0][1]
  for (let i = 0; i < anchors.length - 1; i++) {
    const [h0, f0] = anchors[i]
    const [h1, f1] = anchors[i + 1]
    if (hoursAgo <= h0 && hoursAgo >= h1) {
      const t = h0 === h1 ? 0 : (h0 - hoursAgo) / (h0 - h1)
      return now * (f0 + (f1 - f0) * t)
    }
  }
  return now
}

function timeSteps(maxHours: number): number[] {
  const n = 14
  const m = Math.min(Math.max(maxHours, 0.05), 24)
  return Array.from({ length: n + 1 }, (_, i) => +(m * (1 - i / n)).toFixed(4))
}

function buildAssetSeries(
  priceNow: number,
  ch1: number,
  ch6: number,
  ch24: number,
  maxHours: number,
): NavPoint[] {
  const nowSec = Math.floor(Date.now() / 1000)
  const steps = timeSteps(maxHours)
  const raw = steps.map((h) => priceAt(priceNow, ch1, ch6, ch24, h))
  const base = raw[0] || raw.find((v) => v > 0) || 1
  return steps.map((h, i) => ({
    time: nowSec - Math.round(h * 3600),
    value: base > 0 ? (raw[i] / base) * 100 : 100,
  }))
}

function buildNavSeries(
  items: { balance: number; priceUsd: number; ch1: number; ch6: number; ch24: number }[],
  supply: number,
  maxHours: number,
): NavPoint[] {
  if (supply <= 0) return []
  const nowSec = Math.floor(Date.now() / 1000)
  return timeSteps(maxHours).map((h) => {
    let aum = 0
    for (const it of items) aum += it.balance * priceAt(it.priceUsd, it.ch1, it.ch6, it.ch24, h)
    return { time: nowSec - Math.round(h * 3600), value: aum / supply }
  })
}

const inceptionCache = new Map<string, number>()
async function getInceptionTs(token: Address, chainId: number): Promise<number | null> {
  const key = `${chainId}:${token.toLowerCase()}`
  const cached = inceptionCache.get(key)
  if (cached != null) return cached
  try {
    const client = clientFor(chainId)
    const factory = chainCfg(chainId).spectrumFactory
    const latest = await client.getBlockNumber()
    const WINDOW = 9000n
    for (let end = latest; end > latest - 80000n && end > 0n; end -= WINDOW) {
      const start = end - WINDOW + 1n > 0n ? end - WINDOW + 1n : 0n
      try {
        const logs = await client.getLogs({
          address: factory,
          event: launchedEvent,
          args: { token },
          fromBlock: start,
          toBlock: end,
        })
        if (logs.length > 0) {
          const blk = await client.getBlock({ blockNumber: logs[0].blockNumber })
          const ts = blk ? Number(blk.timestamp) : null
          if (ts != null) inceptionCache.set(key, ts)
          return ts
        }
      } catch {
        /* window failed — try the next one */
      }
    }
    return null
  } catch {
    return null
  }
}

// Creator attribution: the factory stores (deployer, pook) per index. One cheap
// static read, permanently cached (a deployer never changes). Works for any index
// including seeds, with no log-window dependency. Null on revert / zero deployer.
const deployerCache = new Map<string, string | null>()
async function getDeployer(token: Address, chainId: number): Promise<string | null> {
  const key = `${chainId}:${token.toLowerCase()}`
  const cached = deployerCache.get(key)
  if (cached !== undefined) return cached
  try {
    const client = clientFor(chainId)
    const factory = chainCfg(chainId).spectrumFactory
    const [deployer] = await client.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: 'tokens',
      args: [token],
    })
    const out = deployer && deployer !== ZERO_ADDRESS ? deployer : null
    deployerCache.set(key, out)
    return out
  } catch {
    deployerCache.set(key, null)
    return null
  }
}

interface PriceFactor {
  factor: number
  dstableUsd: number | null
}
// Base: factor = dstablePerETH × dstableUsd ÷ ETH_USD (from the dstable/ETH pool
// sqrtPrice via extsload). ETH: no pool id wired → factor 1 (aggregate spot).
//
// Cached per chain with in-flight coalescing: a list refresh fans out N concurrent
// getIndexData calls that each need this same factor — without coalescing they'd
// each redo the extsload + exchangeRate + WETH-price fetch. One shared computation
// per refresh instead of N. TTL < the 60s query refetch so values stay fresh.
const POOL_FACTOR_TTL_MS = 30_000
const poolFactorCache = new Map<number, { value: PriceFactor; ts: number }>()
const poolFactorInflight = new Map<number, Promise<PriceFactor>>()

async function getPoolPriceFactor(chainId: number): Promise<PriceFactor> {
  const cached = poolFactorCache.get(chainId)
  if (cached && Date.now() - cached.ts < POOL_FACTOR_TTL_MS) return cached.value
  const inflight = poolFactorInflight.get(chainId)
  if (inflight) return inflight
  const p = computePoolPriceFactor(chainId)
  poolFactorInflight.set(chainId, p)
  try {
    return await p
  } finally {
    poolFactorInflight.delete(chainId)
  }
}

async function computePoolPriceFactor(chainId: number): Promise<PriceFactor> {
  const cfg = chainCfg(chainId)
  if (!cfg.dstableEthPoolId) {
    const v: PriceFactor = { factor: 1, dstableUsd: null }
    poolFactorCache.set(chainId, { value: v, ts: Date.now() })
    return v
  }
  try {
    const client = clientFor(chainId)
    const slot = keccak256(
      encodePacked(['bytes32', 'uint256'], [cfg.dstableEthPoolId, V4_POOLS_SLOT]),
    )
    const word = await client.readContract({
      address: cfg.poolManager,
      abi: poolManagerAbi,
      functionName: 'extsload',
      args: [slot],
    })
    const sqrt = BigInt(word) & ((1n << 160n) - 1n)
    const dstablePerEth = sqrt === 0n ? null : (Number(sqrt) / 2 ** 96) ** 2 * 1e12

    let dstableUsd: number | null = null
    try {
      const rate = await client.readContract({
        address: cfg.dstable,
        abi: dstableAbi,
        functionName: 'exchangeRate',
      })
      dstableUsd = Number(rate) / 1e18
    } catch {
      /* leave null */
    }

    const wMap = await fetchDexPrices([cfg.weth.toLowerCase()], cfg.dexscreenerSlug)
    const ethUsd = parseFloat(wMap.get(cfg.weth.toLowerCase())?.priceUsd ?? '0') || null

    let factor = 1
    if (dstablePerEth && dstableUsd && ethUsd) factor = (dstablePerEth * dstableUsd) / ethUsd
    if (!(factor > 0) || !isFinite(factor)) factor = 1
    const v: PriceFactor = { factor, dstableUsd }
    poolFactorCache.set(chainId, { value: v, ts: Date.now() })
    return v
  } catch {
    return { factor: 1, dstableUsd: null }
  }
}

function weightedChange(holdings: Holding[], aumUsd: number): number | null {
  if (aumUsd <= 0) return null
  let acc = 0
  let priced = 0
  for (const h of holdings) {
    if (h.change24hPct == null || !h.priced) continue
    acc += (h.valueUsd / aumUsd) * h.change24hPct
    priced += h.valueUsd
  }
  return priced > 0 ? acc : null
}

// ── Core reads ───────────────────────────────────────────────────────────────

// `inception` defaults off: list views don't need the lifetime-clamped chart window,
// and skipping it avoids a per-index getLogs scan storm on public RPC.
export async function getIndexData(
  address: Address,
  chainId: number = DEFAULT_CHAIN_ID,
  opts: { inception?: boolean; detail?: boolean; priceFactor?: PriceFactor } = {},
): Promise<IndexData> {
  const client = clientFor(chainId)
  const cfg = chainCfg(chainId)

  const [name, symbol, decimalsRaw, supplyRaw, lenRaw, deployer] = await Promise.all([
    client.readContract({ address, abi: indexAbi, functionName: 'name' }),
    client.readContract({ address, abi: indexAbi, functionName: 'symbol' }),
    client.readContract({ address, abi: indexAbi, functionName: 'decimals' }),
    client.readContract({ address, abi: indexAbi, functionName: 'totalSupply' }),
    client.readContract({ address, abi: indexAbi, functionName: 'basketLength' }),
    getDeployer(address, chainId),
  ])

  const decimals = Number(decimalsRaw)
  const len = Number(lenRaw)

  const entries = await Promise.all(
    Array.from({ length: len }, (_, i) =>
      client.readContract({ address, abi: indexAbi, functionName: 'basket', args: [BigInt(i)] }),
    ),
  )
  const assets = entries.map((e) => e[0])
  const targetBps = entries.map((e) => Number(e[5]))
  const assetDecimals = entries.map((e) => Number(e[6]))

  const balances = await Promise.all(
    assets.map((a, i) =>
      client
        .readContract({ address: a, abi: erc20BalanceAbi, functionName: 'balanceOf', args: [address] })
        .then((b) => Number(formatUnits(b, assetDecimals[i])))
        .catch(() => 0),
    ),
  )

  const inceptionTs = opts.inception ? await getInceptionTs(address, chainId) : null
  const ageHours = inceptionTs != null ? (Date.now() / 1000 - inceptionTs) / 3600 : null
  const maxHours = ageHours != null ? Math.min(Math.max(ageHours, 0.05), 24) : 24

  // List views inject one shared factor (computed once for the whole batch);
  // standalone callers compute it on demand (cached + coalesced).
  const { factor, dstableUsd } = opts.priceFactor ?? (await getPoolPriceFactor(chainId))

  const dex = await fetchDexPrices(assets.map((a) => a.toLowerCase()), cfg.dexscreenerSlug)
  const DSTABLE = cfg.dstable.toLowerCase()

  const holdings: Holding[] = assets.map((a, i) => {
    const low = a.toLowerCase()
    const p = dex.get(low)
    let priceUsd = p?.priceUsd ? parseFloat(p.priceUsd) : 0
    if (low === DSTABLE && !priceUsd) priceUsd = 1
    const balance = balances[i]
    const valueUsd = balance * priceUsd
    return {
      asset: a,
      symbol: p?.baseToken?.symbol ?? (low === DSTABLE ? 'dstable' : '?'),
      name: p?.baseToken?.name ?? '',
      decimals: assetDecimals[i],
      targetWeightPct: targetBps[i] / 100,
      balance,
      priceUsd,
      valueUsd,
      liveWeightPct: 0,
      change24hPct: p?.priceChange?.h24 ?? null,
      priced: priceUsd > 0,
      series: buildAssetSeries(
        priceUsd,
        p?.priceChange?.h1 ?? 0,
        p?.priceChange?.h6 ?? 0,
        p?.priceChange?.h24 ?? 0,
        maxHours,
      ),
    }
  })

  const aumUsd = holdings.reduce((s, h) => s + h.valueUsd, 0)
  for (const h of holdings) h.liveWeightPct = aumUsd > 0 ? (h.valueUsd / aumUsd) * 100 : 0

  const totalSupply = Number(formatUnits(supplyRaw, decimals))
  const spotUsdNav = totalSupply > 0 ? aumUsd / totalSupply : 0
  const navPerToken = spotUsdNav * factor

  const navSeriesUsd = buildNavSeries(
    holdings.map((h, i) => {
      const p = dex.get(assets[i].toLowerCase())
      return {
        balance: h.balance,
        priceUsd: h.priceUsd,
        ch1: p?.priceChange?.h1 ?? 0,
        ch6: p?.priceChange?.h6 ?? 0,
        ch24: p?.priceChange?.h24 ?? 0,
      }
    }),
    totalSupply,
    maxHours,
  )
  const navSeries = navSeriesUsd.map((p) => ({ time: p.time, value: p.value * factor }))

  // Protocol readouts for the detail page — three cheap static reads, each
  // fail-safe (null on revert). Skipped for list views so cards stay lean.
  let effectiveSupply: number | null = null
  let feeReserveUsd: number | null = null
  let pendingBurnUsd: number | null = null
  if (opts.detail) {
    const [effRaw, feeRaw, burnRaw] = await Promise.all([
      client.readContract({ address, abi: indexAbi, functionName: 'effectiveSupply' }).catch(() => null),
      client.readContract({ address, abi: indexAbi, functionName: 'feeReserveDstable' }).catch(() => null),
      client.readContract({ address, abi: indexAbi, functionName: 'pendingPrismBurnDstable' }).catch(() => null),
    ])
    if (effRaw != null) effectiveSupply = Number(formatUnits(effRaw, decimals))
    if (feeRaw != null) feeReserveUsd = Number(formatUnits(feeRaw, DSTABLE_DECIMALS))
    if (burnRaw != null) pendingBurnUsd = Number(formatUnits(burnRaw, DSTABLE_DECIMALS))
  }

  return {
    chainId,
    address,
    name,
    symbol,
    decimals,
    totalSupply,
    aumUsd: aumUsd * factor,
    navPerToken,
    spotUsdNav,
    dstableUsd,
    change24hPct: weightedChange(holdings, aumUsd),
    holdings,
    navSeries,
    pricedCount: holdings.filter((h) => h.priced).length,
    totalCount: holdings.length,
    inceptionTs,
    ageHours,
    deployer,
    effectiveSupply,
    feeReserveUsd,
    pendingBurnUsd,
    updatedAt: new Date().toISOString(),
  }
}

export async function listIndexesForChain(chainId: number): Promise<IndexSummary[]> {
  const client = clientFor(chainId)
  const cfg = chainCfg(chainId)
  const addresses = new Set(cfg.seeds.map((s) => s.address.toLowerCase()))

  // Best-effort live discovery; public RPCs cap getLogs ranges, so bound it and
  // fall back to the seed set on failure.
  try {
    const latest = await client.getBlockNumber()
    const from = latest > 60000n ? latest - 60000n : 0n
    const logs = await client.getLogs({
      address: cfg.spectrumFactory,
      event: launchedEvent,
      fromBlock: from,
      toBlock: latest,
    })
    for (const l of logs) {
      const token = l.args.token
      if (token) addresses.add(token.toLowerCase())
    }
  } catch {
    /* seed set only */
  }

  // Compute the chain's dstable/ETH price factor ONCE here, then inject it into
  // every card — otherwise each of the N concurrent getIndexData calls would
  // recompute it (extsload + exchangeRate + a WETH-price fetch) before any of them
  // could populate the shared cache.
  const priceFactor = await getPoolPriceFactor(chainId)

  const list = await Promise.all(
    Array.from(addresses).map(async (addr): Promise<IndexSummary | null> => {
      try {
        const d = await getIndexData(addr as Address, chainId, { priceFactor })
        // All constituents, by launch-target weight (so cards show the whole basket
        // and the bento %/sizes match the detail page).
        const top = [...d.holdings]
          .sort((a, b) => b.targetWeightPct - a.targetWeightPct)
          .map((h) => ({ address: h.asset, symbol: h.symbol, weightPct: h.targetWeightPct }))
        return {
          chainId,
          address: d.address,
          name: d.name,
          symbol: d.symbol,
          basketLength: d.totalCount,
          navPerToken: d.navPerToken,
          aumUsd: d.aumUsd,
          change24hPct: d.change24hPct,
          pricedCount: d.pricedCount,
          top,
          navSeries: d.navSeries,
          deployer: d.deployer,
        }
      } catch {
        return null
      }
    }),
  )

  return list
    .filter((x): x is IndexSummary => x !== null)
    .sort((a, b) => b.aumUsd - a.aumUsd)
}

// Every index across all supported chains, sorted by AUM (powers homepage TVL +
// cross-chain discovery). Each chain fails independently.
export async function listAllIndexes(): Promise<IndexSummary[]> {
  const perChain = await Promise.all(
    SUPPORTED_CHAIN_IDS.map((id) => listIndexesForChain(id).catch(() => [] as IndexSummary[])),
  )
  return perChain.flat().sort((a, b) => b.aumUsd - a.aumUsd)
}

// Back-compat: Base-only list.
export async function listIndexes(): Promise<IndexSummary[]> {
  return listIndexesForChain(DEFAULT_CHAIN_ID)
}

// Per-wallet index balances (powers the portfolio). Reads balanceOf + decimals per
// index, grouped by chain so each chain's reads batch into one Multicall3 call.
// Returns token-unit balances keyed by lowercased index address; failed reads → 0.
export async function getUserHoldings(
  account: Address,
  indexes: { address: string; chainId: number }[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const byChain = new Map<number, string[]>()
  for (const ix of indexes) {
    const arr = byChain.get(ix.chainId) ?? []
    arr.push(ix.address)
    byChain.set(ix.chainId, arr)
  }
  await Promise.all(
    Array.from(byChain.entries()).map(async ([chainId, addrs]) => {
      const client = clientFor(chainId)
      await Promise.all(
        addrs.map(async (addr) => {
          const token = addr as Address
          try {
            const [bal, dec] = await Promise.all([
              client.readContract({ address: token, abi: erc20BalanceAbi, functionName: 'balanceOf', args: [account] }),
              client.readContract({ address: token, abi: indexAbi, functionName: 'decimals' }),
            ])
            out.set(addr.toLowerCase(), Number(formatUnits(bal, Number(dec))))
          } catch {
            out.set(addr.toLowerCase(), 0)
          }
        }),
      )
    }),
  )
  return out
}
