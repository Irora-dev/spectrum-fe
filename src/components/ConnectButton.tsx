import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function ConnectButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const cls =
    'border border-line-bright bg-panel-2 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:border-violet hover:text-violet-bright disabled:opacity-50'

  if (isConnected && address) {
    return (
      <button onClick={() => disconnect()} className={cls}>
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    )
  }

  const injectedConnector =
    connectors.find((c) => c.type === 'injected') ?? connectors[0]

  return (
    <button
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      disabled={isPending || !injectedConnector}
      className={cls}
    >
      {isPending ? 'Connecting…' : 'Connect'}
    </button>
  )
}
