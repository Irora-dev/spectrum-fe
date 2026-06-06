/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALCHEMY_API_KEY?: string
  readonly VITE_BASE_RPC_URL?: string
  readonly VITE_MAINNET_RPC_URL?: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
