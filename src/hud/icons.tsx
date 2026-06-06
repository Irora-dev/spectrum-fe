import type { SVGProps } from 'react'

type IconProps = { className?: string; size?: number }

const base = (size = 16): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})

/** Abstract, logo-free glyphs — stand-ins for token marks. */

export function IconChevrons({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3.5 5l4.5 5 4.5-5" />
      <path d="M5 3l3 3 3-3" opacity="0.5" />
    </svg>
  )
}

export function IconBank({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M2 6l6-3.2L14 6" />
      <path d="M3.2 6.5v5M6.4 6.5v5M9.6 6.5v5M12.8 6.5v5" />
      <path d="M2 13.2h12" />
    </svg>
  )
}

export function IconBot({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="5" width="10" height="7.5" rx="1.6" />
      <path d="M8 2.6V5" />
      <circle cx="8" cy="2.4" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="6" cy="8.6" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8.6" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconPin({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8 14s4.4-4.2 4.4-7A4.4 4.4 0 1 0 3.6 7c0 2.8 4.4 7 4.4 7Z" />
      <circle cx="8" cy="7" r="1.5" />
    </svg>
  )
}

export function IconSpark({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8 2v12M2.6 5l10.8 6M13.4 5L2.6 11" />
    </svg>
  )
}

export function IconHex({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8 2.2l5 2.9v5.8l-5 2.9-5-2.9V5.1z" />
    </svg>
  )
}

export function IconNode({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="8" cy="8" r="2.1" />
      <path d="M8 2.4v2M8 11.6v2M2.4 8h2M11.6 8h2" />
    </svg>
  )
}

export function IconRing({ className, size }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="8" cy="8" r="5.2" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}
