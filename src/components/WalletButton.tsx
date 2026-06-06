import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, type Connector } from 'wagmi'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

const btn =
  'border border-white/20 bg-white/[0.04] px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:border-cyan hover:text-cyan'

export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [open, setOpen] = useState(false)

  if (isConnected && address) {
    return (
      <button onClick={() => disconnect()} className={btn} title="Disconnect">
        {short(address)}
      </button>
    )
  }

  // De-dupe by name — EIP-6963 discovery can surface the same wallet twice.
  const seen = new Set<string>()
  const list = connectors.filter((c) => {
    const k = c.name.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  const pick = (c: Connector) => {
    connect({ connector: c })
    setOpen(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btn}>
        Connect
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[360px] max-w-full border border-white/15 bg-[#0a0810] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink">Connect wallet</span>
              <button onClick={() => setOpen(false)} className="text-ink-faint transition-colors hover:text-ink">
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {list.length === 0 && (
                <p className="py-4 text-center text-sm text-ink-faint">
                  No wallet detected. Install MetaMask, Rabby, or Coinbase Wallet.
                </p>
              )}
              {list.map((c) => (
                <button
                  key={c.uid}
                  onClick={() => pick(c)}
                  disabled={isPending}
                  className="flex items-center justify-between border border-white/10 px-4 py-3 text-left transition-colors hover:border-cyan/50 hover:bg-white/[0.04] disabled:opacity-50"
                >
                  <span className="text-sm text-ink">{c.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    {c.type === 'injected' ? 'Injected' : 'Connect'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
