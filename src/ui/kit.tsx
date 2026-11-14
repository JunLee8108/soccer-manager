import { useEffect, type ReactNode } from 'react'
import type { Club, Position } from '../engine/types'
import { LINE_OF } from '../engine/types'
import { IconChevronLeft, IconClose } from './Icons'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function Crest({ club, size = 40 }: { club: Pick<Club, 'name' | 'crest' | 'color'>; size?: number }) {
  return (
    <svg role="img" aria-label={`${club.name} 엠블럼`} width={size} height={size * 1.15} viewBox="0 0 40 46" className="shrink-0">
      <path d="M20 2 4 8v13c0 10 7 18 16 22 9-4 16-12 16-22V8z" fill={club.color} />
      <text x="20" y="28" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0B1220" fontFamily="Barlow Condensed, sans-serif">
        {club.crest}
      </text>
    </svg>
  )
}

export function ClubDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span aria-hidden="true" className="shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
}

const LINE_TONE = {
  GK: 'bg-gk/15 text-gk',
  DF: 'bg-away/15 text-away',
  MF: 'bg-accent/15 text-accent',
  FW: 'bg-fw/15 text-fw',
} as const

export function PosBadge({ pos, className }: { pos: Position; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex w-[38px] shrink-0 items-center justify-center rounded-md py-0.5 font-display text-[14px] font-bold leading-[18px]',
        LINE_TONE[LINE_OF[pos]],
        className,
      )}
    >
      {pos}
    </span>
  )
}

export interface SegOption<T extends string> {
  value: T
  label: ReactNode
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  tone?: 'neutral' | 'accent'
  size?: 'md' | 'sm'
  className?: string
}) {
  const container = tone === 'neutral' ? 'rounded-xl border border-line bg-surface p-1 gap-1' : 'rounded-[11px] bg-bg p-[3px] gap-[3px]'
  return (
    <div role="group" aria-label={label} className={cx('grid', container, className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-[9px] font-semibold transition-colors',
              size === 'md' ? 'h-[38px] text-[14px]' : 'h-[38px] text-[13px]',
              tone === 'neutral'
                ? on
                  ? 'bg-active text-ink'
                  : 'text-muted'
                : on
                  ? 'bg-accent text-bg'
                  : 'text-ink-2',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Card({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={cx('rounded-2xl border border-line bg-surface', className)}>
      {children}
    </section>
  )
}

export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
  backLabel = '뒤로',
}: {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  onBack?: () => void
  backLabel?: string
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 px-4 pt-[18px] pb-3">
      {onBack && (
        <button type="button" aria-label={backLabel} onClick={onBack} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink">
          <IconChevronLeft size={20} />
        </button>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <h1 className="m-0 truncate text-[22px] font-bold">{title}</h1>
        {subtitle && <span className="truncate text-[12px] text-muted">{subtitle}</span>}
      </div>
      {right}
    </header>
  )
}

export function conditionColor(v: number) {
  if (v >= 80) return '#A3E635'
  if (v >= 60) return '#FACC15'
  return '#FB923C'
}

export function ConditionBar({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cx('flex h-1 overflow-hidden rounded-sm bg-line', className)} aria-hidden="true">
      <span className="rounded-sm" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: conditionColor(value) }} />
    </span>
  )
}

const FORM_STYLE = {
  W: { label: '승', cls: 'bg-accent/18 text-accent' },
  D: { label: '무', cls: 'bg-line text-ink-2' },
  L: { label: '패', cls: 'bg-warn/18 text-warn' },
} as const

export function FormBadge({ r }: { r: 'W' | 'D' | 'L' }) {
  const s = FORM_STYLE[r]
  return <span className={cx('flex size-6 items-center justify-center rounded-md text-[12px] font-bold', s.cls)}>{s.label}</span>
}

export function Stars({ n, className }: { n: number; className?: string }) {
  return (
    <span aria-label={`잠재력 5성 중 ${n}성`} className={cx('whitespace-nowrap text-accent', className)}>
      {'★'.repeat(n)}
      {'☆'.repeat(5 - n)}
    </span>
  )
}

export function ratingTone(r: number, best = false) {
  if (best) return 'bg-accent text-bg'
  if (r >= 7) return 'bg-accent/16 text-accent'
  if (r < 6.0) return 'bg-warn/16 text-warn'
  return 'bg-surface-2 text-ink'
}

export function attrColor(v: number) {
  if (v >= 15) return 'text-accent'
  if (v <= 10) return 'text-warn'
  return 'text-ink'
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative flex h-full w-full max-w-[430px] flex-col justify-end">
        <button type="button" aria-label="닫기" className="animate-fade-in absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="animate-sheet-up pb-safe relative flex max-h-[85%] flex-col rounded-t-3xl border-t border-line bg-surface">
          <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
            <h2 className="m-0 text-[17px] font-bold">{title}</h2>
            <button type="button" aria-label="닫기" onClick={onClose} className="-mr-2 flex size-11 items-center justify-center rounded-xl text-muted">
              <IconClose size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="text-[15px] font-semibold">{title}</span>
      {body && <span className="text-[13px] leading-relaxed text-muted">{body}</span>}
    </div>
  )
}

export function moraleLabel(v: number): { label: string; level: number } {
  if (v >= 80) return { label: '매우 좋음', level: 5 }
  if (v >= 68) return { label: '좋음', level: 4 }
  if (v >= 55) return { label: '보통', level: 3 }
  if (v >= 42) return { label: '나쁨', level: 2 }
  return { label: '매우 나쁨', level: 1 }
}

export const TAG_STYLE: Record<string, { label: string; cls: string }> = {
  board: { label: '이사회', cls: 'bg-accent/16 text-accent' },
  scout: { label: '스카우트', cls: 'bg-away/16 text-away' },
  medical: { label: '의료진', cls: 'bg-warn/16 text-warn' },
  finance: { label: '재정', cls: 'bg-line text-ink-2' },
  match: { label: '경기', cls: 'bg-line text-ink-2' },
  staff: { label: '코치진', cls: 'bg-caution/14 text-caution' },
}
