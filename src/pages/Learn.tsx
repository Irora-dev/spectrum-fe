import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

function Section({ label, title, children }: { label: string; title: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">{label}</div>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-dim">{children}</div>
    </section>
  )
}

const FEE_SPLIT: [string, string, string][] = [
  ['60%', 'Holders', '#35e0ff'],
  ['30%', 'Creator', '#ff4db8'],
  ['10%', 'Buy & burn PRISM', '#ff9248'],
]

export function Learn() {
  return (
    <div className="mx-auto max-w-3xl space-y-14 py-6">
      <header>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">How it works</div>
        <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
          One token.<br />
          <span className="text-cyan">The whole basket.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-dim">
          Spectrum is a launchpad for onchain index tokens, built on Uniswap V4 and PRISM. Anyone can
          bundle a thesis — AI, DeFi, memes, RWAs — into a single token that trades as easily as any
          ERC-20, and pays the people who hold it.
        </p>
      </header>

      <Section label="01 · Index tokens" title="A whole basket, as one token">
        <p>
          An index token holds many assets at fixed weights and trades as a single token. Buy one to
          own the entire basket; sell it in one transaction. No bridging between a dozen positions, no
          rebalancing — the thesis is the token.
        </p>
      </Section>

      <Section label="02 · The mechanism" title="The token is the pool">
        <p>
          Each index <em className="not-italic text-ink">is</em> its own Uniswap V4 hook and its own
          liquidity. Buying routes through a custom hook that mints shares and deposits the underlying
          assets straight into the pool — no vault, no wrapper, no second transaction.
        </p>
        <p>
          Because the token is its own liquidity, the price always reflects the real units you own:
          you can&rsquo;t pay a premium to NAV, you can&rsquo;t have your basket drained, and you&rsquo;re a
          claimant on the assets rather than a liquidity provider exposed to impermanent loss.
        </p>
      </Section>

      <Section label="03 · The flywheel" title="Every trade pays holders">
        <p>
          A 1% fee on every buy and every sell — but instead of charging holders, it pays them. It
          splits three ways:
        </p>
        <div className="grid grid-cols-3 gap-3">
          {FEE_SPLIT.map(([pct, who, c]) => (
            <div key={who} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-num text-2xl tabular-nums" style={{ color: c }}>
                {pct}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-ink-faint">
                {who}
              </div>
            </div>
          ))}
        </div>
        <p>
          Holders&rsquo; share accrues as NAV growth and is paid out when they exit. Hold the token, get
          paid; launch the token, get paid; and the PRISM ecosystem compounds underneath it all.
        </p>
      </Section>

      <Section label="04 · Why it's different" title="Built without the seam">
        <p>
          Every earlier index token was two things stitched together: a vault that held the assets and
          a separate market that priced them. Every failure traced back to that seam — management fees,
          rented liquidity that walked away, closed-end discounts to NAV, impermanent loss.
        </p>
        <p>
          Spectrum removes the seam entirely. The token is the liquidity, valuation is unit-based, and
          there is nothing to rent, drift, or bleed.
        </p>
      </Section>

      <Section label="05 · Launch" title="Anyone can launch one">
        <p>
          Win a launch slot, choose any assets and weights, and your index deploys with a hook address
          mined in your browser. You earn 30% of every trade for as long as it trades. Pool routing,
          fees and tick spacing are detected automatically — you just pick the assets.
        </p>
        <Link
          to="/launch"
          className="mt-1 inline-block rounded-lg border border-white/20 bg-white/[0.04] px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:border-cyan hover:text-cyan"
        >
          Launch an index →
        </Link>
      </Section>

      <Section label="06 · PRISM &amp; DSTABLE" title="The settlement layer">
        <p>
          Indexes are priced in <span className="text-ink">DSTABLE</span>, the ecosystem&rsquo;s
          dollar-pegged settlement currency, so a quote always reads as a familiar number. PRISM owns
          the machine — a claim on every index&rsquo;s fees and on dstable&rsquo;s yield — and its supply
          shrinks through buy &amp; burn as Spectrum grows. Revenue up, supply down.
        </p>
      </Section>

      <div className="flex flex-wrap gap-3 border-t border-white/10 pt-8">
        <Link
          to="/"
          className="rounded-lg border border-white/20 bg-white/[0.04] px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:border-cyan hover:text-cyan"
        >
          Explore indexes
        </Link>
        <Link
          to="/launch"
          className="rounded-lg border border-white/10 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink-dim transition-colors hover:text-ink"
        >
          Launch an index
        </Link>
      </div>
    </div>
  )
}
