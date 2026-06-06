/**
 * Bakes brand colors for every asset held by the known indexes.
 *
 *   pnpm bake:colors
 *
 * Enumerates each seed index's basket on-chain → resolves the DexScreener logo per
 * asset → extracts the dominant vibrant hue (12 hue bins weighted by saturation×value,
 * skipping near-black/grey, +12% saturation) → computes readable ink → writes
 * src/lib/spectrum/token-meta.generated.ts (keyed by lowercased address).
 *
 * Re-run any time the index set changes. Unmapped tokens fall back to a hashed hue
 * at runtime (token-meta.ts). The Alchemy key (if present in .env.local) is used only
 * for reliable reads and is NEVER written to the output.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { base, mainnet } from 'viem/chains'
import { Jimp } from 'jimp'
import { SEED_INDEXES, ETH_SEED_INDEXES } from '../src/lib/chain/constants.ts'

const HERE = dirname(fileURLToPath(import.meta.url))

function alchemyKey(): string | undefined {
  try {
    const env = readFileSync(resolve(HERE, '../.env.local'), 'utf8')
    return env.match(/^VITE_ALCHEMY_API_KEY=(.+)$/m)?.[1]?.trim() || undefined
  } catch {
    return undefined
  }
}
const KEY = alchemyKey()
const rpc = (alc: string, pub: string) => http(KEY ? alc.replace('{KEY}', KEY) : pub)
const clients: Record<number, ReturnType<typeof createPublicClient>> = {
  8453: createPublicClient({ chain: base, transport: rpc('https://base-mainnet.g.alchemy.com/v2/{KEY}', 'https://base-rpc.publicnode.com') }),
  1: createPublicClient({ chain: mainnet, transport: rpc('https://eth-mainnet.g.alchemy.com/v2/{KEY}', 'https://ethereum-rpc.publicnode.com') }),
}
const SLUG: Record<number, string> = { 1: 'ethereum', 8453: 'base' }

const INDEX_ABI = parseAbi([
  'function basketLength() view returns (uint256)',
  'function basket(uint256) view returns (address asset, uint8 venue, (address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) ethPool, uint24 v3Fee, address v2Pair, uint16 weight, uint8 decimals)',
])
const ERC20_ABI = parseAbi(['function symbol() view returns (string)'])

// ── color math ───────────────────────────────────────────────────────────────
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  ;(r /= 255), (g /= 255), (b /= 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, max === 0 ? 0 : d / max, max]
}
const hx = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
const rgbToHex = (r: number, g: number, b: number) => `#${hx(r)}${hx(g)}${hx(b)}`.toUpperCase()
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) ((r = c), (g = x))
  else if (h < 120) ((r = x), (g = c))
  else if (h < 180) ((g = c), (b = x))
  else if (h < 240) ((g = x), (b = c))
  else if (h < 300) ((r = x), (b = c))
  else ((r = c), (b = x))
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}
function readableInk(hex: string): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? '#34203B' : '#F4F0F4'
}

// Resolve a token's real logo URL via the DexScreener token API (highest-liquidity
// pair with an info.imageUrl), forcing png so jimp can decode it.
async function resolveLogoUrl(slug: string, addr: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/${slug}/${addr}`, { headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    const pairs = (await r.json()) as { info?: { imageUrl?: string }; liquidity?: { usd?: number } }[]
    let best: string | null = null
    let liq = -1
    for (const p of pairs) {
      const img = p?.info?.imageUrl
      const l = p?.liquidity?.usd ?? 0
      if (img && l > liq) ((liq = l), (best = img))
    }
    if (!best) return null
    return /format=/.test(best) ? best.replace(/format=[^&]+/, 'format=png') : best
  } catch {
    return null
  }
}

async function colorFromLogo(url: string): Promise<{ color: string; ink: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const img = await Jimp.read(Buffer.from(await res.arrayBuffer()))
    img.resize({ w: 64, h: 64 })
    const data = img.bitmap.data
    const BINS = 12
    const w = new Array(BINS).fill(0)
    const hSum = new Array(BINS).fill(0)
    const sSum = new Array(BINS).fill(0)
    const vSum = new Array(BINS).fill(0)
    let mr = 0, mg = 0, mb = 0, mc = 0
    for (let p = 0; p < data.length; p += 4) {
      if (data[p + 3] < 128) continue
      const r = data[p], g = data[p + 1], b = data[p + 2]
      const [h, s, v] = rgbToHsv(r, g, b)
      mr += r; mg += g; mb += b; mc++
      if (v < 0.12 || s < 0.12) continue
      const weight = s * v
      const bin = Math.min(BINS - 1, Math.floor((h / 360) * BINS))
      w[bin] += weight; hSum[bin] += h * weight; sSum[bin] += s * weight; vSum[bin] += v * weight
    }
    let bi = -1, bw = 0
    for (let i = 0; i < BINS; i++) if (w[i] > bw) ((bw = w[i]), (bi = i))
    if (bi >= 0 && bw > 0) {
      const hex = hsvToHex(hSum[bi] / w[bi], Math.min(1, (sSum[bi] / w[bi]) * 1.12), vSum[bi] / w[bi])
      return { color: hex, ink: readableInk(hex) }
    }
    if (mc > 0) {
      const hex = rgbToHex(mr / mc, mg / mc, mb / mc)
      return { color: hex, ink: readableInk(hex) }
    }
    return null
  } catch {
    return null
  }
}

// ── enumerate index baskets ──────────────────────────────────────────────────
interface Asset { address: string; symbol: string; chainId: number }
async function assetsFor(chainId: number, seeds: { address: Address }[]): Promise<Asset[]> {
  const client = clients[chainId]
  const out: Asset[] = []
  for (const ix of seeds) {
    try {
      const len = Number(await client.readContract({ address: ix.address, abi: INDEX_ABI, functionName: 'basketLength' }))
      for (let i = 0; i < len; i++) {
        const e = (await client.readContract({ address: ix.address, abi: INDEX_ABI, functionName: 'basket', args: [BigInt(i)] })) as readonly unknown[]
        const asset = (e[0] as Address).toLowerCase()
        let symbol = ''
        try {
          symbol = (await client.readContract({ address: asset as Address, abi: ERC20_ABI, functionName: 'symbol' })) as string
        } catch {}
        out.push({ address: asset, symbol, chainId })
      }
    } catch (err) {
      console.warn(`  ! ${ix.address}: ${String(err).slice(0, 80)}`)
    }
  }
  return out
}

async function main() {
  console.log(`Alchemy key: ${KEY ? 'yes' : 'no (public RPC)'}`)
  const assets = [...(await assetsFor(8453, SEED_INDEXES)), ...(await assetsFor(1, ETH_SEED_INDEXES))]
  const unique = new Map<string, Asset>()
  for (const a of assets) if (!unique.has(a.address)) unique.set(a.address, a)
  console.log(`Found ${unique.size} unique assets. Extracting colors…`)

  const baked: Record<string, { color: string; ink: string; symbol: string }> = {}
  for (const a of unique.values()) {
    const candidates = [
      await resolveLogoUrl(SLUG[a.chainId], a.address),
      `https://dd.dexscreener.com/ds-data/tokens/${SLUG[a.chainId]}/${a.address}.png?size=lg`,
    ].filter((u): u is string => !!u)
    let c: { color: string; ink: string } | null = null
    for (const url of candidates) {
      c = await colorFromLogo(url)
      if (c) break
    }
    if (c) {
      baked[a.address] = { ...c, symbol: a.symbol }
      console.log(`  ✓ ${(a.symbol || a.address).padEnd(14)} ${c.color}`)
    } else {
      console.log(`  · ${(a.symbol || a.address).padEnd(14)} (no logo → runtime fallback)`)
    }
  }

  const lines = Object.entries(baked)
    .map(([addr, v]) => `  '${addr}': { color: '${v.color}', ink: '${v.ink}' }, // ${v.symbol}`)
    .join('\n')
  const body = `// AUTO-GENERATED by scripts/bake-token-meta.ts — brand colors extracted from\n// token logos (dominant vibrant hue). Re-run: pnpm bake:colors. Do not edit by hand.\n\nexport const BAKED: Record<string, { color: string; ink: string }> = {\n${lines}\n}\n`
  const outDir = resolve(HERE, '../src/lib/spectrum')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'token-meta.generated.ts'), body)
  console.log(`\nWrote ${Object.keys(baked).length} colors → src/lib/spectrum/token-meta.generated.ts`)
}

main()
