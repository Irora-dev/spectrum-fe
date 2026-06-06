import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Nav } from './Nav'

const FOOTER_LINKS: { to: string; label: string }[] = [
  { to: '/learn', label: 'Learn' },
  { to: '/faq', label: 'FAQ' },
  { to: '/docs/valuation', label: 'Valuation docs' },
]

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col">
      {/* decorative left rail */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-2 top-1/2 hidden -translate-y-1/2 rotate-180 font-mono text-[10px] uppercase tracking-[0.4em] text-ink-faint/60 [writing-mode:vertical-rl] xl:block"
      >
        capture · launch · settle
      </div>

      <Nav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            Spectrum · onchain index tokens
          </span>
          <nav className="flex items-center gap-5">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint transition-colors hover:text-cyan"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            powered by PRISM
          </span>
        </div>
      </footer>
    </div>
  )
}
