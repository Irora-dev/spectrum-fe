import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { config } from './wagmi'
import { SpectrumBackground } from './components/SpectrumBackground'
import { Layout } from './components/Layout'
import { Explore } from './pages/Explore'
import { Token } from './pages/Token'
import { Launch } from './pages/Launch'
import { Flush } from './pages/Flush'
import { Faq } from './pages/Faq'
import { Learn } from './pages/Learn'
import { Docs } from './pages/Docs'
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
              <Route path="/launch" element={<Launch />} />
              <Route path="/flush" element={<Flush />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/docs/valuation" element={<Docs />} />
              <Route path="/post-deploy-test" element={<PostDeployTest />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
