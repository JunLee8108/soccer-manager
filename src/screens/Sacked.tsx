import { managerTitle } from '../engine/korean'
import { objectiveFor } from '../engine/generator'
import type { GameState } from '../engine/types'
import { navigate } from '../router'
import { useGame } from '../store/gameStore'
import { Card, Crest } from '../ui/kit'

export function SackedScreen({ game }: { game: GameState }) {
  const takeJob = useGame((s) => s.takeJob)
  const exitToMenu = useGame((s) => s.exitToMenu)
  const club = game.clubs[game.userClubId]
  const byRep = [...game.clubOrder].sort((a, b) => game.clubs[b].reputation - game.clubs[a].reputation)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
      <div className="flex flex-col items-center gap-3 pt-14 pb-6 text-center">
        <Crest club={club} size={56} />
        <h1 className="m-0 text-[24px] font-bold">경질 통보</h1>
        <p className="m-0 text-[14px] leading-relaxed text-muted">
          {club.name} 이사회가 {managerTitle(game.managerName)}과의 결별을 결정했습니다.
          <br />
          시즌 {game.season} · {game.round}라운드 · 이사회 신뢰도 {Math.round(game.board.confidence)}
        </p>
      </div>

      <h2 className="m-0 px-1 pb-2 text-[13px] font-semibold text-muted">감독직 제안</h2>
      <div className="flex flex-col gap-2">
        {game.board.jobOffers.map((id) => {
          const c = game.clubs[id]
          return (
            <Card key={id} className="flex items-center gap-3 p-3.5">
              <Crest club={c} size={40} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-bold">{c.name}</span>
                <span className="truncate text-[12px] text-muted">
                  목표 {objectiveFor(byRep.indexOf(id) + 1).label} · 명성 {c.reputation}
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await takeJob(id)
                  navigate('', { replace: true })
                }}
                className="h-11 shrink-0 rounded-xl border-none bg-accent px-4 text-[14px] font-bold text-bg"
              >
                부임하기
              </button>
            </Card>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          void exitToMenu()
          navigate('', { replace: true })
        }}
        className="mt-4 h-12 rounded-xl border border-line bg-surface text-[14px] font-semibold text-ink"
      >
        메인 메뉴로 (새 게임)
      </button>
    </div>
  )
}
