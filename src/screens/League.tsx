import { useState } from 'react'
import { LEAGUE_NAME } from '../engine/data/clubs'
import { isSeasonOver, totalRounds } from '../engine/season'
import { standingsOf, topAssists, topRated, topScorers, type LeaderRow } from '../engine/standings'
import type { GameState } from '../engine/types'
import { href } from '../router'
import { IconChevronLeft, IconChevronRight } from '../ui/Icons'
import { Card, ClubDot, EmptyState, PosBadge, ScreenHeader, Segmented, cx } from '../ui/kit'

type Tab = 'table' | 'fixtures' | 'stats'

export function LeagueScreen({ game }: { game: GameState }) {
  const [tab, setTab] = useState<Tab>('table')
  const over = isSeasonOver(game)
  const played = Math.min(game.round, totalRounds(game))
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title="리그"
        subtitle={`${LEAGUE_NAME} · ${game.clubOrder.length}개 클럽`}
        right={
          <span className="flex h-11 shrink-0 items-center rounded-xl border border-line bg-surface px-3.5 text-[13px] font-semibold">
            시즌 {game.season} · {over ? '종료' : played === 0 ? '개막 전' : `${played}R 종료`}
          </span>
        }
      />
      <div className="shrink-0 px-4 pb-3">
        <Segmented
          label="리그 정보 보기"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'table', label: '순위' },
            { value: 'fixtures', label: '일정 · 결과' },
            { value: 'stats', label: '개인 기록' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {tab === 'table' && <Table game={game} />}
        {tab === 'fixtures' && <Fixtures game={game} />}
        {tab === 'stats' && <Leaders game={game} />}
      </div>
    </div>
  )
}

const COLS = '24px minmax(0,1fr) 20px 20px 20px 20px 32px 30px'

function Table({ game }: { game: GameState }) {
  const rows = standingsOf(game)
  const n = rows.length
  return (
    <>
      <Card label="리그 순위표" className="overflow-hidden">
        <div className="grid h-[30px] items-center gap-1 px-3 text-[11px] text-muted" style={{ gridTemplateColumns: COLS }}>
          <span className="text-center">#</span>
          <span>클럽</span>
          <span className="text-center">경</span>
          <span className="text-center">승</span>
          <span className="text-center">무</span>
          <span className="text-center">패</span>
          <span className="text-center">득실</span>
          <span className="text-right">승점</span>
        </div>
        {rows.map((r, i) => {
          const rank = i + 1
          const club = game.clubs[r.clubId]
          const mine = r.clubId === game.userClubId
          const zone = rank <= 4 ? 'bg-accent/18 text-accent' : rank > n - 3 ? 'bg-warn/18 text-warn' : 'text-muted'
          return (
            <div
              key={r.clubId}
              className={cx('grid h-[33px] items-center gap-1 border-t border-line-soft px-3', mine && 'bg-accent/8')}
              style={{ gridTemplateColumns: COLS }}
            >
              <span className={cx('flex size-[22px] items-center justify-center rounded-md font-display text-[14px] font-bold', zone)}>{rank}</span>
              <span className="flex min-w-0 items-center gap-2">
                <ClubDot color={club.color} />
                <span className={cx('truncate text-[13px]', mine ? 'font-bold text-accent' : 'font-medium')}>{club.name}</span>
              </span>
              {[r.played, r.won, r.drawn, r.lost].map((v, k) => (
                <span key={k} className="text-center font-display text-[15px] text-ink-2">
                  {v}
                </span>
              ))}
              <span className="text-center font-display text-[15px] text-ink-2">{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
              <span className="text-right font-display text-[16px] font-bold">{r.points}</span>
            </div>
          )
        })}
      </Card>
      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-accent/30" />
          대륙컵 진출 (1–4위)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-warn/30" />
          강등권 ({n - 2}–{n}위)
        </span>
      </div>
    </>
  )
}

function Fixtures({ game }: { game: GameState }) {
  const total = totalRounds(game)
  const [round, setRound] = useState(Math.min(game.round, total - 1))
  const list = game.fixtures.filter((f) => f.round === round)
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 라운드"
          disabled={round === 0}
          onClick={() => setRound(round - 1)}
          className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-ink disabled:opacity-40"
        >
          <IconChevronLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[15px] font-bold">{round + 1}라운드</span>
          <span className="text-[11px] text-muted">{round < game.round ? '경기 종료' : round === game.round ? '다음 경기' : '예정'}</span>
        </div>
        <button
          type="button"
          aria-label="다음 라운드"
          disabled={round >= total - 1}
          onClick={() => setRound(round + 1)}
          className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-ink disabled:opacity-40"
        >
          <IconChevronRight size={20} />
        </button>
      </div>
      <Card className="overflow-hidden">
        {list.map((f, i) => {
          const h = game.clubs[f.homeId]
          const a = game.clubs[f.awayId]
          const mine = f.homeId === game.userClubId || f.awayId === game.userClubId
          return (
            <div
              key={f.id}
              className={cx('grid h-12 items-center gap-2 px-3', i > 0 && 'border-t border-line-soft', mine && 'bg-accent/8')}
              style={{ gridTemplateColumns: 'minmax(0,1fr) 64px minmax(0,1fr)' }}
            >
              <span className="flex min-w-0 items-center justify-end gap-2">
                <span className={cx('truncate text-right text-[13px]', f.homeId === game.userClubId ? 'font-bold text-accent' : 'font-medium')}>{h.name}</span>
                <ClubDot color={h.color} />
              </span>
              <span className={cx('text-center font-display font-bold', f.result ? 'text-[18px]' : 'text-[13px] text-muted')}>
                {f.result ? `${f.result.homeGoals} : ${f.result.awayGoals}` : 'VS'}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <ClubDot color={a.color} />
                <span className={cx('truncate text-[13px]', f.awayId === game.userClubId ? 'font-bold text-accent' : 'font-medium')}>{a.name}</span>
              </span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

function LeaderList({ title, rows, game, format }: { title: string; rows: LeaderRow[]; game: GameState; format: (v: number) => string }) {
  return (
    <Card label={title} className="overflow-hidden">
      <h2 className="m-0 px-3.5 py-2.5 text-[14px] font-bold">{title}</h2>
      {rows.length === 0 && <EmptyState title="아직 기록이 없습니다" />}
      {rows.map(({ player, value }, i) => {
        const club = game.clubs[player.clubId] ?? { id: 'FA', name: '자유계약', color: '#4B5A75' }
        const mine = club.id === game.userClubId
        const row = (
          <>
            <span className="text-center font-display text-[15px] font-bold text-muted">{i + 1}</span>
            <PosBadge pos={player.position} />
            <span className="flex min-w-0 flex-col">
              <span className={cx('truncate text-[13px] font-semibold', mine && 'text-accent')}>{player.name}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                <ClubDot color={club.color} size={8} />
                {club.name}
              </span>
            </span>
            <span className="text-right font-display text-[20px] font-bold">{format(value)}</span>
          </>
        )
        const cls = 'grid h-12 items-center gap-2.5 border-t border-line-soft px-3.5 text-ink no-underline'
        const style = { gridTemplateColumns: '20px 38px minmax(0,1fr) 44px' }
        return mine ? (
          <a key={player.id} href={href(`player/${player.id}`)} className={cls} style={style}>
            {row}
          </a>
        ) : (
          <div key={player.id} className={cls} style={style}>
            {row}
          </div>
        )
      })}
    </Card>
  )
}

function Leaders({ game }: { game: GameState }) {
  return (
    <div className="flex flex-col gap-3">
      <LeaderList title="득점 순위" rows={topScorers(game)} game={game} format={(v) => `${v}골`} />
      <LeaderList title="도움 순위" rows={topAssists(game)} game={game} format={(v) => `${v}`} />
      <LeaderList title="평균 평점" rows={topRated(game)} game={game} format={(v) => v.toFixed(2)} />
    </div>
  )
}
