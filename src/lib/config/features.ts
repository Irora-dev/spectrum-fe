// ─────────────────────────────────────────────────────────────────────────────
// Feature gates — three independent switches so each wallet surface flips on its
// own risk timeline. Everything is OFF by default; the public site is information /
// analytics only until classification is settled (see the regulatory posture). The
// underlying infra (wagmi provider, hooks, readers, tx builders, components) always
// stays in the tree — these flags only control what renders / what can broadcast.
//
//   WALLET_ENABLED  — the connect-wallet button. Harmless on its own (read-only:
//                     lets a user connect to see their own holdings). Prerequisite
//                     for deploy and trading.
//   DEPLOY_ENABLED  — the launch flow's on-chain broadcast (deployIndex). Needs a
//                     wallet, NOT trading. The creator/issuer acts for themselves.
//   TRADING_ENABLED — buy/sell (Token TradePanel) + the Flush fee-claim. This is the
//                     highest-risk surface (CASP/MiFID exposure) — last to flip,
//                     gated on the classification opinion.
//
// DEPLOY and TRADING each require WALLET, but are independent of EACH OTHER — so
// turning trading on never arms deploy, and turning deploy on never arms trading.
// Expressible configs:
//   • info-only   — all off (no VITE_* set).
//   • deploy-only — VITE_ENABLE_WALLET=true + VITE_ENABLE_DEPLOY=true  (trading off):
//                   "we don't run buy/sell, but we help people deploy."
//   • full site   — VITE_ENABLE_WALLET=true + VITE_ENABLE_DEPLOY=true + VITE_ENABLE_TRADING=true.
// ─────────────────────────────────────────────────────────────────────────────

/** Connect-wallet (and any read-only wallet view, e.g. Portfolio). Base prerequisite. */
export const WALLET_ENABLED = import.meta.env.VITE_ENABLE_WALLET === 'true'

/**
 * Launching an index on-chain (the deployIndex broadcast in useDeployIndex). Requires a
 * wallet; independent of trading. Irreversible + costs ≥0.1 ETH (Dutch-auction slot), so
 * the broadcast also has a hard runtime guard on this flag in `broadcast()`. Salt mining,
 * auction-price reads, and the dry-run simulation are read-only and run regardless.
 */
export const DEPLOY_ENABLED = WALLET_ENABLED && import.meta.env.VITE_ENABLE_DEPLOY === 'true'

/** Buy/sell (TradePanel) + the Flush fee-claim — the CASP/MiFID-risk surface. Requires a wallet. */
export const TRADING_ENABLED = WALLET_ENABLED && import.meta.env.VITE_ENABLE_TRADING === 'true'
