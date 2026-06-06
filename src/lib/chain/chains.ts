import type { Address, Chain, Hex } from 'viem'
import { base, mainnet } from 'viem/chains'
import {
  BASE,
  BASESCAN,
  ETH_SEED_INDEXES,
  ETHERSCAN,
  MAINNET,
  SEED_INDEXES,
} from './constants'

// Per-chain config powering the network toggle + dual-chain reader / pool engine.
// One object per supported chain so callers can stay chain-agnostic: pass a chainId,
// get back everything needed to read indexes and (later) route pools on that chain.
export interface ChainCfg {
  chainId: number
  key: 'base' | 'ethereum'
  name: string
  viemChain: Chain
  spectrumFactory: Address
  dstable: Address
  poolManager: Address
  weth: Address
  // Uniswap factories for pool discovery (v4 uses the singleton poolManager above).
  uniV2Factory: Address
  uniV3Factory: Address
  // Aerodrome PoolFactory (Base only) — detected so we can warn (Aerodrome can't host hooks).
  aerodromeFactory: Address | null
  // Canonical dstable/ETH V4 pool used to price baskets in dstable.
  // null → no pool wired (price factor = 1, aggregate spot). ETH is null for now.
  dstableEthPoolId: Hex | null
  // DexScreener path segment for keyless token pricing.
  dexscreenerSlug: 'base' | 'ethereum'
  explorer: string
  seeds: { address: Address; symbol: string; name: string }[]
}

export const CHAINS: Record<number, ChainCfg> = {
  [BASE.chainId]: {
    chainId: BASE.chainId,
    key: 'base',
    name: 'Base',
    viemChain: base,
    spectrumFactory: BASE.spectrumFactory,
    dstable: BASE.dstable,
    poolManager: BASE.poolManager,
    weth: BASE.weth,
    uniV2Factory: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
    uniV3Factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    aerodromeFactory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
    dstableEthPoolId: BASE.dstableEthPoolId,
    dexscreenerSlug: 'base',
    explorer: BASESCAN,
    seeds: SEED_INDEXES,
  },
  [MAINNET.chainId]: {
    chainId: MAINNET.chainId,
    key: 'ethereum',
    name: 'Ethereum',
    viemChain: mainnet,
    spectrumFactory: MAINNET.spectrumFactory,
    dstable: MAINNET.dstable,
    poolManager: MAINNET.poolManager,
    weth: MAINNET.weth,
    uniV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    uniV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    aerodromeFactory: null,
    dstableEthPoolId: null,
    dexscreenerSlug: 'ethereum',
    explorer: ETHERSCAN,
    seeds: ETH_SEED_INDEXES,
  },
}

export const SUPPORTED_CHAIN_IDS = [BASE.chainId, MAINNET.chainId] as const
export const DEFAULT_CHAIN_ID = BASE.chainId

export function chainCfg(chainId: number): ChainCfg {
  const cfg = CHAINS[chainId]
  if (!cfg) throw new Error(`Unsupported chainId: ${chainId}`)
  return cfg
}
