import { useState, type ReactNode } from 'react'
import { FORMATIONS, FORMATION_IDS } from '../engine/data/formations'
import { BENCH_SIZE, isAvailable } from '../engine/lineup'
import { familiarity, ovr, ratingAt, teamStrength, toDisplay } from '../engine/ratings'
import { isSeasonOver } from '../engine/season'
import type { DefLine, FormationId, GameState, Player, Position, Press, Style } from '../engine/types'
import { navigate } from '../router'
import { useGame, type SheetSpot } from '../store/gameStore'
import { IconChevronDown, IconChevronRight, IconPlus, IconWand } from '../ui/Icons'
import { Card, PosBadge, Segmented, Sheet, conditionColor, cx } from '../ui/kit'
import { playerFlag } from './Squad'

export const STYLE_OPTIONS: { value: Style; label: string }[] = [
  { value: 'possession', label: '점유' },
  { value: 'balanced', label: '균형' },
  { value: 'counter', label: '역습' },
]
export const PRESS_OPTIONS: { value: Press; label: string }[] = [
  { value: 'low', label: '낮음' },
  { value: 'mid', label: '보통' },
  { value: 'high', label: '높음' },
]
export const LINE_OPTIONS: { value: DefLine; label: string }[] = [
  { value: 'deep', label: '낮게' },
  { value: 'normal', label: '보통' },
  { value: 'high', label: '높게' },
]

export function Pitch({ children, height }: { children: ReactNode; height: number }) {
  return (
    <section
      aria-label="선발 라인업 배치"
      className="relative shrink-0 overflow-hidden rounded-2xl border border-pitch-line"
      style={{ height, background: 'repeating-linear-gradient(180deg, #14331F 0px, #14331F 31px, #173A23 31px, #173A23 62px)' }}
    >
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
      <div className="absolute top-1/2 left-1/2 -mt-9 -ml-9 size-[72px] rounded-full border border-white/20" />
      <div className="absolute inset-x-[22%] top-0 h-[15%] border border-t-0 border-white/20" />
      <div className="absolute inset-x-[37%] top-0 h-[6%] border border-t-0 border-white/20" />
      <div className="absolute inset-x-[22%] bottom-0 h-[15%] border border-b-0 border-white/20" />
      <div className="absolute inset-x-[37%] bottom-0 h-[6%] border border-b-0 border-white/20" />
      {children}
    </section>
  )
}

export function TacticsScreen({ game }: { game: GameState }) {
  const { setFormation, placePlayer, autoPick, setTeamInstructions } = useGame.getState()
  const [picker, setPicker] = useState<SheetSpot | null>(null)
  const [formationOpen, setFormationOpen] = useState(false)
  const club = game.clubs[game.userClubId]
  const t = club.tactics
  const slots = FORMATIONS[t.formation].slots
  const players = game.players

  const entries = t.lineup
    .map((id, i) => (id ? { player: players[id], pos: slots[i].pos } : null))
    .filter((x): x is { player: Player; pos: Position } => !!x)
  const s = teamStrength(entries)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-[18px] pb-3">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <h1 className="m-0 text-[22px] font-bold">전술</h1>
          <span className="truncate text-[12px] text-muted">
            팀 전력 · 공격 {toDisplay(s.attack)} · 중원 {toDisplay(s.midfield)} · 수비 {toDisplay(s.defense)}
          </span>
        </div>
        <button
          type="button"
          aria-label={`포메이션 변경, 현재 ${t.formation}`}
          onClick={() => setFormationOpen(true)}
          className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-line bg-surface pr-2.5 pl-3.5 font-display text-[22px] font-bold text-ink"
        >
          {t.formation}
          <IconChevronDown size={18} className="text-muted" />
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-3">
        <Pitch height={310}>
          {slots.map((slot, i) => {
            const id = t.lineup[i]
            const p = id ? players[id] : null
            const offPos = p ? familiarity(p, slot.pos) < 0.85 : false
            return (
              <button
                key={i}
                type="button"
                onClick={() => setPicker({ kind: 'slot', index: i })}
                aria-label={p ? `${slot.pos} ${p.name}, 예상 능력치 ${ratingAt(p, slot.pos)}, 교체할 선수 선택` : `${slot.pos} 빈 자리, 선수 선택`}
                className="absolute flex w-[76px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[3px] border-none bg-transparent p-0"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              >
                {p ? (
                  <span
                    className={cx(
                      'flex size-10 items-center justify-center rounded-full border-2 bg-bg font-display text-[19px] font-bold',
                      offPos ? 'text-caution' : 'text-ink',
                    )}
                    style={{ borderColor: p.condition < 80 ? '#FB923C' : '#A3E635' }}
                  >
                    {ratingAt(p, slot.pos)}
                  </span>
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-white/50 bg-bg/60 text-white/80">
                    <IconPlus size={16} />
                  </span>
                )}
                <span className={cx('rounded-md bg-bg/80 px-1.5 py-px text-[11px] font-semibold whitespace-nowrap', offPos ? 'text-caution' : 'text-ink')}>
                  {p ? shortName(p.name) : slot.pos}
                </span>
              </button>
            )
          })}
        </Pitch>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>원 안 숫자: 그 자리 예상 능력치 · 탭해서 교체</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full border-2 border-warn" />
              컨디션 80% 미만
            </span>
            <span className="text-caution">노란 이름: 포지션 부적합</span>
          </span>
        </div>

        <section aria-label="교체 명단" className="flex shrink-0 flex-col gap-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-semibold text-ink">교체 명단 {t.bench.length}명</span>
            <button type="button" onClick={autoPick} className="flex h-8 items-center gap-1 rounded-lg border-none bg-transparent px-1 text-[12px] font-semibold text-accent">
              <IconWand size={15} /> 자동 선발
            </button>
          </div>
          <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4">
            {t.bench.map((id, i) => {
              const p = players[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPicker({ kind: 'bench', index: i })}
                  aria-label={`교체 명단 ${p.name}, 바꿀 선수 선택`}
                  className="flex h-11 shrink-0 items-center gap-[7px] rounded-xl border border-line bg-surface pr-3 pl-1.5 text-left text-ink"
                >
                  <span className="flex size-[30px] items-center justify-center rounded-full bg-surface-2 font-display text-[15px] font-bold">{p.shirt}</span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[12px] font-semibold whitespace-nowrap">{p.name}</span>
                    <span className="text-[11px] whitespace-nowrap text-muted">
                      {p.position} · {ovr(p)}
                    </span>
                  </span>
                </button>
              )
            })}
            {t.bench.length < BENCH_SIZE && (
              <button
                type="button"
                onClick={() => setPicker({ kind: 'bench', index: t.bench.length })}
                className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-dashed border-line bg-transparent px-3 text-[12px] font-semibold text-muted"
              >
                <IconPlus size={14} /> 추가
              </button>
            )}
          </div>
        </section>

        <Card label="팀 지시" className="flex shrink-0 flex-col gap-2 p-3">
          {(
            [
              ['플레이 스타일', STYLE_OPTIONS, t.style, (v: string) => setTeamInstructions({ style: v as Style })],
              ['압박 강도', PRESS_OPTIONS, t.press, (v: string) => setTeamInstructions({ press: v as Press })],
              ['수비 라인', LINE_OPTIONS, t.line, (v: string) => setTeamInstructions({ line: v as DefLine })],
            ] as const
          ).map(([label, options, value, onChange]) => (
            <div key={label} className="grid items-center gap-2" style={{ gridTemplateColumns: '82px minmax(0,1fr)' }}>
              <span className="text-[13px] text-muted">{label}</span>
              <Segmented label={label} tone="accent" size="sm" options={options as { value: string; label: string }[]} value={value} onChange={onChange} />
            </div>
          ))}
          <p className="m-0 text-[11px] leading-relaxed text-muted">
            점유는 볼을 오래 소유하고, 역습은 기회는 적어도 빠르게 찌릅니다. 높은 압박과 라인은 체력 소모와 뒷공간 위험이 커집니다.
          </p>
        </Card>
      </main>

      {!isSeasonOver(game) && (
        <div className="shrink-0 px-4 pb-3">
          <button
            type="button"
            onClick={() => navigate('match')}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border-none bg-accent text-[16px] font-bold text-bg"
          >
            이 전술로 경기 시작 <IconChevronRight size={20} strokeWidth={2.2} />
          </button>
        </div>
      )}

      <Sheet open={formationOpen} onClose={() => setFormationOpen(false)} title="포메이션 선택">
        <div className="grid grid-cols-2 gap-2.5 px-5 pt-1 pb-4">
          {FORMATION_IDS.map((f) => (
            <FormationCard
              key={f}
              id={f}
              active={f === t.formation}
              onPick={() => {
                setFormation(f)
                setFormationOpen(false)
              }}
            />
          ))}
        </div>
      </Sheet>

      <PlayerPicker
        game={game}
        spot={picker}
        onClose={() => setPicker(null)}
        onPick={(id) => {
          if (picker) placePlayer(picker, id)
          setPicker(null)
        }}
      />
    </div>
  )
}

function shortName(name: string) {
  // Foreign names: show the family name only to keep labels short.
  const parts = name.split(' ')
  return parts.length > 1 ? parts[parts.length - 1] : name
}

function FormationCard({ id, active, onPick }: { id: FormationId; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={cx('flex flex-col gap-2 rounded-2xl border-[1.5px] p-2.5 text-left', active ? 'border-accent bg-accent/10' : 'border-line bg-surface-2')}
    >
      <div className="relative h-[92px] overflow-hidden rounded-lg bg-pitch">
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
        {FORMATIONS[id].slots.map((s, i) => (
          <span key={i} className={cx('absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full', active ? 'bg-accent' : 'bg-ink-2')} style={{ left: `${s.x}%`, top: `${s.y}%` }} />
        ))}
      </div>
      <span className={cx('font-display text-[20px] font-bold', active ? 'text-accent' : 'text-ink')}>{id}</span>
    </button>
  )
}

function PlayerPicker({ game, spot, onClose, onPick }: { game: GameState; spot: SheetSpot | null; onClose: () => void; onPick: (id: string) => void }) {
  if (!spot) return null
  const club = game.clubs[game.userClubId]
  const t = club.tactics
  const slots = FORMATIONS[t.formation].slots
  const pos = spot.kind === 'slot' ? slots[spot.index].pos : null
  const currentId = spot.kind === 'slot' ? t.lineup[spot.index] : t.bench[spot.index]
  const score = (p: Player) => (pos ? ratingAt(p, pos) : ovr(p))
  const squad = club.playerIds
    .map((id) => game.players[id])
    .sort((a, b) => Number(isAvailable(b)) - Number(isAvailable(a)) || score(b) - score(a))

  const roleLabel = (p: Player) => {
    const li = t.lineup.indexOf(p.id)
    if (li >= 0) return `선발 · ${slots[li].pos}`
    if (t.bench.includes(p.id)) return '교체'
    return '명단 외'
  }

  return (
    <Sheet open onClose={onClose} title={pos ? `${pos} 자리 선수 선택` : '교체 명단 선수 선택'}>
      <div className="px-5 pb-1 text-[12px] text-muted">{pos ? '숫자는 이 포지션에서의 예상 능력치입니다.' : '숫자는 선수의 현재 능력치입니다.'}</div>
      <ul className="m-0 list-none p-0 pb-3">
        {squad.map((p) => {
          const available = isAvailable(p)
          const flag = playerFlag(game, p)
          const current = p.id === currentId
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!available || current}
                onClick={() => onPick(p.id)}
                className={cx(
                  'grid w-full items-center gap-2.5 border-0 border-t border-solid border-line-soft bg-transparent px-5 py-2.5 text-left text-ink',
                  current && 'bg-accent/8',
                  !available && 'opacity-55',
                )}
                style={{ gridTemplateColumns: '38px minmax(0,1fr) 44px 40px' }}
              >
                <PosBadge pos={p.position} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold">{p.name}</span>
                    {current && <span className="shrink-0 rounded bg-accent/16 px-1.5 py-px text-[10px] font-bold text-accent">현재</span>}
                    {flag && !current && <span className={cx('shrink-0 rounded px-1.5 py-px text-[10px] font-bold', flag.cls)}>{flag.label}</span>}
                  </span>
                  <span className="text-[12px] text-muted">
                    {roleLabel(p)} · {p.age}세
                  </span>
                </span>
                <span className="text-right font-display text-[13px] font-semibold" style={{ color: conditionColor(p.condition) }}>
                  {p.condition}%
                </span>
                <span className="text-right font-display text-[22px] font-bold">{score(p)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
