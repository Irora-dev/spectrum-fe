// Placeholder index data for the HUD showcase. Mirrors the PRISM + SPECTRUM
// "Base AI Index" example. Swap for factory/Swap-event reads once contracts land.

export type GlyphKey =
  | 'chevrons'
  | 'bank'
  | 'bot'
  | 'pin'
  | 'spark'
  | 'hex'
  | 'node'
  | 'ring'

export type Accent = 'violet' | 'alert' | 'teal' | 'ink'

export type AllocationEntry = {
  label: string
  value: number
  color: string
  accent: Accent
  glyph: GlyphKey
}

export type LongTailEntry = {
  label: string
  value: number
  glyph: GlyphKey
}

export const baseai = {
  ticker: '$BASEAI',
  name: 'Base AI Index',
  tagline: 'A narrative basket, not a single-token bet.',
  about:
    'Base AI is a cluster of agents, infra, automation, social AI, inference, and speculative long-tail names.',
  address: '0x8281833536a41337E2c9450A0277416049514088',
  indexNo: '09',
  allocation: [
    { label: 'VVV', value: 40, color: 'var(--color-violet-bright)', accent: 'violet', glyph: 'chevrons' },
    { label: 'BNKR', value: 20, color: 'var(--color-violet)', accent: 'violet', glyph: 'bank' },
    { label: 'NOCK', value: 10, color: '#5a5a6e', accent: 'ink', glyph: 'bot' },
    { label: 'VIRTUAL', value: 10, color: 'var(--color-teal)', accent: 'teal', glyph: 'pin' },
    { label: 'REI', value: 10, color: 'var(--color-alert)', accent: 'alert', glyph: 'spark' },
    { label: 'Long tail', value: 10, color: '#33333f', accent: 'ink', glyph: 'hex' },
  ] satisfies AllocationEntry[],
  longTail: [
    { label: 'POD', value: 2.5, glyph: 'ring' },
    { label: 'Reppo', value: 1.5, glyph: 'node' },
    { label: 'Surplus', value: 1.5, glyph: 'hex' },
    { label: 'gitlawb', value: 1.0, glyph: 'ring' },
    { label: 'ZyFAI', value: 1.0, glyph: 'node' },
    { label: 'AEON', value: 1.0, glyph: 'spark' },
    { label: 'Blocktronics', value: 1.5, glyph: 'hex' },
  ] satisfies LongTailEntry[],
  stats: {
    nav: '1.2840',
    navUnit: 'DSTABLE',
    supply: '812,400',
    fees24h: '+0.93%',
    holderYield: '+4.21%',
  },
  signals: [
    { label: 'Volatility', spark: [3, 5, 4, 7, 6, 9, 7, 8, 6, 8] },
    { label: 'Correlation', spark: [6, 6, 5, 6, 7, 6, 7, 7, 6, 7] },
    { label: 'Beta / ETH', spark: [4, 5, 6, 5, 7, 6, 8, 7, 8, 7] },
  ],
}

export const longTailTotal = baseai.longTail.reduce((s, e) => s + e.value, 0)
