import { IndexBuilder } from '../components/launch/IndexBuilder'

export function Launch() {
  return (
    <div className="space-y-8">
      <header className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-8 backdrop-blur-md sm:px-8 sm:py-9">
        {/* aurora */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-cyan/15 blur-[110px]" />
          <div className="absolute right-0 -top-16 h-56 w-56 rounded-full bg-violet/15 blur-[120px]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-ink-faint">Create an index</div>
            <h1 className="mt-3 font-display text-5xl font-bold leading-[0.95] tracking-tight text-ink sm:text-6xl">
              Launch a Basket
            </h1>
          </div>
          <p className="max-w-md text-pretty text-sm leading-relaxed text-ink-dim sm:text-right sm:text-balance">
            Pick a basket of tokens, weight it, and deploy one tradeable index token. Buyers mint straight into
            the pool, and you earn from the volume, not a management fee.
          </p>
        </div>
      </header>
      <IndexBuilder />
    </div>
  )
}
