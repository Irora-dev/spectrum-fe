import type { Sector } from './sectors'

// ─────────────────────────────────────────────────────────────────────────────
// Index metadata (task #8). Creator-set fields that DON'T live on-chain:
// description, tagline, creator handle/avatar, custom image, links.
//
// Until the launch flow (#9) writes these to a real store (IPFS / DB), this is a
// hand-maintained registry of known indexes. `getIndexMeta` returns {} for unknown
// indexes; the UI falls back to sensible defaults (name, contract address, generated
// avatar). Swap the body of `getIndexMeta` for a fetch when the store exists —
// callers won't change.
// ─────────────────────────────────────────────────────────────────────────────

export interface IndexMeta {
  /** One- or two-line description shown on the index page. */
  description?: string
  /** Short tag e.g. "The AI economy". */
  tagline?: string
  sector?: Sector
  /** Deployer address (defaults to the index contract until the reader captures it). */
  creatorAddress?: string
  /** Creator nickname / X handle, e.g. "@colbysayshi". */
  creatorHandle?: string
  /** Creator avatar image URL. */
  creatorAvatarUrl?: string
  /** Creator-set index image URL (overrides the generated default avatar). */
  imageUrl?: string
  /** Link to the creator's X profile. */
  xUrl?: string
}

const REGISTRY: Record<string, IndexMeta> = {
  // Base
  '0x8281833536a41337e2c9450a0277416049514088': {
    description:
      'TheBaseAIIndex bundles the highest-conviction AI projects building on Base into a single token. Holdings are hand-picked and conviction-weighted toward the names defining onchain AI, so you get broad exposure to the theme without having to pick individual winners.',
    tagline: 'The AI economy',
    sector: 'AI',
    creatorHandle: '@colbysayshi',
    xUrl: 'https://x.com/colbysayshi',
  },
  '0x2eea2b522cf630aa7883cf0ee7674803e6784088': {
    description:
      'The blue-chip names leading AI on Base, held in one position. A concentrated set of the most established onchain AI tokens, weighted toward liquidity and staying power rather than the long tail.',
    tagline: 'AI blue-chips',
    sector: 'AI',
  },
  '0xab50550986c47facb24ab4aa4e08e0a6f952c088': {
    description:
      'The Bankr meme meta, captured in a single token. A rotating basket of the memes driving the current Base cycle, so you can ride the meta without chasing every new launch.',
    tagline: 'Meme meta',
    sector: 'Meme',
  },
  '0x036c7e64dd0b1a11660754f3e328402aae5ec088': {
    description:
      'Base AI projects riding their cycle uptrend. Momentum-leaning exposure to the AI names outperforming this cycle, tilted toward what is actually working rather than the whole field.',
    tagline: 'AI cycle winners',
    sector: 'AI',
  },
  // Ethereum
  '0xa7aac9fd1d519d78bc7fbd7b2f5f20f2d74c0088': {
    description:
      'Blue-chip DeFi with real revenue and deep moats. The protocols that have proven durable across cycles — fee-generating, battle-tested, and core to onchain finance.',
    tagline: 'DeFi blue-chips',
    sector: 'DeFi',
  },
  '0xc7829debcde82338eb3eddc7df4152e100034088': {
    description:
      'The mainnet meme collective, bundled into one token. Broad exposure to Ethereum’s most liquid memes, so you hold the category instead of betting on any single coin.',
    tagline: 'Meme collective',
    sector: 'Meme',
  },
  '0xa75f524ae2a62f4511ceda8be464f9bf1bb58088': {
    description:
      'Core real-world-asset tokens, onchain. Exposure to the tokenized treasuries, credit, and assets bringing offchain yield onchain — the backbone of the RWA narrative.',
    tagline: 'RWA core',
    sector: 'RWA',
  },
}

export function getIndexMeta(address: string): IndexMeta {
  return REGISTRY[address.toLowerCase()] ?? {}
}
