import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AVATAR, BANNER_W, BANNER_H, DEFAULTS, paintBg, drawLayer, drawSelection, hitTest,
  defaultAvatarLayers, defaultBannerLayers, newTextLayer, downloadCanvas, copyCanvas,
  type Accent, type BgStyle, type Layer, type HitBox, type StudioOpts,
} from '../lib/studio/render'

type Asset = 'avatar' | 'banner'
const BGS: { id: BgStyle; label: string }[] = [
  { id: 'curtain', label: 'Curtain' }, { id: 'spectral', label: 'Spectral' }, { id: 'aurora', label: 'Aurora' },
  { id: 'glow', label: 'Glow' }, { id: 'grid', label: 'Grid' }, { id: 'void', label: 'Void' },
]
const ACCENTS: { id: Accent; sw: string }[] = [
  { id: 'spectral', sw: 'linear-gradient(90deg,#ff9248,#ff4db8,#7b5cff,#35e0ff,#34d6c4)' },
  { id: 'cyan', sw: '#35e0ff' }, { id: 'magenta', sw: '#ff4db8' }, { id: 'amber', sw: '#ff9248' },
  { id: 'violet', sw: '#7b5cff' }, { id: 'teal', sw: '#34d6c4' },
]

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors ${active ? 'border-cyan/70 text-cyan' : 'border-white/12 text-ink-dim hover:border-white/30 hover:text-ink'}`}>
      {children}
    </button>
  )
}
function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint"><span>{label}</span><span className="text-ink-dim">{value.toFixed(step < 1 ? 2 : 0)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-cyan" />
    </label>
  )
}

export function Studio() {
  const [o, setO] = useState<StudioOpts>(DEFAULTS)
  const [ready, setReady] = useState(false)
  const [avatarLayers, setAvatarLayers] = useState<Layer[]>(defaultAvatarLayers)
  const [bannerLayers, setBannerLayers] = useState<Layer[]>(defaultBannerLayers)
  const [active, setActive] = useState<Asset>('avatar')
  const [sel, setSel] = useState<string | 'bg' | null>(null)

  const avatarRef = useRef<HTMLCanvasElement>(null)
  const bannerRef = useRef<HTMLCanvasElement>(null)
  const avatarBg = useRef<HTMLCanvasElement | null>(null)
  const bannerBg = useRef<HTMLCanvasElement | null>(null)
  const bgKey = useRef('')
  const avatarHits = useRef<({ id: string; box: HitBox } | null)[]>([])
  const bannerHits = useRef<({ id: string; box: HitBox } | null)[]>([])
  const drag = useRef<{ asset: Asset; id: string; gdx: number; gdy: number } | null>(null)

  const setOpt = <K extends keyof StudioOpts>(k: K, v: StudioOpts[K]) => setO((p) => ({ ...p, [k]: v }))
  const layersOf = (a: Asset) => (a === 'avatar' ? avatarLayers : bannerLayers)
  const setLayersOf = (a: Asset, fn: (l: Layer[]) => Layer[]) => (a === 'avatar' ? setAvatarLayers(fn) : setBannerLayers(fn))
  const dims = (a: Asset) => (a === 'avatar' ? [AVATAR, AVATAR] : [BANNER_W, BANNER_H]) as [number, number]

  useEffect(() => {
    let alive = true
    Promise.all([
      (document as any).fonts?.load?.('700 64px "Chakra Petch"'),
      (document as any).fonts?.load?.('500 18px "JetBrains Mono"'),
      (document as any).fonts?.ready,
    ]).finally(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [])

  function ensureBg() {
    const key = `${o.bg}|${o.accent}|${o.grid}|${o.curtainAngle}`
    if (key === bgKey.current && avatarBg.current && bannerBg.current) return
    bgKey.current = key
    const a = avatarBg.current ?? (avatarBg.current = document.createElement('canvas'))
    a.width = AVATAR; a.height = AVATAR; paintBg(a.getContext('2d')!, AVATAR, AVATAR, o)
    const b = bannerBg.current ?? (bannerBg.current = document.createElement('canvas'))
    b.width = BANNER_W; b.height = BANNER_H; paintBg(b.getContext('2d')!, BANNER_W, BANNER_H, o)
  }

  function composite(a: Asset, withSel: boolean) {
    const canvas = a === 'avatar' ? avatarRef.current : bannerRef.current
    const bg = a === 'avatar' ? avatarBg.current : bannerBg.current
    if (!canvas || !bg) return
    const [W, H] = dims(a)
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bg, 0, 0)
    const hits = a === 'avatar' ? avatarHits : bannerHits
    hits.current = []
    for (const L of layersOf(a)) {
      if (!L.visible) { hits.current.push(null); continue }
      hits.current.push({ id: L.id, box: drawLayer(ctx, L, o, W, H) })
    }
    if (withSel && active === a && sel && sel !== 'bg') {
      const h = hits.current.find((x) => x && x.id === sel)
      if (h) drawSelection(ctx, h.box, (canvas.clientWidth || W * 0.5) / W)
    }
  }

  useEffect(() => {
    if (!ready) return
    ensureBg()
    composite('avatar', true)
    composite('banner', true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o, avatarLayers, bannerLayers, sel, active, ready])

  function pointer(a: Asset, e: React.PointerEvent<HTMLCanvasElement>, kind: 'down' | 'move' | 'up') {
    const canvas = a === 'avatar' ? avatarRef.current! : bannerRef.current!
    const [W, H] = dims(a)
    const rect = canvas.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    if (kind === 'down') {
      const hits = (a === 'avatar' ? avatarHits : bannerHits).current
      let found: string | null = null
      for (let i = hits.length - 1; i >= 0; i--) {
        const h = hits[i]
        if (h && hitTest(h.box, nx * W, ny * H, 8)) { found = h.id; break }
      }
      setActive(a); setSel(found)
      if (found) {
        const L = layersOf(a).find((l) => l.id === found)!
        drag.current = { asset: a, id: found, gdx: L.x - nx, gdy: L.y - ny }
        canvas.setPointerCapture(e.pointerId)
      }
    } else if (kind === 'move') {
      const d = drag.current
      if (!d || d.asset !== a) return
      const x = Math.max(0, Math.min(1, nx + d.gdx))
      const y = Math.max(0, Math.min(1, ny + d.gdy))
      setLayersOf(a, (ls) => ls.map((l) => (l.id === d.id ? { ...l, x, y } : l)))
    } else {
      drag.current = null
    }
  }

  const patch = (a: Asset, id: string, p: Partial<Layer>) => setLayersOf(a, (ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)))
  const reorder = (a: Asset, id: string, dir: -1 | 1) => setLayersOf(a, (ls) => {
    const i = ls.findIndex((l) => l.id === id); const j = i + dir
    if (i < 0 || j < 0 || j >= ls.length) return ls
    const copy = ls.slice(); [copy[i], copy[j]] = [copy[j], copy[i]]; return copy
  })
  const del = (a: Asset, id: string) => { setLayersOf(a, (ls) => ls.filter((l) => l.id !== id)); setSel(null) }
  const addText = () => { const L = newTextLayer(); setLayersOf(active, (ls) => [...ls, L]); setSel(L.id) }

  async function exportAsset(a: Asset, mode: 'download' | 'copy') {
    composite(a, false)
    const canvas = a === 'avatar' ? avatarRef.current! : bannerRef.current!
    if (mode === 'download') downloadCanvas(canvas, `spectrum-x-${a}.png`)
    else await copyCanvas(canvas)
    composite(a, true)
  }

  const layers = layersOf(active)
  const selLayer = sel && sel !== 'bg' ? layers.find((l) => l.id === sel) : null

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-6">
      <header>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">Studio · internal</div>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">Brand assets</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-dim">
          A layer editor for X assets. Drag elements right on the canvas; select a layer to resize / rotate; toggle, reorder,
          add text, and pick the background. Exports the full-res PNG.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ── editor panel ─────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* asset toggle */}
          <div className="flex gap-2">
            {(['avatar', 'banner'] as Asset[]).map((a) => (
              <button key={a} type="button" onClick={() => { setActive(a); setSel(null) }}
                className={`flex-1 rounded-lg border px-3 py-2 font-mono text-[11px] uppercase tracking-wide transition-colors ${active === a ? 'border-cyan/70 text-cyan' : 'border-white/12 text-ink-dim hover:border-white/30'}`}>
                {a === 'avatar' ? 'Profile' : 'Banner'}
              </button>
            ))}
          </div>

          {/* layers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">Layers</span>
              <button type="button" onClick={addText} className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan hover:text-ink">+ Text</button>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/10">
              {/* background row */}
              <button type="button" onClick={() => setSel('bg')}
                className={`flex w-full items-center gap-2 border-b border-white/8 px-3 py-2 text-left transition-colors ${sel === 'bg' ? 'bg-cyan/10' : 'hover:bg-white/[0.03]'}`}>
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'linear-gradient(90deg,#35e0ff,#ff4db8,#ff9248)' }} />
                <span className="font-mono text-[11px] text-ink-dim">Background · {o.bg}</span>
              </button>
              {[...layers].reverse().map((L) => (
                <div key={L.id} className={`flex items-center gap-2 border-b border-white/8 px-2 py-1.5 last:border-0 ${sel === L.id ? 'bg-cyan/10' : 'hover:bg-white/[0.03]'}`}>
                  <button type="button" aria-label="toggle" onClick={() => patch(active, L.id, { visible: !L.visible })} className={`grid h-5 w-5 shrink-0 place-items-center rounded ${L.visible ? 'text-cyan' : 'text-ink-faint'}`}>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">{L.visible ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="2.5" /></> : <path d="M4 4l16 16M9.5 9.6A2.5 2.5 0 0014 12M6.7 6.8C3.9 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1M10 5.1c.7-.1 1.3-.1 2-.1 6.5 0 10 7 10 7a16 16 0 01-2.3 3" />}</svg>
                  </button>
                  <button type="button" onClick={() => setSel(L.id)} className="flex-1 truncate text-left font-mono text-[11px] text-ink-dim">{L.label}</button>
                  <button type="button" aria-label="up" onClick={() => reorder(active, L.id, 1)} className="px-1 text-ink-faint hover:text-ink">↑</button>
                  <button type="button" aria-label="down" onClick={() => reorder(active, L.id, -1)} className="px-1 text-ink-faint hover:text-ink">↓</button>
                  {L.kind === 'text' && <button type="button" aria-label="delete" onClick={() => del(active, L.id)} className="px-1 text-ink-faint hover:text-magenta">✕</button>}
                </div>
              ))}
            </div>
          </div>

          {/* selected controls */}
          <div className="space-y-3 rounded-xl border border-white/10 p-3">
            {sel === 'bg' ? (
              <>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">Background</div>
                <div className="flex flex-wrap gap-2">{BGS.map((b) => <Chip key={b.id} active={o.bg === b.id} onClick={() => setOpt('bg', b.id)}>{b.label}</Chip>)}</div>
                {o.bg === 'curtain' && <div className="flex flex-wrap gap-2">{[0, 90, 180, 270].map((deg) => <Chip key={deg} active={o.curtainAngle === deg} onClick={() => setOpt('curtainAngle', deg)}>{deg}°</Chip>)}</div>}
                <div className="flex items-center gap-2">
                  {ACCENTS.map((a) => <button key={a.id} type="button" aria-label={a.id} onClick={() => setOpt('accent', a.id)} className={`h-7 w-7 rounded-full border-2 ${o.accent === a.id ? 'border-white' : 'border-white/20'}`} style={{ background: a.sw }} />)}
                </div>
                <Chip active={o.grid} onClick={() => setOpt('grid', !o.grid)}>Grid {o.grid ? 'on' : 'off'}</Chip>
              </>
            ) : selLayer ? (
              <>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">{selLayer.label}</div>
                {selLayer.kind === 'text' && selLayer.style !== 'wordmark' && (
                  <input value={selLayer.text ?? ''} onChange={(e) => patch(active, selLayer.id, { text: e.target.value })} placeholder="Text"
                    className="w-full rounded-lg border border-white/12 bg-black/30 px-3 py-2 text-sm text-ink outline-none focus:border-cyan/60" />
                )}
                {selLayer.style === 'wordmark' && <Chip active={o.spectralText} onClick={() => setOpt('spectralText', !o.spectralText)}>Spectral fill {o.spectralText ? 'on' : 'off'}</Chip>}
                <Slider label="Size" value={selLayer.scale} min={0.3} max={3} step={0.01} onChange={(v) => patch(active, selLayer.id, { scale: v })} />
                <Slider label="Rotation" value={selLayer.rot} min={-180} max={180} step={1} onChange={(v) => patch(active, selLayer.id, { rot: v })} />
              </>
            ) : (
              <div className="font-mono text-[11px] text-ink-faint">Click a layer (or drag one on the canvas) to edit it.</div>
            )}
          </div>

          <button type="button" onClick={() => { setO(DEFAULTS); setAvatarLayers(defaultAvatarLayers()); setBannerLayers(defaultBannerLayers()); setSel(null) }}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint underline-offset-4 hover:text-ink hover:underline">Reset all</button>
        </div>

        {/* ── canvases ─────────────────────────────────────────────── */}
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink">Profile photo</h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">400 × 400 · drag to arrange · X crops to a circle</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => exportAsset('avatar', 'download')} className="rounded-lg bg-cyan px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-void hover:scale-[1.03]">Download</button>
                <button type="button" onClick={() => exportAsset('avatar', 'copy')} className="rounded-lg border border-white/20 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink hover:border-cyan hover:text-cyan">Copy</button>
              </div>
            </div>
            <div className="relative w-[280px]">
              <canvas ref={avatarRef} width={AVATAR} height={AVATAR} className="block w-[280px] cursor-move touch-none rounded-2xl border border-white/10"
                onPointerDown={(e) => pointer('avatar', e, 'down')} onPointerMove={(e) => pointer('avatar', e, 'move')} onPointerUp={(e) => pointer('avatar', e, 'up')} />
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/25" />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink">Header / banner</h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">1500 × 500 · drag to arrange · keep art clear of the lower-left</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => exportAsset('banner', 'download')} className="rounded-lg bg-cyan px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-void hover:scale-[1.03]">Download</button>
                <button type="button" onClick={() => exportAsset('banner', 'copy')} className="rounded-lg border border-white/20 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink hover:border-cyan hover:text-cyan">Copy</button>
              </div>
            </div>
            <div className="relative max-w-[720px] overflow-hidden rounded-2xl border border-white/10">
              <canvas ref={bannerRef} width={BANNER_W} height={BANNER_H} className="block w-full cursor-move touch-none"
                onPointerDown={(e) => pointer('banner', e, 'down')} onPointerMove={(e) => pointer('banner', e, 'move')} onPointerUp={(e) => pointer('banner', e, 'up')} />
            </div>
          </section>

          {!ready && <p className="font-mono text-[11px] text-ink-faint">Loading typefaces…</p>}
        </div>
      </div>
    </div>
  )
}
