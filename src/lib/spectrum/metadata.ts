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
  /** Creator X handle, e.g. "@colbysayshi". Takes priority in `resolveCreator`. */
  creatorHandle?: string
  /** Free-text display name, used when there's no handle (falls back to the deployer). */
  creatorName?: string
  /** Creator avatar image URL. */
  creatorAvatarUrl?: string
  /** Creator-set index image URL (overrides the generated default avatar). */
  imageUrl?: string
  /** Link to the creator's X profile. */
  xUrl?: string
}

// Neutralized for the public build: only neutral taxonomy (`sector`, used for filter
// chips) and FACTUAL creator attribution are kept. The previous per-index descriptions
// + taglines were platform-authored and read as promotional investment theses
// ("highest-conviction", "outperforming", "blue-chips") — a financial-promotion /
// classification risk while activity is paused. With description/tagline absent, the UI
// falls back to a neutral factual line ("A N-asset onchain index") and
// "About". Creators set their OWN description/tagline via the launch flow, under their own
// responsibility (the deploy acknowledgment), once a real store backs this (#8/#9).
const REGISTRY: Record<string, IndexMeta> = {
  // Base
  '0x8281833536a41337e2c9450a0277416049514088': { sector: 'AI', creatorHandle: '@colbysayshi', xUrl: 'https://x.com/colbysayshi' },
  '0x2eea2b522cf630aa7883cf0ee7674803e6784088': { sector: 'AI' },
  '0xab50550986c47facb24ab4aa4e08e0a6f952c088': { sector: 'Meme' },
  '0x036c7e64dd0b1a11660754f3e328402aae5ec088': { sector: 'AI' },
  // Ethereum
  '0xa7aac9fd1d519d78bc7fbd7b2f5f20f2d74c0088': { sector: 'DeFi' },
  '0xc7829debcde82338eb3eddc7df4152e100034088': { sector: 'Meme' },
  '0xa75f524ae2a62f4511ceda8be464f9bf1bb58088': { sector: 'RWA' },
}

export function getIndexMeta(address: string): IndexMeta {
  return REGISTRY[address.toLowerCase()] ?? {}
}
