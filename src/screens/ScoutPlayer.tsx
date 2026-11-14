import { useState } from 'react'
import { NATIONALITY_LABEL } from '../engine/data/names'
import { ATTR_LABEL, FOOT_LABEL, POSITION_LABEL, formatMoney } from '../engine/korean'
import { avgRating, marketValue, potentialStars, radar } from '../engine/ratings'
import { MAX_SCOUTS, SCOUT_FEE, askingPriceFor, isKnown, isUntouchable, isScouting, wageDemand, windowLabel, windowState } from '../engine/transfers'
import type { GameState, Player } from '../engine/types'
import { FREE_AGENT } from '../engine/types'
import { goBack } from '../router'
import { useGame } from '../store/gameStore'
import { Radar } from '../ui/charts'
import { IconChevronLeft } from '../ui/Icons'
import { Card, ClubDot, PosBadge, Segmented, Stars, attrColor, cx } from '../ui/kit'
import { attrGroups } from './Player'
import { NegotiationSheet, OvrEstimate } from './Transfers'

type Tab = 'attrs' | 'contract' | 'stats'

/** A player at another club (or a free agent), seen through the user's scouting. */
export function OtherPlayerScreen({ game, p }: { game: GameState; p: Player }) {
  const scoutPlayer = useGame((s) => s.scoutPlayer)
  const [tab, setTab] = useState<Tab>('attrs')
  const [negotiate, setNegotiate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const club = game.clubs[p.clubId] ?? null
  const free = p.clubId === FREE_AGENT
  const known = isKnown(game, p)
  const scouting = isScouting(game, p.id)
  const youth = !!club?.youthIds.includes(p.id)
  const ask = club ? askingPriceFor(game, p) : 0
  const win = windowState(game)
  const canBid = !youth && (free || win.open)
  const avg = avgRating(p)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <button type="button" aria-label="뒤로" onClick={() => goBack('market')} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink">
          <IconChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold">선수 정보</span>
        <span className="size-11" />
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4">
        <section className="flex shrink-0 items-center gap-3.5">
          <div className="flex size-[68px] shrink-0 items-center justify-center rounded-[18px] border-2 border-line bg-surface font-display text-[34px] font-bold text-ink-2">
            {free || youth ? '–' : p.shirt}
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
              <span className="flex items-center gap-1 rounded bg-surface-2 px-1.5 py-px font-semibold text-ink-2">
                {club && <ClubDot color={club.color} size={8} />}
                {club ? `${club.name}${youth ? ' 유스' : ''}` : '자유계약'}
              </span>
              {club && isUntouchable(game, p, game.userClubId) && <span className="rounded bg-caution/14 px-1.5 py-px font-bold text-caution">핵심 선수</span>}
              {known ? (
                <span className="rounded bg-accent/16 px-1.5 py-px font-bold text-accent">스카우트 완료</span>
              ) : scouting ? (
                <span className="rounded bg-away/16 px-1.5 py-px font-bold text-away">스카우트 조사 중</span>
              ) : (
                <span className="rounded bg-line px-1.5 py-px font-semibold text-ink-2">미파악</span>
              )}
            </div>
          </div>
        </section>

        <Card label="핵심 지표" className="grid shrink-0 grid-cols-3 py-3">
          <div className="flex flex-col items-center gap-1 px-1.5">
            <span className="text-[11px] text-muted">{known ? '현재 능력' : '예상 능력'}</span>
            <OvrEstimate game={game} p={p} className={known ? 'text-[28px] leading-none' : 'text-[22px] leading-none text-ink-2'} />
            <span className="text-[11px] text-muted">{POSITION_LABEL[p.position]}</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-x border-line px-1.5">
            <span className="text-[11px] text-muted">잠재력</span>
            {known ? <Stars n={potentialStars(p.potential)} className="text-[16px] leading-7 tracking-[1px]" /> : <span className="font-display text-[24px] leading-7 font-bold text-muted">?</span>}
            <span className="text-[11px] text-muted">{known ? '스카우트 평가' : '스카우트 필요'}</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-1.5">
            <span className="text-[11px] text-muted">{free ? '이적료' : '요구 이적료'}</span>
            <span className="font-display text-[24px] leading-none font-bold">{free ? '없음' : youth ? '–' : formatMoney(ask)}</span>
            <span className="text-[11px] text-muted">가치 {formatMoney(marketValue(p))}</span>
          </div>
        </Card>

        <Segmented
          label="선수 정보 보기"
          value={tab}
          onChange={setTab}
          className="shrink-0"
          options={[
            { value: 'attrs', label: '능력치' },
            { value: 'contract', label: '계약' },
            { value: 'stats', label: '기록' },
          ]}
        />

        {tab === 'attrs' &&
          (known ? (
            <>
              <Card className="flex shrink-0 items-center justify-center py-1">
                <Radar axes={radar(p)} width={240} />
              </Card>
              <Card label="세부 능력치 (1–20)" className="grid shrink-0 grid-cols-3 gap-3.5 px-3.5 py-3">
                {attrGroups(p).map((g) => (
                  <div key={g.title} className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-[12px] font-bold text-muted">{g.title}</span>
                    {g.keys.map((k) => {
                      const v = Math.round(p.attrs[k])
                      return (
                        <div key={k} className="flex items-baseline justify-between gap-1 text-[13px]">
                          <span className="truncate whitespace-nowrap">{ATTR_LABEL[k]}</span>
                          <span className={cx('font-display text-[17px] font-bold', attrColor(v))}>{v}</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </Card>
            </>
          ) : (
            <Card className="flex shrink-0 flex-col items-center gap-2 px-5 py-8 text-center">
              <span className="text-[15px] font-semibold">스카우트 보고서가 필요합니다</span>
              <span className="text-[13px] leading-relaxed text-muted">
                {scouting
                  ? '스카우트가 선수를 지켜보고 있습니다. 다음 라운드가 끝나면 보고서가 도착합니다.'
                  : `스카우트를 보내면 다음 라운드 뒤에 정확한 능력치와 잠재력을 알 수 있습니다. 비용 ${formatMoney(SCOUT_FEE)}, 동시에 ${MAX_SCOUTS}명까지.`}
              </span>
            </Card>
          ))}

        {tab === 'contract' && (
          <Card className="flex shrink-0 flex-col divide-y divide-line-soft">
            {[
              ['소속', club ? club.name : '자유계약'],
              ['현재 주급', free ? '-' : formatMoney(p.contract.wage)],
              ['계약 기간', free ? '-' : `시즌 ${p.contract.until}까지`],
              ['시장 가치', formatMoney(marketValue(p))],
              ['예상 요구 주급', `약 ${formatMoney(wageDemand(game, p, game.userClubId))}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-3.5 text-[14px]">
                <span className="text-muted">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </Card>
        )}

        {tab === 'stats' && (
          <Card className="grid shrink-0 grid-cols-3 gap-y-4 p-4">
            {[
              ['출전', `${p.stats.apps}`],
              ['골', `${p.stats.goals}`],
              ['도움', `${p.stats.assists}`],
              ['평균 평점', avg ? avg.toFixed(2) : '-'],
              ['MOM', `${p.stats.motm}`],
              ['경고 / 퇴장', `${p.stats.yellows} / ${p.stats.reds}`],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col items-center gap-1">
                <span className="text-[11px] text-muted">{k}</span>
                <span className="font-display text-[26px] leading-none font-bold">{v}</span>
              </div>
            ))}
          </Card>
        )}

        {error && <div className="rounded-xl border border-warn/40 bg-warn/8 px-3 py-2.5 text-[13px]">{error}</div>}
        {!free && !youth && !win.open && <div className="text-center text-[12px] text-muted">{windowLabel(game)}</div>}
        {youth && <div className="text-center text-[12px] text-muted">다른 구단의 유스 선수는 영입할 수 없습니다.</div>}
      </main>

      <div className="grid shrink-0 grid-cols-2 gap-2 px-4 pb-3">
        <button
          type="button"
          disabled={known || scouting || game.scoutQueue.length >= MAX_SCOUTS}
          onClick={() => setError(scoutPlayer(p.id))}
          className="flex h-12 flex-col items-center justify-center rounded-xl border border-[#2E3F5E] bg-surface-2 text-ink disabled:opacity-45"
        >
          <span className="text-[14px] font-semibold">{known ? '파악 완료' : scouting ? '보고 대기 중' : '스카우트 파견'}</span>
          {!known && !scouting && <span className="text-[11px] text-muted">{formatMoney(SCOUT_FEE)} · 1라운드</span>}
        </button>
        <button
          type="button"
          disabled={!canBid}
          onClick={() => {
            setError(null)
            setNegotiate(true)
          }}
          className="h-12 rounded-xl border-none bg-accent text-[14px] font-bold text-bg disabled:opacity-45"
        >
          {free ? '자유계약 영입' : win.open ? '영입 제안' : '이적시장 닫힘'}
        </button>
      </div>

      {negotiate && <NegotiationSheet game={game} playerId={p.id} mode={free ? 'free' : 'buy'} onClose={() => setNegotiate(false)} />}
    </div>
  )
}
