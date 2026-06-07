import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

function Q({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group border-b border-white/[0.07] last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {q}
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="pb-4 pr-6 text-sm leading-relaxed text-ink-dim [&_a:hover]:underline [&_a]:text-cyan">
        {children}
      </div>
    </details>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">{label}</div>
      <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 sm:px-5">{children}</div>
    </section>
  )
}

export function Faq() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 py-6">
      <header>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">FAQ</div>
        <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
          Questions &amp; answers
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-dim">
          How Spectrum works, in plain terms. For the longer version see{' '}
          <Link to="/learn" className="text-cyan hover:underline">Learn</Link>, and read the{' '}
          <Link to="/risk" className="text-cyan hover:underline">Risk Disclosure</Link> before interacting with
          any onchain asset.
        </p>
      </header>

      <Group label="Basics">
        <Q q="What is Spectrum?">
          <p>
            A launchpad for onchain index tokens, built on Uniswap V4 and PRISM. An index bundles a basket of
            tokens into a single ERC-20 that trades like any token. Each index is its own Uniswap V4 hook and
            liquidity, so there is no separate vault or wrapper.
          </p>
        </Q>
        <Q q="What is an index token?">
          <p>
            An ERC-20 (18 decimals) backed by a fixed basket of constituents at set weights. Buying it mints
            shares against the basket; selling redeems them. Its value tracks the combined value of everything
            inside.
          </p>
        </Q>
        <Q q="Which networks does it run on?">
          <p>Base and Ethereum mainnet. Each index lives on one chain.</p>
        </Q>
        <Q q="What is DSTABLE?">
          <p>
            DSTABLE is the ecosystem&rsquo;s dollar-pegged settlement unit (about $1). Indexes are quoted in it,
            so a price reads as a familiar number.
          </p>
        </Q>
      </Group>

      <Group label="Mechanics &amp; fees">
        <Q q="How do mint and redeem work?">
          <p>
            Minting and redeeming an index are mechanical, peer-to-contract swaps at NAV against its basket,
            settled in DSTABLE through the index&rsquo;s own V4 hook. This app is informational: it does not
            execute, route, or take custody of any transaction. You interact with the onchain contracts directly
            from your own wallet, and can open any index from <Link to="/explore">Explore</Link> to see its
            details.
          </p>
        </Q>
        <Q q="What is the protocol fee?">
          <p>
            The protocol applies a fixed 1% fee on each mint and redeem, allocated onchain 60% to holders, 30%
            to the index&rsquo;s creator, and 10% to a PRISM buy-and-burn. The split is written into the
            contract; no one sets or changes it. Network (gas) costs apply separately.
          </p>
        </Q>
        <Q q="Does Spectrum charge a management fee?">
          <p>
            No. Spectrum does not charge any management or subscription fee. The only protocol-level fee is the
            fixed 1% per mint and redeem described above.
          </p>
        </Q>
      </Group>

      <Group label="Launching">
        <Q q="Can anyone launch an index?">
          <p>
            Yes. Launching is permissionless: pick the assets and weights, and the index deploys through the
            factory. The deployer is recorded onchain as the index&rsquo;s creator and is the party entitled to
            that index&rsquo;s 30% fee share. <Link to="/launch">Launch a Basket</Link>.
          </p>
        </Q>
        <Q q="What can go in a basket?">
          <p>
            Tokens with sufficient Uniswap liquidity (V4, V3, or V2). The launcher detects the deepest pool for
            each asset automatically. Tokens that only trade on venues without hooks (for example Aerodrome)
            can&rsquo;t be used as constituents.
          </p>
        </Q>
        <Q q="Can a launched index be changed later?">
          <p>
            No. Indexes are immutable by design. The system evolves by deploying new versions, not by mutating
            live ones.
          </p>
        </Q>
      </Group>

      <Group label="Pricing &amp; data">
        <Q q="How is an index's price (NAV) calculated?">
          <p>
            Off-chain, as aggregate-spot USD: the sum of each constituent&rsquo;s held amount times its real
            market price, divided by the index&rsquo;s <code className="font-mono text-ink">effectiveSupply</code>.
            There is no dstable/ETH conversion factor. See the{' '}
            <Link to="/docs/valuation">valuation method</Link>.
          </p>
        </Q>
        <Q q="Why isn't the price taken from the index's own pool?">
          <p>
            An index&rsquo;s internal V4 self-pool is hook-mediated, so its quoted price is effectively static
            and does not track value. Price always comes from reconstructing NAV from the real holdings.
          </p>
        </Q>
      </Group>

      <Group label="Custody &amp; risk">
        <Q q="Does Spectrum hold my assets?">
          <p>
            No. Spectrum is non-custodial. You connect a self-custodial wallet and interact directly with the
            contracts; Spectrum never holds your assets or transacts on your behalf.
          </p>
        </Q>
        <Q q="Are indexes vetted or endorsed?">
          <p>
            No. Anyone can deploy an index, including low-quality, illiquid, or misleadingly named ones. Listing
            or display is not an endorsement or a recommendation. Do your own diligence.
          </p>
        </Q>
        <Q q="What are the risks?">
          <p>
            Onchain assets are volatile and you can lose some or all of what you put in. There is smart-contract
            risk, creator / issuer risk, and liquidity risk. Read the full{' '}
            <Link to="/risk">Risk Disclosure</Link> and <Link to="/terms">Terms</Link>.
          </p>
        </Q>
      </Group>
    </div>
  )
}
