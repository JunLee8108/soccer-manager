import { useState } from 'react'
import { formatMoney } from '../engine/korean'
import { expiringPlayers, renewalOffer, suggestedDecision } from '../engine/offseason'
import { ovr, ovrAt } from '../engine/ratings'
import { isSeasonOver, seasonSummary } from '../engine/season'
import { standingsOf } from '../engine/standings'
import type { ContractDecision, GameState } from '../engine/types'
import { goBack, navigate } from '../router'
import { useGame } from '../store/gameStore'
import { Card, ClubDot, Crest, EmptyState, PosBadge, ScreenHeader, cx } from '../ui/kit'

export function SeasonScreen({ game }: { game: GameState }) {
  const beginNextSeason = useGame((s) => s.beginNextSeason)
  const club = game.clubs[game.userClubId]
  const expiring = isSeasonOver(game) ? expiringPlayers(game, club.id) : []
  const [decisions, setDecisions] = useState<Record<string, ContractDecision>>(() =>
    Object.fromEntries(expiring.map((p) => [p.id, suggestedDecision(p, club, game)])),
  )
  const [starting, setStarting] = useState(false)

  if (!isSeasonOver(game)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScreenHeader title="시즌 결산" onBack={() => goBack('')} />
        <EmptyState title="시즌이 아직 진행 중입니다" />
      </div>
    )
  }
  const s = seasonSummary(game)
  const champion = game.clubs[s.championId]
  const table = standingsOf(game)
  const risers = [...club.playerIds, ...club.youthIds]
    .map((id) => game.players[id])
    .map((p) => ({ p, delta: ovr(p) - ovrAt(p.seasonStart, p.position) }))
    .filter((x) => x.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5)
  const releasing = Object.values(decisions).filter((d) => d === 'release').length
  const veterans = club.playerIds.map((id) => game.players[id]).filter((p) => p.age >= 33).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title={`시즌 ${game.season} 결산`} subtitle={`${game.managerName} 감독 · ${club.name}`} onBack={() => goBack('')} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-3">
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
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="shrink-0 text-[13px] text-muted">득점왕</span>
            <span className="truncate text-[14px] font-semibold">
              {s.topScorer ? `${s.topScorer.name} (${game.clubs[s.topScorer.clubId].short}) · ${s.topScorerGoals}골` : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="shrink-0 text-[13px] text-muted">우리 팀 최고 평점</span>
            <span className="truncate text-[14px] font-semibold">
              {s.bestPlayer ? `${s.bestPlayer.name} · ${(s.bestPlayer.stats.ratingSum / s.bestPlayer.stats.rated).toFixed(2)}` : '-'}
            </span>
          </div>
        </Card>

        {risers.length > 0 && (
          <Card label="이번 시즌 성장 TOP" className="overflow-hidden">
            <h2 className="m-0 px-4 py-2.5 text-[14px] font-bold">이번 시즌 성장 TOP</h2>
            {risers.map(({ p, delta }) => (
              <div key={p.id} className="grid h-12 items-center gap-2.5 border-t border-line-soft px-4" style={{ gridTemplateColumns: '38px minmax(0,1fr) auto' }}>
                <PosBadge pos={p.position} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[14px] font-semibold">{p.name}</span>
                  <span className="text-[11px] text-muted">
                    {p.age}세 · {ovrAt(p.seasonStart, p.position)} → {ovr(p)}
                  </span>
                </span>
                <span className="font-display text-[18px] font-bold text-accent">+{delta}</span>
              </div>
            ))}
          </Card>
        )}

        <Card label="계약 만료 선수" className="overflow-hidden">
          <div className="flex items-baseline justify-between px-4 py-2.5">
            <h2 className="m-0 text-[14px] font-bold">계약 만료 선수 {expiring.length}명</h2>
            {expiring.length > 0 && <span className="text-[12px] text-muted">재계약 조건은 자동 제시</span>}
          </div>
          {expiring.length === 0 && <div className="border-t border-line-soft px-4 py-3 text-[13px] text-muted">이번 시즌 계약이 끝나는 선수가 없습니다.</div>}
          {expiring.map((p) => {
            const offer = renewalOffer(p)
            const d = decisions[p.id] ?? 'renew'
            return (
              <div key={p.id} className="flex flex-col gap-2 border-t border-line-soft px-4 py-3">
                <div className="grid items-center gap-2.5" style={{ gridTemplateColumns: '38px minmax(0,1fr) auto' }}>
                  <PosBadge pos={p.position} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[14px] font-semibold">{p.name}</span>
                    <span className="truncate text-[11px] text-muted">
                      {p.age}세 · 능력 {ovr(p)} · {p.stats.apps}경기
                    </span>
                  </span>
                  <span className="text-right text-[11px] text-muted">
                    주급 {formatMoney(offer.wage)}
                    <br />
                    {offer.years}년
                  </span>
                </div>
                <div role="group" aria-label={`${p.name} 계약 결정`} className="grid grid-cols-2 gap-[3px] rounded-[11px] bg-bg p-[3px]">
                  {(['renew', 'release'] as ContractDecision[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={d === v}
                      onClick={() => setDecisions({ ...decisions, [p.id]: v })}
                      className={cx(
                        'h-9 rounded-lg border-none text-[13px] font-semibold',
                        d === v ? (v === 'renew' ? 'bg-accent text-bg' : 'bg-warn text-bg') : 'bg-transparent text-ink-2',
                      )}
                    >
                      {v === 'renew' ? '재계약' : '방출'}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </Card>

        <Card className="flex flex-col gap-1.5 p-4 text-[13px] leading-relaxed text-muted">
          <span className="text-[14px] font-bold text-ink">다음 시즌으로 넘어가면</span>
          <span>· 프리시즌 훈련으로 젊은 선수들이 조금 더 성장하고, 모두 한 살씩 나이를 먹습니다.</span>
          <span>· 33세 이상 선수 {veterans}명 중 일부가 은퇴할 수 있습니다.</span>
          <span>· 유스 아카데미에 새 유망주가 입단하고, 20세가 된 유스 선수는 승격 또는 방출됩니다.</span>
          {releasing > 0 && <span className="text-warn">· 방출을 선택한 {releasing}명이 팀을 떠납니다.</span>}
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
      </div>
      <div className="shrink-0 px-4 pb-3">
        <button
          type="button"
          disabled={starting}
          onClick={async () => {
            setStarting(true)
            await beginNextSeason(decisions)
            navigate('', { replace: true })
          }}
          className="h-[52px] w-full rounded-[14px] border-none bg-accent text-[16px] font-bold text-bg disabled:opacity-60"
        >
          {starting ? '새 시즌 준비 중…' : `시즌 ${game.season + 1} 시작`}
        </button>
      </div>
    </div>
  )
}
