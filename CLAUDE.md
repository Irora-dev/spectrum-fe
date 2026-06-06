# Spectrum FE — Claude Project Guide

Spectrum is an index-token launchpad on **Uniswap V4 + PRISM**. Each index is an ERC-20 that is its own V4 hook + LP; buying mints shares straight into the pool (no vault, no wrapper). Indexes live on **Base (8453)** and **Ethereum mainnet (1)**, priced in **DSTABLE**. This repo is the **new** Spectrum frontend.

## 📋 Build progress → [CHECKLIST.md](./CHECKLIST.md)
`CHECKLIST.md` is the source of truth for what's done / in progress / planned. **Read it at the start of feature work and update it as pieces land.**

## Stack
- Vite + React 19 + TypeScript, Tailwind v4
- wagmi + viem + TanStack Query
- Fully **client-side / static** (IPFS/ENS deploy target) — no server runtime
- Dual-chain: Base (8453) + Ethereum mainnet (1)

## Division of labor
- **UI / visual design** → owned by the user (a separate frontend AI design system). Don't build or restyle pages unless explicitly asked.
- **Data / contract / infra layer** → owned by Claude. Lives in `src/lib/**`, headless and design-agnostic, exposed via hooks the UI consumes.

## Layout
- `src/lib/chain/` — chain registry + addresses + RPC clients (`constants.ts`, `chains.ts`, `rpc.ts`)
- `src/lib/spectrum/` — index data reader (NAV/basket/pricing), ABIs, hooks, formatting
- `src/lib/pools/` — **(planned)** best-pool detection engine for the launch flow
- `src/wagmi.ts` — wagmi config (connectors + transports)

## Run
`pnpm dev` (preview on **:4321**, see `.claude/launch.json`) · `pnpm build` (tsc + vite) · `pnpm typecheck`

## Key facts / gotchas
- **NAV is not readable on-chain** — basket valuation needs the V4 PoolManager unlock callback, so static `eth_call` reverts. Reconstruct off-chain: read `basket()` + balances, price via DexScreener, `NAV = Σ(bal×price)/supply`, scale by the dstable/ETH pool factor (`extsload` PoolManager slot 6). ETH chain uses factor = 1 for now (`dstableEthPoolId` null).
- **Discovery**: scan factory `Launched(token,deployer,pook,…)` logs + a seed list (no enumeration view). Public RPC caps `getLogs` (~10k blocks) → window in ~9k chunks.
- **Pool routing for launch is computed client-side** and passed into the factory. Each basket entry is `(asset, venue, ethPool{currency0,currency1,fee,tickSpacing,hooks}, v3Fee, v2Pair, weight, decimals)`. The launch flow must pick the best Uniswap pool per asset: **deepest liquidity, static fee only (reject dynamic-fee), correct tickSpacing**. **Aerodrome can't be used (no hooks)** → warn. This engine is **net-new** (absent from Prismbeat).
- **DexScreener works client-side** (CORS ok); keyless per-chain (`/tokens/v1/base/…`, `/tokens/v1/ethereum/…`).
- Hook address must end in **0x88** (BEFORE_SWAP | BEFORE_SWAP_RETURNS_DELTA) → CREATE2 salt mined in-browser.

## Contracts
All addresses in `src/lib/chain/constants.ts`. Canonical reference (local-only): `irora-capital-systems/dashboard/docs/Prism & Spectrum/Tech/CONTRACTS.local.md`.

## Reuse from Prismbeat (`Irora-dev/Prismbeat`)
Read-only explorer (Next.js + ethers). **Reusable** (adapted to viem here): NAV/basket reader (`lib/spectrum/index-data.ts`), dual-chain address registry, Chart.js index+per-asset chart (`components/spectrum/index-chart.tsx`). **Not present — build fresh:** wallet infra, pool detection, salt mining, launch tx flow, thesis/sector/metadata storage.
