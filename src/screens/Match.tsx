import { useEffect, useState } from 'react'
import { LEAGUE_NAME } from '../engine/data/clubs'
import type { LiveMatch, MatchPlayer, Side, TeamState } from '../engine/match/types'
import { ratingAt } from '../engine/ratings'
import { isSeasonOver, userFixture } from '../engine/season'
import type { DefLine, GameState, Press, Style } from '../engine/types'
import { navigate } from '../router'
import { useGame, type Speed } from '../store/gameStore'
import { Momentum } from '../ui/charts'
import { IconPause, IconPlay, IconSkip, IconSliders, IconSwap } from '../ui/Icons'
import { PosBadge, Segmented, Sheet, conditionColor, cx } from '../ui/kit'
import { Feed, OPP_COLOR, RatingsPanel, Scoreboard, StatsPanel, USER_COLOR, scorerLine, type RatingRow } from './matchParts'
import { LINE_OPTIONS, PRESS_OPTIONS, STYLE_OPTIONS } from './Tactics'

const SPEED_MS: Record<Speed, number> = { 1: 650, 2: 320, 4: 110 }

type Tab = 'feed' | 'stats' | 'ratings'

export function ratingRows(t: TeamState): RatingRow[] {
  const row = (mp: MatchPlayer, status: RatingRow['status']): RatingRow => ({
    id: mp.id,
    pos: mp.pos,
    rating: mp.rating,
    energy: mp.energy,
    goals: mp.goals,
    assists: mp.assists,
    yellow: mp.yellow,
    sentOff: mp.sentOff,
    status,
  })
  return [
    ...t.onPitch.map((mp) => row(mp, mp.injured ? 'injured' : 'on')),
    ...t.off.map((mp) => row(mp, mp.sentOff ? 'sentOff' : mp.injured ? 'injured' : 'off')),
  ]
}

function statusText(m: LiveMatch, paused: boolean) {
  if (m.finished) return '경기 종료'
  if (m.minute === 0) return '킥오프 대기'
  if (m.minute === 45 && paused) return '하프타임'
  return `${m.minute <= 45 ? '전반' : '후반'} ${m.minute}'`
}

export function MatchScreen({ game }: { game: GameState }) {
  const match = useGame((s) => s.match)
  const speed = useGame((s) => s.speed)
  const paused = useGame((s) => s.paused)
  const busy = useGame((s) => s.busy)
  const { ensureMatch, tick, setPaused, setSpeed, skipMatch, finishMatch } = useGame.getState()
  const [tab, setTab] = useState<Tab>('feed')
  const [sheet, setSheet] = useState<'subs' | 'tactics' | null>(null)

  useEffect(() => {
    if (isSeasonOver(game)) navigate('', { replace: true })
    else ensureMatch()
  }, [game, ensureMatch])

  const running = !!match && !paused && !match.finished && sheet === null
  useEffect(() => {
    if (!running) return
    const id = setInterval(tick, SPEED_MS[speed])
    return () => clearInterval(id)
  }, [running, speed, tick])

  if (!match) {
    return <div className="flex flex-1 items-center justify-center text-muted">경기를 준비하는 중…</div>
  }

  const fixture = userFixture(game)
  const home = game.clubs[match.home.clubId]
  const away = game.clubs[match.away.clubId]
  const userSide: Side = home.id === game.userClubId ? 'home' : 'away'
  const userTeam = userSide === 'home' ? match.home : match.away
  const homeColor = userSide === 'home' ? USER_COLOR : OPP_COLOR
  const awayColor = userSide === 'home' ? OPP_COLOR : USER_COLOR
  const attendance = Math.round((home.capacity * (0.6 + home.reputation / 330)) / 10) * 10
  const halfTime = match.minute === 45 && paused && !match.finished
  const possessor = match.possession === 'home' ? home : away
  const possessorIsUser = match.possession === userSide
  const towardRight = match.possession === 'home'
  const attackDepth = towardRight ? match.ballX : 100 - match.ballX
  const zone = attackDepth > 66 ? '상대 진영' : attackDepth > 33 ? '중원' : '자기 진영'
  const ballColor = possessorIsUser ? USER_COLOR : OPP_COLOR

  const openSheet = (s: 'subs' | 'tactics') => {
    setSheet(s)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
        <button
          type="button"
          aria-label="결과 바로 보기"
          disabled={match.finished}
          onClick={skipMatch}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink disabled:opacity-40"
        >
          <IconSkip size={20} />
        </button>
        <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
          <span className="text-[13px] font-bold">
            {LEAGUE_NAME} · {fixture ? fixture.round + 1 : game.round + 1}라운드
          </span>
          <span className="truncate text-[11px] text-muted">
            {home.stadium} · 관중 {attendance.toLocaleString('ko-KR')}명
          </span>
        </div>
        <button
          type="button"
          aria-label={paused ? '재생' : '일시정지'}
          disabled={match.finished}
          onClick={() => setPaused(!paused)}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink disabled:opacity-40"
        >
          {paused ? <IconPlay size={20} /> : <IconPause size={20} />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="shrink-0 px-4">
          <Scoreboard
            home={home}
            away={away}
            homeGoals={match.home.goals}
            awayGoals={match.away.goals}
            status={statusText(match, paused)}
            live={!match.finished && !paused && match.minute > 0}
            homeScorers={scorerLine(match.events, 'home', game)}
            awayScorers={scorerLine(match.events, 'away', game)}
          />
        </div>

        <section
          aria-label={`볼 위치: ${possessor.short} 공격, ${zone}`}
          className="relative mx-4 mt-3 h-[92px] shrink-0 overflow-hidden rounded-[14px] border border-pitch-line bg-pitch"
        >
          <div
            className="absolute inset-y-0 transition-all duration-300"
            style={{
              left: `${Math.floor(match.ballX / 33.4) * 33.33}%`,
              width: '33.4%',
              background: possessorIsUser ? 'rgba(163,230,53,0.12)' : 'rgba(96,165,250,0.12)',
            }}
          />
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/22" />
          <div className="absolute top-1/2 left-1/2 -mt-5 -ml-5 size-10 rounded-full border border-white/22" />
          <div className="absolute top-[21px] left-0 h-12 w-[46px] border border-l-0 border-white/22" />
          <div className="absolute top-[21px] right-0 h-12 w-[46px] border border-r-0 border-white/22" />
          <div className="absolute top-[33px] left-0 h-6 w-[15px] border border-l-0 border-white/22" />
          <div className="absolute top-[33px] right-0 h-6 w-[15px] border border-r-0 border-white/22" />
          <div
            className="absolute -mt-1.5 -ml-1.5 size-3 rounded-full bg-white transition-all duration-300"
            style={{ left: `${match.ballX}%`, top: `${30 + ((match.minute * 37) % 40)}%`, boxShadow: '0 0 0 5px rgba(255,255,255,0.16)' }}
          />
          <div className="absolute top-2 left-2.5 flex items-center gap-1.5 rounded-full bg-bg/66 px-2 py-[3px] text-[11px] font-semibold text-ink">
            <span className="size-1.5 rounded-full" style={{ background: ballColor }} />
            {possessor.short} 공격 · {zone}
          </div>
          <div className="absolute right-2.5 bottom-[7px] text-[11px] font-semibold text-ink/80">
            {possessor.short} {towardRight ? '공격 방향 →' : '← 공격 방향'}
          </div>
        </section>

        <section aria-label="경기 흐름" className="mx-4 mt-3 flex shrink-0 flex-col gap-1.5">
          <div className="flex justify-between text-[12px] text-muted">
            <span className="font-semibold text-ink">경기 흐름</span>
            <span>
              <span style={{ color: homeColor }}>▲ {home.short}</span> · <span style={{ color: awayColor }}>▼ {away.short}</span>
            </span>
          </div>
          <Momentum bins={match.momentum} current={match.minute} upColor={homeColor} downColor={awayColor} />
        </section>

        <div className="mx-4 mt-3.5 shrink-0">
          <Segmented
            label="경기 정보 보기"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'feed', label: '중계' },
              { value: 'stats', label: '스탯' },
              { value: 'ratings', label: '평점' },
            ]}
          />
        </div>

        <div className="mx-4 mt-2.5 shrink-0">
          {match.pendingInjury && !match.finished && (
            <div className="mb-2 flex flex-col gap-2 rounded-xl border border-warn/40 bg-warn/8 px-3 py-2.5">
              <span className="text-[13px] font-semibold">
                {game.players[match.pendingInjury.playerId]?.name} 부상 — 교체가 필요합니다
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPaused(false)} className="h-9 rounded-lg border border-line bg-surface-2 text-[13px] font-semibold text-ink">
                  그대로 진행
                </button>
                <button
                  type="button"
                  disabled={userTeam.subsLeft === 0 || userTeam.bench.length === 0}
                  onClick={() => openSheet('subs')}
                  className="h-9 rounded-lg border-none bg-accent text-[13px] font-bold text-bg disabled:opacity-50"
                >
                  교체하기
                </button>
              </div>
            </div>
          )}
          {halfTime && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/8 px-3 py-2.5">
              <span className="text-[13px] font-semibold">하프타임 — 전술과 교체를 점검하세요</span>
              <button type="button" onClick={() => setPaused(false)} className="h-9 shrink-0 rounded-lg border-none bg-accent px-3 text-[13px] font-bold text-bg">
                후반전 시작
              </button>
            </div>
          )}
          {match.finished && (
            <div className="mb-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[13px] font-semibold">
              {resultLine(match, userSide)}
            </div>
          )}
          {tab === 'feed' && <Feed events={match.events} userSide={userSide} />}
          {tab === 'stats' && (
            <StatsPanel stats={{ home: match.home.stats, away: match.away.stats }} homeName={home.short} awayName={away.short} homeColor={homeColor} awayColor={awayColor} />
          )}
          {tab === 'ratings' && <RatingsPanel rows={ratingRows(userTeam)} game={game} live={!match.finished} />}
        </div>
      </div>

      <div className="pb-safe flex shrink-0 gap-2 border-t border-line-soft bg-nav px-4 pt-2.5">
        {match.finished ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await finishMatch()
              navigate('', { replace: true })
            }}
            className="h-12 flex-1 rounded-xl border-none bg-accent text-[15px] font-bold text-bg disabled:opacity-60"
          >
            {busy ? '다른 경기 결과 계산 중…' : '결과 저장하고 계속'}
          </button>
        ) : (
          <>
            <div role="group" aria-label="경기 속도" className="flex shrink-0 gap-0.5 rounded-xl border border-line bg-surface p-[3px]">
              {([1, 2, 4] as Speed[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  onClick={() => setSpeed(s)}
                  className={cx('h-10 w-9 rounded-[9px] border-none font-display text-[16px] font-bold', speed === s ? 'bg-active text-ink' : 'bg-transparent text-muted')}
                >
                  {s}x
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => openSheet('tactics')}
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#2E3F5E] bg-surface-2 text-[14px] font-semibold text-ink"
            >
              <IconSliders size={18} /> 전술
            </button>
            <button
              type="button"
              disabled={userTeam.subsLeft === 0 || userTeam.bench.length === 0}
              onClick={() => openSheet('subs')}
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border-none bg-accent text-[14px] font-bold text-bg disabled:opacity-50"
            >
              <IconSwap size={18} /> 교체 ({userTeam.subsLeft})
            </button>
          </>
        )}
      </div>

      <SubSheet open={sheet === 'subs'} onClose={() => setSheet(null)} game={game} team={userTeam} />
      <MatchTacticsSheet open={sheet === 'tactics'} onClose={() => setSheet(null)} team={userTeam} />
    </div>
  )
}

function resultLine(m: LiveMatch, userSide: Side) {
  const my = userSide === 'home' ? m.home.goals : m.away.goals
  const their = userSide === 'home' ? m.away.goals : m.home.goals
  if (my > their) return `승리! ${my} : ${their}로 승점 3점을 챙겼습니다.`
  if (my < their) return `패배. ${my} : ${their}로 경기를 내줬습니다.`
  return `무승부. ${my} : ${their}로 승점 1점을 나눠 가졌습니다.`
}

function SubSheet({ open, onClose, game, team }: { open: boolean; onClose: () => void; game: GameState; team: TeamState }) {
  const matchSub = useGame((s) => s.matchSub)
  const [outId, setOutId] = useState<string | null>(null)
  const close = () => {
    setOutId(null)
    onClose()
  }
  const out = team.onPitch.find((mp) => mp.id === outId) ?? null
  return (
    <Sheet open={open} onClose={close} title={out ? `${game.players[out.id].name} 대신 투입할 선수` : `교체할 선수 선택 · 남은 교체 ${team.subsLeft}회`}>
      {!out ? (
        <ul className="m-0 list-none p-0 pb-3">
          {[...team.onPitch]
            .sort((a, b) => a.energy - b.energy)
            .map((mp) => {
              const p = game.players[mp.id]
              return (
                <li key={mp.id}>
                  <button
                    type="button"
                    onClick={() => setOutId(mp.id)}
                    className="grid w-full items-center gap-2.5 border-0 border-t border-solid border-line-soft bg-transparent px-5 py-2.5 text-left text-ink"
                    style={{ gridTemplateColumns: '38px minmax(0,1fr) 80px 40px' }}
                  >
                    <PosBadge pos={mp.pos} />
                    <span className="truncate text-[14px] font-semibold">
                      {p.name}
                      {mp.yellow && <span className="ml-1.5 inline-block h-[11px] w-2 rounded-[1px] bg-caution align-middle" aria-label="경고" />}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="flex h-[5px] flex-1 overflow-hidden rounded-[3px] bg-line">
                        <span style={{ width: `${mp.energy}%`, background: mp.energy < 60 ? '#FB923C' : '#A3E635' }} />
                      </span>
                      <span className="w-6 text-right text-[11px] text-muted">{Math.round(mp.energy)}</span>
                    </span>
                    <span className="text-right font-display text-[16px] font-bold">{mp.rating.toFixed(1)}</span>
                  </button>
                </li>
              )
            })}
        </ul>
      ) : (
        <ul className="m-0 list-none p-0 pb-3">
          <li className="px-5 pb-2 text-[12px] text-muted">숫자는 {out.pos} 자리에서의 예상 능력치입니다.</li>
          {team.bench.map((id) => {
            const p = game.players[id]
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => {
                    matchSub(out.id, id)
                    close()
                  }}
                  className="grid w-full items-center gap-2.5 border-0 border-t border-solid border-line-soft bg-transparent px-5 py-2.5 text-left text-ink"
                  style={{ gridTemplateColumns: '38px minmax(0,1fr) 44px 40px' }}
                >
                  <PosBadge pos={p.position} />
                  <span className="truncate text-[14px] font-semibold">{p.name}</span>
                  <span className="text-right font-display text-[13px] font-semibold" style={{ color: conditionColor(p.condition) }}>
                    {p.condition}%
                  </span>
                  <span className="text-right font-display text-[22px] font-bold">{ratingAt(p, out.pos)}</span>
                </button>
              </li>
            )
          })}
          <li className="px-5 pt-2">
            <button type="button" onClick={() => setOutId(null)} className="h-11 w-full rounded-xl border border-line bg-surface-2 text-[14px] font-semibold text-ink">
              다른 선수 고르기
            </button>
          </li>
        </ul>
      )}
    </Sheet>
  )
}

function MatchTacticsSheet({ open, onClose, team }: { open: boolean; onClose: () => void; team: TeamState }) {
  const matchInstructions = useGame((s) => s.matchInstructions)
  return (
    <Sheet open={open} onClose={onClose} title="경기 중 전술 변경">
      <div className="flex flex-col gap-2.5 px-5 pt-1 pb-4">
        {(
          [
            ['플레이 스타일', STYLE_OPTIONS, team.style, (v: string) => matchInstructions({ style: v as Style })],
            ['압박 강도', PRESS_OPTIONS, team.press, (v: string) => matchInstructions({ press: v as Press })],
            ['수비 라인', LINE_OPTIONS, team.line, (v: string) => matchInstructions({ line: v as DefLine })],
          ] as const
        ).map(([label, options, value, onChange]) => (
          <div key={label} className="grid items-center gap-2" style={{ gridTemplateColumns: '82px minmax(0,1fr)' }}>
            <span className="text-[13px] text-muted">{label}</span>
            <Segmented label={label} tone="accent" size="sm" options={options as { value: string; label: string }[]} value={value} onChange={onChange} />
          </div>
        ))}
        <p className="m-0 text-[12px] leading-relaxed text-muted">경기 중 변경은 이번 경기에만 적용됩니다. 기본 전술은 전술 화면에서 바꿀 수 있어요.</p>
        <button type="button" onClick={onClose} className="mt-1 h-12 rounded-xl border-none bg-accent text-[15px] font-bold text-bg">
          적용하고 경기 재개
        </button>
      </div>
    </Sheet>
  )
}
