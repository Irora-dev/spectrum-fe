import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { isAddress } from 'viem'
import { AssetLogo } from '../AssetLogo'
import { searchTokens, type TokenHit } from '../../lib/spectrum/token-search'
import { formatUsdCompact, shortAddr } from '../../lib/spectrum/format'

const SPECTRAL = 'linear-gradient(90deg,#ff9248,#ff4db8,#35e0ff)'

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}

// Type-to-search asset picker for the basket builder: type a name/symbol → a
// dropdown of matching tokens on the active chain (ranked by liquidity); click or
// press Enter to add. Pasting a full 0x address still adds it directly.
export function AssetSearch({
  chainId,
  onPick,
  busy = false,
  excludeAddresses = [],
}: {
  chainId: number
  onPick: (address: string, symbol?: string) => void
  busy?: boolean
  excludeAddresses?: string[]
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TokenHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const exclude = useMemo(
    () => new Set(excludeAddresses.map((a) => a.toLowerCase())),
    [excludeAddresses],
  )
  const trimmed = query.trim()
  const looksLikeAddress = isAddress(trimmed)
  const chainLabel = chainId === 1 ? 'Ethereum' : 'Base'
  const canAdd = !busy && trimmed.length > 0

  // Debounced search; aborts stale requests so fast typing never races.
  useEffect(() => {
    if (looksLikeAddress || trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      try {
        const hits = await searchTokens(trimmed, chainId, ctrl.signal)
        setResults(hits.filter((h) => !exclude.has(h.address.toLowerCase())))
        setActive(0)
      } catch {
        /* aborted / failed */
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      ctrl.abort()
      window.clearTimeout(t)
    }
  }, [trimmed, chainId, looksLikeAddress, exclude])

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const showDropdown = open && !looksLikeAddress && trimmed.length >= 2

  const pick = (h: TokenHit) => {
    onPick(h.address, h.symbol)
    setQuery('')
    setResults([])
    setOpen(false)
  }
  const submit = () => {
    if (looksLikeAddress) {
      onPick(trimmed)
      setQuery('')
      setOpen(false)
    } else if (results[active]) {
      pick(results[active])
    }
  }
  const clear = () => {
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }

  return (
    <div ref={rootRef} className="group relative">
      {/* prismatic focus halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[3px] -z-10 rounded-[26px] opacity-0 blur-lg transition-opacity duration-300 group-focus-within:opacity-40"
        style={{ background: SPECTRAL }}
      />

      {/* search bar */}
      <div className="relative flex items-center gap-4 overflow-hidden rounded-[22px] border border-white/15 bg-void/85 py-3 pl-6 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-colors duration-200 focus-within:border-white/25">
        {loading ? (
          <span
            aria-hidden
            className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-cyan/30 border-t-cyan"
          />
        ) : (
          <SearchIcon className="h-6 w-6 shrink-0 text-ink-faint transition-all duration-200 group-focus-within:text-cyan group-focus-within:drop-shadow-[0_0_8px_rgba(53,224,255,0.6)]" />
        )}

        <label htmlFor="asset-search" className="sr-only">
          Search a token by name or symbol, or paste a contract address
        </label>
        <input
          id="asset-search"
          ref={inputRef}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby="asset-help"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="Search a token — name, symbol, or paste an address"
          spellCheck={false}
          autoComplete="off"
          disabled={busy}
          className="min-w-0 flex-1 bg-transparent py-2 font-mono text-lg text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
        />

        {query && !busy && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}

        <button
          type="button"
          disabled={!canAdd}
          onClick={submit}
          className={`shrink-0 rounded-2xl px-7 py-3 font-display text-base font-bold uppercase tracking-wide transition-all duration-150 disabled:cursor-not-allowed ${
            canAdd ? 'text-black hover:brightness-110 hover:saturate-150' : 'bg-white/[0.07] text-ink-faint'
          }`}
          style={canAdd ? { background: SPECTRAL } : undefined}
        >
          {busy ? 'Checking…' : 'Add'}
        </button>
      </div>

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Token search results"
          className="search-pop absolute z-30 mt-2.5 max-h-[26rem] w-full origin-top overflow-auto rounded-2xl border border-white/12 bg-panel/95 p-2 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
        >
          <li className="flex items-center justify-between px-3 pb-2 pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            <span>
              {loading && results.length === 0
                ? `Searching ${chainLabel}…`
                : results.length > 0
                  ? `Tokens on ${chainLabel}`
                  : `No matches on ${chainLabel}`}
            </span>
            {results.length > 0 && <span className="text-ink-faint/70">by liquidity</span>}
          </li>

          {!loading && results.length === 0 && (
            <li className="px-3 pb-2 font-mono text-xs leading-relaxed text-ink-dim">
              Paste the token&rsquo;s contract address (0x…) to add it directly.
            </li>
          )}

          {results.map((h, i) => (
            <li key={h.address} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h)}
                className={`flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-colors ${
                  i === active ? 'bg-cyan/10 ring-1 ring-inset ring-cyan/30' : 'hover:bg-white/[0.06]'
                }`}
              >
                <AssetLogo address={h.address} symbol={h.symbol} chainId={chainId} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-display text-base font-bold uppercase tracking-wide text-ink">
                      {h.symbol}
                    </span>
                    {h.name && <span className="truncate font-mono text-xs text-ink-dim">{h.name}</span>}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-ink-faint">
                    {h.liquidityUsd > 0 ? `${formatUsdCompact(h.liquidityUsd)} liquidity` : shortAddr(h.address)}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    i === active ? 'bg-cyan/20 text-cyan' : 'text-ink-faint'
                  }`}
                >
                  {i === active ? 'Add ↵' : 'Add'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
