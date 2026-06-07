// The canonical live Spectrum app (IPFS / ENS-hosted) where every deployed index
// has its own tradable page. This repo is the new discovery front-end; "Visit"
// links point users to that live deploy site for a given index.
const SPECTRUM_APP = 'https://spectrum.0xsolazy.eth.limo'

/** Live deploy-site URL for one index, keyed by its token address. */
export function deploySiteUrl(address: string): string {
  return `${SPECTRUM_APP}/token/?addr=${address}`
}
