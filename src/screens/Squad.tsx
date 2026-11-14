import { useState } from 'react'
import { formatMoney } from '../engine/korean'
import { ovr, potentialStars } from '../engine/ratings'
import type { GameState, Line, Player } from '../engine/types'
import { LINE_OF, POSITIONS } from '../engine/types'
import { href } from '../router'
import { IconSort } from '../ui/Icons'
import { ConditionBar, PosBadge, ScreenHeader, Stars, conditionColor, cx } from '../ui/kit'

type Filter = 'ALL' | Line
type SortKey = 'ovr' | 'pos' | 'age' | 'condition'

const SORT_LABEL: Record<SortKey, string> = { ovr: '능력치순', pos: '포지션순', age: '나이순', condition: '컨디션순' }
const SORT_ORDER: SortKey[] = ['ovr', 'pos', 'age', 'condition']

export function playerFlag(game: GameState, p: Player): { label: string; cls: string } | null {
  if (p.injury) return { label: `부상 ${p.injury.weeks}주`, cls: 'bg-warn/18 text-warn' }
  if (p.suspension > 0) return { label: '출장 정지', cls: 'bg-warn/18 text-warn' }
  if (p.contract.until <= game.season) return { label: '계약 만료 임박', cls: 'bg-caution/16 text-caution' }
  if (p.age <= 21 && potentialStars(p.potential) >= 4) return { label: '유망주', cls: 'bg-accent/16 text-accent' }
  return null
}

export function roleOf(game: GameState, p: Player): '선발' | '교체' | '명단 외' | '유스' {
  if (game.clubs[p.clubId].youthIds.includes(p.id)) return '유스'
  const t = game.clubs[p.clubId].tactics
  if (t.lineup.includes(p.id)) return '선발'
  if (t.bench.includes(p.id)) return '교체'
  return '명단 외'
}

export function SquadScreen({ game }: { game: GameState }) {
  const [filter, setFilter] = useState<Filter>('ALL')
  const [sort, setSort] = useState<SortKey>('ovr')
  const club = game.clubs[game.userClubId]
  const squad = club.playerIds.map((id) => game.players[id])
  const avgAge = squad.reduce((s, p) => s + p.age, 0) / squad.length
  const wages = squad.reduce((s, p) => s + p.contract.wage, 0)
  const counts = { ALL: squad.length, GK: 0, DF: 0, MF: 0, FW: 0 } as Record<Filter, number>
  for (const p of squad) counts[LINE_OF[p.position]]++

  const list = squad
    .filter((p) => filter === 'ALL' || LINE_OF[p.position] === filter)
    .sort((a, b) => {
      if (sort === 'pos') return POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || ovr(b) - ovr(a)
      if (sort === 'age') return a.age - b.age || ovr(b) - ovr(a)
      if (sort === 'condition') return a.condition - b.condition
      return ovr(b) - ovr(a)
    })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title="스쿼드"
        subtitle={`${squad.length}명 · 평균 ${avgAge.toFixed(1)}세 · 주급 총액 ${formatMoney(wages)}`}
        right={
          <button
            type="button"
            aria-label={`정렬 기준 변경, 현재 ${SORT_LABEL[sort]}`}
            onClick={() => setSort(SORT_ORDER[(SORT_ORDER.indexOf(sort) + 1) % SORT_ORDER.length])}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink"
          >
            <IconSort size={16} className="text-muted" />
            {SORT_LABEL[sort]}
          </button>
        }
      />

      <div role="group" aria-label="포지션 필터" className="scrollbar-none flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-2.5">
        {(['ALL', 'GK', 'DF', 'MF', 'FW'] as Filter[]).map((f) => {
          const on = f === filter
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f)}
              className={cx(
                'h-9 shrink-0 rounded-full px-3.5 text-[13px]',
                on ? 'border-none bg-accent font-bold text-bg' : 'border border-line bg-surface font-semibold text-ink-2',
              )}
            >
              {f === 'ALL' ? '전체' : f} {counts[f]}
            </button>
          )
        })}
        <a href={href('club/youth')} className="flex h-9 shrink-0 items-center rounded-full border border-dashed border-line px-3.5 text-[13px] font-semibold text-ink-2 no-underline">
          유스 {club.youthIds.length} →
        </a>
      </div>

      <div className="grid h-7 shrink-0 items-center gap-2.5 border-b border-line-soft px-4 text-[11px] text-muted" style={{ gridTemplateColumns: '40px minmax(0,1fr) 56px 50px' }}>
        <span>포지션</span>
        <span>선수</span>
        <span className="text-right">컨디션</span>
        <span className="text-right">능력</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.map((p) => {
          const flag = playerFlag(game, p)
          return (
            <a
              key={p.id}
              href={href(`player/${p.id}`)}
              className="grid h-[60px] items-center gap-2.5 border-b border-line-soft px-4 text-ink no-underline"
              style={{ gridTemplateColumns: '40px minmax(0,1fr) 56px 50px' }}
            >
              <PosBadge pos={p.position} />
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold">{p.name}</span>
                  {flag && <span className={cx('shrink-0 rounded px-1.5 py-px text-[10px] font-bold', flag.cls)}>{flag.label}</span>}
                </span>
                <span className="truncate text-[12px] text-muted">
                  {p.age}세 · {roleOf(game, p)} · #{p.shirt}
                </span>
              </span>
              <span className="flex flex-col gap-[5px]">
                <span className="text-right font-display text-[12px] font-semibold" style={{ color: p.condition < 60 ? conditionColor(p.condition) : '#C5CEDD' }}>
                  {p.condition}%
                </span>
                <ConditionBar value={p.condition} />
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="flex items-baseline gap-1">
                  {ovr(p) !== p.history[0] && (
                    <span className={cx('font-display text-[11px] font-bold', ovr(p) > p.history[0] ? 'text-accent' : 'text-warn')}>
                      {ovr(p) > p.history[0] ? '+' : ''}
                      {ovr(p) - p.history[0]}
                    </span>
                  )}
                  <span className="font-display text-[24px] leading-none font-bold">{ovr(p)}</span>
                </span>
                <Stars n={potentialStars(p.potential)} className="text-[10px] tracking-[1px]" />
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
