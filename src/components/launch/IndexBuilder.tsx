import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getAddress, isAddress, type Address } from 'viem'
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
import type { NavInput } from '../../lib/spectrum/history'
import { useAllIndexes } from '../../lib/spectrum/hooks'
import { AssetLogo } from '../AssetLogo'
import { BasketBento, type BentoItem } from '../BasketBento'
import { BacktestChart } from './BacktestChart'
import { DeployPortal } from './DeployPortal'
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
      className="rounded-2xl card-surface p-5 backdrop-blur-md sm:p-6"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'none' : 'translateY(18px)',
        transition: 'opacity 0.5s ease, transform 0.55s cubic-bezier(0.34,1.2,0.64,1)',
      }}
    >
      <div className="flex items-center gap-3">
        <span
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
          <div className="font-display text-lg font-bold uppercase tracking-tight text-ink">{title}</div>
          {subtitle && <div className="mt-0.5 font-mono text-[13px] leading-snug text-ink-dim">{subtitle}</div>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function IndexBuilder() {
  const chainId = useActiveChainId()
  const cfg = useMemo(() => chainCfg(chainId), [chainId])

  const [assets, setAssets] = useState<BuilderAsset[]>([])
  const [weights, setWeights] = useState<number[]>([])
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sector, setSector] = useState<Sector | ''>('')
  const [tagline, setTagline] = useState('')
  const [thesis, setThesis] = useState('')
  const [horizon, setHorizon] = useState<string>('')
  const [deploying, setDeploying] = useState(false)
  const [basketConfirmed, setBasketConfirmed] = useState(false)
  const [maxStep, setMaxStep] = useState(1)

  useEffect(() => {
    setAssets([])
    setWeights([])
    setError(null)
    setInput('')
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
        setInput('')
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

  const suggestionsToShow = useMemo(
    () => suggestions.filter((s) => !inBasket(s.address)).slice(0, 14),
    [suggestions, inBasket],
  )

  // Derived views
  const total = sum(weights)
  const bentoItems: BentoItem[] = assets.map((a, i) => ({ symbol: a.symbol, address: a.address, weightPct: weights[i] ?? 0, chainId }))
  const navInputs: NavInput[] = assets.map((a, i) => ({ address: a.address, weight: weights[i] ?? 0 }))
  const symbolsMap = useMemo(() => Object.fromEntries(assets.map((a) => [a.address.toLowerCase(), a.symbol])), [assets])

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

  // Progressive reveal: the highest stage the basket has earned (monotonic, so editing
  // an earlier step never collapses a later one).
  const level =
    basketConfirmed && nameValid && symbolValid ? 5 : basketConfirmed ? 4 : enoughAssets ? 3 : assets.length >= 1 ? 2 : 1
  useEffect(() => {
    setMaxStep((m) => Math.max(m, level))
  }, [level])

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* ── 1 · Add assets ─────────────────────────────────────────── */}
        <Step
          index={1}
          title="Add assets"
          subtitle={`Pick the tokens for your index on ${cfg.name}.`}
          show
          complete={enoughAssets}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void add(input)
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste a token address (0x…)"
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/30 px-3 py-2.5 font-mono text-sm text-ink placeholder:text-ink-dim focus:border-cyan/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={adding || input.trim().length === 0}
              className="shrink-0 rounded-lg bg-white/10 px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-ink transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adding ? 'Checking…' : 'Add'}
            </button>
          </form>

          {error && <p className="mt-2.5 font-mono text-[13px] leading-relaxed text-alert">{error}</p>}
          <p className="mt-2.5 font-mono text-[13px] leading-relaxed text-ink-dim">
            We find the deepest Uniswap v2/v3/v4 pool automatically. Aerodrome-only tokens can't be used (no hook support).
          </p>

          {suggestionsToShow.length > 0 && (
            <div className="mt-5 border-t border-white/8 pt-5">
              <div className="font-mono text-xs uppercase tracking-wide text-ink-dim">Popular on {cfg.name}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestionsToShow.map((s) => {
                  const color = tokenVisual(s.symbol, s.address).color
                  return (
                    <button
                      key={s.address}
                      type="button"
                      disabled={adding}
                      onClick={() => void add(s.address, s.symbol)}
                      className="group relative flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3 backdrop-blur transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        style={{ boxShadow: `0 0 0 1px ${color}66, 0 10px 26px -10px ${color}` }}
                      />
                      <AssetLogo address={s.address} symbol={s.symbol} chainId={chainId} size={22} />
                      <span className="font-display text-sm font-bold uppercase tracking-wide text-ink">{s.symbol}</span>
                      <span className="font-num text-sm leading-none" style={{ color }}>
                        +
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
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
                className="rounded-md border border-white/12 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-dim transition-colors hover:border-white/30 hover:text-ink"
              >
                Equal weight
              </button>
            )}
          </div>

          <ul className="space-y-2.5">
            {assets.map((a, i) => {
              const color = tokenVisual(a.symbol, a.address).color
              const w = weights[i] ?? 0
              return (
                <li
                  key={a.address}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/10 p-3"
                  style={{ background: `linear-gradient(90deg, ${color}1f, ${color}0a 32%, rgba(255,255,255,0.02) 72%)` }}
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} />
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
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-ink-dim">
                      {a.depthUsd != null ? `~${formatUsdCompact(a.depthUsd)} liquidity` : shortAddr(a.address)}
                      {a.warnings.length > 0 && <span className="text-amber"> · shallow pool</span>}
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
                </li>
              )
            })}
          </ul>

          <div className="mt-3.5 flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
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
            <span className={total === CAP ? 'text-teal' : 'text-alert'}>{total === CAP ? '✓ Balanced · 100%' : `Σ ${total}%`}</span>
          </div>
        </Step>

        {/* ── 3 · Projected returns ──────────────────────────────────── */}
        <Step
          index={3}
          title="Projected returns"
          subtitle="How this basket would have tracked. Tweak assets and weights above to reshape it."
          show={maxStep >= 3}
          complete={basketConfirmed}
        >
          <div className="space-y-6">
            <BacktestChart bare chainId={chainId} assets={navInputs} symbol={symbol} symbols={symbolsMap} />

            <div className="border-t border-white/10 pt-5">
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
                    <p className="mt-2 text-center font-mono text-[11px] text-ink-dim">Add at least 2 assets, balanced to 100%.</p>
                  )}
                </>
              )}
            </div>
          </div>
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
            <div className="font-mono text-[11px] uppercase tracking-wide text-ink-dim">
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
                  <span className="font-display text-xl font-bold text-black/75">◆</span>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 42))}
                  placeholder="Index name (e.g. Base AI Index)"
                  className="w-full rounded-lg border border-white/12 bg-black/30 px-3 py-2.5 font-display text-base text-ink placeholder:text-ink-dim focus:border-cyan/60 focus:outline-none"
                />
                <div className="flex items-center rounded-lg border border-white/12 bg-black/30 px-3 focus-within:border-cyan/60">
                  <span className="font-num text-base text-ink-dim">$</span>
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
                    placeholder="SYMBOL"
                    className="w-full bg-transparent py-2.5 font-display text-base font-bold uppercase tracking-wide text-ink placeholder:text-ink-dim focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="font-mono text-[11px] uppercase tracking-wide text-ink-dim">Sector</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {SECTORS.map((s) => {
                const on = sector === s
                const c = SECTOR_COLOR[s]
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSector(on ? '' : s)}
                    className="rounded-full border px-3 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors"
                    style={on ? { borderColor: c, background: `${c}24`, color: '#e8e8f0' } : { borderColor: 'rgba(255,255,255,0.12)', color: '#8b8b9e' }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-5">
            <label className="font-mono text-[11px] uppercase tracking-wide text-ink-dim">Tagline</label>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, 48))}
              placeholder="e.g. The AI economy"
              className="mt-1.5 w-full rounded-lg border border-white/12 bg-black/30 px-3 py-2 font-display text-sm text-ink placeholder:text-ink-dim focus:border-cyan/60 focus:outline-none"
            />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[11px] uppercase tracking-wide text-ink-dim">Thesis</label>
              <span className="font-mono text-[11px] text-ink-dim">{thesis.length}/400</span>
            </div>
            <textarea
              value={thesis}
              onChange={(e) => setThesis(e.target.value.slice(0, 400))}
              rows={4}
              placeholder="Why this basket, why these weights, and over what horizon."
              className="mt-1.5 w-full resize-none rounded-lg border border-white/12 bg-black/30 px-3 py-2 font-mono text-[13px] leading-relaxed text-ink placeholder:text-ink-dim focus:border-cyan/60 focus:outline-none"
            />
          </div>

          <div className="mt-5">
            <div className="font-mono text-[11px] uppercase tracking-wide text-ink-dim">Time horizon</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {HORIZONS.map((h) => {
                const on = horizon === h
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHorizon(on ? '' : h)}
                    className={`rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors ${
                      on ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-white/12 text-ink-dim hover:border-white/30 hover:text-ink'
                    }`}
                  >
                    {h}
                  </button>
                )
              })}
            </div>
          </div>
        </Step>

        {/* ── 5 · Deploy ─────────────────────────────────────────────── */}
        <Step index={5} title="Deploy" subtitle="Mint your index token onchain." show={maxStep >= 5} complete={canDeploy}>
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-white/20" style={{ background: avatarGrad }}>
              <span className="font-display text-base font-bold text-black/75">◆</span>
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-base font-bold uppercase tracking-tight text-ink">{name || 'Your index'}</div>
              <div className="font-mono text-[11px] uppercase tracking-wide text-ink-dim">
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

          <button
            type="button"
            disabled={!canDeploy}
            onClick={() => setDeploying(true)}
            className="mt-4 w-full rounded-xl py-3.5 font-display text-base font-bold uppercase tracking-[0.15em] text-black transition-transform hover:enabled:scale-[1.01] disabled:cursor-not-allowed"
            style={canDeploy ? { background: 'linear-gradient(90deg,#ff9248,#ff4db8,#35e0ff)' } : { background: 'rgba(255,255,255,0.08)', color: '#565669' }}
          >
            Continue to deploy
          </button>
          {!canDeploy && (
            <p className="mt-2 text-center font-mono text-[11px] text-ink-dim">Complete the checklist above to deploy.</p>
          )}
        </Step>
      </div>

      <DeployPortal
        open={deploying}
        onClose={() => setDeploying(false)}
        onStartOver={() => {
          setDeploying(false)
          setAssets([])
          setWeights([])
          setName('')
          setSymbol('')
          setSector('')
          setTagline('')
          setThesis('')
          setHorizon('')
          setBasketConfirmed(false)
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
        assets={assets.map((a) => ({ address: a.address, symbol: a.symbol }))}
        bentoItems={bentoItems}
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
        className="grid h-4 w-4 place-items-center rounded-full text-[9px]"
        style={{ background: ok ? 'rgba(52,214,196,0.15)' : 'rgba(255,255,255,0.06)', color: ok ? '#34d6c4' : '#565669' }}
      >
        {ok ? '✓' : '○'}
      </span>
      <span className="text-ink-dim">{children}</span>
    </li>
  )
}
