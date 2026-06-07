import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getAddress, isAddress, type Address } from 'viem'
import { useAccount } from 'wagmi'
import { useActiveChainId } from '../../lib/chain/active-chain'
import { chainCfg } from '../../lib/chain/chains'
import { clientFor } from '../../lib/chain/rpc'
import { findBestPool, PoolDetectionError, type BasketRoute } from '../../lib/pools'
import {
  addAsset,
  adjustWeight,
  CAP,
  equalSplit,
  isValid,
  MAX_ASSETS,
  MIN,
  removeAsset,
  setWeight,
  STEP,
  sum,
} from '../../lib/spectrum/weights'
import { tokenVisual } from '../../lib/spectrum/token-meta'
import { formatUsdCompact, shortAddr } from '../../lib/spectrum/format'
import { resolveCreator } from '../../lib/spectrum/creator'
import { useAllIndexes } from '../../lib/spectrum/hooks'
import { AssetLogo } from '../AssetLogo'
import { BasketBento, type BentoItem } from '../BasketBento'
import { DeployPortal } from './DeployPortal'
import { AssetSearch } from './AssetSearch'
import { PopularAssets } from './PopularAssets'
import { useDeployIndex } from '../../lib/spectrum/use-deploy'
import { SECTORS, SECTOR_COLOR, type Sector } from '../../lib/spectrum/sectors'

interface BuilderAsset {
  address: string
  symbol: string
  decimals: number
  venueLabel: string
  depthUsd: number | null
  warnings: string[]
  route: BasketRoute
}

const symbolAbi = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const

async function readSymbol(addr: string, chainId: number): Promise<string> {
  try {
    const s = await clientFor(chainId).readContract({ address: addr as Address, abi: symbolAbi, functionName: 'symbol' })
    return (s as string) || shortAddr(addr)
  } catch {
    return shortAddr(addr)
  }
}

async function resolveAsset(addr: string, chainId: number, knownSymbol?: string): Promise<BuilderAsset> {
  const [pool, symbol] = await Promise.all([
    findBestPool(addr as Address, chainId),
    knownSymbol ? Promise.resolve(knownSymbol) : readSymbol(addr, chainId),
  ])
  return {
    address: getAddress(addr),
    symbol,
    decimals: pool.decimals,
    venueLabel: pool.best.label,
    depthUsd: pool.best.depthUsd,
    warnings: pool.warnings,
    route: pool.route,
  }
}

const DEFAULT_GRAD = 'linear-gradient(135deg, #35e0ff, #a48bff 55%, #ff4db8)'
const HORIZONS = ['Swing', 'This cycle', 'Long-term'] as const

// Liquidity tiers for a basket constituent's routing pool. A thin pool means every
// index mint/redeem routes a slice of the trade through it, so it slips.
const LOW_LIQ_USD = 100_000
const VERY_LOW_LIQ_USD = 10_000
type LiqTier = 'ok' | 'low' | 'verylow'
function liqTier(depthUsd: number | null): LiqTier {
  if (depthUsd == null) return 'low'
  if (depthUsd < VERY_LOW_LIQ_USD) return 'verylow'
  if (depthUsd < LOW_LIQ_USD) return 'low'
  return 'ok'
}
// Suggested max weight so a thin pool isn't a bottleneck — ~$20k of pool depth per
// 1% of basket weight, clamped to the builder's min/cap.
function suggestedWeight(depthUsd: number | null): number {
  if (depthUsd == null) return MIN
  return Math.max(MIN, Math.min(CAP, Math.round(depthUsd / 20_000)))
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// One stage of the launch flow. Renders nothing until `show` flips true, then fades
// up into place and (for steps past the first) gently scrolls itself into view — so
// the page reveals one focused area at a time instead of showing everything at once.
function Step({
  index,
  title,
  subtitle,
  show,
  complete,
  children,
}: {
  index: number
  title: string
  subtitle?: string
  show: boolean
  complete?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (!show) {
      setEntered(false)
      return
    }
    const t0 = window.setTimeout(() => setEntered(true), 30)
    let t: number | undefined
    if (index > 1 && !prefersReducedMotion()) {
      t = window.setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
    }
    return () => {
      window.clearTimeout(t0)
      if (t) window.clearTimeout(t)
    }
  }, [show, index])

  if (!show) return null
  return (
    <section
      ref={ref}
      id={`step-${index}`}
      aria-labelledby={`step-${index}-title`}
      className="scroll-mt-24 rounded-2xl card-surface p-5 backdrop-blur-md sm:p-6"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'none' : 'translateY(18px)',
        transition: 'opacity 0.5s ease, transform 0.55s cubic-bezier(0.34,1.2,0.64,1)',
      }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-num text-sm font-bold tabular-nums"
          style={
            complete
              ? { background: 'rgba(52,214,196,0.16)', color: '#34d6c4', boxShadow: 'inset 0 0 0 1px rgba(52,214,196,0.45)' }
              : { background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }
          }
        >
          {complete ? '✓' : index}
        </span>
        <div className="min-w-0">
          <h2 id={`step-${index}-title`} className="font-display text-lg font-bold uppercase tracking-tight text-ink">
            <span className="sr-only">{`Step ${index}: `}</span>
            {title}
            {complete && <span className="sr-only"> (complete)</span>}
          </h2>
          {subtitle && <div className="mt-1 font-mono text-[15px] leading-snug text-ink-dim">{subtitle}</div>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

interface StepState {
  n: number
  label: string
  done: boolean
}

// Progress rail across the 5 stages: an overview + a keyboard-accessible jump-to-step
// (anchor links to each Step's id). Revealed steps are links; upcoming ones are inert.
function Stepper({ steps, maxStep, current }: { steps: StepState[]; maxStep: number; current: number }) {
  return (
    <nav aria-label="Launch progress" className="rounded-2xl card-surface px-3 py-2.5 backdrop-blur-md sm:px-4">
      <ol className="flex items-center">
        {steps.map((s, i) => {
          const revealed = s.n <= maxStep
          const isCurrent = s.n === current
          const node = (
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-num text-xs font-bold tabular-nums transition-colors"
                style={
                  s.done
                    ? { background: 'rgba(52,214,196,0.16)', color: '#34d6c4', boxShadow: 'inset 0 0 0 1px rgba(52,214,196,0.45)' }
                    : isCurrent
                      ? { background: 'rgba(53,224,255,0.14)', color: '#35e0ff', boxShadow: 'inset 0 0 0 1px rgba(53,224,255,0.5)' }
                      : { background: 'rgba(255,255,255,0.05)', color: revealed ? '#8b8b9e' : '#565669', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }
                }
              >
                {s.done ? '✓' : s.n}
              </span>
              <span
                className={`hidden font-mono text-[11px] uppercase tracking-[0.15em] sm:inline ${
                  isCurrent ? 'text-ink' : revealed ? 'text-ink-dim' : 'text-ink-faint'
                }`}
              >
                {s.label}
              </span>
            </span>
          )
          const srText = `Step ${s.n}: ${s.label}${s.done ? ', complete' : isCurrent ? ', current' : !revealed ? ', upcoming' : ''}. `
          return (
            <li key={s.n} className="flex flex-1 items-center last:flex-none">
              {revealed ? (
                <a
                  href={`#step-${s.n}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="rounded-full transition-opacity hover:opacity-80"
                >
                  <span className="sr-only">{srText}</span>
                  {node}
                </a>
              ) : (
                <span>
                  <span className="sr-only">{srText}</span>
                  {node}
                </span>
              )}
              {i < steps.length - 1 && <span aria-hidden className="mx-2 h-px flex-1 bg-white/10 sm:mx-3" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function IndexBuilder() {
  const chainId = useActiveChainId()
  const cfg = useMemo(() => chainCfg(chainId), [chainId])
  const { address: account } = useAccount()

  const [assets, setAssets] = useState<BuilderAsset[]>([])
  const [weights, setWeights] = useState<number[]>([])
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [adding, setAdding] = useState(false)
  // Per-asset (keyed by address) state for the "recheck pools" action on thin pools.
  const [recheck, setRecheck] = useState<Record<string, 'checking' | 'better' | 'none' | 'set'>>({})
  const [error, setError] = useState<string | null>(null)
  const [sector, setSector] = useState<Sector | ''>('')
  const [tagline, setTagline] = useState('')
  const [thesis, setThesis] = useState('')
  const [horizon, setHorizon] = useState<string>('')
  const [xHandle, setXHandle] = useState('')
  const [creatorName, setCreatorName] = useState('')

  // Live preview of who the index will be attributed to: X handle → name → the
  // connected deploy address. Drives the builder hint + the deploy reveal.
  const creatorPreview = useMemo(
    () => resolveCreator({ handle: xHandle, name: creatorName, deployer: account ?? null }),
    [xHandle, creatorName, account],
  )
  const [deploying, setDeploying] = useState(false)
  const deploy = useDeployIndex(chainId)
  // Open the ceremony + kick off the read-only prepare (mine + price + simulate). The
  // on-chain broadcast stays gated behind DEPLOY_ENABLED inside the hook. Shared by the
  // Step-5 button and the bottom-of-page launch banner.
  const startDeploy = useCallback(() => {
    setDeploying(true)
    void deploy.prepare({
      name,
      symbol,
      assets: assets.map((a) => ({ address: a.address, decimals: a.decimals, route: a.route })),
      weights,
    })
  }, [deploy, name, symbol, assets, weights])
  const [basketConfirmed, setBasketConfirmed] = useState(false)
  // Deployer self-attestation that gates the launch CTA (placeholder legal copy in Step 5).
  const [acknowledged, setAcknowledged] = useState(false)
  const [maxStep, setMaxStep] = useState(1)

  useEffect(() => {
    setAssets([])
    setWeights([])
    setError(null)
    setSector('')
    setTagline('')
    setThesis('')
    setHorizon('')
    setDeploying(false)
    setBasketConfirmed(false)
    setMaxStep(1)
  }, [chainId])

  const inBasket = useCallback(
    (addr: string) => assets.some((a) => a.address.toLowerCase() === addr.toLowerCase()),
    [assets],
  )

  const add = useCallback(
    async (addr: string, knownSymbol?: string) => {
      setError(null)
      const raw = addr.trim()
      if (!isAddress(raw)) {
        setError('Enter a valid token contract address (0x…).')
        return
      }
      if (inBasket(raw)) {
        setError('That asset is already in the basket.')
        return
      }
      if (assets.length >= MAX_ASSETS) {
        setError(`A basket holds up to ${MAX_ASSETS} assets.`)
        return
      }
      setAdding(true)
      try {
        const a = await resolveAsset(raw, chainId, knownSymbol)
        setAssets((prev) => [...prev, a])
        // addAsset borrows from existing holdings to keep Σ = CAP, so it assumes a
        // basket that already sums to CAP — seed the first asset at the full CAP.
        setWeights((prev) => (prev.length === 0 ? [CAP] : addAsset(prev)))
      } catch (e) {
        if (e instanceof PoolDetectionError) setError(e.message)
        else setError('Could not validate this asset — check the address and the selected network.')
      } finally {
        setAdding(false)
      }
    },
    [assets.length, chainId, inBasket],
  )

  const remove = useCallback((i: number) => {
    setAssets((prev) => prev.filter((_, k) => k !== i))
    setWeights((prev) => removeAsset(prev, i))
  }, [])

  const bump = useCallback((i: number, delta: number) => setWeights((prev) => adjustWeight(prev, i, delta)), [])
  const setW = useCallback((i: number, v: number) => setWeights((prev) => setWeight(prev, i, v)), [])
  const equalize = useCallback(() => setWeights((prev) => equalSplit(prev.length)), [])

  // Re-run pool detection for one asset; if a deeper routing pool turns up, swap to
  // it. Otherwise flag "none" so the UI can suggest a safe (small) weight.
  const recheckPool = useCallback(
    async (i: number) => {
      const a = assets[i]
      if (!a) return
      const key = a.address.toLowerCase()
      setRecheck((m) => ({ ...m, [key]: 'checking' }))
      try {
        const fresh = await findBestPool(a.address as Address, chainId)
        const prev = a.depthUsd ?? 0
        const next = fresh.best.depthUsd ?? 0
        const better = next > prev * 1.02
        if (better) {
          setAssets((prevAssets) =>
            prevAssets.map((x, k) =>
              k === i
                ? {
                    ...x,
                    decimals: fresh.decimals,
                    venueLabel: fresh.best.label,
                    depthUsd: fresh.best.depthUsd,
                    warnings: fresh.warnings,
                    route: fresh.route,
                  }
                : x,
            ),
          )
        }
        setRecheck((m) => ({ ...m, [key]: better ? 'better' : 'none' }))
      } catch {
        setRecheck((m) => ({ ...m, [key]: 'none' }))
      }
    },
    [assets, chainId],
  )

  // Suggestions: real constituents of live indexes on this chain, most-used first.
  const { data: allIndexes } = useAllIndexes()
  const suggestions = useMemo(() => {
    const freq = new Map<string, { address: string; symbol: string; n: number }>()
    const dstable = cfg.dstable.toLowerCase()
    const weth = cfg.weth.toLowerCase()
    for (const ix of allIndexes ?? []) {
      if (ix.chainId !== chainId) continue
      for (const t of ix.top) {
        const k = t.address.toLowerCase()
        if (k === dstable || k === weth || !t.symbol || t.symbol === '?') continue
        const cur = freq.get(k)
        if (cur) cur.n += 1
        else freq.set(k, { address: t.address, symbol: t.symbol, n: 1 })
      }
    }
    return [...freq.values()].sort((a, b) => b.n - a.n)
  }, [allIndexes, chainId, cfg])

  // Derived views
  const total = sum(weights)
  const bentoItems: BentoItem[] = assets.map((a, i) => ({ symbol: a.symbol, address: a.address, weightPct: weights[i] ?? 0, chainId }))

  // Prismatic blend from the basket's brand colors (avatar + ambient glow).
  const blend = useMemo(() => assets.map((a) => tokenVisual(a.symbol, a.address).color), [assets])
  const avatarGrad =
    blend.length >= 2 ? `linear-gradient(135deg, ${blend.join(', ')})` : blend.length === 1 ? `linear-gradient(135deg, ${blend[0]}, ${blend[0]})` : DEFAULT_GRAD
  const glowGrad = blend.length === 0 ? null : `linear-gradient(115deg, ${(blend.length === 1 ? [blend[0], blend[0]] : blend).join(', ')})`

  const weightsValid = isValid(weights)
  const symbolValid = /^[A-Z0-9]{2,11}$/.test(symbol)
  const nameValid = name.trim().length >= 2
  const enoughAssets = assets.length >= 2
  const canDeploy = weightsValid && symbolValid && nameValid && enoughAssets
  // The launch CTA also requires the deployer acknowledgment (Step 5 checkbox).
  const readyToDeploy = canDeploy && acknowledged

  // Progressive reveal: the highest stage the basket has earned (monotonic, so editing
  // an earlier step never collapses a later one).
  const level =
    basketConfirmed && nameValid && symbolValid ? 5 : basketConfirmed ? 4 : enoughAssets ? 3 : assets.length >= 1 ? 2 : 1
  useEffect(() => {
    setMaxStep((m) => Math.max(m, level))
  }, [level])

  const stepState: StepState[] = [
    { n: 1, label: 'Assets', done: enoughAssets },
    { n: 2, label: 'Weights', done: enoughAssets && weightsValid },
    { n: 3, label: 'Review', done: basketConfirmed },
    { n: 4, label: 'Name', done: nameValid && symbolValid },
    { n: 5, label: 'Deploy', done: readyToDeploy },
  ]
  const currentStep = stepState.find((s) => s.n <= maxStep && !s.done)?.n ?? Math.min(maxStep, 5)

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6">
        <Stepper steps={stepState} maxStep={maxStep} current={currentStep} />

        {/* ── 1 · Add assets ─────────────────────────────────────────── */}
        <Step
          index={1}
          title="Add assets"
          subtitle={`Pick the tokens for your index on ${cfg.name}.`}
          show
          complete={enoughAssets}
        >
          <AssetSearch
            chainId={chainId}
            busy={adding}
            excludeAddresses={assets.map((a) => a.address)}
            onPick={(addr, sym) => void add(addr, sym)}
          />

          {error && (
            <p role="alert" className="mt-2.5 font-mono text-sm leading-relaxed text-alert">
              {error}
            </p>
          )}
          <p id="asset-help" className="mt-2.5 font-mono text-sm leading-relaxed text-ink-dim">
            We find the deepest Uniswap v2/v3/v4 pool automatically. Aerodrome-only tokens can't be used (no hook support).
          </p>

          <PopularAssets
            chainId={chainId}
            chainName={cfg.name}
            candidates={suggestions}
            excludeAddresses={assets.map((a) => a.address)}
            onPick={(addr, sym) => void add(addr, sym)}
            busy={adding}
          />
        </Step>

        {/* ── 2 · Set weights ────────────────────────────────────────── */}
        <Step
          index={2}
          title="Set weights"
          subtitle="Tune the mix — it always rebalances to 100%."
          show={maxStep >= 2}
          complete={enoughAssets && weightsValid}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-ink-dim">
              {assets.length}/{MAX_ASSETS} assets
            </span>
            {assets.length > 1 && (
              <button
                type="button"
                onClick={equalize}
                className="rounded-md border border-white/12 px-2.5 py-1 font-mono text-[13px] uppercase tracking-[0.15em] text-ink-dim transition-colors hover:border-white/30 hover:text-ink"
              >
                Equal weight
              </button>
            )}
          </div>

          <ul className="space-y-2.5">
            {assets.map((a, i) => {
              const color = tokenVisual(a.symbol, a.address).color
              const w = weights[i] ?? 0
              const tier = liqTier(a.depthUsd)
              const rk = recheck[a.address.toLowerCase()]
              const sugg = suggestedWeight(a.depthUsd)
              const showNudge = w > sugg
              const tierColor = tier === 'verylow' ? '#ff3b52' : '#ff9248'
              // Once the user accepts the suggested (safe) weight, the strip turns green.
              const safeguarded = rk === 'set' && !showNudge
              const stripColor = safeguarded ? '#34d6c4' : tierColor
              return (
                <li
                  key={a.address}
                  className="group relative flex flex-col gap-2.5 overflow-hidden rounded-xl border border-white/10 p-3"
                  style={{ background: `linear-gradient(90deg, ${color}1f, ${color}0a 32%, rgba(255,255,255,0.02) 72%)` }}
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} />
                  <div className="flex items-center gap-3">
                    <AssetLogo
                      address={a.address}
                      symbol={a.symbol}
                      chainId={chainId}
                      size={34}
                      discColor={`color-mix(in srgb, ${color} 55%, #000)`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-sm font-bold uppercase tracking-wide text-ink">{a.symbol}</span>
                        <span className="shrink-0 rounded border border-white/12 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-dim">
                          {a.venueLabel.replace('Uniswap ', '')}
                        </span>
                        {tier !== 'ok' && (
                          <span
                            className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: tierColor, background: `${tierColor}1f` }}
                          >
                            {tier === 'verylow' ? 'Very low liq' : 'Low liq'}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-xs text-ink-dim">
                        {a.depthUsd != null ? `~${formatUsdCompact(a.depthUsd)} liquidity` : shortAddr(a.address)}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-white/12 bg-black/40">
                      <button
                        type="button"
                        aria-label={`Decrease ${a.symbol} weight`}
                        onClick={() => bump(i, -STEP)}
                        disabled={w <= MIN}
                        className="grid h-8 w-8 place-items-center font-num text-ink-dim transition-colors hover:bg-white/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        −
                      </button>
                      <WeightInput value={w} onCommit={(v) => setW(i, v)} label={a.symbol} />
                      <button
                        type="button"
                        aria-label={`Increase ${a.symbol} weight`}
                        onClick={() => bump(i, STEP)}
                        className="grid h-8 w-8 place-items-center font-num text-ink-dim transition-colors hover:bg-white/5 hover:text-ink"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      aria-label={`Remove ${a.symbol}`}
                      onClick={() => remove(i)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-dim transition-colors hover:bg-white/5 hover:text-alert"
                    >
                      ×
                    </button>
                  </div>

                  {tier !== 'ok' && (
                    <div
                      className="relative flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-2.5 py-2 font-mono text-[11px] leading-relaxed"
                      style={{ borderColor: `${stripColor}40`, background: `${stripColor}12` }}
                    >
                      {safeguarded ? (
                        <span className="text-teal">
                          <span className="font-bold">✓ </span>
                          Whilst large transactions may suffer slippage, this weighting safeguards as best as
                          possible.
                        </span>
                      ) : (
                        <>
                          {!rk && (
                            <span className="text-ink-dim">
                              <span className="font-bold" style={{ color: stripColor }}>
                                ⚠{' '}
                              </span>
                              {tier === 'verylow'
                                ? 'Very thin pool — large index trades will slip badly here.'
                                : 'Thin pool — sizable index trades may slip here.'}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => void recheckPool(i)}
                            disabled={rk === 'checking'}
                            className="rounded-md border border-white/15 px-2 py-1 uppercase tracking-wide text-ink transition-colors hover:border-cyan/60 hover:text-cyan disabled:opacity-50"
                          >
                            {rk === 'checking' ? 'Rechecking…' : 'Recheck pools'}
                          </button>
                          {rk === 'better' && <span className="text-teal">Found a deeper pool ✓</span>}
                          {rk === 'none' && !showNudge && <span className="text-ink-dim">No deeper pool found.</span>}
                          {showNudge && (rk === 'none' || rk === 'set') && (
                            <>
                              <span className="text-ink-dim">
                                {rk === 'none' ? 'No deeper pool found — keep its weight small:' : 'Keep its weight small:'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setW(i, sugg)
                                  setRecheck((m) => ({ ...m, [a.address.toLowerCase()]: 'set' }))
                                }}
                                className="rounded-md px-2 py-1 font-bold uppercase tracking-wide text-black transition-transform hover:scale-[1.03]"
                                style={{ background: tierColor }}
                              >
                                Set {sugg}%
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {/* live bento — the basket reshapes into its index "box" as you tune weights */}
          <div className="mt-4 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-faint">Your basket</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">live preview</span>
          </div>
          <div className="mt-2">
            <BasketBento items={bentoItems} aspect={3} />
          </div>
          {/* slim balance bar under the bento */}
          <div aria-hidden className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            {assets.map((a, i) => (
              <div
                key={a.address}
                className="h-full transition-[width] duration-300 ease-out"
                style={{ width: `${weights[i] ?? 0}%`, background: tokenVisual(a.symbol, a.address).color }}
                title={`${a.symbol} · ${weights[i] ?? 0}%`}
              />
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between font-mono text-[11px] uppercase tracking-wide">
            <span className="text-ink-dim">
              Min {MIN}% per asset · type or ±{STEP}%
            </span>
            <span aria-live="polite" className={total === CAP ? 'text-teal' : 'text-alert'}>
              {total === CAP ? '✓ Balanced · 100%' : `Σ ${total}%`}
            </span>
          </div>
        </Step>

        {/* ── 3 · Review & confirm basket ────────────────────────────── */}
        <Step
          index={3}
          title="Review basket"
          subtitle="Lock in your basket before naming it. Tweak assets and weights above to reshape it."
          show={maxStep >= 3}
          complete={basketConfirmed}
        >
          {basketConfirmed ? (
            <div className="flex items-center justify-center gap-2 font-mono text-[12px] uppercase tracking-[0.15em] text-teal">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-teal/15 text-[10px]">✓</span>
              Basket confirmed — name it below
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={!(enoughAssets && weightsValid)}
                onClick={() => setBasketConfirmed(true)}
                className="w-full rounded-xl py-3.5 font-display text-base font-bold uppercase tracking-[0.15em] text-black transition-transform hover:enabled:scale-[1.01] disabled:cursor-not-allowed"
                style={enoughAssets && weightsValid ? { background: 'linear-gradient(90deg,#ff9248,#ff4db8,#35e0ff)' } : { background: 'rgba(255,255,255,0.08)', color: '#565669' }}
              >
                Confirm basket
              </button>
              {!(enoughAssets && weightsValid) && (
                <p className="mt-2 text-center font-mono text-xs text-ink-dim">Add at least 2 assets, balanced to 100%.</p>
              )}
            </>
          )}
        </Step>

        {/* ── 4 · Name your index ────────────────────────────────────── */}
        <Step
          index={4}
          title="Name your index"
          subtitle="Give it an identity, and an optional thesis buyers will read."
          show={maxStep >= 4}
          complete={nameValid && symbolValid}
        >
          <div className="mb-6">
            <div className="font-mono text-[13px] uppercase tracking-[0.15em] text-ink-dim">
              Your basket · {assets.length} assets · starts at $1.00
            </div>
            <div className="mt-2.5">
              <BasketBento items={bentoItems} aspect={1.7} />
            </div>
          </div>

          <div className="relative">
            {glowGrad && (
              <div
                aria-hidden
                className="pointer-events-none absolute -top-28 left-1/2 -z-0 h-48 w-[120%] -translate-x-1/2 opacity-35 blur-3xl"
                style={{ background: glowGrad }}
              />
            )}
            <div className="relative z-10 flex items-center gap-3.5">
              <div className="relative shrink-0">
                <div className="absolute -inset-1 rounded-2xl opacity-60 blur-md" style={{ background: avatarGrad }} aria-hidden />
                <div className="relative grid h-14 w-14 place-items-center rounded-2xl ring-1 ring-white/20" style={{ background: avatarGrad }}>
                  <span aria-hidden className="font-display text-xl font-bold text-black/75">◆</span>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <label htmlFor="index-name" className="sr-only">
                  Index name
                </label>
                <input
                  id="index-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 42))}
                  placeholder="Index name (e.g. Base AI Index)"
                  className="w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3 font-display text-lg text-ink placeholder:text-ink-dim transition-colors focus:border-cyan/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-cyan/15"
                />
                <label htmlFor="index-symbol" className="sr-only">
                  Ticker symbol
                </label>
                <div className="flex items-center rounded-xl border border-white/12 bg-black/40 px-4 transition-colors focus-within:border-cyan/60 focus-within:bg-black/50 focus-within:ring-2 focus-within:ring-cyan/15">
                  <span aria-hidden className="font-num text-lg text-ink-dim">$</span>
                  <input
                    id="index-symbol"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
                    placeholder="SYMBOL"
                    className="w-full bg-transparent py-3 font-display text-lg font-bold uppercase tracking-wide text-ink placeholder:text-ink-dim focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div id="sector-label" className="font-mono text-[13px] uppercase tracking-[0.15em] text-ink-dim">Sector</div>
            <div role="group" aria-labelledby="sector-label" className="mt-2 flex flex-wrap gap-2">
              {SECTORS.map((s) => {
                const on = sector === s
                const c = SECTOR_COLOR[s]
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSector(on ? '' : s)}
                    className="rounded-full border px-4 py-1.5 font-display text-sm font-bold uppercase tracking-wide transition-colors"
                    style={on ? { borderColor: c, background: `${c}24`, color: '#e8e8f0' } : { borderColor: 'rgba(255,255,255,0.12)', color: '#8b8b9e' }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="tagline" className="font-mono text-[13px] uppercase tracking-[0.15em] text-ink-dim">Tagline</label>
            <input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, 48))}
              placeholder="e.g. The AI economy"
              className="mt-2 w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3 font-display text-base text-ink placeholder:text-ink-dim transition-colors focus:border-cyan/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-cyan/15"
            />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label htmlFor="thesis" className="font-mono text-[13px] uppercase tracking-[0.15em] text-ink-dim">Thesis</label>
              <span aria-hidden className="font-mono text-xs text-ink-dim">{thesis.length}/400</span>
            </div>
            <textarea
              id="thesis"
              value={thesis}
              onChange={(e) => setThesis(e.target.value.slice(0, 400))}
              rows={4}
              maxLength={400}
              placeholder="Why this basket, why these weights, and over what horizon."
              className="mt-2 w-full resize-none rounded-xl border border-white/12 bg-black/40 px-4 py-3 font-mono text-sm leading-relaxed text-ink placeholder:text-ink-dim transition-colors focus:border-cyan/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-cyan/15"
            />
          </div>

          <div className="mt-5">
            <div id="horizon-label" className="font-mono text-[13px] uppercase tracking-[0.15em] text-ink-dim">Time horizon</div>
            <div role="group" aria-labelledby="horizon-label" className="mt-2 flex flex-wrap gap-2">
              {HORIZONS.map((h) => {
                const on = horizon === h
                return (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setHorizon(on ? '' : h)}
                    className={`rounded-full border px-4 py-1.5 font-mono text-sm uppercase tracking-wide transition-colors ${
                      on ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-white/12 text-ink-dim hover:border-white/30 hover:text-ink'
                    }`}
                  >
                    {h}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-5">
            <div id="creator-label" className="font-mono text-[13px] uppercase tracking-[0.15em] text-ink-dim">Creator</div>
            <div role="group" aria-labelledby="creator-label" className="mt-2 grid gap-2 sm:grid-cols-2">
              <label htmlFor="creator-handle" className="sr-only">
                X / Twitter handle
              </label>
              <input
                id="creator-handle"
                value={xHandle}
                onChange={(e) => setXHandle(e.target.value.slice(0, 40))}
                placeholder="@handle (X / Twitter)"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-describedby="creator-hint"
                className="w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3 font-display text-base text-ink placeholder:text-ink-dim transition-colors focus:border-cyan/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-cyan/15"
              />
              <label htmlFor="creator-name" className="sr-only">
                Creator display name
              </label>
              <input
                id="creator-name"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value.slice(0, 40))}
                placeholder="or a display name"
                aria-describedby="creator-hint"
                className="w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3 font-display text-base text-ink placeholder:text-ink-dim transition-colors focus:border-cyan/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-cyan/15"
              />
            </div>
            <p id="creator-hint" className="mt-1.5 font-mono text-xs text-ink-dim">
              {creatorPreview.kind === 'address'
                ? account
                  ? `Leave blank to attribute to your deploy address (${shortAddr(account)}).`
                  : 'Leave blank to attribute to your deploy address once your wallet is connected.'
                : `Attributed to ${creatorPreview.label}.`}
            </p>
          </div>
        </Step>

        {/* ── 5 · Deploy ─────────────────────────────────────────────── */}
        <Step index={5} title="Deploy" subtitle="Mint your index token onchain." show={maxStep >= 5} complete={readyToDeploy}>
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-white/20" style={{ background: avatarGrad }}>
              <span aria-hidden className="font-display text-base font-bold text-black/75">◆</span>
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-base font-bold uppercase tracking-tight text-ink">{name || 'Your index'}</div>
              <div className="font-mono text-[13px] uppercase tracking-[0.15em] text-ink-dim">
                {symbol ? `$${symbol} · ` : ''}
                {assets.length} assets · starts at $1.00
              </div>
            </div>
          </div>

          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2">
            <Check ok={enoughAssets}>At least 2 assets</Check>
            <Check ok={weightsValid}>Weights balanced</Check>
            <Check ok={nameValid}>Index name set</Check>
            <Check ok={symbolValid}>Ticker set</Check>
          </ul>

          {/* Deployer self-attestation — gates the launch CTA below. PLACEHOLDER legal
              copy; finalize with counsel before deploy is enabled on a public build. */}
          <label
            className={`mt-5 flex cursor-pointer items-start gap-3 rounded-xl border bg-white/[0.02] p-4 transition-colors ${
              acknowledged ? 'border-teal/40' : 'tick-glow border-cyan/40'
            }`}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-cyan"
            />
            <span className="text-sm leading-relaxed text-ink-dim">
              I’m the creator and issuer of this index and responsible for my own legal and marketing
              obligations. Spectrum is software, not financial, investment, legal, or tax advice, and is
              provided without warranty.
            </span>
          </label>
        </Step>

        {/* Bottom-of-flow launch banner — the big, page-width deploy action. Routes
            through the same gated flow as Step 5 (startDeploy → ceremony); the on-chain
            broadcast stays behind DEPLOY_ENABLED, so this never launches on its own. */}
        <div
          className="flex flex-col items-center gap-5 rounded-2xl p-6 text-center sm:flex-row sm:justify-between sm:p-8 sm:text-left"
          style={{ background: readyToDeploy ? 'linear-gradient(90deg,#ff9248,#ff4db8,#35e0ff)' : 'rgba(255,255,255,0.06)' }}
        >
          <div className={readyToDeploy ? 'text-black' : 'text-ink-dim'}>
            <div className="font-display text-2xl font-bold uppercase leading-none tracking-tight sm:text-3xl">
              Ready to launch {symbol ? `$${symbol}` : 'your index'}?
            </div>
            <div className="mt-2 font-mono text-[13px] uppercase tracking-[0.15em] opacity-80">
              {assets.length} {assets.length === 1 ? 'asset' : 'assets'} · starts at $1.00 NAV
            </div>
          </div>
          <button
            type="button"
            disabled={!readyToDeploy}
            onClick={startDeploy}
            className="w-full shrink-0 rounded-xl bg-black px-10 py-4 font-display text-lg font-bold uppercase tracking-[0.2em] text-white transition-transform hover:enabled:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Deploy →
          </button>
        </div>
        {canDeploy && !acknowledged && (
          <p className="text-center font-mono text-xs text-ink-dim">
            Check the creator acknowledgment in step 5 to enable deploy.
          </p>
        )}
      </div>

      <DeployPortal
        open={deploying}
        onClose={() => {
          setDeploying(false)
          deploy.reset()
        }}
        onStartOver={() => {
          setDeploying(false)
          deploy.reset()
          setAssets([])
          setWeights([])
          setName('')
          setSymbol('')
          setSector('')
          setTagline('')
          setThesis('')
          setHorizon('')
          setXHandle('')
          setCreatorName('')
          setBasketConfirmed(false)
          setAcknowledged(false)
          setMaxStep(1)
        }}
        chainId={chainId}
        name={name}
        symbol={symbol}
        grad={avatarGrad}
        blend={blend}
        sector={sector || undefined}
        sectorColor={sector ? SECTOR_COLOR[sector] : undefined}
        tagline={tagline || undefined}
        thesis={thesis || undefined}
        creatorHandle={xHandle || undefined}
        creatorName={creatorName || undefined}
        creatorAddress={account}
        assets={assets.map((a) => ({ address: a.address, symbol: a.symbol }))}
        bentoItems={bentoItems}
        deploy={{
          status: deploy.status,
          attempts: deploy.attempts,
          predicted: deploy.predicted,
          priceWei: deploy.priceWei,
          txHash: deploy.txHash,
          token: deploy.token,
          error: deploy.error,
          enabled: deploy.enabled,
          onSign: () => void deploy.broadcast(),
        }}
      />
    </>
  )
}

// Typeable weight cell — buffers keystrokes locally and commits on blur/Enter via
// setWeight (which clamps to MIN and rebalances the others to keep Σ = 100). Resyncs
// to the model value after each commit, including when the entry clamps to no change.
function WeightInput({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
  const [text, setText] = useState(String(value))
  const [resync, setResync] = useState(0)
  useEffect(() => setText(String(value)), [value, resync])
  const commit = () => {
    const n = parseInt(text, 10)
    if (Number.isFinite(n)) onCommit(n)
    setResync((r) => r + 1)
  }
  return (
    <div className="flex w-16 items-center justify-center border-x border-white/10 py-1">
      <input
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        inputMode="numeric"
        aria-label={`${label} weight percent`}
        className="w-7 bg-transparent text-right font-num text-sm font-semibold tabular-nums text-ink focus:outline-none"
      />
      <span className="font-num text-sm text-ink-dim">%</span>
    </div>
  )
}

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 font-mono text-xs">
      <span
        aria-hidden
        className="grid h-4 w-4 place-items-center rounded-full text-[9px]"
        style={{ background: ok ? 'rgba(52,214,196,0.15)' : 'rgba(255,255,255,0.06)', color: ok ? '#34d6c4' : '#565669' }}
      >
        {ok ? '✓' : '○'}
      </span>
      <span className="text-ink-dim">
        <span className="sr-only">{ok ? 'Done: ' : 'To do: '}</span>
        {children}
      </span>
    </li>
  )
}
