/**
 * Icons drawn specifically for JADEN.
 * For generic UI icons use lucide-react.
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 18, strokeWidth = 2, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  }
}

export function JournalIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5a2 2 0 0 1 2-2h9v18H6a2 2 0 0 1-2-2z" />
      <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
    </svg>
  )
}

export function FrameworksIcon(props: IconProps) {
  return (
    <svg {...base({ strokeWidth: 1.75, ...props })}>
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

export function InsightsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
    </svg>
  )
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </svg>
  )
}

export function FlameIcon({ size = 14, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 2c.7 2.7-2.6 4.4-2.6 7.8a2.6 2.6 0 0 0 5.2 0c0-.9-.5-1.6-.5-1.6 1.4.8 2.4 2.6 2.4 4.4A4.5 4.5 0 0 1 12 17.1a4.5 4.5 0 0 1-4.5-4.5C7.5 8 9.5 5.5 12 2z" />
    </svg>
  )
}
