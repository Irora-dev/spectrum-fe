import { Link } from 'react-router-dom'
import { LegalDoc, LegalSection } from '../components/LegalDoc'

// PLACEHOLDER copy reflecting Spectrum's actual model (onchain, self-custodial,
// creator-issued, NAV reconstructed from public data) — NOT legal advice. Finalize with counsel.
export function Risk() {
  return (
    <LegalDoc
      title="Risk Disclosure"
      intro="Interacting with onchain assets carries real risk. Please read this before you do. If anything here is unclear, don't proceed until it is."
    >
      <LegalSection title="You can lose money">
        <p>
          Onchain assets are volatile and can fall sharply and quickly. You can lose some or all of
          what you put in. Only commit what you can afford to lose entirely.
        </p>
      </LegalSection>

      <LegalSection title="No guarantees">
        <p>
          Nothing in an index, its chart, or any description is a promise of a return. Past performance
          does not predict future results, and a value shown now can change at any moment.
        </p>
      </LegalSection>

      <LegalSection title="Smart-contract and transaction risk">
        <p>
          Spectrum is software interacting with smart contracts that may contain bugs or be exploited.
          Onchain transactions are irreversible and settle on public blockchains, and a mistaken or
          malicious transaction generally cannot be undone.
        </p>
      </LegalSection>

      <LegalSection title="Creator / issuer risk">
        <p>
          Each index is created and issued by a third party, not by Spectrum. Their basket, weights, and
          conduct are their responsibility. Anyone can deploy an index, including ones that are
          low-quality, illiquid, or named misleadingly. Do your own diligence.
        </p>
      </LegalSection>

      <LegalSection title="Concentration and liquidity">
        <p>
          An index can be concentrated in a few holdings or a single theme, and its constituents may be
          thinly traded. A focused or illiquid basket can move far more than the broad market, in either
          direction, and may be costly to exit.
        </p>
      </LegalSection>

      <LegalSection title="Pricing and data">
        <p>
          A Spectrum index has no reliable market pool of its own; its value (NAV) is reconstructed
          off-chain from public market data, which can be delayed, incomplete, or wrong. Displayed
          values are estimates, not a guaranteed redemption price. (See the{' '}
          <Link to="/docs/valuation" className="text-cyan hover:underline">valuation method</Link>.)
        </p>
      </LegalSection>

      <LegalSection title="Regulatory risk">
        <p>
          The legal treatment of these tokens is evolving and varies by jurisdiction. Availability may
          be restricted, and how a product is classified may change in ways that affect it.
        </p>
      </LegalSection>
    </LegalDoc>
  )
}
