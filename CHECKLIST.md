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

## Global
- [x] ✅ **Wallet connect that actually connects** — `WalletButton` connector-picker modal wired to wagmi `useConnect`; injected (MetaMask/Rabby/Brave) + Coinbase work now, WalletConnect lights up once a projectId is set. (Live handshake untested headlessly — verify in a real browser.) · `INFRA` + `UI`
- [x] ✅ **Base⇄Eth network toggle** — `NetworkToggle` in nav: `useActiveChain()` store (persisted) + wallet `switchChain` sync. · `INFRA` + `UI`

## Homepage
- [x] ✅ Total TVL across all index tokens (Σ aumUsd, both chains) — hero · `INFRA` + `UI`
- [x] ✅ "What is Spectrum / index tokens / what they unlock" explainer · `UI`
- [x] ✅ All indexes with filters — chain (real) + sector (interim map; real = #8) · `INFRA` + `UI`
- [x] 🔸 Spotlight (largest index) done; **creator** attribution shows contract — real creator (deployer) needs reader add + metadata (#8) · `INFRA` + `UI`

## Index Discovery
- [ ] ⬜ All indexes across both chains; filter to one chain · `INFRA` + `UI`
- [ ] ⬜ Filter by sector (defi / privacy / ai / …) — **needs a sector metadata source** ✨ · `INFRA` + `UI`
- [ ] ⬜ Search by creator name + creator spotlight / best performer · `INFRA` (metadata + rank) + `UI`

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
- [x] ✅ **Projected return profile** ✨ — real-data backtest of a hypothetical basket ("if launched `range` ago at $1.00"): `backtestNavHistory` + `useBasketBacktest` (reuse the per-asset price cache; exposes normalized per-asset series), 7D/30D/MAX. **Index/Assets toggle**: Index = rainbow NAV area w/ $1.00 baseline + projected return % + max drawdown; Assets = overlaid normalized constituent lines with an **interactive legend** (click to show/hide, rescales). **Underlying assets** small-multiples grid of per-asset SVG sparklines underneath (collapsible). · `INFRA` + `UI`
- [x] 🔸 **Thesis editor** — structured creator metadata in the builder: sector chips (SECTOR_COLOR), tagline, thesis textarea (400-char), time-horizon chips. Feeds the deploy reveal. Persisting to IPFS/DB still pending the real deploy (#9). · `UI` + `INFRA` (storage ✨)

## Deploy (via Launch)
- [ ] ⬜ Fold **salt mining** (CREATE2 → 0x88 hook addr) into the single deploy action ✨ · `INFRA`
- [ ] ⬜ Build + sign launch tx(s), pay ETH, commit auction slot · `INFRA` ✨
- [x] ✅ **Deploy ceremony** (`DeployPortal`) — a valid "Continue to deploy" plays the `/post-deploy-test` portal animation with the creator's own basket: assets orbit → gather → drop through a glowing portal → "Index Deployed", then cross-fades to a "ready" reveal card (avatar/name/$symbol/sector/thesis + bento + Done/Replay/Start over). rAF-driven with a real-time backstop so it completes even when the tab/preview throttles timers; portals to body to escape the cards' backdrop-blur containing block. **On-chain deploy (salt mining + tx) still stubbed.** · `UI`

## Index Page
- [x] ✅ Index detail page (`/token`) — **bento layout**: identity / price / NAV chart on the left, weight-proportional asset bento on the right, buy bar. (effective-supply + fees-accrued readouts TBD)
- [x] 🔸 Chart — clean NAV line done; per-asset dotted lines + index⇄all toggle + hover breakdown still a follow-up · ♻️
- [x] ✅ Thesis/description + creator handle + X link — via metadata (#8)
- [x] 🔸 Asset breakdown — bento shows weights + logos; per-asset 24h / cost / current value = follow-up
- [x] ✅ **Bento** (`BasketBento`, squarified treemap) reused on homepage + explore cards · ♻️
- [x] ✅ **Index metadata layer** (#8) — `metadata.ts` interim registry (description/tagline/sector/creator handle/image); swap `getIndexMeta` for IPFS/DB at launch

## Research / decisions (unblock the above)
- [ ] ⬜ Inspect Spectrum **factory contract** — `launch`/`commit` signature, on-chain pool validation (check `~/spectrum-index`?)
- [ ] ⬜ Decide **pool-detection data source** — on-chain factory enumeration (rigorous, no external dep) vs Uniswap subgraph/API vs hybrid
- [ ] ⬜ Decide **index metadata storage** — thesis/sector/creator/X: IPFS vs DB (Supabase) vs on-chain/event (Prismbeat has none)
- [ ] ⬜ Decide **wallet connector set** + WalletConnect projectId
