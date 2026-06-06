import { getAddress, type Address } from 'viem'
import type { BasketRoute } from '../pools'
import { DSTABLE_DECIMALS } from '../chain/constants'
import { CAP } from './weights'

// SpectrumToken is a standard 18-decimal ERC-20 (confirmed on every live index).
export const INDEX_TOKEN_DECIMALS = 18

// One basket entry exactly as deployIndex/predictTokenAddress expect it (LIVE factory,
// no `pair` field). NB: the factory zeroes `decimals` inside _buildInitCode before CREATE2
// and re-derives it on-chain, so this field affects neither the mined address nor the
// deploy — we still populate it truthfully for clarity/forward-compat.
export interface DeployBasketEntry {
  asset: Address
  venue: number
  ethPool: { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address }
  v3Fee: number
  v2Pair: Address
  /** weight in basis points (Σ = 10000). */
  weight: number
  decimals: number
}

export interface DeployAssetInput {
  address: Address | string
  decimals: number
  route: BasketRoute
}

/**
 * Assemble the deployIndex basket from the builder's assets + whole-% weights.
 * Weights are pct×100 → bps; because the weight model keeps whole-number percentages
 * summing to exactly CAP (100), the bps sum is exactly 10000 with no rounding drift.
 * The SAME array must be fed to both mineSalt and deployIndex (the address depends on it).
 */
export function toBasketEntries(assets: DeployAssetInput[], weightsPct: number[]): DeployBasketEntry[] {
  if (assets.length !== weightsPct.length) {
    throw new Error(`basket/weights length mismatch (${assets.length} vs ${weightsPct.length})`)
  }
  const totalPct = weightsPct.reduce((s, w) => s + w, 0)
  if (totalPct !== CAP) throw new Error(`weights must sum to ${CAP}% (got ${totalPct}%)`)
  return assets.map((a, i) => ({
    asset: getAddress(a.address as string),
    venue: a.route.venue,
    ethPool: { ...a.route.ethPool },
    v3Fee: a.route.v3Fee,
    v2Pair: a.route.v2Pair,
    weight: weightsPct[i] * 100,
    decimals: a.decimals,
  }))
}

/** Integer square root for bigint (Newton's method). Floors, like Solidity's. */
export function isqrt(value: bigint): bigint {
  if (value < 0n) throw new Error('isqrt: negative input')
  if (value < 2n) return value
  let x0 = value >> 1n
  let x1 = (x0 + value / x0) >> 1n
  while (x1 < x0) {
    x0 = x1
    x1 = (x0 + value / x0) >> 1n
  }
  return x0
}

const Q192 = 1n << 192n

/**
 * Initial sqrtPriceX96 for the index's own DSTABLE/INDEX V4 pool so its NAV opens at
 * $1.00 — i.e. 1 index ($1) trades 1:1 against 1 dstable ($1). Uniswap encodes
 * sqrtPriceX96 = sqrt(amount1/amount0)·2^96 over RAW units of currency0/currency1, and
 * V4 orders currencies by address. dstable is $1-pegged, so equal $ value means equal
 * unit counts; only the decimal gap (dstable 6, index 18) sets the ratio.
 *
 * Verified against live BASEAI: dstable=currency0 / index=currency1 → exactly 1e6·2^96.
 * The index address must be the MINED one (its sort order vs dstable decides currency0).
 */
export function startSqrtPriceX96ForDollarNav(
  indexAddr: Address,
  dstableAddr: Address,
  indexDecimals = INDEX_TOKEN_DECIMALS,
  dstableDecimals = DSTABLE_DECIMALS,
): bigint {
  const dstableIsCurrency0 = BigInt(dstableAddr) < BigInt(indexAddr)
  const dec0 = dstableIsCurrency0 ? dstableDecimals : indexDecimals
  const dec1 = dstableIsCurrency0 ? indexDecimals : dstableDecimals
  // sqrt(10^dec1 / 10^dec0) · 2^96 == isqrt(10^dec1 · 2^192 / 10^dec0)
  return isqrt((10n ** BigInt(dec1) * Q192) / 10n ** BigInt(dec0))
}
