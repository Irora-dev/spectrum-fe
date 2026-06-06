import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' keeps asset URLs relative so the build works under any
// IPFS/ENS gateway path. Clean per-route HTML for IPFS is handled at deploy time.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
