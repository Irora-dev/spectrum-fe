// The SPECTRUM logo: the word itself, with a band of spectral light sweeping
// through the letters (see `.spectrum-wordmark` in index.css).
export function SpectrumWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`spectrum-wordmark font-display font-bold uppercase ${className}`}>Spectrum</span>
  )
}
