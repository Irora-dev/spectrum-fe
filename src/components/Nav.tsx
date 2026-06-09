import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { NetworkToggle } from './NetworkToggle'
import { WalletButton } from './WalletButton'
import { SpectrumWordmark } from './SpectrumWordmark'
import { PrismMark } from '../hud'
import { TRADING_ENABLED, WALLET_ENABLED } from '../lib/config/features'

const links: { to: string; label: string; end?: boolean }[] = [
  { to: '/explore', label: 'Explore' },
  { to: '/launch', label: 'Launch' },
  // Portfolio = read-only holdings (needs only a connected wallet); Flush = fee-claim,
  // a transactional surface gated with buy/sell.
  ...(WALLET_ENABLED ? [{ to: '/portfolio', label: 'Portfolio' }] : []),
  ...(TRADING_ENABLED ? [{ to: '/flush', label: 'Flush' }] : []),
  { to: '/faq', label: 'FAQ' },
]

export function Nav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  // Close the drawer whenever the route changes (tapping a link navigates).
  useEffect(() => setOpen(false), [pathname])

  // Close on Escape while the drawer is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-void/70 backdrop-blur">
      <div className="relative flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* left — logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <PrismMark size={24} />
          <SpectrumWordmark className="text-lg tracking-[0.3em]" />
        </Link>

        {/* center — menu (desktop) */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3.5 py-1.5 font-mono text-base uppercase tracking-[0.18em] transition-colors ${
                  isActive ? 'text-cyan' : 'text-ink-dim hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* right — network + wallet + mobile menu toggle */}
        <div className="flex items-center gap-2">
          <NetworkToggle />
          {WALLET_ENABLED && <WalletButton />}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/12 text-ink-dim transition-colors hover:border-white/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70 md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      {open && (
        <nav id="mobile-nav" className="border-t border-line bg-void/95 px-3 py-2 backdrop-blur md:hidden">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-3 font-mono text-sm uppercase tracking-[0.18em] transition-colors ${
                  isActive ? 'text-cyan' : 'text-ink-dim hover:bg-white/5 hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
