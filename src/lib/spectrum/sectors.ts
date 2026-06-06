// Interim sector tags. NOTE: sectors are NOT stored on-chain (or in Prismbeat) —
// this hand-maintained map covers the known indexes until the metadata layer
// (task #8: IPFS/DB) lands. `sectorOf` falls back to 'Other'.

export type Sector = 'DeFi' | 'AI' | 'Infra' | 'Meme' | 'RWA' | 'Stables' | 'Other'

export const SECTORS: Exclude<Sector, 'Other'>[] = ['DeFi', 'AI', 'Infra', 'Meme', 'RWA', 'Stables']

const TAGS: Record<string, Sector> = {
  '0x8281833536a41337e2c9450a0277416049514088': 'AI', // BASEAI
  '0x2eea2b522cf630aa7883cf0ee7674803e6784088': 'AI', // BALI
  '0x036c7e64dd0b1a11660754f3e328402aae5ec088': 'AI', // WNNRS
  '0xab50550986c47facb24ab4aa4e08e0a6f952c088': 'Meme', // PLSBRO
  '0xa7aac9fd1d519d78bc7fbd7b2f5f20f2d74c0088': 'DeFi', // BDEFI
  '0xc7829debcde82338eb3eddc7df4152e100034088': 'Meme', // MEME.ETH
  '0xa75f524ae2a62f4511ceda8be464f9bf1bb58088': 'RWA', // RWAC
  '0xe8c30008d4e0a831640978910c43b9031f0d4088': 'DeFi', // V4INDEX
  '0x09f12a58196ab3f11a2cce6e5a3013b0d4700088': 'DeFi', // V4BLU
}

export function sectorOf(address: string): Sector {
  return TAGS[address.toLowerCase()] ?? 'Other'
}

// Accent per sector, drawn from the spectrum-background palette.
export const SECTOR_COLOR: Record<Sector, string> = {
  DeFi: '#35e0ff', // cyan
  AI: '#ff4db8', // magenta
  Infra: '#ff9248', // amber
  Meme: '#a48bff', // violet
  RWA: '#5cff8f', // green
  Stables: '#9fb2c9', // slate
  Other: '#6e6481', // muted
}
