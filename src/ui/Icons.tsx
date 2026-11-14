import type { ReactNode, SVGProps } from 'react'

type IconProps = { size?: number; className?: string; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'children'>

function make(paths: ReactNode, defaults: { fill?: boolean; strokeWidth?: number } = {}) {
  return function Icon({ size = 24, className, strokeWidth, ...rest }: IconProps) {
    return (
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={defaults.fill ? 'currentColor' : 'none'}
        stroke={defaults.fill ? 'none' : 'currentColor'}
        strokeWidth={strokeWidth ?? defaults.strokeWidth ?? 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...rest}
      >
        {paths}
      </svg>
    )
  }
}

export const IconHome = make(
  <>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9v11h13V9" />
    <path d="M10 20v-5.5h4V20" />
  </>,
)

export const IconSquad = make(
  <>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 20c.4-3.5 3-5.5 6.5-5.5s6.1 2 6.5 5.5" />
    <path d="M15.5 5.3a3.3 3.3 0 0 1 0 6.4" />
    <path d="M18 14.8c1.9.7 3.2 2.5 3.5 5.2" />
  </>,
)

export const IconTactics = make(
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    <path d="M3.5 12h17" />
    <circle cx="12" cy="12" r="3" />
  </>,
)

export const IconLeague = make(
  <>
    <path d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0z" />
    <path d="M7.5 6h-3v1a3 3 0 0 0 3 3" />
    <path d="M16.5 6h3v1a3 3 0 0 1-3 3" />
    <path d="M12 13v4" />
    <path d="M8.5 20h7" />
    <path d="M10 17h4v3h-4z" />
  </>,
)

export const IconClub = make(
  <>
    <path d="M4 20V9.5L12 4l8 5.5V20" />
    <path d="M9.5 20v-5h5v5" />
    <path d="M2.5 20h19" />
  </>,
)

export const IconBell = make(
  <>
    <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </>,
)

export const IconChevronRight = make(<path d="M9 5l7 7-7 7" />, { strokeWidth: 2 })
export const IconChevronLeft = make(<path d="M15 5l-7 7 7 7" />, { strokeWidth: 2 })
export const IconChevronDown = make(<path d="M6 9l6 6 6-6" />, { strokeWidth: 2 })
export const IconClose = make(
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </>,
  { strokeWidth: 2 },
)

export const IconPause = make(
  <>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </>,
  { fill: true },
)

export const IconPlay = make(<path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.3-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z" />, { fill: true })

export const IconSkip = make(
  <>
    <path d="M5 5.5v13l9-6.5z" />
    <path d="M18 5v14" />
  </>,
  { strokeWidth: 2 },
)

export const IconSliders = make(
  <>
    <path d="M4 7h9" />
    <path d="M17 7h3" />
    <circle cx="15" cy="7" r="2" />
    <path d="M4 17h3" />
    <path d="M11 17h9" />
    <circle cx="9" cy="17" r="2" />
  </>,
)

export const IconSwap = make(
  <>
    <path d="M7 4v14" />
    <path d="M3.5 14.5 7 18l3.5-3.5" />
    <path d="M17 20V6" />
    <path d="M13.5 9.5 17 6l3.5 3.5" />
  </>,
  { strokeWidth: 2 },
)

export const IconBall = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5l3.2 2.3-1.2 3.7h-4l-1.2-3.7z" />
  </>,
)

export const IconSort = make(
  <>
    <path d="M7 4v16" />
    <path d="M3.5 16.5 7 20l3.5-3.5" />
    <path d="M13 6h8" />
    <path d="M13 11h6" />
    <path d="M13 16h4" />
  </>,
  { strokeWidth: 2 },
)

export const IconMenu = make(
  <>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </>,
  { strokeWidth: 2 },
)

export const IconCheck = make(<path d="M5 12.5l4.5 4.5L19 7.5" />, { strokeWidth: 2.2 })

export const IconPlus = make(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
  { strokeWidth: 2 },
)

export const IconTrash = make(
  <>
    <path d="M4.5 7h15" />
    <path d="M9.5 7V4.5h5V7" />
    <path d="M6.5 7l1 13h9l1-13" />
  </>,
)

export const IconCross = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </>,
)

export const IconWand = make(
  <>
    <path d="M4 20 15 9" />
    <path d="M14 4v3" />
    <path d="M18.5 5.5l-2 2" />
    <path d="M20 10h-3" />
    <path d="M10 4.5l1.5 1.5" />
  </>,
)
