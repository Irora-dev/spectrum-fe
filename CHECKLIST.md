# Spectrum FE — Build Checklist

Living checklist, referenced by [CLAUDE.md](./CLAUDE.md). Update as work lands.

**Status:** ✅ done · 🔸 in progress · ⬜ todo
**Owner:** `INFRA` (Claude, `src/lib`) · `UI` (design system)
**Reuse:** ♻️ adapt from Prismbeat · ✨ net-new (not in Prismbeat)

---

## Foundation
- [x] ✅ Scaffold — Vite + React + TS + Tailwind v4 + wagmi + viem + TanStack Query · `INFRA`
- [x] ✅ wagmi config — Base + Eth transports, injected + WalletConnect · `INFRA`
- [x] ✅ Index data reader (Base) — NAV/basket/pricing, `useIndexes`/`useIndexData` · `INFRA` ♻️
- [x] ✅ Chain constants — Base + Eth addresses, fee/flag constants · `INFRA`
- [x] ✅ Dual-chain registry — `chains.ts` (per-chain `ChainCfg`) + `clientFor(chainId)` · `INFRA` ♻️
- [x] ✅ Generalize reader to dual-chain — `getIndexData(addr, chainId)`, `listIndexesForChain`, `listAllIndexes` (verified 4 Base + 5 ETH) · `INFRA` ♻️
- [x] ✅ **Reader perf** — Multicall3 batching is on (client-level `batch.multicall`); pool-price factor now computed **once per list batch** and injected (was once/card → N× `extsload`+`exchangeRate`+WETH-price), + short-TTL DexScreener spot-price cache (dedupes shared constituents + the WETH price). Verified live: homepage WETH/factor fetch **1×** (was ~4), total DexScreener calls collapsed for 14 cards. · `INFRA`

## Global
- [x] ✅ **Wallet connect that actually connects** — `WalletButton` connector-picker modal wired to wagmi `useConnect`; injected (MetaMask/Rabby/Brave) + Coinbase work now, WalletConnect lights up once a projectId is set. (Live handshake untested headlessly — verify in a real browser.) · `INFRA` + `UI`
- [x] ✅ **Base⇄Eth network toggle** — `NetworkToggle` in nav: `useActiveChain()` store (persisted) + wallet `switchChain` sync. · `INFRA` + `UI`
- [x] 🔒 **Transactions gate** — `src/lib/config/features.ts` `TRANSACTIONS_ENABLED` (**default OFF**, set `VITE_ENABLE_TRANSACTIONS=true` to enable). Hides every wallet/transactional surface on the public site until AIFMD/MiCAR green-light: **connect-wallet** (nav `WalletButton`), **buy/sell** (Token `TradePanel`), **portfolio** (nav link + `/portfolio` redirects home), **flush/fee-payout** (nav link + `/flush` redirects home). Infra stays in the tree. Kept visible: Explore, detail pages, Launch (no-wallet preview), FAQ/Learn/Docs, the Base⇄ETH view toggle. ⚠️ still ungated: the `/post-deploy-test` mock "Buy" (dev-harness route). · `INFRA`
- [x] 🔸 **Portfolio** (gated OFF by default — see Transactions gate) — `/portfolio`, connect-gated. `usePortfolio`/`getUserHoldings`: held indexes (balanceOf × NAV, batched per chain off the cached index list) + indexes you created (deployer filter), with total value + counts; held as rows, created as cards. Balance read verified vs chain (deployer holds 58.6 BASEAI); the populated view can't render headlessly (no wallet to connect). **Claimable holder-fees readout (ties to `/flush`) still todo.** · `INFRA` + `UI`

## Homepage
- [x] ✅ Total TVL across all index tokens (Σ aumUsd, both chains) — hero · `INFRA` + `UI`
- [x] ✅ "What is Spectrum / index tokens / what they unlock" explainer · `UI`
- [x] ✅ All indexes with filters — chain (real) + sector (interim map; real = #8) · `INFRA` + `UI`
- [x] ✅ Spotlight (largest index) + **creator attribution** — reader exposes the real deployer (`IndexData`/`IndexSummary.deployer`, via factory `tokens()`, both chains). `lib/spectrum/creator.ts` resolver drives the fallback chain **X handle → display name → deploy address** across all 4 display sites (verified live: BALI → `0x3821…F494`, BASEAI → linked `@colbysayshi`). · `INFRA` + `UI`

## Index Discovery
- [ ] ⬜ All indexes across both chains; filter to one chain · `INFRA` + `UI`
- [ ] ⬜ Filter by sector (defi / privacy / ai / …) — **needs a sector metadata source** ✨ · `INFRA` + `UI`
- [x] 🔸 Creator profile — `/creator/:address` page (`useCreatorProfile`: all indexes by a deployer + TVL / count / chains / best-24h, identity resolved X-handle → name → address). Reachable from the "by …" link on every card. Verified live: `@colbysayshi` (1 index) + an address-only creator (2 indexes, $9.6K). Global search-by-name + a homepage creator rail still todo. · `INFRA` + `UI`

## Launch
- [x] ✅ **Pool-detection engine** ✨ (`src/lib/pools/findBestPool`) — verified live: deepest-liquidity selection across v2/v3 with correct venue/fee/tick routes, dynamic-fee + Aerodrome rejection, shallow-liquidity warning. **V4 discovery needs `VITE_ALCHEMY_API_KEY`** (public RPC can't scan v4 Initialize logs). · `INFRA`
  - Per asset: discover Uniswap pools across **v2 / v3 / v4**
  - Pick **deepest liquidity** (fix the live-site bug where a non-deepest pool is chosen)
  - **Static fee only** — reject dynamic-fee pools
  - Capture **fee rate + tickSpacing**; output basket entry `(venue, ethPool PoolKey, v3Fee, v2Pair)`
  - Must be **Uniswap**; **reject/flag Aerodrome** (no hooks) with a clear warning
  - Warn on shallow liquidity; prefer a deeper matching pool; rigorous throw-on-invalid
  - All behind the scenes — UI just picks the asset
- [x] 🔸 **Add assets to basket** — paste any ERC-20 (validated live via `findBestPool`: venue + depth + shallow/Aerodrome warnings) **+ a "Popular on {chain}" rail seeded from real constituents of live indexes**. Search-by-name + sector filter + top-performers still todo. · `INFRA` + `UI`
- [x] ✅ **Weighting system + Bento UX** — stepper UI on the `weights.ts` model (Σ always = CAP, min 5%/asset, equal-split reset), live allocation strip + squarified `BasketBento` preview, gradient token identity (name/$symbol), deploy-readiness checklist gating the CTA. · `UI` + `INFRA`
- [x] 🚫 **Projected return profile — REMOVED (reg/compliance)** ✨ — the hypothetical-basket backtest ("if launched `range` ago at $1.00" → projected return % / end NAV / max drawdown) was pulled from the Launch builder. Showing projected/backtested performance for a **not-yet-deployed** product is a financial-promotion risk under the current classification-gated posture ([[project-regulatory-posture]]). Deleted `BacktestChart`, `useBasketBacktest`, `backtestNavHistory` + the Start/End NAV/drawdown readout; **Step 3 is now a plain "Review basket" confirm step** (gate intact). The index **detail page's REAL NAV history** (`useNavHistory` — actual deployed-index data, factual past performance) is a different thing and is unaffected. · `INFRA` + `UI`
- [x] ✅ **Builder UX + a11y pass** — a progress **Stepper** (5-stage overview, completion ✓, `aria-current`, keyboard jump-to-step via anchors); each step is an `<h2>`-labelled `<section>`; every input has an associated label (sr-only where placeholder-only); sector/horizon are labelled groups with `aria-pressed` toggles; suggestion chips carry `aria-label`; error is `role="alert"`, weights status is an `aria-live` region; decorative glyphs `aria-hidden`. Verified live across steps 1–4. · `UI`
- [x] 🔸 **Thesis editor** — structured creator metadata in the builder: sector chips (SECTOR_COLOR), tagline, thesis textarea (400-char), time-horizon chips, **+ creator identity (X handle / display name, blank → connected deploy address) with a live attribution hint**, all feeding the deploy reveal "created by". Typed-handle only (no OAuth — static build); **durable persistence still deferred to the real deploy (#9)** — leading choice: Supabase with writes gated by a deployer signature. · `UI` + `INFRA` (storage ✨)

## Deploy (via Launch)
- [x] ✅ **Salt mining** (CREATE2 → 0x88 hook addr) ✨ — `src/lib/spectrum/salt-mining.ts`: brute-forces a salt whose `predictTokenAddress` (the factory's own oracle — can't drift from deployed bytecode) lands on the hook bits the factory enforces, `uint160(token) & 0x3FFF == 0x88` (the low **14** bits, ~1/16384), batched through Multicall3. Verified live: all 4 Base seeds satisfy the mask + the no-pair basket tuple encodes against the live factory. (Public RPC ~3s/heavy-batch → slow; an Alchemy key or the noted local-init-code-hash path makes it snappy.) · `INFRA`
- [x] ✅ **Build launch tx** ✨ — `src/lib/spectrum/deploy.ts` (basket assembly: route+weight→bps, decimals; `startSqrtPriceX96` for $1.00 NAV computed from the **mined** address's sort vs dstable — verified == BASEAI's live Slot0) + `use-deploy.ts` `useDeployIndex` hook: assemble → mine → read `currentDeployPrice()` (Dutch auction; handles SlotNotOpen) → `simulateContract` (dry-run, no broadcast) → `writeContract` → parse `Launched` for the token. **Broadcast is gated behind a DEDICATED `DEPLOY_ENABLED` flag (separate from `TRANSACTIONS_ENABLED`, both default OFF) + a connected wallet on-chain, with a hard runtime guard in `broadcast()` so a stray call can't fire; the live signed deploy is intentionally NOT exercised** (irreversible, costs ≥0.1 ETH, pending legal). Enabling trading alone never arms a deploy. pook defaults to `address(0)`. · `INFRA`
- [x] ✅ **Deploy ceremony** (`DeployPortal`) — a valid "Continue to deploy" plays the `/post-deploy-test` portal animation with the creator's own basket: assets orbit → gather → drop through a glowing portal → "Index Deployed", then cross-fades to a "ready" reveal card (avatar/name/$symbol/sector/thesis + bento + Done/Replay/Start over). rAF-driven with a real-time backstop so it completes even when the tab/preview throttles timers; portals to body to escape the cards' backdrop-blur containing block. **Now wired to the real flow**: the CTA kicks off `useDeployIndex.prepare()`, and the reveal shows the actual mined 0x88 hook address + live auction price (with a "deploy is off" note, or a Sign & deploy button when the gate is on). A **full-width "Ready to launch $SYMBOL?" banner** at the bottom of the builder is the sole deploy CTA (Step 5 now shows only the readiness checklist) into the gated flow (verified live: opens the ceremony with the real basket). · `UI` + `INFRA`

## Index Page
- [x] ✅ Index detail page (`/token`) — **bento layout**: identity / price / NAV chart on the left, weight-proportional asset bento on the right, buy bar. **effective-supply + fees-accrued readouts now in the reader** (`IndexData.effectiveSupply` / `feeReserveUsd` / `pendingBurnUsd`, detail-only, $1-peg dstable, verified live both chains); UI display of these still pending. · `INFRA` ✅ + `UI`
- [x] 🔸 Chart — clean NAV line done; **per-asset series now exposed** from `useNavHistory` (`perAsset`: normalized series + window return, same fetches as the NAV curve — no extra calls). Rendering them as dotted lines + index⇄all toggle + hover breakdown is the remaining UI follow-up. · `INFRA` ✅ + `UI` ♻️
- [x] ✅ Thesis/description + creator handle + X link — via metadata (#8)
- [x] 🔸 Asset breakdown — bento shows weights + logos; per-asset 24h / cost / current value = follow-up
- [x] ✅ **Bento** (`BasketBento`, squarified treemap) reused on homepage + explore cards · ♻️
- [x] ✅ **Index metadata layer** (#8) — `metadata.ts` interim registry (description/tagline/sector/creator handle/image); swap `getIndexMeta` for IPFS/DB at launch

## Research / decisions (unblock the above)
- [x] ✅ Inspect Spectrum **factory contract** — read the real source (`~/spectrum-usdc/src/Spectrum.sol`) + the live FE reference (`~/spectrum-index/src/lib/spectrum`). `deployIndex(salt, name, symbol, basket, pook, startSqrtPriceX96, maxCost) payable`; Dutch auction via `currentDeployPrice()` (1 ETH start → 0.1 ETH floor over 10 blocks, ±12.5%/deploy, reverts `SlotNotOpen` between slots, 90% bridged to PRISM burn); CREATE2 hook gate `& 0x3FFF == 0x88`. **The `~/spectrum-usdc` fork is pre-audit + undeployed** and changes the `BasketEntry` ABI (`+pair`) — we build against the LIVE factory (no-pair tuple) until that ships.
- [ ] ⬜ Decide **pool-detection data source** — on-chain factory enumeration (rigorous, no external dep) vs Uniswap subgraph/API vs hybrid
- [ ] ⬜ Decide **index metadata storage** — thesis/sector/creator/X: IPFS vs DB (Supabase) vs on-chain/event (Prismbeat has none)
- [ ] ⬜ Decide **wallet connector set** + WalletConnect projectId
