import { lazy, Suspense, useEffect } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { config } from './wagmi'
import { Layout } from './components/Layout'

// Routes are code-split: each page (and its heavy deps — Recharts, the launch
// builder, the docs) loads on demand, keeping the initial bundle lean.
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const Explore = lazy(() => import('./pages/Explore').then((m) => ({ default: m.Explore })))
const Token = lazy(() => import('./pages/Token').then((m) => ({ default: m.Token })))
const Creator = lazy(() => import('./pages/Creator').then((m) => ({ default: m.Creator })))
const Portfolio = lazy(() => import('./pages/Portfolio').then((m) => ({ default: m.Portfolio })))
const Launch = lazy(() => import('./pages/Launch').then((m) => ({ default: m.Launch })))
const Flush = lazy(() => import('./pages/Flush').then((m) => ({ default: m.Flush })))
const Faq = lazy(() => import('./pages/Faq').then((m) => ({ default: m.Faq })))
const Learn = lazy(() => import('./pages/Learn').then((m) => ({ default: m.Learn })))
const Docs = lazy(() => import('./pages/Docs').then((m) => ({ default: m.Docs })))
const Terms = lazy(() => import('./pages/Terms').then((m) => ({ default: m.Terms })))
const Privacy = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.Privacy })))
const Risk = lazy(() => import('./pages/Risk').then((m) => ({ default: m.Risk })))
const Studio = lazy(() => import('./pages/Studio').then((m) => ({ default: m.Studio })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))
// The WebGL background is purely decorative + pulls in three.js (~heavy). Lazy-load
// it so it's off the first-paint critical path; a null fallback means the page just
// shows the solid void bg until it streams in.
const SpectrumBackground = lazy(() =>
  import('./components/SpectrumBackground').then((m) => ({ default: m.SpectrumBackground })),
)
const PostDeployTest = import.meta.env.DEV
  ? lazy(() => import('./pages/PostDeployTest').then((m) => ({ default: m.PostDeployTest })))
  : null

const queryClient = new QueryClient()

// Per-route browser-tab titles (the static index.html title/OG is what social
// crawlers see; this just keeps the tab label in sync as you navigate).
const ROUTE_TITLES: Record<string, string> = {
  '/': 'Spectrum · onchain index tokens',
  '/explore': 'Explore · Spectrum',
  '/token': 'Index · Spectrum',
  '/portfolio': 'Portfolio · Spectrum',
  '/launch': 'Launch a Basket · Spectrum',
  '/flush': 'Flush · Spectrum',
  '/faq': 'FAQ · Spectrum',
  '/learn': 'Learn · Spectrum',
  '/docs': 'Docs · Spectrum',
  '/docs/valuation': 'Valuation docs · Spectrum',
  '/terms': 'Terms · Spectrum',
  '/privacy': 'Privacy · Spectrum',
  '/risk': 'Risk · Spectrum',
  '/studio': 'Studio · Spectrum',
}

function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title =
      ROUTE_TITLES[pathname] ??
      (pathname.startsWith('/creator') ? 'Creator · Spectrum' : 'Spectrum · onchain index tokens')
  }, [pathname])
  return null
}

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center" aria-label="Loading" role="status">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-cyan" />
    </div>
  )
}

export function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <RouteTitle />
          <Suspense fallback={null}>
            <SpectrumBackground />
          </Suspense>
          <Layout>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
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
                <Route path="/studio" element={<Studio />} />
                {/* Dev-only harness (reproduces the deploy ceremony + a MOCK "Buy" bar).
                    Never routed in production builds, so the public site has no buy path here. */}
                {import.meta.env.DEV && PostDeployTest && (
                  <Route path="/post-deploy-test" element={<PostDeployTest />} />
                )}
                {/* catch-all — unknown / stale URLs get a branded 404, not a blank page */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
