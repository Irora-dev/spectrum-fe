import type { Address, Hex } from 'viem'

// ─────────────────────────────────────────────────────────────────────────────
// Spectrum / PRISM contract registry. Source of truth:
//   irora-capital-systems/dashboard/docs/Prism & Spectrum/Tech/CONTRACTS.local.md
// and dashboard/src/lib/spectrum/index-data.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const BASE_CHAIN_ID = 8453
export const MAINNET_CHAIN_ID = 1

// ── Base (chain 8453) — where Spectrum indexes launch & trade ────────────────
export const BASE = {
  chainId: BASE_CHAIN_ID,
  // Spectrum index launcher + launch auction (a.k.a. factory)
  spectrumFactory: '0xab9af86483dbf217e2e7edea84dd1bdbe3d488cf' as Address,
  dstable: '0x51f2817B06DE142021FBFf00Ac9B56ad84e84088' as Address,
  poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b' as Address,
  weth: '0x4200000000000000000000000000000000000006' as Address,
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  // Canonical dstable/ETH V4 pool — the rail the protocol prices baskets through.
  dstableEthPoolId: '0x861eaaed4ebff97b6b1b9bb4d30e1774b2dc5e51718bf2e463aa115f69338e91' as Hex,
} as const

// ── Ethereum mainnet (chain 1) — PRISM home + bridged buy&burn ───────────────
export const MAINNET = {
  chainId: MAINNET_CHAIN_ID,
  // PRISM — the token that owns the machine (also a Uniswap V4 hook)
  prism: '0xbd3AB5859f244CC9F51Ee0Ca755c5cf663D80040' as Address,
  dstable: '0x05E32dC43d0c4B6BfF1976714717f12EBA8e8088' as Address,
  weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address,
  poolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90' as Address,
  spectrumFactory: '0xA7D4A1b8D6096D503FAa6E7ecd927D5BA06DAB2a' as Address,
  chainlinkEthUsd: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' as Address,
  l1PrismBurner: '0x9d2b5f051074CFdFc14da4430779857529739837' as Address,
} as const

// Pool-state read: V4 PoolManager keeps pools in a mapping at storage slot 6;
// pool Slot0 (packed sqrtPriceX96 in the low 160 bits) lives at keccak(poolId . slot).
export const V4_POOLS_SLOT = 6n

// ── Known live Base indexes (seed). Merged with live `Launched` discovery so
//    data shows on first load even before the log scan returns. ───────────────
export const SEED_INDEXES: { address: Address; symbol: string; name: string }[] = [
  { address: '0x8281833536a41337E2c9450A0277416049514088', symbol: 'BASEAI', name: 'The Base AI Index' },
  { address: '0xab50550986C47faCB24AB4AA4E08e0A6f952C088', symbol: 'PLSBRO', name: 'Bankr Pls Bro Meta' },
  { address: '0x2eEA2b522Cf630Aa7883cf0ee7674803e6784088', symbol: 'BALI', name: 'Base AI Leaders Index' },
  { address: '0x036c7e64dD0B1a11660754f3E328402AAE5ec088', symbol: 'WNNRS', name: 'Base AI Cycle Winners' },
]

// Known live Ethereum-mainnet indexes (seed). ETH indexes are priced at aggregate
// spot until the ETH dstable/ETH pool id is wired (dstableEthPoolId = null → factor 1).
export const ETH_SEED_INDEXES: { address: Address; symbol: string; name: string }[] = [
  { address: '0xe8C30008D4e0A831640978910C43b9031f0D4088', symbol: 'V4INDEX', name: 'V4 Index' },
  { address: '0x09f12a58196AB3f11A2cce6E5A3013b0D4700088', symbol: 'V4BLU', name: 'V4 Bluechip' },
  { address: '0xA7aAc9fd1D519D78Bc7Fbd7B2F5F20f2D74C0088', symbol: 'BDEFI', name: 'Bluechip DeFi' },
  { address: '0xc7829deBCde82338Eb3eddc7DF4152e100034088', symbol: 'MEME.ETH', name: 'Mainnet Meme Collective Fund' },
  { address: '0xA75F524Ae2A62f4511cedA8BE464f9bf1bb58088', symbol: 'RWAC', name: 'RWA Core Index' },
]

// ── Shared protocol constants ────────────────────────────────────────────────
export const DSTABLE_DECIMALS = 6 // $1 peg
export const POOL_FEE_PIPS = 10_000 // 1% index pool swap fee
export const LP_HOLDERS_BPS = 6_000 // 60% of fees → holders
export const CREATOR_BPS = 3_000 // 30% → creator
export const PRISM_BURN_BPS = 1_000 // 10% → buy & burn PRISM
export const SLOT_DURATION_BLOCKS = 10
export const AUCTION_FLOOR_ETH = 0.1
export const HOOK_FLAGS_SUFFIX = 0x88 // BEFORE_SWAP (0x80) | BEFORE_SWAP_RETURNS_DELTA (0x08)

export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as Address
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

// Explorers
export const BASESCAN = 'https://basescan.org'
export const ETHERSCAN = 'https://etherscan.io'
