import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { config } from './wagmi'
import { SpectrumBackground } from './components/SpectrumBackground'
import { Layout } from './components/Layout'
import { Explore } from './pages/Explore'
import { Token } from './pages/Token'
import { Creator } from './pages/Creator'
import { Portfolio } from './pages/Portfolio'
import { Launch } from './pages/Launch'
import { Flush } from './pages/Flush'
import { Faq } from './pages/Faq'
import { Learn } from './pages/Learn'
import { Docs } from './pages/Docs'
import { Terms } from './pages/Terms'
import { Privacy } from './pages/Privacy'
import { Risk } from './pages/Risk'
import { PostDeployTest } from './pages/PostDeployTest'

const queryClient = new QueryClient()

export function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SpectrumBackground />
          <Layout>
            <Routes>
              <Route path="/" element={<Explore />} />
              <Route path="/token" element={<Token />} />
              <Route path="/creator/:address" element={<Creator />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/launch" element={<Launch />} />
              <Route path="/flush" element={<Flush />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/docs/valuation" element={<Docs />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/risk" element={<Risk />} />
              {/* Dev-only harness (reproduces the deploy ceremony + a MOCK "Buy" bar).
                  Never routed in production builds, so the public site has no buy path here. */}
              {import.meta.env.DEV && <Route path="/post-deploy-test" element={<PostDeployTest />} />}
            </Routes>
          </Layout>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
