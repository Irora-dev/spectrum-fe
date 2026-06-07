import { Link } from 'react-router-dom'
import { LegalDoc, LegalSection } from '../components/LegalDoc'

// PLACEHOLDER copy reflecting Spectrum's actual model (self-custodial, onchain,
// creator-issued indexes, no accounts) — NOT legal advice. Finalize with counsel.
export function Terms() {
  return (
    <LegalDoc
      title="Terms of Use"
      intro="These terms cover your use of the Spectrum interface. Spectrum is software for interacting with permissionless smart contracts. Please read these alongside the Risk Disclosure."
    >
      <LegalSection title="What Spectrum is">
        <p>
          Spectrum is a software interface to a set of permissionless smart contracts on Base and
          Ethereum for creating and trading onchain index tokens. It is non-custodial: Spectrum does
          not hold your assets, execute transactions on your behalf, or manage any index. You interact
          directly with the contracts from your own wallet.
        </p>
      </LegalSection>

      <LegalSection title="Indexes are issued by their creators">
        <p>
          Each index is deployed by a third-party creator, who is its issuer and is solely responsible
          for it, including its composition, naming, and any description they provide. Spectrum is not
          the issuer of, and does not endorse, any index. Listing or display of an index is not a
          recommendation.
        </p>
      </LegalSection>

      <LegalSection title="Not advice or an offer">
        <p>
          Nothing on Spectrum is financial, investment, legal, or tax advice, a solicitation, or a
          recommendation to buy, sell, or hold anything. You are responsible for your own decisions.
        </p>
      </LegalSection>

      <LegalSection title="Wallets and self-custody">
        <p>
          You connect and use your own self-custodial wallet. You are responsible for securing your
          keys and for all activity from your wallet. Onchain transactions are irreversible and settle
          on public blockchains outside Spectrum&rsquo;s control.
        </p>
      </LegalSection>

      <LegalSection title="Fees">
        <p>
          A protocol-level 1% fee applies to mints and redemptions, split 60% to holders, 30% to the
          index&rsquo;s creator, and 10% to the PRISM buy-and-burn. Network (gas) costs apply
          separately. Spectrum does not charge a separate management or subscription fee.
        </p>
      </LegalSection>

      <LegalSection title="Eligibility and your responsibility">
        <p>
          You must be permitted to use a service like this under the laws that apply to you, and you
          must not use it where doing so is restricted. You are responsible for determining and meeting
          your own legal, regulatory, and tax obligations, including any that arise from deploying an
          index.
        </p>
      </LegalSection>

      <LegalSection title="No warranty; limitation of liability">
        <p>
          The interface and contracts are provided &ldquo;as is,&rdquo; without warranties of any kind,
          and may contain errors. To the maximum extent permitted by law, the Spectrum contributors are
          not liable for any losses arising from your use of the software, the contracts, or any index.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          These terms may be updated. Continued use after a change means you accept the updated terms.
          See also the <Link to="/risk" className="text-cyan hover:underline">Risk Disclosure</Link> and{' '}
          <Link to="/privacy" className="text-cyan hover:underline">Privacy</Link> notice.
        </p>
      </LegalSection>
    </LegalDoc>
  )
}
