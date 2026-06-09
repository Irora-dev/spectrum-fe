import { http, createConfig } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import { baseRpcUrl, mainnetRpcUrl } from './lib/chain/rpc'

const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
// Wallet UI is gated (VITE_ENABLE_WALLET). Until it's on, ship ONLY the lightweight
// `injected` connector — the Coinbase Wallet SDK + WalletConnect pull in hundreds of
// KB that's pure dead weight (the connect button isn't even rendered). The flag is a
// build-time constant, so the heavy connector SDKs tree-shake out of the gated build.
const walletEnabled = import.meta.env.VITE_ENABLE_WALLET === 'true'

export const config = createConfig({
  chains: [base, mainnet],
  connectors: walletEnabled
    ? [
        // injected covers MetaMask, Rabby, Brave, etc.; Coinbase + WalletConnect add the rest.
        injected(),
        coinbaseWallet({ appName: 'Spectrum' }),
        ...(wcProjectId ? [walletConnect({ projectId: wcProjectId })] : []),
      ]
    : [injected()],
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
