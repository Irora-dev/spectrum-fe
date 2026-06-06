import { tokenVisual } from './token-meta'
import { SECTOR_COLOR, sectorOf } from './sectors'

// One signature color per index, reused on its card (accent glow) and detail page
// (accent lid) so the two read as the same object. Defaults to the dominant
// holding's brand color, then the sector color.
export function indexSignatureColor(
  indexAddress: string,
  dominant?: { symbol?: string; address?: string },
): string {
  if (dominant?.address) return tokenVisual(dominant.symbol, dominant.address).color
  return SECTOR_COLOR[sectorOf(indexAddress)]
}
