import { Link } from 'react-router-dom'
import {
  Callout,
  Checklist,
  CodeBlock,
  CopyChip,
  DocSection,
  IC,
  Table,
  Toc,
} from '../components/DocKit'

// ── copyable snippets (kept verbatim so copy/paste is exact) ──────────────────
const NAV_FORMULA = `NAV per token = (total USD value of all held constituents) / (effective supply)`

const ALGO = `AUM_usd = 0
for i in 0 .. basketLength()-1:
    (asset, _, _, _, _, _, dec) = basket(i)
    held   = totalHeld(asset)                  # raw, asset decimals
    price  = priceUsd(asset)                   # see §5; dstable -> 1.0
    AUM_usd += (held / 10**dec) * price

navPerToken = AUM_usd / (effectiveSupply() / 1e18)`

const REFERENCE_TS = `import { Contract, JsonRpcProvider, formatUnits } from "ethers";

const INDEX_ABI = [
  "function decimals() view returns (uint8)",
  "function effectiveSupply() view returns (uint256)",
  "function basketLength() view returns (uint256)",
  "function basket(uint256) view returns (address asset, uint8 venue, (address,address,uint24,int24,address) ethPool, uint24 v3Fee, address v2Pair, uint16 weight, uint8 decimals)",
  "function totalHeld(address) view returns (uint256)",
];

async function indexNav(index: string, provider: JsonRpcProvider) {
  const c = new Contract(index, INDEX_ABI, provider);
  const [supplyRaw, lenRaw] = await Promise.all([c.effectiveSupply(), c.basketLength()]);
  const len = Number(lenRaw);

  const entries = await Promise.all([...Array(len)].map((_, i) => c.basket(i)));
  const held = await Promise.all(entries.map((e) => c.totalHeld(e.asset)));

  let aum = 0;
  for (let i = 0; i < len; i++) {
    const dec = Number(entries[i].decimals);
    const amount = Number(formatUnits(held[i], dec));
    const priceUsd = await priceOf(entries[i].asset); // your price source (§5)
    aum += amount * priceUsd;
  }
  const supply = Number(formatUnits(supplyRaw, 18));
  return { aumUsd: aum, navPerToken: supply > 0 ? aum / supply : 0 };
}`

const EVENT_SOL = `event Launched(
  address indexed token, address indexed deployer, address indexed pook,
  bytes32 pookCodeHash, string name, string symbol,
  uint160 startSqrtPriceX96, uint256 ethPaid
);`

const DEX_URL = `https://api.dexscreener.com/tokens/v1/base/{comma-separated-addresses}`

const TOC = [
  { id: 'what', label: '1 · What an index is' },
  { id: 'reconstruct', label: '2 · NAV reconstruction' },
  { id: 'derived', label: '3 · Change · weights · AUM' },
  { id: 'onchain', label: '4 · On-chain views' },
  { id: 'pricing', label: '5 · Pricing constituents' },
  { id: 'discover', label: '6 · Discovering indexes' },
  { id: 'aggregate', label: '7 · Aggregate-spot NAV' },
  { id: 'gotchas', label: '8 · Gotchas' },
  { id: 'versioning', label: '9 · Versioning' },
  { id: 'reference', label: '10 · Quick reference' },
]

const BASE_ADDR = {
  factory: '0xab9af86483dbf217e2e7edea84dd1bdbe3d488cf',
  dstable: '0x51f2817B06DE142021FBFf00Ac9B56ad84e84088',
  poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
}
const ETH_ADDR = {
  factory: '0xA7D4A1b8D6096D503FAa6E7ecd927D5BA06DAB2a',
  dstable: '0x05E32dC43d0c4B6BfF1976714717f12EBA8e8088',
  poolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
}

function AddressGroup({ chain, addr }: { chain: string; addr: typeof BASE_ADDR }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">{chain}</div>
      <dl className="space-y-2.5">
        {[
          ['Factory', addr.factory],
          ['dstable', addr.dstable],
          ['v4 PoolManager', addr.poolManager],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-center justify-between gap-2">
            <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-dim">{label}</dt>
            <dd className="min-w-0">
              <CopyChip text={value} label={`${value.slice(0, 6)}…${value.slice(-4)}`} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function Docs() {
  return (
    <div className="py-4">
      <Link
        to="/"
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
      >
        ← Back to Spectrum
      </Link>

      {/* header */}
      <header className="mt-5 border-b border-white/10 pb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
          Developer guide · Integration
        </div>
        <h1 className="mt-5 max-w-3xl font-display text-3xl font-bold uppercase leading-[0.96] tracking-tight text-ink sm:text-4xl md:text-5xl">
          Sourcing the value of a Spectrum index
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-dim">
          For external builders, infra providers, price feeds, dashboards, and protocols that need the
          value (NAV) of a Spectrum index token. Value an index by reconstructing its NAV from on-chain
          holdings plus a price source — the method below works for <em className="not-italic text-ink">every</em>{' '}
          index on Base and Ethereum.
        </p>
      </header>

      {/* two-column: TOC + article */}
      <div className="mt-10 lg:grid lg:grid-cols-[170px_minmax(0,1fr)] lg:gap-12">
        <Toc items={TOC} />

        <article className="min-w-0 max-w-3xl space-y-7">
          {/* key callouts up top */}
          <Callout variant="note" title="Bottom line">
            <p>
              Reconstruct NAV from on-chain holdings plus a price source. Do <strong className="text-ink">not</strong>{' '}
              rely on the on-chain <IC>exchangeRate()</IC> view — it reverts for most live indexes (see{' '}
              <a href="#onchain" className="text-cyan hover:underline">§4</a>). Examples target Base (8453); the
              same method applies on Ethereum mainnet with that chain&rsquo;s addresses.
            </p>
          </Callout>

          <Callout variant="danger" title="Never price from the index's own pool">
            <p>
              Each index has an internal Uniswap v4 &ldquo;self-pool&rdquo; (index/dstable), but mint/redeem are
              hook-mediated, so that pool&rsquo;s price does <strong className="text-ink">not</strong> track value and
              is effectively static. An indexer that auto-detects that pool will publish a wrong price. Always
              reconstruct NAV per <a href="#reconstruct" className="text-cyan hover:underline">§2</a>.
            </p>
          </Callout>

          <Callout variant="key" title="Canonical price = aggregate-spot USD NAV">
            <p>
              <IC>Σ (held_i × real-market-price_i) ÷ effectiveSupply</IC>. Price each constituent at its real
              market USD price and apply <strong className="text-ink">no</strong> dstable→ETH conversion factor
              (see <a href="#aggregate" className="text-cyan hover:underline">§7</a>). This is the single number all
              surfaces must agree on.
            </p>
          </Callout>

          {/* 1 */}
          <DocSection id="what" n="01" title="What a Spectrum index is">
            <p>
              A Spectrum index is an ERC-20 token (<strong className="text-ink">18 decimals</strong>) backed by a
              fixed basket of constituent tokens. It has no tradeable market pool you can price against: users
              mint and redeem against the backing at NAV (deposit dstable → the contract buys the constituents and
              mints index tokens; redeem burns index tokens → the contract sells constituents back to dstable).
            </p>
            <p>So the value of one index token is:</p>
            <CodeBlock code={NAV_FORMULA} title="nav per token" />
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">Units you must respect</p>
            <Table
              head={['Thing', 'Value']}
              rows={[
                ['Index token decimals', <strong className="text-ink">18</strong>],
                ['dstable (settlement / cash-buffer unit)', <span><strong className="text-ink">6 decimals</strong>, ≈ $1.00</span>],
                ['Basket weights', <span>BPS (10000 = 100%) — these are <em className="not-italic text-ink">target</em> weights; live weights drift with price</span>],
                ['Constituent decimals', <span><strong className="text-ink">varies</strong> — read per entry, never assume 18</span>],
              ]}
            />
          </DocSection>

          {/* 2 */}
          <DocSection id="reconstruct" n="02" title="Off-chain NAV reconstruction">
            <p>
              The canonical method, and the only one that works for every index (including those with V3/V2
              constituents). Three on-chain reads plus a price source.
            </p>

            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">2.1 · Reads (per index token address)</p>
            <Table
              head={['Call', 'Returns', 'Use']}
              rows={[
                [<IC>decimals()</IC>, <IC>18</IC>, 'Scale the index token'],
                [<IC>effectiveSupply()</IC>, <IC>uint256</IC>, <span>Denominator for NAV/token (excludes tokens pending burn — use this, <em className="not-italic text-ink">not</em> <IC>totalSupply()</IC>)</span>],
                [<IC>basketLength()</IC>, <IC>uint256</IC>, 'Number of constituents'],
                [<IC>basket(i)</IC>, <span>tuple (see ABI below)</span>, 'Constituent address, target weight (BPS), decimals'],
                [<IC>totalHeld(asset)</IC>, <IC>uint256</IC>, 'Actual held amount (raw, asset decimals)'],
              ]}
            />
            <Callout variant="warn" title="Use totalHeld(asset), not balanceOf">
              <p>
                Part of the backing can be parked in a yield manager (&ldquo;pook&rdquo;); <IC>balanceOf</IC>{' '}
                undercounts it. <IC>totalHeld</IC> returns idle + parked. (They&rsquo;re equal only when an index has
                no pook.)
              </p>
            </Callout>

            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">2.2 · Algorithm</p>
            <CodeBlock code={ALGO} title="pseudocode" />

            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">2.3 · Reference implementation</p>
            <CodeBlock code={REFERENCE_TS} title="indexNav.ts · ethers v6" />
          </DocSection>

          {/* 3 */}
          <DocSection id="derived" n="03" title="24h change, live weights, AUM">
            <ul className="space-y-2.5">
              <li className="flex gap-2"><span className="text-cyan">·</span><span><strong className="text-ink">AUM (USD)</strong> = the <IC>aum</IC> computed above.</span></li>
              <li className="flex gap-2"><span className="text-cyan">·</span><span><strong className="text-ink">Live weight</strong> of constituent <IC>i</IC> = <IC>(held_i × price_i) / AUM</IC> (drifts from the BPS target as prices move).</span></li>
              <li className="flex gap-2"><span className="text-cyan">·</span><span><strong className="text-ink">24h change</strong> = value-weighted sum of each priced constituent&rsquo;s 24h change.</span></li>
            </ul>
          </DocSection>

          {/* 4 */}
          <DocSection id="onchain" n="04" title="On-chain views — and why they revert">
            <p>
              The contract exposes <IC>exchangeRate()</IC> (dstable per index token, ×1e18) and{' '}
              <IC>totalReserveDstable()</IC> (total backing in dstable). <strong className="text-ink">Do not depend
              on them:</strong>
            </p>
            <ul className="space-y-2.5">
              <li className="flex gap-2">
                <span className="text-alert">·</span>
                <span>
                  They <strong className="text-ink">revert for any index containing a V3 or V2 constituent</strong>{' '}
                  — which is most of them — with <IC>InvalidEthPool</IC> (<IC>0xc70c704d</IC>), because V3/V2
                  constituents are priced through a V4 <IC>ethPool</IC> that is zeroed for those entries.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-alert">·</span>
                <span>
                  Even when they don&rsquo;t revert (an all-V4 basket), they are <strong className="text-ink">spot-priced</strong>{' '}
                  via a single <IC>getSlot0</IC> read per pool — manipulable within a block, so unsafe as an oracle.
                </span>
              </li>
            </ul>
            <Callout variant="note">
              <p>
                Treat <IC>exchangeRate()</IC> as a convenience for all-V4 baskets only, never as a
                manipulation-resistant feed. The <a href="#reconstruct" className="text-cyan hover:underline">§2</a>{' '}
                reconstruction is the supported path.
              </p>
            </Callout>
          </DocSection>

          {/* 5 */}
          <DocSection id="pricing" n="05" title="Pricing the constituents">
            <p>
              You supply the prices; the contract only tells you <em className="not-italic text-ink">what</em> and{' '}
              <em className="not-italic text-ink">how much</em> it holds. Price each constituent at its real market
              USD price — do <strong className="text-ink">not</strong> route value through the dstable/ETH pool (it
              can be pegged/stale; see <a href="#aggregate" className="text-cyan hover:underline">§7</a>).
            </p>
            <ul className="space-y-2.5">
              <li className="flex gap-2"><span className="text-cyan">·</span><span><strong className="text-ink">DexScreener</strong> (no key, per-chain): <IC>priceUsd</IC> per token; pick the deepest pair.</span></li>
              <li className="flex gap-2"><span className="text-cyan">·</span><span><strong className="text-ink">dstable</strong> = $1.00 (cash buffer, 6 decimals).</span></li>
              <li className="flex gap-2"><span className="text-cyan">·</span><span><strong className="text-ink">ETH</strong> (if valuing via ETH): Chainlink ETH/USD feed.</span></li>
              <li className="flex gap-2"><span className="text-cyan">·</span><span>Or your own oracle / TWAP. For a manipulation-resistant feed, use a TWAP or aggregated source — not raw pool spot.</span></li>
            </ul>
            <CodeBlock code={DEX_URL} title="DexScreener · base" />
            <Callout variant="warn" title="Handle missing prices gracefully">
              <p>
                Leave a constituent <strong className="text-ink">unpriced</strong> (don&rsquo;t assume $0 or revert the
                whole NAV) if no price is available; surface <IC>pricedCount / totalCount</IC> so consumers know
                coverage.
              </p>
            </Callout>
          </DocSection>

          {/* 6 */}
          <DocSection id="discover" n="06" title="Discovering indexes">
            <p>
              Indexes are created by the Spectrum factory. Enumerate them from its event log (there is no on-chain
              enumeration view); public RPCs cap <IC>getLogs</IC> ranges, so page in windows.{' '}
              <IC>factory.tokens(token)</IC> returns <IC>(deployer, pook)</IC>.
            </p>
            <CodeBlock code={EVENT_SOL} title="factory event · solidity" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink-dim">Base factory</span>
                <CopyChip text={BASE_ADDR.factory} label={`${BASE_ADDR.factory.slice(0, 6)}…${BASE_ADDR.factory.slice(-4)}`} />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink-dim">Ethereum factory</span>
                <CopyChip text={ETH_ADDR.factory} label={`${ETH_ADDR.factory.slice(0, 6)}…${ETH_ADDR.factory.slice(-4)}`} />
              </div>
            </div>
          </DocSection>

          {/* 7 */}
          <DocSection id="aggregate" n="07" title="Use aggregate-spot NAV — no dstable/ETH factor">
            <p>There are two numbers you could compute; publish the first:</p>
            <ol className="space-y-2.5">
              <li className="flex gap-2.5">
                <span className="font-num font-semibold text-cyan">1</span>
                <span>
                  <strong className="text-ink">Aggregate-spot NAV (canonical):</strong>{' '}
                  <IC>Σ held × real-market-price ÷ effectiveSupply</IC> — the honest USD value of the backing.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="font-num font-semibold text-ink-faint">2</span>
                <span>
                  <strong className="text-ink">Pool-quoted value (do not publish):</strong> aggregate-spot × a factor
                  derived from the canonical dstable/ETH pool.
                </span>
              </li>
            </ol>
            <p>
              The factor is not a rounding term. Measured live on Base, the dstable/ETH pool quotes ~2,000
              dstable/ETH while real ETH is ≈ $1,770 → factor ≈ <strong className="text-ink">1.13</strong>, i.e. the
              pool-quoted value runs <strong className="text-ink">~13% above</strong> aggregate-spot. That gap is a
              pegged/stale-pool artifact, not real value. (On Ethereum mainnet no dstable/ETH pool is wired, so
              indexes there are already aggregate-spot.)
            </p>
            <Callout variant="key" title="For integrators">
              <p>Compute aggregate-spot NAV (§2) and apply no factor.</p>
            </Callout>
          </DocSection>

          {/* 8 */}
          <DocSection id="gotchas" n="08" title="Gotchas checklist">
            <Checklist
              items={[
                <span>Index is 18 decimals; <IC>dstable</IC> is 6; constituents vary — read per-entry <IC>decimals</IC>.</span>,
                <span>Denominator is <IC>effectiveSupply()</IC>, not <IC>totalSupply()</IC>.</span>,
                <span>Held amount is <IC>totalHeld(asset)</IC>, not <IC>balanceOf</IC>.</span>,
                <span>Publish <strong className="text-ink">aggregate-spot NAV</strong>; apply <strong className="text-ink">no</strong> dstable/ETH factor (§7).</span>,
                <span>Never price the index from its own self-pool.</span>,
                <span>Don&rsquo;t use <IC>exchangeRate()</IC> (reverts for V3/V2 indexes; spot-priced).</span>,
                <span>Weights from <IC>basket()</IC> are <em className="not-italic text-ink">targets</em> in BPS; compute live weights from value.</span>,
                <span>Handle unpriced/illiquid constituents gracefully; report price coverage.</span>,
                <span><IC>dstable</IC> constituent = $1 (don&rsquo;t try to price it via a pool).</span>,
              ]}
            />
          </DocSection>

          {/* 9 */}
          <DocSection id="versioning" n="09" title="Versioning note (forward compatibility)">
            <p>A forthcoming release adds USDC-paired constituents. Two changes integrators should anticipate:</p>
            <ul className="space-y-2.5">
              <li className="flex gap-2"><span className="text-cyan">·</span><span>The <IC>basket(i)</IC> tuple gains a <IC>pair</IC> field (<IC>enum {'{ ETH, USDC }'}</IC>) after <IC>venue</IC>. Decode defensively / version your ABI; older indexes won&rsquo;t have it.</span></li>
              <li className="flex gap-2"><span className="text-cyan">·</span><span><IC>exchangeRate()</IC> / <IC>totalReserveDstable()</IC> will additionally price USDC and dstable-buffer entries (still spot-priced — the §2 method remains recommended).</span></li>
            </ul>
            <p>Neither affects the §2 reconstruction, which is why it&rsquo;s the integration path we support.</p>
          </DocSection>

          {/* 10 */}
          <DocSection id="reference" n="10" title="Quick reference">
            <Table
              head={['Read (on the index token)', 'Signature']}
              rows={[
                ['Token metadata', <IC>name() / symbol() / decimals() / totalSupply()</IC>],
                ['Redeemable supply', <IC>effectiveSupply() returns (uint256)</IC>],
                ['Basket size', <IC>basketLength() returns (uint256)</IC>],
                ['Basket entry', <IC>basket(uint256) returns (… weight, decimals)</IC>],
                ['Held amount', <IC>totalHeld(address asset) returns (uint256)</IC>],
                ['On-chain NAV (avoid)', <span><IC>exchangeRate() / totalReserveDstable()</IC> — revert for V3/V2 indexes</span>],
              ]}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <AddressGroup chain="Base · 8453" addr={BASE_ADDR} />
              <AddressGroup chain="Ethereum · 1" addr={ETH_ADDR} />
            </div>
            <p className="border-t border-white/10 pt-5 text-[12px] leading-relaxed text-ink-faint">
              △ <span className="text-ink-dim">SPECTRUM</span> · onchain index tokens · Base &amp; Ethereum. This
              page defines the canonical valuation method (aggregate-spot NAV). Many assets, one token.
            </p>
          </DocSection>
        </article>
      </div>
    </div>
  )
}
