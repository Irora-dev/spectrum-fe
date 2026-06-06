import { parseAbi, parseAbiItem } from 'viem'

// Spectrum index token (ERC-20 that is also its own V4 hook + LP).
// NOTE: there is intentionally NO NAV view here — exchangeRate()/
// totalReserveDstable() revert on a static eth_call because basket valuation
// routes through the V4 PoolManager unlock callback. NAV is reconstructed off-chain.
export const indexAbi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function basketLength() view returns (uint256)',
  'function basket(uint256) view returns (address asset, uint8 venue, (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) ethPool, uint24 v3Fee, address v2Pair, uint16 weight, uint8 decimals)',
  // Static-safe readouts (verified live on Base + Ethereum). effectiveSupply can
  // exceed totalSupply once yield vests; the two DSTABLE reserves are 6-decimal
  // ($1-peg) USD: feeReserveDstable = fees claimable by holders, pendingPrismBurn
  // = swap-fee cut queued for the bridge→PRISM buy-and-burn.
  // NB: totalReserveDstable()/exchangeRate() are intentionally absent — they revert
  // on a static eth_call (basket valuation routes through the V4 PoolManager unlock).
  'function effectiveSupply() view returns (uint256)',
  'function feeReserveDstable() view returns (uint256)',
  'function pendingPrismBurnDstable() view returns (uint256)',
])

export const erc20BalanceAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
])

// V4 PoolManager transient/persistent storage reader.
export const poolManagerAbi = parseAbi([
  'function extsload(bytes32 slot) view returns (bytes32)',
])

// dstable exposes its own peg via exchangeRate() (1e18-scaled, ≈ $1).
export const dstableAbi = parseAbi([
  'function exchangeRate() view returns (uint256)',
])

// The factory has no enumeration view; every index is discovered via this event.
export const launchedEvent = parseAbiItem(
  'event Launched(address indexed token, address indexed deployer, address indexed pook, bytes32 pookCodeHash, string name, string symbol, uint160 startSqrtPriceX96, uint256 ethPaid)',
)

// Factory registry: maps a deployed index → its creator (deployer) + optional yield
// manager (pook). One cheap static read gives real creator attribution for any
// index, including seeds outside the discovery log window. Verified on both factories.
export const factoryAbi = parseAbi([
  'function tokens(address) view returns (address deployer, address pook)',
])

// One BasketEntry tuple as the LIVE factory expects it (verified on-chain at
// 0xab9a…88cf). NB: the undeployed USDC fork (~/spectrum-usdc) adds a trailing
// `uint8 pair` field — do NOT add it here until that factory is live, or the
// deployIndex/predictTokenAddress calldata will mis-encode against the live one.
const BASKET_ENTRY =
  '(address asset, uint8 venue, (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) ethPool, uint24 v3Fee, address v2Pair, uint16 weight, uint8 decimals)'

// Factory deploy + auction surface. `predictTokenAddress` is the salt-mining oracle
// (mine until the predicted address satisfies the 0x88 hook bits). `currentDeployPrice`
// reverts SlotNotOpen() until the current Dutch-auction slot opens.
export const factoryDeployAbi = parseAbi([
  `function deployIndex(bytes32 salt, string name, string symbol, ${BASKET_ENTRY}[] basket, address pook, uint160 startSqrtPriceX96, uint256 maxCost) payable returns (address token)`,
  `function predictTokenAddress(bytes32 salt, ${BASKET_ENTRY}[] basket, address deployer, address pook) view returns (address)`,
  'function currentDeployPrice() view returns (uint256)',
  'function deployEnabled() view returns (bool)',
  'function slotStartPrice() view returns (uint256)',
])
