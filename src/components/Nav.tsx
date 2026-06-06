import { Link, NavLink } from 'react-router-dom'
import { NetworkToggle } from './NetworkToggle'
import { WalletButton } from './WalletButton'
import { SpectrumWordmark } from './SpectrumWordmark'
import { PrismMark } from '../hud'
import { TRADING_ENABLED, WALLET_ENABLED } from '../lib/config/features'

const links: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Explore', end: true },
  { to: '/launch', label: 'Launch' },
  // Portfolio = read-only holdings (needs only a connected wallet); Flush = fee-claim,
  // a transactional surface gated with buy/sell.
  ...(WALLET_ENABLED ? [{ to: '/portfolio', label: 'Portfolio' }] : []),
  ...(TRADING_ENABLED ? [{ to: '/flush', label: 'Flush' }] : []),
  { to: '/faq', label: 'FAQ' },
]

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-void/70 backdrop-blur">
      <div className="relative flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* left — logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <PrismMark size={24} />
          <SpectrumWordmark className="text-lg tracking-[0.3em]" />
        </Link>

        {/* center — menu */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3 py-1.5 font-mono text-sm uppercase tracking-[0.18em] transition-colors ${
                  isActive ? 'text-cyan' : 'text-ink-dim hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* right — network + wallet */}
        <div className="flex items-center gap-2">
          <NetworkToggle />
          {WALLET_ENABLED && <WalletButton />}
        </div>
      </div>
    </header>
  )
}
