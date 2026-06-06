import { LegalDoc, LegalSection } from '../components/LegalDoc'

// PLACEHOLDER copy reflecting Spectrum's actual model (static, client-side, no accounts,
// no server) — NOT legal advice. Finalize with counsel, and confirm the actual hosting/
// analytics stack before publishing.
export function Privacy() {
  return (
    <LegalDoc
      title="Privacy"
      intro="Spectrum is a static, client-side application. There are no accounts and no login, and we don't run a server that collects your personal data. Here's what that means in practice."
    >
      <LegalSection title="No accounts">
        <p>
          You don&rsquo;t create an account or sign in with an email or social login. You connect a
          self-custodial wallet directly in your browser; that connection is held locally by your
          wallet, not by us.
        </p>
      </LegalSection>

      <LegalSection title="What's public by nature">
        <p>
          Your wallet address and any onchain transactions you make are public on the blockchain — that
          is inherent to a public ledger, not something Spectrum collects or controls.
        </p>
      </LegalSection>

      <LegalSection title="Data the app reads">
        <p>
          To display indexes, the app reads public onchain data through RPC providers and public market
          data from third-party APIs (for example, DexScreener for token prices). Those providers may
          receive your IP address and request data under their own privacy policies. Spectrum does not
          sell personal data.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and analytics">
        <p>
          The app does not require cookies to function. Any analytics or hosting providers used to serve
          the site are listed here once finalized; this section is a placeholder pending confirmation of
          the production stack.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>A contact route for privacy questions will be added before publication.</p>
      </LegalSection>
    </LegalDoc>
  )
}
