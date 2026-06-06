import { useEffect, useState, type ReactNode } from 'react'

// ── tiny icons ───────────────────────────────────────────────────────────────
function ClipboardIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}
function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }
  return { copied, copy }
}

// ── inline code ──────────────────────────────────────────────────────────────
export function IC({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.84em] text-ink">
      {children}
    </code>
  )
}

// ── copy button ──────────────────────────────────────────────────────────────
export function CopyButton({ text }: { text: string }) {
  const { copied, copy } = useCopy()
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint transition-colors hover:text-cyan"
    >
      {copied ? <CheckIcon className="h-3 w-3 text-cyan" /> : <ClipboardIcon className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ── copyable chip (addresses, short values) ──────────────────────────────────
export function CopyChip({ text, label }: { text: string; label?: string }) {
  const { copied, copy } = useCopy()
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      title={text}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-ink-dim transition-colors hover:border-cyan/50 hover:text-ink"
    >
      <span className="truncate">{label ?? text}</span>
      {copied ? (
        <CheckIcon className="h-3 w-3 shrink-0 text-cyan" />
      ) : (
        <ClipboardIcon className="h-3 w-3 shrink-0 opacity-60" />
      )}
    </button>
  )
}

// ── code block (copy + line-level comment dimming) ───────────────────────────
const COMMENT_RE = /^\s*(\/\/|#|--|\*|\/\*|>)/
export function CodeBlock({ code, title }: { code: string; title?: string }) {
  const lines = code.replace(/\n+$/, '').split('\n')
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#08080d]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {title ?? 'code'}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-[12.5px] leading-[1.7]">
        <code className="font-mono">
          {lines.map((ln, i) => (
            <span
              key={i}
              className={`block whitespace-pre ${COMMENT_RE.test(ln) ? 'text-ink-faint/70' : 'text-ink-dim'}`}
            >
              {ln || ' '}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

// ── callout / admonition ─────────────────────────────────────────────────────
type CalloutVariant = 'note' | 'key' | 'warn' | 'danger'
const CALLOUT: Record<CalloutVariant, { bar: string; chip: string }> = {
  note: { bar: '#35e0ff', chip: 'Note' },
  key: { bar: '#7b5cff', chip: 'Canonical' },
  warn: { bar: '#ff9248', chip: 'Caution' },
  danger: { bar: '#ff3b52', chip: 'Never' },
}
export function Callout({
  variant = 'note',
  title,
  children,
}: {
  variant?: CalloutVariant
  title?: string
  children: ReactNode
}) {
  const v = CALLOUT[variant]
  return (
    <div
      className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
      style={{ borderLeft: `3px solid ${v.bar}` }}
    >
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: v.bar }}>
        {title ?? v.chip}
      </div>
      <div className="mt-1.5 space-y-2 text-[13px] leading-relaxed text-ink-dim">{children}</div>
    </div>
  )
}

// ── section with anchor ──────────────────────────────────────────────────────
export function DocSection({
  id,
  n,
  title,
  children,
}: {
  id: string
  n: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[11px] font-semibold text-cyan">{n}</span>
        <h2 className="font-display text-xl font-bold uppercase tracking-tight text-ink sm:text-2xl">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-dim">{children}</div>
    </section>
  )
}

// ── table ────────────────────────────────────────────────────────────────────
export function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {head.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-faint"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-white/[0.06] last:border-0">
              {r.map((c, ci) => (
                <td key={ci} className="px-3 py-2.5 align-top leading-relaxed text-ink-dim">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── checklist ────────────────────────────────────────────────────────────────
export function Checklist({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-dim">
          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-cyan/40 bg-cyan/10">
            <CheckIcon className="h-2.5 w-2.5 text-cyan" />
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

// ── on-this-page TOC with scrollspy ──────────────────────────────────────────
export function Toc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '')
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    )
    items.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [items])

  return (
    <nav className="hidden lg:block">
      <div className="sticky top-24">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          On this page
        </div>
        <ul className="border-l border-white/10">
          {items.map((it) => (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                className={`-ml-px block border-l py-1 pl-3 text-[12px] transition-colors ${
                  active === it.id
                    ? 'border-cyan text-cyan'
                    : 'border-transparent text-ink-faint hover:text-ink-dim'
                }`}
              >
                {it.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
