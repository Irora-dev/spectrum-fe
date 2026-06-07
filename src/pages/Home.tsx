import { Link } from 'react-router-dom'
import { useAllIndexes } from '../lib/spectrum/hooks'
import type { IndexSummary } from '../lib/spectrum/index-data'
import { IndexSpotlight } from '../components/IndexSpotlight'
import { BasketGrid } from '../components/BasketGrid'
import { ConceptOrbit } from '../components/ConceptReveal'
import { SpectrumWordmark } from '../components/SpectrumWordmark'

const keyOf = (ix: IndexSummary) => `${ix.chainId}:${ix.address}`

// The landing page: a cinematic full-bleed hero (the assets-converge-into-one
// animation behind the wordmark) that explains the concept at a glance, then a
// curated taste — the top-two spotlight + a short trending row. The full
// searchable directory lives at /explore.
export function Home() {
  const { data, isLoading } = useAllIndexes()
  const all = data ?? []

  const featured = all.slice(0, 2)
  const fk = new Set(featured.map(keyOf))
  const trending = [...all]
    .filter((i) => !fk.has(keyOf(i)))
    .sort((a, b) => (b.change24hPct ?? -Infinity) - (a.change24hPct ?? -Infinity))
    .slice(0, 6)

  return (
    <div className="space-y-14">
      {/* ── cinematic hero: converging assets behind the wordmark ─────────── */}
      <section className="relative left-1/2 -mt-8 w-screen -translate-x-1/2 overflow-hidden">
        {/* aurora */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet/15 blur-[130px]" />
          <div className="absolute left-[18%] top-[28%] h-72 w-72 rounded-full bg-cyan/12 blur-[120px]" />
          <div className="absolute right-[16%] top-[42%] h-72 w-72 rounded-full bg-magenta/12 blur-[130px]" />
        </div>

        {/* the concept animation, blown up as an ambient backdrop (no centre
            token — the wordmark sits at the convergence point) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <ConceptOrbit
            showCore={false}
            logoSize={46}
            className="opacity-50 [--orbit-r:200px] sm:[--orbit-r:300px] lg:[--orbit-r:360px]"
          />
        </div>

        {/* legibility scrim — large + soft, fully transparent before any edge so
            it never shows a hard boundary; the glow simply melts into the page
            (no solid band, so nothing cuts off on load or scroll) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(125% 85% at 50% 44%, rgba(5,5,11,0.66) 0%, rgba(5,5,11,0.22) 46%, transparent 78%)',
          }}
        />

        {/* foreground */}
        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-4xl flex-col items-center justify-center px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
            Live · Ethereum &amp; Base
          </div>

          <SpectrumWordmark className="mt-6 text-6xl leading-[0.9] tracking-tight sm:text-7xl md:text-8xl lg:text-9xl" />

          <p className="mt-6 max-w-2xl text-lg leading-snug text-ink-dim sm:text-xl">
            Launch onchain index tokens. Own a whole basket of assets in a single token, an entire sector in
            one swap.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/launch"
              className="rounded-lg bg-cyan px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-void transition-transform hover:scale-[1.03]"
            >
              Launch a Basket
            </Link>
            <Link
              to="/explore"
              className="rounded-lg border border-white/20 bg-white/[0.04] px-6 py-3 font-mono text-xs uppercase tracking-[0.18em] text-ink backdrop-blur transition-colors hover:border-cyan hover:text-cyan"
            >
              Explore indexes →
            </Link>
          </div>

          {/* scroll cue */}
          <div className="mt-16 flex flex-col items-center gap-2 text-ink-faint">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Featured baskets</span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── featured spotlight + trending teaser ─────────────────────────── */}
      {!isLoading && featured.length > 0 && (
        <section className="space-y-8">
          <IndexSpotlight indexes={featured} />

          {trending.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-end justify-between border-b border-white/10 pb-3">
                <div>
                  <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink">Trending now</h2>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                    Top movers · 24h
                  </p>
                </div>
                <Link
                  to="/explore"
                  className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan transition-colors hover:text-ink"
                >
                  Explore all {all.length} →
                </Link>
              </div>
              <BasketGrid indexes={trending} />
            </div>
          )}
        </section>
      )}
    </div>
  )
}
