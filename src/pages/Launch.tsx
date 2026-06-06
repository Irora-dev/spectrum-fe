import { IndexBuilder } from '../components/launch/IndexBuilder'

export function Launch() {
  return (
    <div className="space-y-8">
      <header className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
        <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight text-white sm:text-6xl">
          Launch an index
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-ink-dim sm:text-right">
          Pick a basket of tokens, weight it, and see how it would have performed — then deploy one
          tradeable index token. Buyers mint straight into the pool, and you earn from the volume,
          not a management fee.
        </p>
      </header>
      <IndexBuilder />
    </div>
  )
}
