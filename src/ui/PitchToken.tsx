import { cx } from './kit'

const R = 18
const C = 2 * Math.PI * R

export function energyColor(e: number) {
  if (e >= 70) return '#A3E635'
  if (e >= 55) return '#FACC15'
  return '#FB923C'
}

function ratingChip(r: number) {
  if (r >= 7) return 'bg-accent/20 text-accent'
  if (r < 6) return 'bg-warn/22 text-warn'
  return 'bg-line text-ink'
}

/**
 * A player on a pitch: ability inside the circle, energy as the ring,
 * today's rating as a chip next to the name.
 */
export function PitchToken({
  value,
  energy,
  name,
  rating,
  selected,
  yellow,
  injured,
  offPos,
  label,
  onClick,
  x,
  y,
}: {
  value: number
  energy: number
  name: string
  rating?: number
  selected?: boolean
  yellow?: boolean
  injured?: boolean
  offPos?: boolean
  label: string
  onClick: () => void
  x: number
  y: number
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className="absolute flex w-[88px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 border-none bg-transparent p-0"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span
        className="relative block size-[42px] rounded-full transition-shadow"
        style={{ boxShadow: selected ? '0 0 0 3px #FFFFFF, 0 0 14px rgba(255,255,255,0.45)' : 'none' }}
      >
        <svg aria-hidden="true" width="42" height="42" viewBox="0 0 42 42" className="absolute inset-0">
          <circle cx="21" cy="21" r={R} fill="#0B1220" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
          <circle
            cx="21"
            cy="21"
            r={R}
            fill="none"
            stroke={energyColor(energy)}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(C * Math.max(0, Math.min(100, energy))) / 100} ${C}`}
            transform="rotate(-90 21 21)"
          />
        </svg>
        <span className={cx('absolute inset-0 flex items-center justify-center font-display text-[18px] font-bold', offPos ? 'text-caution' : 'text-ink')}>
          {value}
        </span>
        {yellow && <span aria-hidden="true" className="absolute -top-px -right-px h-[11px] w-2 rounded-[1px] bg-caution" />}
        {injured && (
          <span aria-hidden="true" className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-warn text-[11px] leading-none font-bold text-bg">
            +
          </span>
        )}
      </span>
      <span className="flex items-center gap-[3px] rounded-md bg-bg/82 py-px pr-0.5 pl-1.5 whitespace-nowrap">
        <span className={cx('text-[11px] font-semibold', offPos ? 'text-caution' : 'text-ink')}>{name}</span>
        {rating !== undefined && (
          <span className={cx('rounded px-1 font-display text-[12px] font-bold', ratingChip(rating))}>{rating.toFixed(1)}</span>
        )}
      </span>
    </button>
  )
}
