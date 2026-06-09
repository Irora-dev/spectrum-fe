// Studio — render Spectrum-branded X assets to <canvas> at export resolution.
// Layer-composited so the page can drag / resize / rotate each element. No deps.

export const AVATAR = 400 // X profile photo (square, shown circular)
export const BANNER_W = 1500 // X header
export const BANNER_H = 500 // 3:1

const C = {
  void: '#07070b', panel: '#0c0c12', ink: '#e8e8f0', inkDim: '#a7a8bb', inkFaint: '#6b6c80',
  cyan: '#35e0ff', magenta: '#ff4db8', amber: '#ff9248', violet: '#7b5cff', teal: '#34d6c4',
} as const
const SPECTRAL = ['#ff9248', '#ff4db8', '#7b5cff', '#35e0ff', '#34d6c4']

export type BgStyle = 'void' | 'aurora' | 'curtain' | 'grid' | 'spectral' | 'glow'
export type Accent = 'spectral' | 'cyan' | 'magenta' | 'amber' | 'violet' | 'teal'

export interface StudioOpts {
  bg: BgStyle
  accent: Accent
  grid: boolean
  curtainAngle: number // rotates the curtain background
  spectralText: boolean // spectral fill for the wordmark
}
export const DEFAULTS: StudioOpts = { bg: 'curtain', accent: 'spectral', grid: true, curtainAngle: 0, spectralText: false }

// ── layer model ──────────────────────────────────────────────────────────────
export type LayerStyle = 'wordmark' | 'display' | 'mono'
export interface Layer {
  id: string
  kind: 'prism' | 'text'
  label: string
  text?: string
  style?: LayerStyle
  x: number // normalised centre (0..1)
  y: number
  scale: number // 1 = base size
  rot: number // degrees
  visible: boolean
}
export interface HitBox { cx: number; cy: number; hw: number; hh: number; rot: number }

let _seq = 0
const uid = (p: string) => `${p}-${++_seq}`

export function defaultAvatarLayers(): Layer[] {
  return [
    { id: uid('prism'), kind: 'prism', label: 'Prism', x: 0.5, y: 0.4, scale: 1, rot: 0, visible: true },
    { id: uid('word'), kind: 'text', style: 'wordmark', label: 'Wordmark', x: 0.5, y: 0.7, scale: 1, rot: 0, visible: true },
    { id: uid('handle'), kind: 'text', style: 'mono', label: 'Handle', text: '@spectrum', x: 0.5, y: 0.86, scale: 1, rot: 0, visible: true },
  ]
}
export function defaultBannerLayers(): Layer[] {
  return [
    { id: uid('prism'), kind: 'prism', label: 'Prism', x: 0.1, y: 0.42, scale: 0.95, rot: 0, visible: true },
    { id: uid('word'), kind: 'text', style: 'wordmark', label: 'Wordmark', x: 0.31, y: 0.42, scale: 0.95, rot: 0, visible: true },
    { id: uid('head'), kind: 'text', style: 'display', label: 'Headline', text: 'Onchain index tokens', x: 0.27, y: 0.64, scale: 1, rot: 0, visible: true },
    { id: uid('sub'), kind: 'text', style: 'mono', label: 'Subline', text: 'Many assets. One token.', x: 0.22, y: 0.78, scale: 1, rot: 0, visible: true },
    { id: uid('rail'), kind: 'text', style: 'mono', label: 'Rail', text: 'CAPTURE · LAUNCH · SETTLE', x: 0.82, y: 0.12, scale: 0.8, rot: 0, visible: true },
  ]
}
export function newTextLayer(): Layer {
  return { id: uid('text'), kind: 'text', style: 'mono', label: 'Text', text: 'New text', x: 0.5, y: 0.5, scale: 1, rot: 0, visible: true }
}

type Ctx = CanvasRenderingContext2D
const accentColor = (a: Accent): string => (a === 'spectral' ? C.cyan : C[a])
function spectralGrad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  SPECTRAL.forEach((c, i) => g.addColorStop(i / (SPECTRAL.length - 1), c))
  return g
}
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// ── backgrounds ──────────────────────────────────────────────────────────────
function paintVoid(ctx: Ctx, w: number, h: number) { ctx.fillStyle = C.void; ctx.fillRect(0, 0, w, h) }
function paintGrid(ctx: Ctx, w: number, h: number, step = 34) {
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
  for (let x = step; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke() }
  for (let y = step; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke() }
  ctx.restore()
}
function radialBlob(ctx: Ctx, cx: number, cy: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  g.addColorStop(0, hexA(color, alpha)); g.addColorStop(1, hexA(color, 0))
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
}
function paintAurora(ctx: Ctx, w: number, h: number) {
  radialBlob(ctx, w * 0.2, h * 0.3, Math.max(w, h) * 0.5, C.cyan, 0.16)
  radialBlob(ctx, w * 0.78, h * 0.6, Math.max(w, h) * 0.5, C.magenta, 0.15)
  radialBlob(ctx, w * 0.5, h, Math.max(w, h) * 0.55, C.violet, 0.18)
}
function paintGlow(ctx: Ctx, w: number, h: number, a: Accent) {
  radialBlob(ctx, w * 0.5, h * 0.46, Math.max(w, h) * 0.55, accentColor(a), 0.22)
  if (a === 'spectral') radialBlob(ctx, w * 0.5, h * 0.46, Math.max(w, h) * 0.4, C.violet, 0.14)
}
function paintSpectralWash(ctx: Ctx, w: number, h: number) {
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = spectralGrad(ctx, 0, 0, w, h); ctx.fillRect(0, 0, w, h); ctx.restore()
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7)
  g.addColorStop(0, 'rgba(7,7,11,0.45)'); g.addColorStop(1, 'rgba(7,7,11,0.86)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
}

// detailed edge-spectrum curtain — port of the app's WebGL shader
function hash2(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s) }
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  const ux = xf * xf * (3 - 2 * xf), uy = yf * yf * (3 - 2 * yf)
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy
}
function ss(e0: number, e1: number, x: number) { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
function paintCurtainDetailed(ctx: Ctx, w: number, h: number, angle = 0) {
  const a = ((angle % 360) + 360) % 360
  const img = ctx.createImageData(w, h)
  const D = img.data
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let u: number, p: number
      if (a === 0) { u = px / w; p = py / h }
      else if (a === 90) { u = py / h; p = px / w }
      else if (a === 180) { u = 1 - px / w; p = py / h }
      else { u = 1 - py / h; p = px / w }
      const bu = u / 2.4
      let cr = 0, cg = 0, cb = 0
      let s = ss(0.004, 0.03, bu) * (1 - ss(0.025, 0.07, bu)); cg += 0.94 * s; cb += 1.0 * s
      s = ss(0.015, 0.05, bu) * (1 - ss(0.045, 0.1, bu)); cr += 1.0 * s; cb += 0.7 * s
      s = ss(0.04, 0.08, bu) * (1 - ss(0.075, 0.13, bu)); cr += 1.0 * s; cg += 0.5 * s
      const bc = vnoise(u * 320, p * 1.6)
      const flow = 0.62 + 0.38 * Math.sin(p * 5.0)
      const inten = 1.7 * (0.32 + 0.68 * bc) * flow
      cr *= inten; cg *= inten; cb *= inten
      const vf = 0.5 + 0.5 * Math.sin(p * Math.PI)
      cr *= vf; cg *= vf; cb *= vf
      const mask = 1 - ss(0.108, 0.27, bu)
      let r = 0.086 * mask * 0.7 + cr * mask
      let g = 0.07 * mask * 0.7 + cg * mask
      let b = 0.141 * mask * 0.7 + cb * mask
      const grain = hash2(px * 0.37 + 1.3, py * 0.51 + 2.7)
      const gx = (grain - 0.5) * 0.05 * mask + grain * 0.012
      r += gx; g += gx; b += gx
      const o = (py * w + px) * 4
      D[o] = Math.max(0, Math.min(255, r * 255))
      D[o + 1] = Math.max(0, Math.min(255, g * 255))
      D[o + 2] = Math.max(0, Math.min(255, b * 255))
      D[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

/** Paint the background (curtain / aurora / grid / …) onto ctx. */
export function paintBg(ctx: Ctx, w: number, h: number, o: StudioOpts) {
  paintVoid(ctx, w, h)
  if (o.bg === 'aurora') paintAurora(ctx, w, h)
  else if (o.bg === 'glow') paintGlow(ctx, w, h, o.accent)
  else if (o.bg === 'spectral') paintSpectralWash(ctx, w, h)
  else if (o.bg === 'curtain') paintCurtainDetailed(ctx, w, h, o.curtainAngle)
  if (o.grid) paintGrid(ctx, w, h)
}

// ── prism mark ───────────────────────────────────────────────────────────────
function specColor(t: number): string {
  const s = Math.max(0, Math.min(1, t)) * (SPECTRAL.length - 1)
  const i = Math.min(SPECTRAL.length - 2, Math.floor(s)), f = s - i
  const a = parseInt(SPECTRAL[i].slice(1), 16), b = parseInt(SPECTRAL[i + 1].slice(1), 16)
  const ch = (sh: number) => Math.round(((a >> sh) & 255) + ((((b >> sh) & 255) - ((a >> sh) & 255)) * f))
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}
const lerpPt = (x0: number, y0: number, x1: number, y1: number, t: number): [number, number] => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]

function drawPrism(ctx: Ctx, cx: number, cy: number, size: number) {
  const hw = size * 0.55, top = cy - size * 0.5, bot = cy + size * 0.5
  const tri = () => { ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + hw, bot); ctx.lineTo(cx - hw, bot); ctx.closePath() }
  ctx.save(); tri(); ctx.fillStyle = 'rgba(9,9,15,0.9)'; ctx.fill(); ctx.restore()
  ctx.save(); tri(); ctx.clip()
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'
  const ccx = cx - hw, ccy = bot, bx = cx + hw, by = bot, ax = cx, ay = top
  const targets: [number, number][] = [
    lerpPt(ccx, ccy, bx, by, 0.12), lerpPt(ccx, ccy, bx, by, 0.32), lerpPt(ccx, ccy, bx, by, 0.5), lerpPt(ccx, ccy, bx, by, 0.68), lerpPt(ccx, ccy, bx, by, 0.88),
    lerpPt(ax, ay, bx, by, 0.55), lerpPt(ax, ay, bx, by, 0.82),
    lerpPt(ax, ay, ccx, ccy, 0.55), lerpPt(ax, ay, ccx, ccy, 0.82),
  ]
  const center: [number, number] = [cx, cy - size * 0.04]
  for (const [tx, ty] of targets) {
    ctx.strokeStyle = specColor((tx - ccx) / (2 * hw))
    ctx.lineWidth = Math.max(1.5, size * 0.028)
    ctx.beginPath(); ctx.moveTo(center[0], center[1]); ctx.lineTo(tx, ty); ctx.stroke()
  }
  ctx.restore()
  ctx.save(); tri(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.25, size * 0.034); ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore()
}

// ── layers ───────────────────────────────────────────────────────────────────
function textFont(style: LayerStyle, fs: number) {
  return style === 'mono' ? `500 ${fs}px "JetBrains Mono", monospace` : `700 ${fs}px "Chakra Petch", system-ui, sans-serif`
}
/** Draw one layer at its transform; returns its on-canvas hit box. */
export function drawLayer(ctx: Ctx, layer: Layer, o: StudioOpts, W: number, H: number): HitBox {
  const cx = layer.x * W, cy = layer.y * H
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((layer.rot * Math.PI) / 180)
  let hw = 0, hh = 0
  if (layer.kind === 'prism') {
    const size = H * 0.3 * layer.scale
    drawPrism(ctx, 0, 0, size)
    hw = size * 0.55; hh = size * 0.5
  } else if (layer.style === 'wordmark') {
    const fs = H * 0.13 * layer.scale
    ctx.font = `700 ${fs}px "Chakra Petch", system-ui, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = `${fs * 0.04}px`
    const wd = ctx.measureText('SPECTRUM').width
    ctx.fillStyle = o.spectralText ? spectralGrad(ctx, -wd / 2, 0, wd / 2, 0) : C.ink
    ctx.fillText('SPECTRUM', 0, 0)
    hw = wd / 2; hh = fs * 0.55
  } else {
    const fs = (layer.style === 'display' ? H * 0.08 : H * 0.04) * layer.scale
    const text = layer.text ?? ''
    ctx.font = textFont(layer.style ?? 'mono', fs)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.letterSpacing = layer.style === 'mono' ? `${fs * 0.12}px` : '0px'
    ctx.fillStyle = layer.style === 'display' ? C.ink : C.inkDim
    ctx.fillText(text, 0, 0)
    hw = ctx.measureText(text).width / 2; hh = fs * 0.62
  }
  ctx.restore()
  return { cx, cy, hw: Math.max(hw, 6), hh: Math.max(hh, 6), rot: layer.rot }
}

/** Is (px,py) inside the (rotated) hit box? */
export function hitTest(box: HitBox, px: number, py: number, pad = 0) {
  const dx = px - box.cx, dy = py - box.cy
  const r = (-box.rot * Math.PI) / 180
  const lx = dx * Math.cos(r) - dy * Math.sin(r)
  const ly = dx * Math.sin(r) + dy * Math.cos(r)
  return Math.abs(lx) <= box.hw + pad && Math.abs(ly) <= box.hh + pad
}

/** Draw a selection outline around a hit box (screen-space lineWidth via inv). */
export function drawSelection(ctx: Ctx, box: HitBox, scale = 1) {
  ctx.save()
  ctx.translate(box.cx, box.cy)
  ctx.rotate((box.rot * Math.PI) / 180)
  ctx.strokeStyle = '#35e0ff'
  ctx.lineWidth = 2 / scale
  ctx.setLineDash([8 / scale, 5 / scale])
  const p = 8
  ctx.strokeRect(-box.hw - p, -box.hh - p, (box.hw + p) * 2, (box.hh + p) * 2)
  ctx.restore()
}

// ── export helpers ───────────────────────────────────────────────────────────
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
}
export async function copyCanvas(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('no blob'))), 'image/png'))
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch { return false }
}
