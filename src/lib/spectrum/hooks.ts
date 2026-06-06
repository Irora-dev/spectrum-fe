import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { DEFAULT_CHAIN_ID } from '../chain/chains'
import {
  getIndexData,
  listAllIndexes,
  listIndexes,
  listIndexesForChain,
} from './index-data'
import type { NavPoint } from './index-data'
import {
  backtestNavHistory,
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
export function useIndexData(address?: string, chainId: number = DEFAULT_CHAIN_ID) {
  return useQuery({
    queryKey: ['spectrum', 'index', chainId, address?.toLowerCase()],
    queryFn: () => getIndexData(address as Address, chainId, { inception: true }),
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

  const data = useMemo<NavPoint[]>(() => {
    if (!input || uniqAddrs.length === 0) return []
    const map = new Map<string, NavPoint[]>()
    uniqAddrs.forEach((addr, i) => map.set(addr, results[i]?.data ?? []))
    return combineNavHistory(assets, map, navPerToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, updatedKey, navPerToken])

  return { data, isLoading }
}

export interface BacktestInput {
  chainId: number
  assets: NavInput[]
  range: ChartRange
  /** Inception NAV to anchor the first point to. Defaults to $1 (Spectrum's). */
  startNav?: number
}

export interface BacktestAssetReturn {
  address: string
  weight: number
  /** % change over the window; null if the series is too short to price. */
  pct: number | null
  /** Price history normalized to 100 at the window start (for sparklines / overlay). */
  series: NavPoint[]
}

export interface BacktestResult {
  /** NAV curve anchored so the first point = startNav. */
  curve: NavPoint[]
  /** Per-constituent return over the same window (for best/worst breakdown). */
  perAsset: BacktestAssetReturn[]
  isLoading: boolean
}

// Backtest a hypothetical (not-yet-deployed) basket: "if this had launched `range`
// ago at $startNav, here's the NAV curve." Reuses the SAME per-asset price queries
// as useNavHistory (identical query keys), so constituents shared with live indexes
// are already cached — no extra network calls.
export function useBasketBacktest(input?: BacktestInput): BacktestResult {
  const range: ChartRange = input?.range ?? '30D'
  const chainId = input?.chainId ?? 0
  const startNav = input?.startNav ?? 1

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
      queryFn: () => fetchAssetHistory(chainId, addr, range, null),
      enabled: !!input && chainId > 0 && uniqAddrs.length > 0,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
    })),
  })

  const isLoading = results.length > 0 && results.some((r) => r.isLoading)
  const updatedKey = results.map((r) => r.dataUpdatedAt).join(',')

  return useMemo<BacktestResult>(() => {
    if (!input || uniqAddrs.length === 0) return { curve: [], perAsset: [], isLoading }
    const map = new Map<string, NavPoint[]>()
    uniqAddrs.forEach((addr, i) => map.set(addr, results[i]?.data ?? []))
    const curve = backtestNavHistory(assets, map, startNav)
    const perAsset: BacktestAssetReturn[] = assets.map((a) => {
      const s = map.get(a.address.toLowerCase()) ?? []
      const base = s.length ? s[0].value : 0
      const pct = s.length >= 2 && base > 0 ? (s[s.length - 1].value / base - 1) * 100 : null
      const series = base > 0 ? s.map((p) => ({ time: p.time, value: (p.value / base) * 100 })) : []
      return { address: a.address, weight: a.weight, pct, series }
    })
    return { curve, perAsset, isLoading }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, updatedKey, startNav, isLoading])
}
