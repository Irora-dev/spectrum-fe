import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' keeps asset URLs relative so the build works under any
// IPFS/ENS gateway path. Clean per-route HTML for IPFS is handled at deploy time.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors into their own cacheable chunks so the initial
        // parse is smaller and chunks download in parallel. three is also
        // lazy-loaded (decorative background), so it stays off first paint.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/three/')) return 'three'
          if (/\/(recharts|d3-[a-z]+|victory-vendor|internmap)\//.test(id)) return 'charts'
          if (/\/(react|react-dom|react-router|react-router-dom|scheduler|use-sync-external-store)\//.test(id))
            return 'react-vendor'
          if (/\/(wagmi|@wagmi|viem|ox|abitype|@tanstack|@coinbase|@walletconnect|@reown|@safe-global|@metamask)/.test(id))
            return 'web3'
        },
      },
    },
  },
})
