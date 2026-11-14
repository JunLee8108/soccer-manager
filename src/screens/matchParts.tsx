import type { MatchEvent, Side, TeamStats } from '../engine/match/types'
import type { Club, GameState, Position } from '../engine/types'
import { IconBall } from '../ui/Icons'
import { Crest, cx, ratingTone } from '../ui/kit'

export const USER_COLOR = '#A3E635'
export const OPP_COLOR = '#60A5FA'

interface TagStyle {
  tag: string
  row: string
  tagCls: string
  minute: string
}

function eventStyle(e: MatchEvent, userSide: Side | null): TagStyle {
  const mine = userSide !== null && e.side === userSide
  switch (e.type) {
    case 'goal':
      return mine || userSide === null
        ? { tag: '골', row: 'bg-accent/12', tagCls: 'bg-accent text-bg', minute: 'text-accent' }
        : { tag: '실점', row: 'bg-away/12', tagCls: 'bg-away text-bg', minute: 'text-away' }
    case 'card':
      return { tag: '경고', row: 'bg-surface', tagCls: 'bg-caution text-bg', minute: 'text-muted' }
    case 'red':
      return { tag: '퇴장', row: 'bg-warn/10', tagCls: 'bg-warn text-bg', minute: 'text-warn' }
    case 'sub':
      return { tag: '교체', row: 'bg-surface', tagCls: 'bg-line text-ink-2', minute: 'text-muted' }
    case 'injury':
      return { tag: '부상', row: 'bg-surface', tagCls: 'bg-warn/20 text-warn', minute: 'text-muted' }
    case 'shot':
      return { tag: '찬스', row: 'bg-surface', tagCls: mine ? 'bg-accent/16 text-accent' : 'bg-line text-ink', minute: 'text-muted' }
    case 'period':
      return { tag: '중계', row: 'bg-surface-2', tagCls: 'bg-active text-ink', minute: 'text-ink-2' }
    default:
      return { tag: '중계', row: 'bg-surface', tagCls: 'bg-surface-2 text-muted', minute: 'text-muted' }
  }
}

export function Feed({ events, userSide }: { events: MatchEvent[]; userSide: Side | null }) {
  const list = [...events].reverse()
  return (
    <ol aria-label="문자 중계" aria-live="polite" className="m-0 flex list-none flex-col gap-1.5 p-0 pb-2.5">
      {list.map((e, i) => {
        const s = eventStyle(e, userSide)
        return (
          <li key={`${e.minute}-${i}-${list.length}`} className={cx('flex items-start gap-2.5 rounded-xl px-3 py-2.5', s.row)}>
            <span className={cx('w-[30px] shrink-0 font-display text-[17px] leading-5 font-semibold', s.minute)}>{e.minute}'</span>
            <span className={cx('shrink-0 rounded-md px-[7px] py-0.5 text-[11px] leading-4 font-bold', s.tagCls)}>{s.tag}</span>
            <span className={cx('min-w-0 flex-1 text-[13px] leading-5', e.type === 'period' && 'font-semibold')}>
              {e.text}
              {e.type === 'goal' && e.score && <span className="ml-1 font-display text-[15px] font-bold">{e.score[0]} : {e.score[1]}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100)
}

export function StatsPanel({
  stats,
  homeName,
  awayName,
  homeColor,
  awayColor,
}: {
  stats: { home: TeamStats; away: TeamStats }
  homeName: string
  awayName: string
  homeColor: string
  awayColor: string
}) {
  const h = stats.home
  const a = stats.away
  const posH = pct(h.possessionMinutes, h.possessionMinutes + a.possessionMinutes) || 50
  const rows: [string, number, number, string, string][] = [
    ['점유율', posH, 100 - posH, `${posH}%`, `${100 - posH}%`],
    ['슈팅', h.shots, a.shots, `${h.shots}`, `${a.shots}`],
    ['유효 슈팅', h.onTarget, a.onTarget, `${h.onTarget}`, `${a.onTarget}`],
    ['기대 득점 (xG)', h.xg, a.xg, h.xg.toFixed(2), a.xg.toFixed(2)],
    ['패스 성공률', pct(h.passesCompleted, h.passes), pct(a.passesCompleted, a.passes), `${pct(h.passesCompleted, h.passes)}%`, `${pct(a.passesCompleted, a.passes)}%`],
    ['코너킥', h.corners, a.corners, `${h.corners}`, `${a.corners}`],
    ['파울', h.fouls, a.fouls, `${h.fouls}`, `${a.fouls}`],
    ['경고', h.yellows, a.yellows, `${h.yellows}`, `${a.yellows}`],
  ]
  return (
    <div className="flex flex-col gap-3 px-0.5 pt-1 pb-3">
      <div className="flex justify-between text-[12px] font-semibold">
        <span style={{ color: homeColor }}>{homeName}</span>
        <span style={{ color: awayColor }}>{awayName}</span>
      </div>
      {rows.map(([label, hv, av, hs, as]) => {
        const total = hv + av
        const hp = total === 0 ? 50 : Math.round((hv / total) * 100)
        return (
          <div key={label} className="flex flex-col gap-[5px]">
            <div className="flex items-baseline justify-between">
              <span className={cx('font-display text-[18px] font-semibold', hv >= av ? 'text-ink' : 'text-muted')}>{hs}</span>
              <span className="text-[13px] text-muted">{label}</span>
              <span className={cx('font-display text-[18px] font-semibold', av >= hv ? 'text-ink' : 'text-muted')}>{as}</span>
            </div>
            <div className="flex h-[5px] gap-[3px]">
              <span className="rounded-[3px]" style={{ width: `${hp}%`, background: homeColor }} />
              <span className="rounded-[3px]" style={{ width: `${100 - hp}%`, background: awayColor }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export interface RatingRow {
  id: string
  pos: Position
  rating: number
  energy: number
  goals: number
  assists: number
  yellow: boolean
  sentOff: boolean
  status: 'on' | 'off' | 'sentOff' | 'injured'
}

export function RatingsPanel({ rows, game, live }: { rows: RatingRow[]; game: GameState; live: boolean }) {
  const sorted = [...rows].sort((a, b) => b.rating - a.rating)
  const bestId = sorted[0]?.id
  return (
    <div className="flex flex-col pb-3">
      <div className="grid h-[26px] items-center gap-2 text-[11px] text-muted" style={{ gridTemplateColumns: '26px minmax(0,1fr) 76px 46px' }}>
        <span>#</span>
        <span>선수</span>
        <span>체력</span>
        <span className="text-right">평점</span>
      </div>
      {sorted.map((r) => {
        const p = game.players[r.id]
        const statusLabel = r.status === 'off' ? 'OUT' : r.status === 'sentOff' ? '퇴장' : r.status === 'injured' ? '부상' : null
        return (
          <div key={r.id} className="grid h-[38px] items-center gap-2 border-t border-line-soft" style={{ gridTemplateColumns: '26px minmax(0,1fr) 76px 46px' }}>
            <span className="font-display text-[15px] font-semibold text-muted">{p.shirt}</span>
            <span className="flex min-w-0 items-baseline gap-1.5 overflow-hidden whitespace-nowrap">
              <span className={cx('truncate text-[13px] font-semibold', r.status !== 'on' && 'text-muted')}>{p.name}</span>
              <span className="text-[11px] text-muted">{r.pos}</span>
              {r.goals > 0 && <span className="text-[11px] font-bold text-accent">{r.goals}골</span>}
              {r.assists > 0 && <span className="text-[11px] font-semibold text-ink-2">{r.assists}도움</span>}
              {r.yellow && !r.sentOff && <span aria-label="경고" className="inline-block h-[11px] w-2 rounded-[1px] bg-caution" />}
              {statusLabel && <span className="text-[10px] font-bold text-warn">{statusLabel}</span>}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-[5px] flex-1 overflow-hidden rounded-[3px] bg-line">
                <span className="rounded-[3px]" style={{ width: `${r.energy}%`, background: r.energy < 60 ? '#FB923C' : '#A3E635' }} />
              </span>
              <span className="w-[22px] text-right text-[11px] text-muted">{Math.round(r.energy)}</span>
            </span>
            <span className={cx('justify-self-end rounded-md px-2 py-px font-display text-[15px] font-bold', ratingTone(r.rating, r.id === bestId && !live))}>
              {r.rating.toFixed(1)}
            </span>
          </div>
        )
      })}
      {live && <div className="mt-2 text-[12px] text-muted">체력 60 미만은 주황색 — 교체를 고려해 보세요.</div>}
    </div>
  )
}

export function scorerLine(events: MatchEvent[], side: Side, game: GameState): string[] {
  const map = new Map<string, number[]>()
  for (const e of events) {
    if (e.type !== 'goal' || e.side !== side || !e.playerId) continue
    map.set(e.playerId, [...(map.get(e.playerId) ?? []), e.minute])
  }
  return [...map.entries()].map(([id, mins]) => `${game.players[id]?.name ?? ''} ${mins.map((m) => `${m}'`).join(' ')}`)
}

export function Scoreboard({
  home,
  away,
  homeGoals,
  awayGoals,
  status,
  live,
  homeScorers,
  awayScorers,
}: {
  home: Club
  away: Club
  homeGoals: number
  awayGoals: number
  status: string
  live: boolean
  homeScorers: string[]
  awayScorers: string[]
}) {
  return (
    <section aria-label={`스코어 ${home.name} ${homeGoals} 대 ${awayGoals} ${away.name}`} className="flex shrink-0 flex-col gap-2.5 rounded-[18px] border border-line bg-surface px-3 pt-3.5 pb-3">
      <div className="grid items-center gap-1" style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)' }}>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <Crest club={home} size={40} />
          <span className="text-[13px] font-semibold">{home.name}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 px-1.5">
          <div className="flex items-center gap-3 font-display text-[54px] leading-none font-bold">
            <span>{homeGoals}</span>
            <span className="text-[38px] text-faint">:</span>
            <span>{awayGoals}</span>
          </div>
          <div className={cx('flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[12px] font-bold', live ? 'bg-accent/14 text-accent' : 'bg-line text-ink-2')}>
            {live && <span className="animate-live size-1.5 rounded-full bg-accent" />}
            {status}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <Crest club={away} size={40} />
          <span className="text-[13px] font-semibold">{away.name}</span>
        </div>
      </div>
      {(homeScorers.length > 0 || awayScorers.length > 0) && (
        <div className="grid grid-cols-2 gap-3 border-t border-line-soft pt-2.5 text-[12px] text-muted">
          {[homeScorers, awayScorers].map((list, i) => (
            <ul key={i} className="m-0 flex list-none flex-col items-center gap-0.5 p-0">
              {list.map((line) => (
                <li key={line} className="flex max-w-full items-center gap-1.5">
                  <IconBall size={13} className="shrink-0" />
                  <span className="truncate">{line}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </section>
  )
}
