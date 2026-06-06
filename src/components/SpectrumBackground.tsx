import { useEffect, useRef } from 'react'
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three'

// Tuned values (from the in-prototype OPTICS·TUNE panel). Edge-spectrum curtains
// on the left/right margins fading to pure black through the center.
const SETTINGS: Record<string, number> = {
  uIntensity: 1.6,
  uBandWidth: 0.27,
  uFlowAmount: 0.43,
  uFlowSpeed: 0.76,
  uTwinkle: 0.3,
  uUndulation: 0.36,
  uUndSpeed: 0.12,
  uBreathe: 0.05,
  uGrain: 0.145,
  uCore: 0,
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
`

const fragmentShader = /* glsl */ `
  uniform float uTime, uIntensity, uBandWidth, uFlowAmount, uFlowSpeed, uTwinkle, uUndulation, uUndSpeed, uBreathe, uGrain, uCore;
  varying vec2 vUv;
  float random(vec2 st){ return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
  float noise(in vec2 st){
    vec2 i = floor(st); vec2 f = fract(st);
    float a = random(i); float b = random(i + vec2(1.0,0.0));
    float c = random(i + vec2(0.0,1.0)); float d = random(i + vec2(1.0,1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
  }
  void main(){
    vec2 uv = vUv;
    float edgeDist = min(uv.x, 1.0 - uv.x); // 0 at edges, 0.5 at center

    float core = 1.0 - smoothstep(0.0, 0.008, edgeDist);
    vec3 coreColor = vec3(1.0, 0.92, 0.96) * core * uCore;

    vec3 spectralColor = vec3(0.0);
    spectralColor += vec3(0.0, 0.94, 1.0) * smoothstep(0.004, 0.030, edgeDist) * (1.0 - smoothstep(0.025, 0.070, edgeDist));
    spectralColor += vec3(1.0, 0.0, 0.70) * smoothstep(0.015, 0.050, edgeDist) * (1.0 - smoothstep(0.045, 0.100, edgeDist));
    spectralColor += vec3(1.0, 0.5, 0.0)  * smoothstep(0.040, 0.080, edgeDist) * (1.0 - smoothstep(0.075, 0.130, edgeDist));

    float barcodeNoise = noise(vec2(uv.x * 200.0 + uTime * uTwinkle, uv.y * 0.6));
    spectralColor *= barcodeNoise * uIntensity;

    float flow = (1.0 - uFlowAmount) + uFlowAmount * sin(uv.y * 5.0 - uTime * uFlowSpeed);
    spectralColor *= flow;

    float aurora = (1.0 - uUndulation) + uUndulation * noise(vec2(uv.y * 2.0, uTime * uUndSpeed));
    spectralColor *= aurora;

    float breathe = (1.0 - uBreathe) + uBreathe * sin(uTime * 0.18);
    spectralColor *= breathe; coreColor *= breathe;

    float vertFade = 0.55 + 0.45 * sin(uv.y * 3.1415);
    spectralColor *= vertFade; coreColor *= vertFade;

    float edgeMask = 1.0 - smoothstep(uBandWidth * 0.4, uBandWidth, edgeDist);
    vec3 bgColor = vec3(0.086, 0.070, 0.141) * edgeMask * 0.7;
    vec3 finalColor = bgColor + (coreColor + spectralColor) * edgeMask;

    float grain = random(uv + vec2(uTime * 0.08, uTime * 0.08));
    finalColor -= grain * uGrain * edgeMask;
    finalColor += grain * 0.04 * spectralColor;
    finalColor += grain * 0.012;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

/**
 * Full-viewport animated optics-lab background. Renders behind all content
 * (fixed, -z-10, non-interactive). Honors prefers-reduced-motion by holding a
 * still frame. To re-tune, use the sandbox at /proto/bg.html.
 */
export function SpectrumBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const scene = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const renderer = new WebGLRenderer({ alpha: true, antialias: false })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)

    const uniforms: Record<string, { value: number }> = { uTime: { value: 0 } }
    for (const [k, v] of Object.entries(SETTINGS)) uniforms[k] = { value: v }

    const material = new ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      depthWrite: false,
      depthTest: false,
    })
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    scene.add(mesh)

    // Dev-only handle (debugging / future in-app tune panel).
    if (import.meta.env.DEV) {
      ;(globalThis as Record<string, unknown>).__spectrumBg = { uniforms, renderer, scene, camera }
    }

    const onResize = () => renderer.setSize(window.innerWidth, window.innerHeight)
    window.addEventListener('resize', onResize)

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let raf = 0
    const loop = () => {
      uniforms.uTime.value = reduceMotion ? 0 : (performance.now() - start) / 1000
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      mesh.geometry.dispose()
      material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
      if (import.meta.env.DEV) delete (globalThis as Record<string, unknown>).__spectrumBg
    }
  }, [])

  return <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />
}
