import { useState } from 'react'
import { NATIONALITY_LABEL } from '../engine/data/names'
import { FOOT_LABEL, POSITION_LABEL, formatMoney } from '../engine/korean'
import { avgRating, marketValue, ovr, potentialStars, radar } from '../engine/ratings'
import type { AttrKey, GameState, Player } from '../engine/types'
import { goBack } from '../router'
import { Radar, Sparkline } from '../ui/charts'
import { Card, PosBadge, Segmented, Stars, attrColor, conditionColor, cx, moraleLabel } from '../ui/kit'
import { IconChevronLeft } from '../ui/Icons'
import { playerFlag, roleOf } from './Squad'

const ATTR_LABEL: Record<AttrKey, string> = {
  finishing: '마무리',
  firstTouch: '퍼스트터치',
  dribbling: '드리블',
  passing: '패스',
  heading: '헤딩',
  tackling: '태클',
  marking: '마킹',
  composure: '침착성',
  positioning: '위치선정',
  decisions: '판단력',
  workRate: '투지',
  teamwork: '팀워크',
  vision: '시야',
  pace: '속도',
  acceleration: '가속력',
  stamina: '체력',
  strength: '근력',
  jumping: '점프',
  handling: '핸들링',
  reflexes: '반사신경',
  oneOnOne: '일대일',
}

function attrGroups(p: Player): { title: string; keys: AttrKey[] }[] {
  const mental: AttrKey[] = ['composure', 'positioning', 'decisions', 'workRate', 'teamwork', 'vision']
  const physical: AttrKey[] = ['pace', 'acceleration', 'stamina', 'strength', 'jumping']
  if (p.position === 'GK') {
    return [
      { title: '골키핑', keys: ['handling', 'reflexes', 'oneOnOne', 'passing', 'firstTouch'] },
      { title: '정신', keys: mental },
      { title: '신체', keys: physical },
    ]
  }
  return [
    { title: '기술', keys: ['finishing', 'firstTouch', 'dribbling', 'passing', 'heading', 'tackling', 'marking'] },
    { title: '정신', keys: mental },
    { title: '신체', keys: physical },
  ]
}

type Tab = 'attrs' | 'growth' | 'contract' | 'stats'

export function PlayerScreen({ game, id }: { game: GameState; id: string }) {
  const [tab, setTab] = useState<Tab>('attrs')
  const p = game.players[id]
  if (!p) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        선수를 찾을 수 없습니다.
      </div>
    )
  }
  const club = game.clubs[p.clubId]
  const o = ovr(p)
  const teamRank = [...club.playerIds].map((pid) => ovr(game.players[pid])).sort((a, b) => b - a).indexOf(o) + 1
  const stars = potentialStars(p.potential)
  const flag = playerFlag(game, p)
  const morale = moraleLabel(p.morale)
  const avg = avgRating(p)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <button
          type="button"
          aria-label="뒤로"
          onClick={() => goBack('squad')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink"
        >
          <IconChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold">선수 정보</span>
        <span className="size-11" />
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4">
        <section className="flex shrink-0 items-center gap-3.5">
          <div aria-label={`등번호 ${p.shirt}`} className="flex size-[68px] shrink-0 items-center justify-center rounded-[18px] bg-accent font-display text-[40px] font-bold text-bg">
            {p.shirt}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
            <div className="flex items-center gap-2">
              <h1 className="m-0 truncate text-[24px] font-bold">{p.name}</h1>
              <PosBadge pos={p.position} />
            </div>
            <div className="truncate text-[13px] text-muted">
              {p.age}세 · {FOOT_LABEL[p.foot]} · {p.height}cm · {NATIONALITY_LABEL[p.nationality] ?? p.nationality}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded bg-surface-2 px-1.5 py-px font-semibold text-ink-2">{roleOf(game, p)}</span>
              {p.secondary.length > 0 && <span className="text-muted">가능 포지션: {p.secondary.join(', ')}</span>}
              {flag && <span className={cx('rounded px-1.5 py-px font-bold', flag.cls)}>{flag.label}</span>}
            </div>
          </div>
        </section>

        <Card label="핵심 지표" className="grid shrink-0 grid-cols-3 py-3">
          <div className="flex flex-col items-center gap-1 px-1.5">
            <span className="text-[11px] text-muted">현재 능력</span>
            <span className="font-display text-[28px] leading-none font-bold">{o}</span>
            <span className="text-[11px] text-muted">팀 내 {teamRank}위</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-x border-line px-1.5">
            <span className="text-[11px] text-muted">잠재력</span>
            <Stars n={stars} className="text-[16px] leading-7 tracking-[1px]" />
            <span className="text-[11px] text-muted">
              추정 {Math.max(o, p.potential - 3)}–{Math.min(99, p.potential + 3)}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 px-1.5">
            <span className="text-[11px] text-muted">시장 가치</span>
            <span className="font-display text-[26px] leading-none font-bold">{formatMoney(marketValue(p))}</span>
            <span className="text-[11px] text-muted">{POSITION_LABEL[p.position]}</span>
          </div>
        </Card>

        <Segmented
          label="선수 정보 보기"
          value={tab}
          onChange={setTab}
          className="shrink-0"
          options={[
            { value: 'attrs', label: '능력치' },
            { value: 'growth', label: '성장' },
            { value: 'contract', label: '계약' },
            { value: 'stats', label: '기록' },
          ]}
        />

        {tab === 'attrs' && (
          <>
            <div className="flex shrink-0 gap-2.5">
              <Card className="flex w-[184px] shrink-0 items-center justify-center py-1">
                <Radar axes={radar(p)} width={176} />
              </Card>
              <Card className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-3">
                <div className="flex flex-col gap-1.5">
                  <span className="flex justify-between text-[12px] text-muted">
                    컨디션 <span className="font-display text-[15px] font-semibold" style={{ color: conditionColor(p.condition) }}>{p.condition}%</span>
                  </span>
                  <span className="flex h-1.5 overflow-hidden rounded-sm bg-line">
                    <span style={{ width: `${p.condition}%`, background: conditionColor(p.condition) }} />
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="flex justify-between text-[12px] text-muted">
                    사기 <span className="text-[13px] font-semibold text-ink">{morale.label}</span>
                  </span>
                  <div aria-hidden="true" className="flex gap-[3px]">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className={cx('h-1.5 flex-1 rounded-sm', i <= morale.level ? 'bg-accent' : 'bg-line')} />
                    ))}
                  </div>
                </div>
                <div className="text-[12px] leading-snug text-muted">
                  이번 시즌 <span className="font-semibold text-ink">{p.stats.apps}경기</span> · {p.stats.goals}골 {p.stats.assists}도움
                </div>
              </Card>
            </div>

            <Card label="세부 능력치 (1–20)" className="grid shrink-0 grid-cols-3 gap-3.5 px-3.5 py-3">
              {attrGroups(p).map((g) => (
                <div key={g.title} className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[12px] font-bold text-muted">{g.title}</span>
                  {g.keys.map((k) => (
                    <div key={k} className="flex items-baseline justify-between gap-1 text-[13px]">
                      <span className="truncate whitespace-nowrap">{ATTR_LABEL[k]}</span>
                      <span className={cx('font-display text-[17px] font-bold', attrColor(p.attrs[k]))}>{p.attrs[k]}</span>
                    </div>
                  ))}
                </div>
              ))}
            </Card>
          </>
        )}

        {tab === 'growth' && (
          <Card className="flex shrink-0 flex-col gap-3 p-4">
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] text-muted">이번 시즌 능력 변화</span>
                <span className="font-display text-[30px] leading-none font-bold text-accent">
                  {o - p.history[0] >= 0 ? '+' : ''}
                  {o - p.history[0]}
                </span>
              </div>
              <span className="text-[12px] text-muted">
                잠재력 추정 {Math.max(o, p.potential - 3)}–{Math.min(99, p.potential + 3)}
              </span>
            </div>
            <Sparkline values={p.history} width={326} height={70} label={`능력 기록 ${p.history.join(', ')}`} />
            <p className="m-0 rounded-xl bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
              훈련과 출전 시간에 따른 성장, 나이에 따른 노화는 다음 업데이트(M2)에서 적용됩니다. 지금은 능력 기록만 쌓입니다.
            </p>
          </Card>
        )}

        {tab === 'contract' && (
          <Card className="flex shrink-0 flex-col divide-y divide-line-soft">
            {[
              ['주급', formatMoney(p.contract.wage)],
              ['계약 기간', `시즌 ${p.contract.until}까지`],
              ['시장 가치', formatMoney(marketValue(p))],
              ['소속', club.name],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-3.5 text-[14px]">
                <span className="text-muted">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
            <p className="m-0 px-4 py-3 text-[12px] leading-relaxed text-muted">계약 연장 협상과 이적 시장은 M3 업데이트에서 열립니다.</p>
          </Card>
        )}

        {tab === 'stats' && (
          <Card className="grid shrink-0 grid-cols-3 gap-y-4 p-4">
            {[
              ['출전', `${p.stats.apps}`, `선발 ${p.stats.starts}`],
              ['골', `${p.stats.goals}`, ''],
              ['도움', `${p.stats.assists}`, ''],
              ['평균 평점', avg ? avg.toFixed(2) : '-', ''],
              ['MOM', `${p.stats.motm}`, ''],
              p.position === 'GK' ? ['클린시트', `${p.stats.cleanSheets}`, ''] : ['경고 / 퇴장', `${p.stats.yellows} / ${p.stats.reds}`, ''],
            ].map(([k, v, sub]) => (
              <div key={k} className="flex flex-col items-center gap-1">
                <span className="text-[11px] text-muted">{k}</span>
                <span className="font-display text-[26px] leading-none font-bold">{v}</span>
                {sub && <span className="text-[11px] text-muted">{sub}</span>}
              </div>
            ))}
          </Card>
        )}
      </main>
    </div>
  )
}
