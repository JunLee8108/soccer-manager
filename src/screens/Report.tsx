import { useState } from 'react'
import type { PlayerLine } from '../engine/match/types'
import type { GameState } from '../engine/types'
import { goBack } from '../router'
import { Momentum } from '../ui/charts'
import { EmptyState, ScreenHeader, Segmented } from '../ui/kit'
import { Feed, OPP_COLOR, RatingsPanel, Scoreboard, StatsPanel, USER_COLOR, scorerLine, type RatingRow } from './matchParts'

type Tab = 'feed' | 'stats' | 'ratings'

const toRows = (lines: PlayerLine[]): RatingRow[] =>
  lines.map((l) => ({
    id: l.id,
    pos: l.pos,
    rating: l.rating,
    energy: l.energy,
    goals: l.goals,
    assists: l.assists,
    yellow: l.yellow,
    sentOff: l.sentOff,
    status: l.sentOff ? 'sentOff' : 'on',
  }))

export function ReportScreen({ game }: { game: GameState }) {
  const [tab, setTab] = useState<Tab>('stats')
  const r = game.lastReport
  if (!r) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScreenHeader title="경기 리포트" onBack={() => goBack('')} />
        <EmptyState title="아직 치른 경기가 없습니다" />
      </div>
    )
  }
  const home = game.clubs[r.homeId]
  const away = game.clubs[r.awayId]
  const userSide = r.homeId === game.userClubId ? 'home' : 'away'
  const homeColor = userSide === 'home' ? USER_COLOR : OPP_COLOR
  const awayColor = userSide === 'home' ? OPP_COLOR : USER_COLOR
  const motm = r.motmId ? game.players[r.motmId] : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title="경기 리포트" subtitle={motm ? `최우수 선수: ${motm.name}` : undefined} onBack={() => goBack('')} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
        <Scoreboard
          home={home}
          away={away}
          homeGoals={r.homeGoals}
          awayGoals={r.awayGoals}
          status="경기 종료"
          live={false}
          homeScorers={scorerLine(r.events, 'home', game)}
          awayScorers={scorerLine(r.events, 'away', game)}
        />
        <section aria-label="경기 흐름" className="flex shrink-0 flex-col gap-1.5">
          <div className="flex justify-between text-[12px] text-muted">
            <span className="font-semibold text-ink">경기 흐름</span>
            <span>
              <span style={{ color: homeColor }}>▲ {home.short}</span> · <span style={{ color: awayColor }}>▼ {away.short}</span>
            </span>
          </div>
          <Momentum bins={r.momentum} current={90} upColor={homeColor} downColor={awayColor} />
        </section>
        <Segmented
          label="리포트 보기"
          value={tab}
          onChange={setTab}
          className="shrink-0"
          options={[
            { value: 'stats', label: '스탯' },
            { value: 'ratings', label: '평점' },
            { value: 'feed', label: '중계' },
          ]}
        />
        {tab === 'stats' && <StatsPanel stats={r.stats} homeName={home.short} awayName={away.short} homeColor={homeColor} awayColor={awayColor} />}
        {tab === 'ratings' && <RatingsPanel rows={toRows(userSide === 'home' ? r.players.home : r.players.away)} game={game} live={false} />}
        {tab === 'feed' && <Feed events={r.events} userSide={userSide} />}
      </div>
    </div>
  )
}
