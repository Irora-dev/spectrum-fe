import { type Address, type Hex, toHex } from 'viem'
import { clientFor } from '../chain/rpc'
import { factoryDeployAbi } from './abis'
import type { DeployBasketEntry } from './deploy'

// The deployed index token IS its own V4 hook, so its address must carry the hook
// permission bits the PoolManager checks: BEFORE_SWAP (1<<7) | BEFORE_SWAP_RETURNS_DELTA
// (1<<3) = 0x88, masked to the low 14 bits. The factory enforces
// `uint160(token) & 0x3FFF == 0x88` (BadHookFlags) at deploy. CREATE2 makes the address a
// pure function of (factory, salt, initCodeHash); initCodeHash is fixed by the basket +
// deployer + pook, so only `salt` is free — we brute-force it until the predicted address
// lands on the bits. Hit rate is 1/16384, so expect ~16k probes.
const HOOK_FLAGS_MASK = 0x3fffn
const HOOK_FLAGS = 0x88n

/** True when `addr` carries the 0x88 hook permission bits the factory requires. */
export function hasHookFlags(addr: Address): boolean {
  return (BigInt(addr) & HOOK_FLAGS_MASK) === HOOK_FLAGS
}

export interface MineSaltArgs {
  /** Spectrum factory for the target chain. */
  factory: Address
  chainId: number
  /** The basket exactly as it will be passed to deployIndex (decimals are normalized
   *  away on-chain, so they don't affect the address — but asset/venue/route/weight do). */
  basket: DeployBasketEntry[]
  /** msg.sender of the eventual deployIndex call — baked into the init code, so the
   *  mined salt is valid ONLY for this deployer. */
  deployer: Address
  /** Optional yield manager. address(0) (default) means none. */
  pook?: Address
  /** predictTokenAddress calls per Multicall3 round-trip. Bigger = fewer round-trips but
   *  heavier eth_call (each probe extcodecopies the ~24KB token bytecode); public RPCs cap
   *  eth_call gas, so keep this modest without a dedicated endpoint. */
  batchSize?: number
  /** Safety cap so a pathological run can't loop forever (default ~12× the expected ~16k). */
  maxAttempts?: number
  /** Reports cumulative probe count after each batch — drive a "mining…" UI off this. */
  onProgress?: (attempts: number) => void
  signal?: AbortSignal
}

export interface MinedSalt {
  salt: Hex
  predicted: Address
  attempts: number
}

/** 32-byte random starting point so concurrent miners don't collide and the salt isn't
 *  predictable; we then walk sequentially from it. */
function randomSaltBase(): bigint {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  return n
}

const U256_MASK = (1n << 256n) - 1n

/**
 * Mine a CREATE2 salt whose predicted index-token address carries the 0x88 hook bits.
 * Uses the factory's own `predictTokenAddress` view as the oracle (robust: it reuses the
 * exact on-chain init code, so the mined address is guaranteed to match the real deploy)
 * batched through Multicall3. An Alchemy key (VITE_ALCHEMY_API_KEY) makes this snappy;
 * the public RPC works but is slower and may throttle long runs.
 *
 * Future optimization: the CREATE2 init-code hash is independent of the salt, so fetching
 * the factory's two token-code-provider bytecodes once + replicating _buildInitCode lets
 * us mine locally (keccak only, no RPC per probe). Skipped for now — the on-chain oracle
 * can't drift from the deployed bytecode, which the local path could.
 */
export async function mineSalt(args: MineSaltArgs): Promise<MinedSalt> {
  const {
    factory,
    chainId,
    basket,
    deployer,
    pook = '0x0000000000000000000000000000000000000000',
    batchSize = 60,
    maxAttempts = 200_000,
    onProgress,
    signal,
  } = args

  const client = clientFor(chainId)
  const base = randomSaltBase()
  const saltAt = (i: number): Hex => toHex((base + BigInt(i)) & U256_MASK, { size: 32 })

  // Probe once up front so a malformed basket / wrong factory fails loudly here rather
  // than masquerading as "no salt found" after thousands of silent batch failures.
  const probe = await client.readContract({
    address: factory,
    abi: factoryDeployAbi,
    functionName: 'predictTokenAddress',
    args: [saltAt(0), basket, deployer, pook],
  })
  if (hasHookFlags(probe)) return { salt: saltAt(0), predicted: probe, attempts: 1 }

  let attempts = 1
  for (let start = 1; start < maxAttempts; start += batchSize) {
    if (signal?.aborted) throw new DOMException('Salt mining aborted', 'AbortError')
    const salts = Array.from({ length: Math.min(batchSize, maxAttempts - start) }, (_, k) => saltAt(start + k))
    const results = await client.multicall({
      contracts: salts.map((salt) => ({
        address: factory,
        abi: factoryDeployAbi,
        functionName: 'predictTokenAddress',
        args: [salt, basket, deployer, pook],
      })),
      allowFailure: true,
    })
    for (let k = 0; k < results.length; k++) {
      const r = results[k]
      if (r.status !== 'success') continue
      const predicted = r.result as unknown as Address
      if (hasHookFlags(predicted)) {
        return { salt: salts[k], predicted, attempts: attempts + k + 1 }
      }
    }
    attempts += salts.length
    onProgress?.(attempts)
  }
  throw new Error(`No 0x88 salt found in ${maxAttempts} attempts — retry (random restart) or raise maxAttempts.`)
}
