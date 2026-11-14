import { isSeasonOver, seasonSummary } from '../engine/season'
import { standingsOf } from '../engine/standings'
import type { GameState } from '../engine/types'
import { goBack, navigate } from '../router'
import { useGame } from '../store/gameStore'
import { Card, ClubDot, Crest, EmptyState, ScreenHeader, cx } from '../ui/kit'

export function SeasonScreen({ game }: { game: GameState }) {
  const beginNextSeason = useGame((s) => s.beginNextSeason)
  if (!isSeasonOver(game)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScreenHeader title="시즌 결산" onBack={() => goBack('')} />
        <EmptyState title="시즌이 아직 진행 중입니다" />
      </div>
    )
  }
  const s = seasonSummary(game)
  const club = game.clubs[game.userClubId]
  const champion = game.clubs[s.championId]
  const table = standingsOf(game)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title={`시즌 ${game.season} 결산`} subtitle={`${game.managerName} 감독 · ${club.name}`} onBack={() => goBack('')} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
        <Card className="flex flex-col items-center gap-2 px-4 py-5 text-center">
          <Crest club={club} size={56} />
          <span className="font-display text-[44px] leading-none font-bold">{s.rank}위</span>
          <span className="text-[13px] text-muted">승점 {s.points}</span>
          <span className={cx('rounded-full px-3 py-1 text-[12px] font-bold', s.objectiveMet ? 'bg-accent/16 text-accent' : 'bg-warn/16 text-warn')}>
            목표 '{game.objective.label}' {s.objectiveMet ? '달성' : '미달성'}
          </span>
        </Card>

        <Card className="flex flex-col divide-y divide-line-soft">
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[13px] text-muted">우승</span>
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              <ClubDot color={champion.color} /> {champion.name}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[13px] text-muted">득점왕</span>
            <span className="text-[14px] font-semibold">
              {s.topScorer ? `${s.topScorer.name} (${game.clubs[s.topScorer.clubId].short}) · ${s.topScorerGoals}골` : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[13px] text-muted">우리 팀 최고 평점</span>
            <span className="text-[14px] font-semibold">
              {s.bestPlayer ? `${s.bestPlayer.name} · ${(s.bestPlayer.stats.ratingSum / s.bestPlayer.stats.rated).toFixed(2)}` : '-'}
            </span>
          </div>
        </Card>

        <Card label="최종 순위" className="overflow-hidden">
          <h2 className="m-0 px-4 py-2.5 text-[14px] font-bold">최종 순위</h2>
          {table.map((r, i) => {
            const c = game.clubs[r.clubId]
            const mine = c.id === game.userClubId
            return (
              <div key={r.clubId} className={cx('flex h-9 items-center gap-2.5 border-t border-line-soft px-4', mine && 'bg-accent/8')}>
                <span className="w-5 text-center font-display text-[14px] font-bold text-muted">{i + 1}</span>
                <ClubDot color={c.color} />
                <span className={cx('flex-1 truncate text-[13px]', mine ? 'font-bold text-accent' : 'font-medium')}>{c.name}</span>
                <span className="font-display text-[15px] font-bold">{r.points}</span>
              </div>
            )
          })}
        </Card>

        {game.history.length > 0 && (
          <Card label="지난 시즌 기록" className="overflow-hidden">
            <h2 className="m-0 px-4 py-2.5 text-[14px] font-bold">지난 시즌 기록</h2>
            {game.history.map((h) => (
              <div key={h.season} className="flex h-10 items-center justify-between border-t border-line-soft px-4 text-[13px]">
                <span className="text-muted">시즌 {h.season}</span>
                <span className="font-semibold">
                  {h.rank}위 · 승점 {h.points}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
      <div className="shrink-0 px-4 pb-3">
        <button
          type="button"
          onClick={async () => {
            await beginNextSeason()
            navigate('', { replace: true })
          }}
          className="h-[52px] w-full rounded-[14px] border-none bg-accent text-[16px] font-bold text-bg"
        >
          시즌 {game.season + 1} 시작
        </button>
        <p className="m-0 pt-2 text-center text-[11px] text-muted">선수들의 나이가 한 살 늘고, 새 일정이 만들어집니다.</p>
      </div>
    </div>
  )
}
