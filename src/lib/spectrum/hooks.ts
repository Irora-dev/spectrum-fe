import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { DEFAULT_CHAIN_ID } from '../chain/chains'
import {
  getIndexData,
  getUserHoldings,
  listAllIndexes,
  listIndexes,
  listIndexesForChain,
} from './index-data'
import type { IndexSummary, NavPoint } from './index-data'
import { getIndexMeta } from './metadata'
import { resolveCreator, type ResolvedCreator } from './creator'
import {
  combineNavHistory,
  fetchAssetHistory,
  type ChartRange,
  type NavInput,
} from './history'

// Every index across Base + Ethereum, sorted by AUM (homepage TVL, discovery).
export function useAllIndexes() {
  return useQuery({
    queryKey: ['spectrum', 'indexes', 'all'],
    queryFn: listAllIndexes,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export interface CreatorProfile {
  /** The deployer address this profile is keyed by. */
  address: string
  /** Resolved display identity (X handle → name → short address) for the header. */
  identity: ResolvedCreator
  /** Every index this address deployed, sorted by AUM desc (inherited order). */
  indexes: IndexSummary[]
  indexCount: number
  totalAumUsd: number
  /** Distinct chains this creator has launched on. */
  chains: number[]
  /** Best 24h performer among their indexes, if any are priced. */
  topPerformer: IndexSummary | null
}

// Pure aggregation: a creator profile = all indexes whose on-chain deployer matches,
// plus headline stats and a resolved identity (handle/name pulled from whichever of
// their indexes carries it). No new fetch — derived from the cached index list.
export function buildCreatorProfile(address: string, all: IndexSummary[]): CreatorProfile {
  const addr = address.toLowerCase()
  const indexes = all.filter((ix) => ix.deployer?.toLowerCase() === addr)
  const totalAumUsd = indexes.reduce((s, ix) => s + (ix.aumUsd || 0), 0)
  const chains = Array.from(new Set(indexes.map((ix) => ix.chainId)))

  let handle: string | undefined
  let name: string | undefined
  let xUrl: string | undefined
  for (const ix of indexes) {
    const m = getIndexMeta(ix.address)
    handle ??= m.creatorHandle
    name ??= m.creatorName
    xUrl ??= m.xUrl
  }
  const identity = resolveCreator({ handle, name, xUrl, deployer: address })

  const topPerformer =
    indexes
      .filter((ix) => ix.change24hPct != null)
      .sort((a, b) => (b.change24hPct ?? -Infinity) - (a.change24hPct ?? -Infinity))[0] ?? null

  return { address, identity, indexes, indexCount: indexes.length, totalAumUsd, chains, topPerformer }
}

// All indexes by one creator (deployer) + headline stats. Reuses the cached
// `useAllIndexes` query, so opening a profile costs no extra network.
export function useCreatorProfile(address?: string) {
  const { data: all, isLoading, isError } = useAllIndexes()
  const data = useMemo(
    () => (address && all ? buildCreatorProfile(address, all) : undefined),
    [address, all],
  )
  return { data, isLoading, isError }
}

export interface PortfolioHolding {
  index: IndexSummary
  /** Balance in token units. */
  balance: number
  /** balance × navPerToken, in USD. */
  valueUsd: number
}

export interface Portfolio {
  address: string
  /** Held indexes (non-zero balance), sorted by value desc. */
  holdings: PortfolioHolding[]
  /** Indexes this wallet deployed. */
  created: IndexSummary[]
  totalValueUsd: number
  heldCount: number
  createdCount: number
}

// A connected wallet's positions: indexes held (balance × NAV) + indexes created.
// The created list + NAVs come from the cached index list; only the per-wallet
// balances are a fresh read (batched per chain), keyed so a wallet/list change
// refetches. Returns undefined until an address + the index list are available.
export function usePortfolio(address?: string) {
  const { data: all, isLoading: allLoading, isError: allError } = useAllIndexes()
  const indexes = useMemo(() => all ?? [], [all])
  const sig = indexes.map((i) => `${i.chainId}:${i.address}`).join(',')

  const balances = useQuery({
    queryKey: ['spectrum', 'portfolio', address?.toLowerCase(), sig],
    queryFn: () => getUserHoldings(address as Address, indexes),
    enabled: !!address && indexes.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const data = useMemo<Portfolio | undefined>(() => {
    if (!address || !all) return undefined
    const addr = address.toLowerCase()
    const balMap = balances.data ?? new Map<string, number>()
    const holdings = all
      .map((index) => {
        const balance = balMap.get(index.address.toLowerCase()) ?? 0
        return { index, balance, valueUsd: balance * index.navPerToken }
      })
      .filter((h) => h.balance > 0)
      .sort((a, b) => b.valueUsd - a.valueUsd)
    const created = all.filter((ix) => ix.deployer?.toLowerCase() === addr)
    const totalValueUsd = holdings.reduce((s, h) => s + h.valueUsd, 0)
    return {
      address,
      holdings,
      created,
      totalValueUsd,
      heldCount: holdings.length,
      createdCount: created.length,
    }
  }, [address, all, balances.data])

  return { data, isLoading: allLoading || balances.isLoading, isError: allError || balances.isError }
}

// Indexes on a single chain.
export function useIndexesForChain(chainId: number) {
  return useQuery({
    queryKey: ['spectrum', 'indexes', chainId],
    queryFn: () => listIndexesForChain(chainId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

// Back-compat: Base-only list.
export function useIndexes() {
  return useQuery({
    queryKey: ['spectrum', 'indexes', DEFAULT_CHAIN_ID],
    queryFn: listIndexes,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

// Full data for a single index (basket, NAV, holdings, lifetime-clamped series).
// `detail` pulls the extra protocol readouts (effective supply, fee reserve,
// pending burn) that list views skip.
export function useIndexData(address?: string, chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: ['spectrum', 'index', chainId, address?.toLowerCase()],
    queryFn: () => getIndexData(address as Address, chainId, { inception: true, detail: true }),
    enabled: !!address,
    staleTime: 30_000,
  })
}

export interface NavHistoryInput {
  chainId: number
  assets: NavInput[]
  navPerToken: number
  ageSec?: number | null
  range: ChartRange
}

// Real reconstructed NAV history for one index over a range. Each constituent's
// price series is its own React Query (keyed by chain/addr/range), so identical
// assets across many cards are de-duplicated to a single network call. The NAV
// curve is recombined whenever any constituent series resolves.
export function useNavHistory(input?: NavHistoryInput) {
  const range: ChartRange = input?.range ?? '7D'
  const chainId = input?.chainId ?? 0
  const ageSec = input?.ageSec ?? null
  const navPerToken = input?.navPerToken ?? 0

  // Stable signature so identity-changing `assets` arrays don't thrash memos.
  const sig = (input?.assets ?? [])
    .map((a) => `${a.address.toLowerCase()}:${a.weight}`)
    .join('|')
  const assets = useMemo(() => input?.assets ?? [], [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  const uniqAddrs = useMemo(
    () => Array.from(new Set(assets.map((a) => a.address.toLowerCase()))),
    [sig], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const results = useQueries({
    queries: uniqAddrs.map((addr) => ({
      queryKey: ['spectrum', 'assetHist', chainId, addr, range],
      queryFn: () => fetchAssetHistory(chainId, addr, range, ageSec),
      enabled: !!input && chainId > 0 && uniqAddrs.length > 0,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
    })),
  })

  const isLoading = results.length > 0 && results.some((r) => r.isLoading)
  const updatedKey = results.map((r) => r.dataUpdatedAt).join(',')

  // `data` is the recombined index NAV curve; `perAsset` exposes each constituent's
  // own normalized (=100 at window start) series + window return — the SAME fetches,
  // so the detail chart can draw per-asset lines + a hover breakdown with no extra
  // network calls.
  const { data, perAsset } = useMemo<{ data: NavPoint[]; perAsset: PerAssetReturn[] }>(() => {
    if (!input || uniqAddrs.length === 0) return { data: [], perAsset: [] }
    const map = new Map<string, NavPoint[]>()
    uniqAddrs.forEach((addr, i) => map.set(addr, results[i]?.data ?? []))
    const curve = combineNavHistory(assets, map, navPerToken)
    const perAsset: PerAssetReturn[] = assets.map((a) => {
      const s = map.get(a.address.toLowerCase()) ?? []
      const base = s.length ? s[0].value : 0
      const pct = s.length >= 2 && base > 0 ? (s[s.length - 1].value / base - 1) * 100 : null
      const series = base > 0 ? s.map((p) => ({ time: p.time, value: (p.value / base) * 100 })) : []
      return { address: a.address, weight: a.weight, pct, series }
    })
    return { data: curve, perAsset }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, updatedKey, navPerToken])

  return { data, perAsset, isLoading }
}

// One constituent's real price history. Shares the exact query key the chart engine
// uses (`useNavHistory`'s per-asset queries), so a tile hover is usually an instant
// cache hit. Used by the bento's hover-to-expand preview.
export function useAssetHistory(chainId: number, address: string | undefined, range: ChartRange = '7D') {
  return useQuery({
    queryKey: ['spectrum', 'assetHist', chainId, address?.toLowerCase(), range],
    queryFn: () => fetchAssetHistory(chainId, address as string, range),
    enabled: !!address && chainId > 0,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })
}

export interface PerAssetReturn {
  address: string
  weight: number
  /** % change over the window; null if the series is too short to price. */
  pct: number | null
  /** Price history normalized to 100 at the window start (for sparklines / overlay). */
  series: NavPoint[]
}
