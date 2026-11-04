import { cn } from 'cn'

/** Framework tile icons. */
const PATHS = {
  layers: ['M12 2 2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5M2 12l10 5 10-5'],
  globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 3v18M3 12h18'],
  check: ['M5 12l5 5L20 7'],
  compass: ['M3 12h18M12 3v18', 'M7 7l10 10M17 7L7 17'],
  heart: ['M12 21c-4-3-8-6.5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 4.5-4 8-10 11z'],
} as const

export type FrameworkIconName = keyof typeof PATHS

/** Sage icon tile: 44px in the gallery, 32px in headers. */
export function FrameworkIcon({
  name,
  size = 44,
  className,
}: {
  name: FrameworkIconName
  size?: number
  className?: string
}) {
  const icon = Math.round(size * 0.48)
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center bg-sage-100 text-sage-700',
        className,
      )}
      style={{ width: size, height: size, borderRadius: size >= 40 ? 12 : 9 }}
    >
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {PATHS[name].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  )
}
