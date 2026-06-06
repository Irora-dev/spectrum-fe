/** Dark-Side-of-the-Moon prism: white beam in, spectrum out. */
export function PrismMark({
  className = '',
  size = 32,
}: {
  className?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      aria-hidden
    >
      {/* incoming white beam hitting the left face */}
      <line x1="2" y1="22" x2="16" y2="22" stroke="#e8e8f0" strokeWidth="1.6" />
      {/* prism */}
      <path
        d="M24 9 L40 37 L8 37 Z"
        stroke="#e8e8f0"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* refracted spectrum fanning out the right face */}
      <line x1="30" y1="21" x2="47" y2="12" stroke="#ff3b52" strokeWidth="1.3" />
      <line x1="30" y1="21" x2="47" y2="17" stroke="#ffb13b" strokeWidth="1.3" />
      <line x1="30" y1="21" x2="47" y2="22" stroke="#34d6c4" strokeWidth="1.3" />
      <line x1="30" y1="21" x2="47" y2="27" stroke="#7b5cff" strokeWidth="1.3" />
    </svg>
  )
}
