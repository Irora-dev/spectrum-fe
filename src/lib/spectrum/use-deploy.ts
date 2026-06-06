import { useCallback, useRef, useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { parseEventLogs, type Address, type Hex } from 'viem'
import { chainCfg } from '../chain/chains'
import { DEPLOY_ENABLED } from '../config/features'
import { factoryDeployAbi, launchedEvent } from './abis'
import { mineSalt } from './salt-mining'
import {
  startSqrtPriceX96ForDollarNav,
  toBasketEntries,
  type DeployAssetInput,
  type DeployBasketEntry,
} from './deploy'

const ZERO = '0x0000000000000000000000000000000000000000' as const

// idle → mining (find the 0x88 salt) → preparing (price + simulate) → ready (safe to
// sign) → signing (wallet prompt) → confirming (mined) → success | error.
export type DeployStatus =
  | 'idle'
  | 'mining'
  | 'preparing'
  | 'ready'
  | 'signing'
  | 'confirming'
  | 'success'
  | 'error'

export interface DeployInput {
  name: string
  symbol: string
  assets: DeployAssetInput[]
  /** whole-% weights aligned with `assets` (the builder's weight model). */
  weights: number[]
  /** optional yield manager; address(0) = none. */
  pook?: Address
}

export interface DeployState {
  status: DeployStatus
  /** salt-mining probe count (drives a "mining…" readout). */
  attempts: number
  salt: Hex | null
  predicted: Address | null
  startSqrtPriceX96: bigint | null
  priceWei: bigint | null
  txHash: Hex | null
  /** deployed index address, parsed from the Launched event. */
  token: Address | null
  error: string | null
}

const INITIAL: DeployState = {
  status: 'idle',
  attempts: 0,
  salt: null,
  predicted: null,
  startSqrtPriceX96: null,
  priceWei: null,
  txHash: null,
  token: null,
  error: null,
}

interface Prepared {
  chainId: number
  factory: Address
  deployer: Address
  name: string
  symbol: string
  basket: DeployBasketEntry[]
  pook: Address
  salt: Hex
  startSqrtPriceX96: bigint
  priceWei: bigint
}

/**
 * Headless launch flow for the index builder. Splits into two steps so the UI ceremony
 * can play while we mine, then ask for an explicit signature:
 *   • prepare(input) — assemble basket → mine the 0x88 salt → read the Dutch-auction price
 *     → compute the $1.00-NAV start price → simulate (no broadcast). Lands in 'ready'.
 *   • broadcast()    — sign + send deployIndex, wait for the receipt, parse Launched.
 *
 * `enabled` is false unless DEPLOY_ENABLED and a wallet is connected on the active
 * chain — broadcast() refuses otherwise. Everything else (mining, pricing, simulation)
 * is read-only and safe to run regardless.
 */
export function useDeployIndex(chainId: number) {
  const cfg = chainCfg(chainId) // throws on unsupported, so the wagmi cast below is safe
  const wagmiChainId = chainId as 8453 | 1
  const { address, isConnected, chainId: walletChainId } = useAccount()
  const publicClient = usePublicClient({ chainId: wagmiChainId })
  const { writeContractAsync } = useWriteContract()

  const [state, setState] = useState<DeployState>(INITIAL)
  const preparedRef = useRef<Prepared | null>(null)
  const patch = useCallback((p: Partial<DeployState>) => setState((s) => ({ ...s, ...p })), [])

  // Launch requires the dedicated DEPLOY_ENABLED gate (which itself requires
  // WALLET_ENABLED) — having a wallet, or trading being on, is never enough to arm a deploy.
  const enabled = DEPLOY_ENABLED && isConnected && walletChainId === chainId
  const reset = useCallback(() => {
    preparedRef.current = null
    setState(INITIAL)
  }, [])

  const prepare = useCallback(
    async (input: DeployInput) => {
      const deployer = (address ?? ZERO) as Address
      const pook = input.pook ?? ZERO
      try {
        preparedRef.current = null
        setState({ ...INITIAL, status: 'mining' })

        const basket = toBasketEntries(input.assets, input.weights)

        const { salt, predicted } = await mineSalt({
          factory: cfg.spectrumFactory,
          chainId,
          basket,
          deployer,
          pook,
          onProgress: (attempts) => patch({ attempts }),
        })
        const startSqrtPriceX96 = startSqrtPriceX96ForDollarNav(predicted, cfg.dstable)
        patch({ status: 'preparing', salt, predicted, startSqrtPriceX96 })

        // Dutch-auction cost to claim the next slot. Reverts SlotNotOpen() between slots.
        let priceWei: bigint
        try {
          priceWei = await (publicClient ?? throwNoClient()).readContract({
            address: cfg.spectrumFactory,
            abi: factoryDeployAbi,
            functionName: 'currentDeployPrice',
          })
        } catch {
          throw new Error('Auction slot is not open yet — one deploy per slot. Try again in a few blocks.')
        }

        // Dry-run against the live factory + connected account so a doomed deploy fails
        // here, before any signature. Skipped with no wallet (nothing to simulate against).
        if (address && publicClient) {
          await publicClient.simulateContract({
            account: address,
            address: cfg.spectrumFactory,
            abi: factoryDeployAbi,
            functionName: 'deployIndex',
            args: [salt, input.name, input.symbol, basket, pook, startSqrtPriceX96, priceWei],
            value: priceWei,
          })
        }

        preparedRef.current = {
          chainId,
          factory: cfg.spectrumFactory,
          deployer,
          name: input.name,
          symbol: input.symbol,
          basket,
          pook,
          salt,
          startSqrtPriceX96,
          priceWei,
        }
        patch({ status: 'ready', priceWei })
      } catch (e) {
        patch({ status: 'error', error: messageOf(e) })
      }
    },
    [address, chainId, cfg.dstable, cfg.spectrumFactory, patch, publicClient],
  )

  const broadcast = useCallback(async () => {
    const p = preparedRef.current
    if (!p) return patch({ status: 'error', error: 'Nothing prepared to deploy. Run prepare() first.' })
    // Hard stop, independent of any UI gating: launching is blocked unless DEPLOY_ENABLED
    // is explicitly set. This is the last line of defense against an accidental deploy.
    if (!DEPLOY_ENABLED) return patch({ status: 'error', error: 'Index deploy is disabled on this build (set VITE_ENABLE_DEPLOY).' })
    if (!isConnected || walletChainId !== chainId) {
      return patch({ status: 'error', error: `Connect a wallet on ${cfg.name} to deploy.` })
    }
    try {
      patch({ status: 'signing', error: null })
      // maxCost == the price we showed: a tight slippage guard. The Dutch price only
      // falls within a slot, so this lands; if a new slot opened it reverts (no overpay).
      const hash = await writeContractAsync({
        address: p.factory,
        abi: factoryDeployAbi,
        functionName: 'deployIndex',
        args: [p.salt, p.name, p.symbol, p.basket, p.pook, p.startSqrtPriceX96, p.priceWei],
        value: p.priceWei,
        chainId: p.chainId as 8453 | 1,
      })
      patch({ status: 'confirming', txHash: hash })

      const receipt = await (publicClient ?? throwNoClient()).waitForTransactionReceipt({ hash })
      const launched = parseEventLogs({ abi: [launchedEvent], logs: receipt.logs })
      const token = (launched.find((l) => eqAddr(l.args.deployer, p.deployer))?.args.token ??
        launched[0]?.args.token ??
        null) as Address | null
      patch({ status: 'success', token })
    } catch (e) {
      patch({ status: 'error', error: messageOf(e) })
    }
  }, [chainId, cfg.name, isConnected, patch, publicClient, walletChainId, writeContractAsync])

  return { ...state, enabled, prepare, broadcast, reset }
}

function throwNoClient(): never {
  throw new Error('No RPC client for the active chain.')
}

function eqAddr(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase()
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object' && 'shortMessage' in e && typeof e.shortMessage === 'string') {
    return e.shortMessage
  }
  return e instanceof Error ? e.message : String(e)
}
