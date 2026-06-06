import { useState } from 'react'
import { AssetLogo } from './AssetLogo'
import { tokenVisual } from '../lib/spectrum/token-meta'

interface DemoAsset {
  symbol: string
  address: string
  price: number
}

// Illustrative sample — real logos + curated brand colours; prices are mock,
// just to show the index token's value moving with what's inside it.
const ASSETS: DemoAsset[] = [
  { symbol: 'VVV', address: '0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf', price: 3.2 },
  { symbol: 'VIRTUAL', address: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b', price: 1.85 },
  { symbol: 'BNKR', address: '0x22af33fe49fd1fa80c7149773dde5890d3c76f3b', price: 0.95 },
  { symbol: 'POD', address: '0xed664536023d8e4b1640c394777d34abaff1df8f', price: 2.1 },
  { symbol: 'REI', address: '0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd', price: 0.62 },
  { symbol: 'AEON', address: '0xbf8e8f0e8866a7052f948c16508644347c57aba3', price: 0.4 },
]
const CHAIN = 8453

export function IndexBuilderDemo() {
  const [selected, setSelected] = useState<string[]>([ASSETS[0].address, ASSETS[1].address, ASSETS[3].address])
  const toggle = (addr: string) =>
    setSelected((s) => (s.includes(addr) ? s.filter((a) => a !== addr) : [...s, addr]))

  const chosen = ASSETS.filter((a) => selected.includes(a.address))
  const weight = chosen.length ? 100 / chosen.length : 0
  const nav = chosen.length ? chosen.reduce((s, a) => s + a.price, 0) / chosen.length : 0
  // the index token borrows the colours of what's inside it
  const grad =
    chosen.length >= 2
      ? `linear-gradient(135deg, ${tokenVisual(chosen[0].symbol, chosen[0].address).color}, ${tokenVisual(
          chosen[chosen.length - 1].symbol,
          chosen[chosen.length - 1].address,
        ).color})`
      : 'linear-gradient(135deg, #35e0ff, #a48bff 55%, #ff4db8)'

  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-6 backdrop-blur-md sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        {/* 1 · pick assets */}
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">1 · Pick assets</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {ASSETS.map((a) => {
              const on = selected.includes(a.address)
              const vis = tokenVisual(a.symbol, a.address)
              return (
                <button
                  key={a.address}
                  type="button"
                  onClick={() => toggle(a.address)}
                  aria-pressed={on}
                  className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 transition-all ${
                    on
                      ? 'border-transparent shadow-[0_6px_18px_-6px_rgba(0,0,0,0.6)]'
                      : 'border-white/15 text-ink-dim hover:border-white/35 hover:text-ink'
                  }`}
                  style={on ? { background: vis.color, color: vis.ink } : undefined}
                >
                  <AssetLogo address={a.address} symbol={a.symbol} chainId={CHAIN} size={20} />
                  <span className="font-display text-xs font-bold uppercase tracking-wide">{a.symbol}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-3 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            Tap to add or remove · {chosen.length} selected
          </div>
        </div>

        {/* 2 · the resulting token */}
        <div className="rounded-xl border border-white/10 bg-black/30 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">2 · Your index token</div>

          {/* live allocation bar */}
          <div className="mt-4 flex h-10 w-full overflow-hidden rounded-lg bg-white/5">
            {chosen.map((a) => {
              const vis = tokenVisual(a.symbol, a.address)
              return (
                <div
                  key={a.address}
                  className="flex items-center justify-center transition-[width] duration-300 ease-out"
                  style={{ width: `${weight}%`, background: vis.color }}
                  title={`${a.symbol} · ${weight.toFixed(0)}%`}
                >
                  {weight > 13 && (
                    <span className="font-display text-[10px] font-bold uppercase" style={{ color: vis.ink }}>
                      {a.symbol}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* token + live value */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl ring-1 ring-white/15" style={{ background: grad }}>
                <span className="font-display text-sm font-bold text-black/75">◆</span>
              </div>
              <div>
                <div className="font-display text-sm font-semibold text-ink">$YOURS</div>
                <div className="font-mono text-[10px] text-ink-faint">
                  {chosen.length ? `1 token · ${chosen.length} assets` : 'add assets to mint'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-num text-2xl leading-none tabular-nums text-ink">${nav.toFixed(2)}</div>
              <div className="font-mono text-[10px] text-ink-faint">value per token</div>
            </div>
          </div>
        </div>
      </div>

      {/* what it means */}
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-ink-dim">
        The token’s price tracks the <span className="text-ink">combined value of every asset inside it</span> — so a
        single trade backs a whole ecosystem, sector, or niche at once.
      </p>
    </div>
  )
}
