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
