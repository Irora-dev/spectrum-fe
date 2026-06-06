import { createPublicClient, http, type PublicClient } from 'viem'
import { CHAINS } from './chains'
import { BASE_CHAIN_ID, MAINNET_CHAIN_ID } from './constants'

// Public fallbacks (no key). Match the existing dashboard's reference.
const PUBLIC_BASE = 'https://base-rpc.publicnode.com'
const PUBLIC_MAINNET = 'https://ethereum-rpc.publicnode.com'

const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY

// Precedence (mirrors the existing app): explicit VITE_*_RPC_URL → Alchemy key → public.
//
// NOTE: this is a fully client-side (static / IPFS) build — anything resolved here
// ships in the bundle. A VITE_ALCHEMY_API_KEY would therefore be PUBLIC. Prefer the
// public fallback, a key restricted by allowed-origins, or a read proxy you control.
export function baseRpcUrl(): string {
  return (
    import.meta.env.VITE_BASE_RPC_URL ||
    (alchemyKey ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}` : PUBLIC_BASE)
  )
}

export function mainnetRpcUrl(): string {
  return (
    import.meta.env.VITE_MAINNET_RPC_URL ||
    (alchemyKey ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}` : PUBLIC_MAINNET)
  )
}

// Whether an Alchemy key is configured — enables wide (full-range) filtered getLogs,
// which public RPCs choke on. The pool engine uses this for complete V4 discovery.
export function hasAlchemyKey(): boolean {
  return !!alchemyKey
}

export function rpcUrlFor(chainId: number): string {
  return chainId === MAINNET_CHAIN_ID ? mainnetRpcUrl() : baseRpcUrl()
}

// Per-chain singleton read clients. `batch.multicall` coalesces concurrent
// readContract calls into Multicall3 — one RPC round-trip instead of N, which
// matters for basket reads over a public endpoint.
const clients = new Map<number, PublicClient>()
export function clientFor(chainId: number): PublicClient {
  const existing = clients.get(chainId)
  if (existing) return existing
  const cfg = CHAINS[chainId]
  if (!cfg) throw new Error(`Unsupported chainId: ${chainId}`)
  const client: PublicClient = createPublicClient({
    chain: cfg.viemChain,
    transport: http(rpcUrlFor(chainId)),
    batch: { multicall: true },
  })
  clients.set(chainId, client)
  return client
}

export function baseClient(): PublicClient {
  return clientFor(BASE_CHAIN_ID)
}
