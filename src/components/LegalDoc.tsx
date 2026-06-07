import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Shared chrome for the static legal pages (Terms / Privacy / Risk). Matches the Docs
// page header pattern. All copy these wrap is PLACEHOLDER pending counsel review.
export function LegalDoc({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl py-6">
      <Link
        to="/"
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
      >
        ← Back to Spectrum
      </Link>

      <header className="mt-5 border-b border-white/10 pb-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">Legal</div>
        <h1 className="mt-3 font-display text-3xl font-bold uppercase leading-[0.96] tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.15em] text-amber-300/70">
          Draft placeholder · pending legal review. Not legal advice.
        </p>
        <p className="mt-5 text-base leading-relaxed text-ink-dim">{intro}</p>
      </header>

      <div className="mt-8 space-y-8">{children}</div>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-2.5 space-y-3 text-sm leading-relaxed text-ink-dim">{children}</div>
    </section>
  )
}
