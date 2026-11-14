import { useEffect, useRef, useState } from 'react'
import { LEAGUE_NAME } from '../engine/data/clubs'
import type { LiveMatch, MatchPlayer, Side, TeamState } from '../engine/match/types'
import { passPct } from '../engine/match/engine'
import { isSeasonOver, userFixture } from '../engine/season'
import type { GameState } from '../engine/types'
import { navigate } from '../router'
import { useGame, type Speed } from '../store/gameStore'
import { Momentum } from '../ui/charts'
import { IconPause, IconPlay, IconSkip, IconSliders, IconSwap } from '../ui/Icons'
import { Segmented, cx } from '../ui/kit'
import { MatchBoard, type BoardTab } from './MatchBoard'
import { Feed, OPP_COLOR, RatingsPanel, Scoreboard, StatsPanel, USER_COLOR, scorerLine, type RatingRow } from './matchParts'

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
    shots: mp.shots,
    onTarget: mp.onTarget,
    keyPasses: mp.keyPasses,
    tackles: mp.tackles,
    passPct: passPct(mp),
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
  const autoBoard = useGame((s) => s.autoBoard)
  const [tab, setTab] = useState<Tab>('feed')
  const [board, setBoard] = useState<{ tab: BoardTab; selected: string | null } | null>(null)
  const autoOpened = useRef(new Set<string>())

  useEffect(() => {
    if (isSeasonOver(game)) navigate('', { replace: true })
    else ensureMatch()
  }, [game, ensureMatch])

  const running = !!match && !paused && !match.finished && board === null
  useEffect(() => {
    if (!running) return
    const id = setInterval(tick, SPEED_MS[speed])
    return () => clearInterval(id)
  }, [running, speed, tick])

  // Open the board by itself at half-time and when one of our players is injured.
  const atHalf = !!match && match.minute === 45 && paused && !match.finished
  const injuredId = match?.pendingInjury?.playerId ?? null
  useEffect(() => {
    if (!autoBoard || !match) return
    const key = injuredId ? `inj:${match.fixtureId}:${injuredId}` : atHalf ? `half:${match.fixtureId}` : null
    if (!key || autoOpened.current.has(key)) return
    autoOpened.current.add(key)
    setBoard({ tab: 'subs', selected: injuredId })
  }, [autoBoard, atHalf, injuredId, match])

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

  const openBoard = (tab: BoardTab, selected: string | null = null) => setBoard({ tab, selected })

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
                  onClick={() => openBoard('subs', match.pendingInjury?.playerId ?? null)}
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
              <span className="flex shrink-0 gap-1.5">
                <button type="button" onClick={() => openBoard('subs')} className="h-9 rounded-lg border border-line bg-surface-2 px-3 text-[13px] font-semibold text-ink">
                  보드
                </button>
                <button type="button" onClick={() => setPaused(false)} className="h-9 rounded-lg border-none bg-accent px-3 text-[13px] font-bold text-bg">
                  후반전 시작
                </button>
              </span>
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
              onClick={() => openBoard('shape')}
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#2E3F5E] bg-surface-2 text-[14px] font-semibold text-ink"
            >
              <IconSliders size={18} /> 전술
            </button>
            <button
              type="button"
              disabled={userTeam.subsLeft === 0 || userTeam.bench.length === 0}
              onClick={() => openBoard('subs')}
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border-none bg-accent text-[14px] font-bold text-bg disabled:opacity-50"
            >
              <IconSwap size={18} /> 교체 ({userTeam.subsLeft})
            </button>
          </>
        )}
      </div>

      {board && (
        <MatchBoard
          game={game}
          match={match}
          side={userSide}
          initialTab={board.tab}
          initialSelected={board.selected}
          onClose={() => setBoard(null)}
          onResume={() => {
            setBoard(null)
            setPaused(false)
          }}
        />
      )}
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
