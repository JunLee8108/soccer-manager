import { useState } from 'react'
import { NATIONALITY_LABEL } from '../engine/data/names'
import { INDIVIDUAL_PROGRAMS, professionalismLabel, programsFor, projectGrowth, type GrowthFactors } from '../engine/development'
import { ATTR_LABEL, FOOT_LABEL, POSITION_LABEL, formatMoney } from '../engine/korean'
import { avgRating, marketValue, ovr, ovrAt, potentialStars, radar } from '../engine/ratings'
import type { AttrKey, GameState, Player } from '../engine/types'
import { goBack, navigate } from '../router'
import { useGame } from '../store/gameStore'
import { Radar, Sparkline } from '../ui/charts'
import { IconChevronLeft, IconChevronRight } from '../ui/Icons'
import { Card, PosBadge, Segmented, Sheet, Stars, attrColor, conditionColor, cx, moraleLabel } from '../ui/kit'
import { LEVEL_STYLE } from './Club'
import { playerFlag, roleOf } from './Squad'

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

const shown = (v: number) => Math.round(v)

function attrChanges(p: Player): { key: AttrKey; diff: number }[] {
  return (Object.keys(p.attrs) as AttrKey[])
    .map((key) => ({ key, diff: shown(p.attrs[key]) - shown(p.seasonStart[key]) }))
    .filter((x) => x.diff !== 0)
    .sort((a, b) => b.diff - a.diff)
}

function factorRows(p: Player, f: GrowthFactors, club: GameState['clubs'][string]) {
  const ageLabel = p.age <= 21 ? '성장기' : p.age <= 25 ? '발전 중' : p.age <= 29 ? '전성기' : '노화 시작'
  const roomLabel = f.room >= 0.75 ? '충분' : f.room >= 0.25 ? '조금 남음' : '거의 없음'
  const minutesLabel = f.minutes >= 1.2 ? '주전 출전' : f.minutes >= 1 ? '교체 출전' : f.minutes >= 0.8 ? '유스 리그' : f.minutes >= 0.6 ? '출전 없음' : '부상'
  const trainingLabel = `${f.training >= 1.1 ? '강도 높음' : f.training >= 0.9 ? '보통' : '가벼움'} · 시설 Lv.${club.facilities.training}`
  return [
    { label: '나이', value: ageLabel, level: Math.min(5, Math.max(0, Math.round((f.age / 0.26) * 5))) },
    { label: '잠재력 여유', value: roomLabel, level: Math.round(f.room * 5) },
    { label: '출전 시간', value: minutesLabel, level: Math.round(((f.minutes - 0.3) / 0.95) * 5) },
    { label: '훈련', value: trainingLabel, level: Math.round(((f.training - 0.4) / 1.1) * 5) },
    { label: '성격', value: professionalismLabel(p.professionalism), level: Math.round(((f.personality - 0.75) / 0.5) * 5) },
  ]
}

type Tab = 'attrs' | 'growth' | 'contract' | 'stats'

export function PlayerScreen({ game, id }: { game: GameState; id: string }) {
  const [tab, setTab] = useState<Tab>('attrs')
  const [programOpen, setProgramOpen] = useState(false)
  const [confirmRelease, setConfirmRelease] = useState(false)
  const { setPlayerFocus, promoteYouth, releaseYouth } = useGame.getState()
  const p = game.players[id]
  if (!p) {
    return <div className="flex flex-1 items-center justify-center text-muted">선수를 찾을 수 없습니다.</div>
  }
  const club = game.clubs[p.clubId]
  const isUser = club.id === game.userClubId
  const isYouth = club.youthIds.includes(p.id)
  const o = ovr(p)
  const pool = isYouth ? club.youthIds : club.playerIds
  const teamRank = pool.map((pid) => ovr(game.players[pid])).sort((a, b) => b - a).indexOf(o) + 1
  const stars = potentialStars(p.potential)
  const flag = playerFlag(game, p)
  const morale = moraleLabel(p.morale)
  const avg = avgRating(p)
  const growth = projectGrowth(p, club)
  const seasonDelta = o - p.history[0]
  const changes = attrChanges(p)
  const startOvr = ovrAt(p.seasonStart, p.position)
  const program = INDIVIDUAL_PROGRAMS[p.trainingFocus]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <button
          type="button"
          aria-label="뒤로"
          onClick={() => goBack(isYouth ? 'club/youth' : 'squad')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink"
        >
          <IconChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold">{isYouth ? '유스 선수 정보' : '선수 정보'}</span>
        <span className="size-11" />
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4">
        <section className="flex shrink-0 items-center gap-3.5">
          <div
            aria-label={isYouth ? '유스 선수' : `등번호 ${p.shirt}`}
            className={cx(
              'flex size-[68px] shrink-0 items-center justify-center rounded-[18px] font-display font-bold',
              isYouth ? 'border-2 border-accent bg-transparent text-[22px] text-accent' : 'bg-accent text-[40px] text-bg',
            )}
          >
            {isYouth ? 'U18' : p.shirt}
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
              <span className="rounded bg-surface-2 px-1.5 py-px font-semibold text-ink-2">성격 {professionalismLabel(p.professionalism)}</span>
              {flag && <span className={cx('rounded px-1.5 py-px font-bold', flag.cls)}>{flag.label}</span>}
            </div>
          </div>
        </section>

        <Card label="핵심 지표" className="grid shrink-0 grid-cols-3 py-3">
          <div className="flex flex-col items-center gap-1 px-1.5">
            <span className="text-[11px] text-muted">현재 능력</span>
            <span className="font-display text-[28px] leading-none font-bold">{o}</span>
            <span className="text-[11px] text-muted">
              {isYouth ? '유스' : '팀'} 내 {teamRank}위
            </span>
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
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] text-muted">이번 시즌 변화</span>
                  <span className={cx('font-display text-[28px] leading-none font-bold', seasonDelta > 0 ? 'text-accent' : seasonDelta < 0 ? 'text-warn' : 'text-ink')}>
                    {seasonDelta > 0 ? '+' : ''}
                    {seasonDelta}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="flex justify-between text-[12px] text-muted">
                    컨디션{' '}
                    <span className="font-display text-[15px] font-semibold" style={{ color: conditionColor(p.condition) }}>
                      {p.condition}%
                    </span>
                  </span>
                  <span className="flex h-1.5 overflow-hidden rounded-sm bg-line">
                    <span style={{ width: `${p.condition}%`, background: conditionColor(p.condition) }} />
                  </span>
                </div>
                <span className="flex justify-between text-[12px] text-muted">
                  사기 <span className="text-[13px] font-semibold text-ink">{morale.label}</span>
                </span>
              </Card>
            </div>

            <Card label="세부 능력치 (1–20)" className="grid shrink-0 grid-cols-3 gap-3.5 px-3.5 py-3">
              {attrGroups(p).map((g) => (
                <div key={g.title} className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[12px] font-bold text-muted">{g.title}</span>
                  {g.keys.map((k) => {
                    const v = shown(p.attrs[k])
                    const diff = v - shown(p.seasonStart[k])
                    return (
                      <div key={k} className="flex items-baseline justify-between gap-1 text-[13px]">
                        <span className="truncate whitespace-nowrap">{ATTR_LABEL[k]}</span>
                        <span className="flex items-baseline gap-0.5">
                          {diff !== 0 && (
                            <span aria-label={diff > 0 ? '상승' : '하락'} className={cx('text-[9px]', diff > 0 ? 'text-accent' : 'text-warn')}>
                              {diff > 0 ? '▲' : '▼'}
                            </span>
                          )}
                          <span className={cx('font-display text-[17px] font-bold', attrColor(v))}>{v}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </Card>
          </>
        )}

        {tab === 'growth' && (
          <>
            <Card className="flex shrink-0 flex-col gap-3 p-4">
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] text-muted">이번 시즌 능력 변화</span>
                  <span className={cx('font-display text-[30px] leading-none font-bold', seasonDelta > 0 ? 'text-accent' : seasonDelta < 0 ? 'text-warn' : 'text-ink')}>
                    {seasonDelta > 0 ? '+' : ''}
                    {seasonDelta}
                    <span className="ml-2 text-[14px] font-semibold text-muted">
                      {startOvr} → {o}
                    </span>
                  </span>
                </div>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-[11px] text-muted">성장 전망</span>
                  <span className={cx('rounded-full px-2.5 py-[3px] text-[12px] font-bold', LEVEL_STYLE[growth.level])}>{growth.level}</span>
                </span>
              </div>
              <Sparkline values={p.history} width={326} height={70} label={`능력 기록 ${p.history.join(', ')}`} />
              <span className="text-[12px] text-muted">
                잠재력 추정 {Math.max(o, p.potential - 3)}–{Math.min(99, p.potential + 3)} · 라운드별 능력 기록
              </span>
            </Card>

            <Card label="성장 요인" className="flex shrink-0 flex-col py-1">
              <h2 className="m-0 px-4 py-2.5 text-[14px] font-bold">성장 요인</h2>
              {factorRows(p, growth.factors, club).map((r) => (
                <div key={r.label} className="grid items-center gap-3 border-t border-line-soft px-4 py-2.5" style={{ gridTemplateColumns: '72px minmax(0,1fr) 64px' }}>
                  <span className="text-[13px] text-muted">{r.label}</span>
                  <span className="truncate text-[13px] font-semibold">{r.value}</span>
                  <span aria-hidden="true" className="flex gap-[3px]">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className={cx('h-1.5 flex-1 rounded-sm', i <= r.level ? 'bg-accent' : 'bg-line')} />
                    ))}
                  </span>
                </div>
              ))}
            </Card>

            <Card label="개인 훈련" className="flex shrink-0 items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[12px] text-muted">개인 훈련</span>
                <span className="text-[15px] font-bold">{program.label}</span>
                <span className="truncate text-[12px] text-muted">{program.desc}</span>
              </div>
              {isUser && (
                <button
                  type="button"
                  onClick={() => setProgramOpen(true)}
                  className="flex h-10 shrink-0 items-center gap-1 rounded-xl border border-[#2E3F5E] bg-surface-2 px-3 text-[13px] font-semibold text-ink"
                >
                  변경 <IconChevronRight size={16} />
                </button>
              )}
            </Card>

            <Card label="이번 시즌 능력치 변화" className="flex shrink-0 flex-col gap-2 p-4">
              <span className="text-[14px] font-bold">이번 시즌 능력치 변화</span>
              {changes.length === 0 ? (
                <span className="text-[13px] text-muted">아직 눈에 띄는 변화가 없습니다.</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {changes.map((c) => (
                    <span key={c.key} className={cx('rounded-lg px-2 py-1 text-[12px] font-semibold', c.diff > 0 ? 'bg-accent/14 text-accent' : 'bg-warn/14 text-warn')}>
                      {ATTR_LABEL[c.key]} {c.diff > 0 ? '+' : ''}
                      {c.diff}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {tab === 'contract' && (
          <Card className="flex shrink-0 flex-col divide-y divide-line-soft">
            {[
              ['주급', formatMoney(p.contract.wage)],
              ['계약 기간', `시즌 ${p.contract.until}까지`],
              ['시장 가치', formatMoney(marketValue(p))],
              ['소속', isYouth ? `${club.name} 유스` : club.name],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-3.5 text-[14px]">
                <span className="text-muted">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
            <p className="m-0 px-4 py-3 text-[12px] leading-relaxed text-muted">
              만료되는 계약은 시즌 결산에서 재계약 여부를 정합니다. 이적 시장과 연봉 협상은 M3 업데이트에서 열립니다.
            </p>
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

      {isUser && (
        <div className="grid shrink-0 grid-cols-2 gap-2 px-4 pb-3">
          {isYouth ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmRelease(true)}
                className="h-12 rounded-xl border border-[#2E3F5E] bg-surface-2 text-[14px] font-semibold text-ink"
              >
                방출
              </button>
              <button type="button" onClick={() => promoteYouth(p.id)} className="h-12 rounded-xl border-none bg-accent text-[14px] font-bold text-bg">
                1군 승격
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setProgramOpen(true)}
              className="col-span-2 h-12 rounded-xl border border-[#2E3F5E] bg-surface-2 text-[14px] font-semibold text-ink"
            >
              개인 훈련 설정 · {program.label}
            </button>
          )}
        </div>
      )}

      <Sheet open={programOpen} onClose={() => setProgramOpen(false)} title="개인 훈련 프로그램">
        <div className="flex flex-col gap-2 px-5 pt-1 pb-4">
          <p className="m-0 pb-1 text-[12px] leading-relaxed text-muted">선택한 분야의 능력치가 더 빨리 오릅니다. 성장 속도 자체는 나이·출전 시간·훈련 강도에 달려 있습니다.</p>
          {programsFor(p).map((f) => {
            const on = f === p.trainingFocus
            const prog = INDIVIDUAL_PROGRAMS[f]
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setPlayerFocus(p.id, f)
                  setProgramOpen(false)
                }}
                className={cx('flex flex-col items-start gap-0.5 rounded-xl border-[1.5px] px-3.5 py-2.5 text-left', on ? 'border-accent bg-accent/10' : 'border-line bg-surface-2')}
              >
                <span className={cx('text-[14px] font-bold', on ? 'text-accent' : 'text-ink')}>{prog.label}</span>
                <span className="text-[12px] text-muted">{prog.desc}</span>
              </button>
            )
          })}
        </div>
      </Sheet>

      <Sheet open={confirmRelease} onClose={() => setConfirmRelease(false)} title="유스 선수 방출">
        <div className="flex flex-col gap-3 px-5 pt-1 pb-4">
          <p className="m-0 text-[14px] leading-relaxed text-ink-2">{p.name} 선수를 아카데미에서 내보낼까요? 되돌릴 수 없습니다.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmRelease(false)} className="h-12 rounded-xl border border-line bg-surface-2 text-[15px] font-semibold text-ink">
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmRelease(false)
                releaseYouth(p.id)
                navigate('club/youth', { replace: true })
              }}
              className="h-12 rounded-xl border-none bg-warn text-[15px] font-bold text-bg"
            >
              방출
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
