import { managerTitle } from '../engine/korean'
import { useState } from 'react'
import { LEAGUE_NAME } from '../engine/data/clubs'
import { ovr } from '../engine/ratings'
import { isSeasonOver, userFixture } from '../engine/season'
import { computeStandings, standingsOf } from '../engine/standings'
import type { GameState } from '../engine/types'
import { href, navigate } from '../router'
import { useGame } from '../store/gameStore'
import { IconBell, IconChevronRight, IconMenu } from '../ui/Icons'
import { formatMoney } from '../engine/korean'
import { windowLabel, windowState } from '../engine/transfers'
import { Card, Crest, FormBadge, Sheet, TAG_STYLE, cx, moraleLabel } from '../ui/kit'
import { BoardMeter } from './Finance'

function lineupStrength(game: GameState, clubId: string) {
  const ids = game.clubs[clubId].tactics.lineup.filter((x): x is string => !!x)
  if (ids.length === 0) return 0
  return Math.round(ids.reduce((s, id) => s + ovr(game.players[id]), 0) / ids.length)
}

export function HomeScreen({ game }: { game: GameState }) {
  const exitToMenu = useGame((s) => s.exitToMenu)
  const slot = useGame((s) => s.slot)
  const [menuOpen, setMenuOpen] = useState(false)
  const club = game.clubs[game.userClubId]
  const fixture = userFixture(game)
  const over = isSeasonOver(game)
  const table = standingsOf(game)
  const rankOf = (id: string) => table.findIndex((r) => r.clubId === id) + 1
  const myRow = table.find((r) => r.clubId === club.id)!
  const rank = rankOf(club.id)
  const prevTable = game.round > 1 ? computeStandings(game.clubOrder, game.fixtures.filter((f) => f.round < game.round - 1)) : null
  const prevRank = prevTable ? prevTable.findIndex((r) => r.clubId === club.id) + 1 : null
  const delta = prevRank ? prevRank - rank : 0
  const started = game.round > 0

  const squad = club.playerIds.map((id) => game.players[id])
  const morale = moraleLabel(squad.reduce((s, p) => s + p.morale, 0) / squad.length)
  const unread = game.inbox.filter((m) => !m.read).length
  const tired = club.tactics.lineup.filter((id) => id && game.players[id].condition < 70).length

  const isHome = fixture?.homeId === club.id
  const oppId = fixture ? (isHome ? fixture.awayId : fixture.homeId) : null
  const opp = oppId ? game.clubs[oppId] : null
  const oppForm = oppId ? table.find((r) => r.clubId === oppId)!.form : []
  const report = game.lastReport

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 px-4 pt-5 pb-3">
        <Crest club={club} size={40} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="truncate text-[17px] font-bold">{club.name}</div>
          <div className="truncate text-[13px] text-muted">
            시즌 {game.season} · {over ? '시즌 종료' : `${game.round + 1}라운드`} · {LEAGUE_NAME}
          </div>
        </div>
        <a
          href={href('inbox')}
          aria-label={unread ? `받은 메시지, 새 메시지 ${unread}개` : '받은 메시지'}
          className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink"
        >
          <IconBell size={22} />
          {unread > 0 && <span className="absolute top-[9px] right-[10px] size-2 rounded-full bg-warn" />}
        </a>
        <button
          type="button"
          aria-label="메뉴"
          onClick={() => setMenuOpen(true)}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink"
        >
          <IconMenu size={20} />
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-3">
        {over ? (
          <Card label="시즌 종료" className="flex shrink-0 flex-col gap-3 p-4">
            <span className="text-[12px] font-bold tracking-wide text-accent">시즌 {game.season} 종료</span>
            <div className="text-[20px] font-bold">최종 {rank}위 · 승점 {myRow.points}</div>
            <p className="m-0 text-[13px] leading-relaxed text-muted">
              이사회 목표는 '{game.objective.label}'였습니다. 시즌 결산을 확인하고 다음 시즌을 시작하세요.
            </p>
            <a href={href('season')} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#2E3F5E] bg-surface-2 text-[14px] font-semibold text-ink no-underline">
              시즌 결산 보기 <IconChevronRight size={18} />
            </a>
          </Card>
        ) : (
          fixture &&
          opp && (
            <Card label="다음 경기" className="flex shrink-0 flex-col gap-3.5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold tracking-wide text-accent">다음 경기 · {fixture.round + 1}라운드</span>
                <span className="text-[12px] text-muted">{isHome ? '홈 경기' : '원정 경기'}</span>
              </div>
              <div className="grid items-center gap-2" style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)' }}>
                {[club, opp].map((c, i) => (
                  <div key={c.id} className={cx('flex flex-col items-center gap-1.5 text-center', i === 1 && 'order-3')}>
                    <Crest club={c} size={48} />
                    <div className="text-[14px] font-semibold">{c.name}</div>
                    <div className="text-[12px] text-muted">
                      {started ? `${rankOf(c.id)}위 · ` : ''}전력 {lineupStrength(game, c.id)}
                    </div>
                  </div>
                ))}
                <div className="order-2 font-display text-[26px] font-semibold tracking-[0.06em] text-muted">VS</div>
              </div>
              {oppForm.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted">{opp.name} 최근 {oppForm.length}경기</span>
                  <div className="flex gap-1">
                    {oppForm.map((r, i) => (
                      <FormBadge key={i} r={r} />
                    ))}
                  </div>
                </div>
              )}
              {tired > 0 && (
                <div className="rounded-xl bg-warn/10 px-3 py-2 text-[12px] font-medium text-warn">
                  선발 중 컨디션 70% 미만 선수가 {tired}명 있습니다.
                </div>
              )}
              <a href={href('tactics')} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#2E3F5E] bg-surface-2 text-[14px] font-semibold text-ink no-underline">
                라인업 · 전술 확인 <IconChevronRight size={18} />
              </a>
            </Card>
          )
        )}

        <div className="grid shrink-0 grid-cols-3 gap-2">
          <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-3">
            <span className="text-[12px] text-muted">리그 순위</span>
            <span className="font-display text-[28px] leading-none font-bold">
              {started ? rank : '-'}
              {started && <span className="ml-0.5 text-[15px] font-semibold">위</span>}
            </span>
            <span className={cx('text-[11px] font-semibold', delta > 0 ? 'text-accent' : delta < 0 ? 'text-warn' : 'text-muted')}>
              {!started ? '개막 전' : prevRank === null ? `${game.round}경기 치름` : delta > 0 ? `▲ ${delta}계단 상승` : delta < 0 ? `▼ ${-delta}계단 하락` : '변동 없음'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-3">
            <span className="text-[12px] text-muted">승점</span>
            <span className="font-display text-[28px] leading-none font-bold">{myRow.points}</span>
            <span className="text-[11px] text-muted">
              {myRow.won}승 {myRow.drawn}무 {myRow.lost}패
            </span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-3">
            <span className="text-[12px] text-muted">팀 사기</span>
            <span className="text-[18px] leading-7 font-bold">{morale.label}</span>
            <div aria-hidden="true" className="flex gap-[3px]">
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={cx('h-1 flex-1 rounded-sm', i <= morale.level ? 'bg-accent' : 'bg-line')} />
              ))}
            </div>
          </div>
        </div>

        <a href={href('club/finance')} className="flex shrink-0 flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-ink no-underline">
          <BoardMeter game={game} compact />
          <div className="flex items-center justify-between text-[12px] text-muted">
            <span>
              잔고 <b className={club.budget < 0 ? 'text-warn' : 'text-ink'}>{formatMoney(club.budget)}</b>
            </span>
            <span className={windowState(game).open ? 'font-semibold text-accent' : ''}>{windowLabel(game)}</span>
          </div>
        </a>

        {game.offers.length > 0 && (
          <a href={href('club/transfer')} className="flex shrink-0 items-center justify-between rounded-2xl border border-accent/40 bg-accent/8 px-4 py-3 text-ink no-underline">
            <span className="text-[14px] font-semibold">받은 이적 제안 {game.offers.length}건</span>
            <IconChevronRight size={18} className="text-accent" />
          </a>
        )}

        {report && (
          <a href={href('report')} className="flex shrink-0 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-ink no-underline">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[12px] text-muted">지난 경기 결과</span>
              <span className="truncate text-[15px] font-semibold">
                {game.clubs[report.homeId].short} <span className="font-display text-[18px]">{report.homeGoals} : {report.awayGoals}</span>{' '}
                {game.clubs[report.awayId].short}
              </span>
            </div>
            <ResultPill game={game} />
            <IconChevronRight size={18} className="text-muted" />
          </a>
        )}

        <Card label="받은 메시지" className="flex shrink-0 flex-col py-1">
          <div className="flex items-center justify-between py-1.5 pr-2 pl-4">
            <h2 className="m-0 text-[15px] font-bold">받은 메시지</h2>
            <a href={href('inbox')} className="flex h-9 items-center px-2 text-[13px] font-semibold text-accent no-underline">
              전체 보기
            </a>
          </div>
          {game.inbox.slice(0, 3).map((m) => (
            <a key={m.id} href={href('inbox')} className="flex items-start gap-3 border-t border-line-soft px-4 py-[11px] text-ink no-underline">
              <span className={cx('w-[52px] shrink-0 rounded-full py-[3px] text-center text-[11px] font-bold', TAG_STYLE[m.tag].cls)}>{TAG_STYLE[m.tag].label}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <div className="truncate text-[14px] font-semibold">{m.title}</div>
                <div className="truncate text-[12px] text-muted">{m.body}</div>
              </div>
              {!m.read && <span aria-hidden="true" className="mt-[7px] size-2 shrink-0 rounded-full bg-accent" />}
            </a>
          ))}
        </Card>
      </main>

      <div className="shrink-0 px-4 pb-3">
        {over ? (
          <a href={href('season')} className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-accent text-[16px] font-bold text-bg no-underline">
            시즌 결산 · 다음 시즌 <IconChevronRight size={20} strokeWidth={2.2} />
          </a>
        ) : (
          <button
            type="button"
            onClick={() => navigate('match')}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border-none bg-accent text-[16px] font-bold text-bg"
          >
            다음 진행 · {game.round + 1}라운드 경기 <IconChevronRight size={20} strokeWidth={2.2} />
          </button>
        )}
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="메뉴">
        <div className="flex flex-col gap-2 px-5 pt-1 pb-4">
          <div className="text-[13px] text-muted">
            {managerTitle(game.managerName)} · 저장 슬롯 {slot !== null ? slot + 1 : '-'} · 자동 저장됨
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              void exitToMenu()
              navigate('', { replace: true })
            }}
            className="h-12 rounded-xl border border-line bg-surface-2 text-[15px] font-semibold text-ink"
          >
            저장하고 메인 메뉴로
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function ResultPill({ game }: { game: GameState }) {
  const r = game.lastReport!
  const home = r.homeId === game.userClubId
  const my = home ? r.homeGoals : r.awayGoals
  const their = home ? r.awayGoals : r.homeGoals
  const res = my > their ? 'W' : my < their ? 'L' : 'D'
  return <FormBadge r={res} />
}
