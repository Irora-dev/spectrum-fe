import { http, createConfig } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import { baseRpcUrl, mainnetRpcUrl } from './lib/chain/rpc'

const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

export const config = createConfig({
  chains: [base, mainnet],
  connectors: [
    // injected covers MetaMask, Rabby, Brave, etc.; Coinbase + WalletConnect add the rest.
    injected(),
    coinbaseWallet({ appName: 'Spectrum' }),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId })] : []),
  ],
  transports: {
    // Shared resolver: explicit *_RPC_URL → Alchemy key → public fallback.
    [base.id]: http(baseRpcUrl()),
    [mainnet.id]: http(mainnetRpcUrl()),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
