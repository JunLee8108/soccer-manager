import { useMemo, useState } from 'react'
import { firstTeamWages } from '../engine/finance'
import { formatMoney } from '../engine/korean'
import { askingPriceFor, compensationFor, estimateOvr, evaluateBid, evaluateContract, isKnown, isScouting, isUntouchable, wageDemand, windowLabel, windowState } from '../engine/transfers'
import { marketValue } from '../engine/ratings'
import type { GameState, Line, Player } from '../engine/types'
import { FREE_AGENT, LINE_OF } from '../engine/types'
import { goBack, href, navigate } from '../router'
import { useGame } from '../store/gameStore'
import { IconChevronRight, IconSort } from '../ui/Icons'
import { Card, ClubDot, EmptyState, PosBadge, ScreenHeader, Segmented, Sheet, cx } from '../ui/kit'

// ---------- Shared bits ----------

export function OvrEstimate({ game, p, className }: { game: GameState; p: Player; className?: string }) {
  const e = estimateOvr(game, p)
  return <span className={cx('font-display font-bold', className)}>{e.exact ? e.low : `${e.low}–${e.high}`}</span>
}

function Stepper({ value, onChange, step, min = 0, format, label }: { value: number; onChange: (v: number) => void; step: number; min?: number; format: (v: number) => string; label: string }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" aria-label={`${label} 낮추기`} onClick={() => onChange(Math.max(min, value - step))} className="size-11 shrink-0 rounded-xl border border-line bg-surface-2 text-[20px] font-bold text-ink">
        −
      </button>
      <span className="flex-1 text-center font-display text-[24px] font-bold">{format(value)}</span>
      <button type="button" aria-label={`${label} 올리기`} onClick={() => onChange(value + step)} className="size-11 shrink-0 rounded-xl border border-line bg-surface-2 text-[20px] font-bold text-ink">
        +
      </button>
    </div>
  )
}

const niceStep = (v: number) => {
  const raw = Math.max(100, v * 0.05)
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  return Math.round(raw / pow) * pow
}

// ---------- Hub (Club > 이적) ----------

export function TransferHub({ game }: { game: GameState }) {
  const respondToOffer = useGame((s) => s.respondToOffer)
  const setTransferListed = useGame((s) => s.setTransferListed)
  const club = game.clubs[game.userClubId]
  const w = windowState(game)
  const wages = firstTeamWages(game, club)
  const wagePct = Math.min(100, Math.round((wages / club.finance.wageBudget) * 100))
  const listed = Object.entries(game.transferList).filter(([id]) => game.players[id]?.clubId === club.id)

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className={cx('rounded-full px-2.5 py-[3px] text-[12px] font-bold', w.open ? 'bg-accent/16 text-accent' : 'bg-line text-ink-2')}>{windowLabel(game)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
            <span className="text-[11px] text-muted">이적 예산</span>
            <span className="font-display text-[20px] font-bold">{formatMoney(club.finance.transferBudget)}</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
            <span className="text-[11px] text-muted">구단 잔고</span>
            <span className="font-display text-[20px] font-bold">{formatMoney(club.budget)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[12px] text-muted">
            <span>주급 예산 사용</span>
            <span>
              {formatMoney(wages)} / {formatMoney(club.finance.wageBudget)}
            </span>
          </div>
          <span className="flex h-1.5 overflow-hidden rounded-sm bg-line">
            <span style={{ width: `${wagePct}%`, background: wagePct >= 95 ? '#FB923C' : '#A3E635' }} />
          </span>
        </div>
        <a href={href('market')} className="mt-1 flex h-12 items-center justify-center gap-1.5 rounded-xl bg-accent text-[15px] font-bold text-bg no-underline">
          선수 찾기 <IconChevronRight size={18} />
        </a>
      </Card>

      <Card label="받은 제안" className="flex flex-col py-1">
        <h2 className="m-0 px-3.5 py-2 text-[15px] font-bold">받은 제안 {game.offers.length > 0 ? game.offers.length : ''}</h2>
        {game.offers.length === 0 && <div className="border-t border-line-soft px-3.5 py-3 text-[13px] text-muted">아직 받은 제안이 없습니다. 판매 목록에 올리면 이적 기간에 제안이 들어옵니다.</div>}
        {game.offers.map((o) => {
          const p = game.players[o.playerId]
          const from = game.clubs[o.fromClubId]
          return (
            <div key={o.id} className="flex flex-col gap-2 border-t border-line-soft px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <PosBadge pos={p.position} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-semibold">{p.name}</span>
                  <span className="flex items-center gap-1.5 truncate text-[12px] text-muted">
                    <ClubDot color={from.color} size={8} />
                    {from.name} · {o.expiresRound - game.round + 1}라운드 내 답변
                  </span>
                </span>
                <span className="font-display text-[18px] font-bold">{formatMoney(o.fee)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => respondToOffer(o.id, false)} className="h-10 rounded-lg border border-line bg-surface-2 text-[13px] font-semibold text-ink">
                  거절
                </button>
                <button type="button" disabled={!w.open} onClick={() => respondToOffer(o.id, true)} className="h-10 rounded-lg border-none bg-accent text-[13px] font-bold text-bg disabled:opacity-50">
                  수락 · 판매
                </button>
              </div>
            </div>
          )
        })}
      </Card>

      <Card label="판매 목록" className="flex flex-col py-1">
        <h2 className="m-0 px-3.5 py-2 text-[15px] font-bold">판매 목록</h2>
        {listed.length === 0 && <div className="border-t border-line-soft px-3.5 py-3 text-[13px] text-muted">선수 정보 화면의 "계약·이적"에서 판매 목록에 올릴 수 있습니다.</div>}
        {listed.map(([id, price]) => {
          const p = game.players[id]
          return (
            <div key={id} className="flex items-center gap-2.5 border-t border-line-soft px-3.5 py-2.5">
              <PosBadge pos={p.position} />
              <a href={href(`player/${id}`)} className="flex min-w-0 flex-1 flex-col text-ink no-underline">
                <span className="truncate text-[14px] font-semibold">{p.name}</span>
                <span className="text-[12px] text-muted">요구액 {formatMoney(price)}</span>
              </a>
              <button type="button" onClick={() => setTransferListed(id, null)} className="h-9 shrink-0 rounded-lg border border-line bg-surface-2 px-3 text-[12px] font-semibold text-ink">
                내리기
              </button>
            </div>
          )
        })}
      </Card>

      {game.scoutQueue.length > 0 && (
        <Card label="스카우트 진행 중" className="flex flex-col py-1">
          <h2 className="m-0 px-3.5 py-2 text-[15px] font-bold">스카우트 진행 중</h2>
          {game.scoutQueue.map((t) => {
            const p = game.players[t.playerId]
            if (!p) return null
            return (
              <a key={t.playerId} href={href(`player/${p.id}`)} className="flex items-center gap-2.5 border-t border-line-soft px-3.5 py-2.5 text-ink no-underline">
                <PosBadge pos={p.position} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{p.name}</span>
                <span className="text-[12px] text-muted">다음 라운드 보고</span>
              </a>
            )
          })}
        </Card>
      )}

      <Card label="최근 이적 소식" className="flex flex-col py-1">
        <h2 className="m-0 px-3.5 py-2 text-[15px] font-bold">최근 이적 소식</h2>
        {game.news.length === 0 && <div className="border-t border-line-soft px-3.5 py-3 text-[13px] text-muted">아직 소식이 없습니다.</div>}
        {game.news.slice(0, 8).map((n, i) => (
          <div key={i} className="flex gap-2 border-t border-line-soft px-3.5 py-2.5 text-[13px]">
            <span className="shrink-0 text-[11px] leading-5 text-muted">{n.round === 0 ? '개막' : `${n.round}R`}</span>
            <span className="leading-5">{n.text}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ---------- Market search ----------

type LineFilter = 'ALL' | Line
type PriceFilter = 'all' | '5' | '10' | '20'
type MarketSort = 'ovr' | 'price' | 'age'
const SORT_LABEL: Record<MarketSort, string> = { ovr: '예상 능력순', price: '가격순', age: '나이순' }

export function MarketScreen({ game }: { game: GameState }) {
  const [line, setLine] = useState<LineFilter>('ALL')
  const [price, setPrice] = useState<PriceFilter>('all')
  const [freeOnly, setFreeOnly] = useState(false)
  const [sort, setSort] = useState<MarketSort>('ovr')
  const [limit, setLimit] = useState(60)

  const rows = useMemo(() => {
    const cap = price === 'all' ? Infinity : Number(price) * 10000
    return Object.values(game.players)
      .filter((p) => {
        if (p.clubId === game.userClubId) return false
        const club = game.clubs[p.clubId]
        if (club && club.youthIds.includes(p.id)) return false
        if (!club && p.clubId !== FREE_AGENT) return false
        if (freeOnly && p.clubId !== FREE_AGENT) return false
        if (line !== 'ALL' && LINE_OF[p.position] !== line) return false
        return true
      })
      .map((p) => {
        const est = estimateOvr(game, p)
        return { p, est, mid: (est.low + est.high) / 2, price: p.clubId === FREE_AGENT ? 0 : askingPriceFor(game, p) }
      })
      .filter((r) => r.price <= cap)
      .sort((a, b) => (sort === 'price' ? b.price - a.price : sort === 'age' ? a.p.age - b.p.age || b.mid - a.mid : b.mid - a.mid))
  }, [game, line, price, freeOnly, sort])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title="선수 찾기"
        subtitle={windowLabel(game)}
        onBack={() => goBack('club/transfer')}
        right={
          <button
            type="button"
            aria-label={`정렬 변경, 현재 ${SORT_LABEL[sort]}`}
            onClick={() => setSort(sort === 'ovr' ? 'price' : sort === 'price' ? 'age' : 'ovr')}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink"
          >
            <IconSort size={16} className="text-muted" />
            {SORT_LABEL[sort]}
          </button>
        }
      />
      <div className="flex shrink-0 flex-col gap-2 px-4 pb-2.5">
        <div role="group" aria-label="포지션" className="scrollbar-none flex gap-1.5 overflow-x-auto">
          {(['ALL', 'GK', 'DF', 'MF', 'FW'] as LineFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={line === f}
              onClick={() => setLine(f)}
              className={cx('h-9 shrink-0 rounded-full px-3.5 text-[13px]', line === f ? 'border-none bg-accent font-bold text-bg' : 'border border-line bg-surface font-semibold text-ink-2')}
            >
              {f === 'ALL' ? '전체' : f}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={freeOnly}
            onClick={() => setFreeOnly(!freeOnly)}
            className={cx('h-9 shrink-0 rounded-full px-3.5 text-[13px]', freeOnly ? 'border-none bg-accent font-bold text-bg' : 'border border-dashed border-line bg-transparent font-semibold text-ink-2')}
          >
            자유계약만
          </button>
        </div>
        <Segmented
          label="가격"
          tone="accent"
          size="sm"
          value={price}
          onChange={setPrice}
          options={[
            { value: 'all', label: '전체 가격' },
            { value: '5', label: '₩5억 이하' },
            { value: '10', label: '₩10억 이하' },
            { value: '20', label: '₩20억 이하' },
          ]}
        />
      </div>
      <div className="grid h-7 shrink-0 items-center gap-2.5 border-b border-line-soft px-4 text-[11px] text-muted" style={{ gridTemplateColumns: '38px minmax(0,1fr) 52px 64px' }}>
        <span>포지션</span>
        <span>선수 · {rows.length}명</span>
        <span className="text-right">능력</span>
        <span className="text-right">가격</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 && <EmptyState title="조건에 맞는 선수가 없습니다" />}
        {rows.slice(0, limit).map(({ p, price: cost }) => {
          const club = game.clubs[p.clubId]
          const known = isKnown(game, p)
          return (
            <a
              key={p.id}
              href={href(`player/${p.id}`)}
              className="grid h-[58px] items-center gap-2.5 border-b border-line-soft px-4 text-ink no-underline"
              style={{ gridTemplateColumns: '38px minmax(0,1fr) 52px 64px' }}
            >
              <PosBadge pos={p.position} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold">{p.name}</span>
                  {known && <span className="shrink-0 rounded bg-accent/16 px-1.5 py-px text-[10px] font-bold text-accent">파악</span>}
                  {!known && isScouting(game, p.id) && <span className="shrink-0 rounded bg-away/16 px-1.5 py-px text-[10px] font-bold text-away">조사 중</span>}
                </span>
                <span className="flex items-center gap-1.5 truncate text-[12px] text-muted">
                  {club ? <ClubDot color={club.color} size={8} /> : null}
                  {p.age}세 · {club ? club.name : '자유계약'}
                </span>
              </span>
              <OvrEstimate game={game} p={p} className={cx('text-right', known ? 'text-[22px]' : 'text-[15px] text-ink-2')} />
              <span className="text-right text-[12px] font-semibold">{cost === 0 ? <span className="text-accent">자유계약</span> : formatMoney(cost)}</span>
            </a>
          )
        })}
        {rows.length > limit && (
          <button type="button" onClick={() => setLimit(limit + 60)} className="m-4 h-11 w-[calc(100%-2rem)] rounded-xl border border-line bg-surface text-[13px] font-semibold text-ink">
            더 보기 ({rows.length - limit}명)
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- Negotiation ----------

type Mode = 'buy' | 'free' | 'renew'

export function NegotiationSheet({ game, playerId, mode, onClose }: { game: GameState; playerId: string; mode: Mode; onClose: () => void }) {
  const { signPlayer, extendContract } = useGame.getState()
  const p = game.players[playerId]
  const ask = mode === 'buy' ? askingPriceFor(game, p) : 0
  const demand = wageDemand(game, p, game.userClubId)
  const [step, setStep] = useState<'fee' | 'contract' | 'done'>(mode === 'buy' ? 'fee' : 'contract')
  const [fee, setFee] = useState(Math.round(ask * 0.9 / 100) * 100)
  const [wage, setWage] = useState(Math.round((demand * 0.95) / 10) * 10)
  const [years, setYears] = useState(p.age <= 24 ? 4 : p.age <= 29 ? 3 : 2)
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'warn' | 'bad'; text: string } | null>(null)
  const [counterFee, setCounterFee] = useState<number | null>(null)
  const club = game.clubs[game.userClubId]
  const wages = firstTeamWages(game, club) - (mode === 'renew' ? p.contract.wage : 0)

  const submitFee = () => {
    const r = evaluateBid(game, playerId, fee)
    if (r.result === 'accept') {
      setFeedback({ tone: 'ok', text: `${r.text} 이제 선수와 계약 조건을 정하세요.` })
      setCounterFee(null)
      setStep('contract')
    } else if (r.result === 'counter') {
      setFeedback({ tone: 'warn', text: r.text })
      setCounterFee(r.fee)
    } else {
      setFeedback({ tone: 'bad', text: r.text })
      setCounterFee(null)
    }
  }

  const submitContract = () => {
    const r = evaluateContract(game, playerId, wage)
    if (r.result !== 'accept') {
      setFeedback({ tone: r.result === 'counter' ? 'warn' : 'bad', text: r.text })
      if (r.result === 'counter') setWage(r.wage)
      return
    }
    const err = mode === 'renew' ? extendContract(playerId, wage, years) : signPlayer(playerId, mode === 'free' ? 0 : fee, wage, years)
    if (err) setFeedback({ tone: 'bad', text: err })
    else setStep('done')
  }

  const title = mode === 'renew' ? '계약 연장' : mode === 'free' ? '자유계약 영입' : '영입 협상'
  const feedbackCls = feedback?.tone === 'ok' ? 'border-accent/40 bg-accent/8' : feedback?.tone === 'warn' ? 'border-caution/40 bg-caution/8' : 'border-warn/40 bg-warn/8'

  return (
    <Sheet open onClose={onClose} title={`${title} · ${p.name}`}>
      <div className="flex flex-col gap-3 px-5 pt-0.5 pb-4">
        {step !== 'done' && (
          <div className="flex items-center gap-2 text-[12px] text-muted">
            {mode === 'buy' && <span className={cx('rounded-full px-2 py-0.5 font-bold', step === 'fee' ? 'bg-accent text-bg' : 'bg-line text-ink-2')}>1 이적료</span>}
            <span className={cx('rounded-full px-2 py-0.5 font-bold', step === 'contract' ? 'bg-accent text-bg' : 'bg-line text-ink-2')}>{mode === 'buy' ? '2 ' : ''}계약 조건</span>
          </div>
        )}

        {feedback && step !== 'done' && <div className={cx('rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed', feedbackCls)}>{feedback.text}</div>}

        {step === 'fee' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="text-[11px] text-muted">구단 요구액{isUntouchable(game, p, game.userClubId) ? ' · 핵심 선수' : ''}</span>
                <span className="font-display text-[18px] font-bold">{formatMoney(ask)}</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="text-[11px] text-muted">남은 이적 예산</span>
                <span className="font-display text-[18px] font-bold">{formatMoney(club.finance.transferBudget)}</span>
              </div>
            </div>
            <Stepper label="이적료" value={fee} onChange={setFee} step={niceStep(ask || 1000)} format={formatMoney} />
            {counterFee !== null && (
              <button
                type="button"
                onClick={() => {
                  setFee(counterFee)
                  setCounterFee(null)
                  setFeedback({ tone: 'ok', text: '요구액에 맞췄습니다. 제안을 보내면 수락됩니다.' })
                }}
                className="h-11 rounded-xl border border-caution/50 bg-transparent text-[14px] font-semibold text-caution"
              >
                요구액 {formatMoney(counterFee)}로 맞추기
              </button>
            )}
            <button type="button" onClick={submitFee} className="h-12 rounded-xl border-none bg-accent text-[15px] font-bold text-bg">
              이적료 제안 보내기
            </button>
          </>
        )}

        {step === 'contract' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="text-[11px] text-muted">기대 주급 (에이전트)</span>
                <span className="font-display text-[18px] font-bold">약 {formatMoney(demand)}</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="text-[11px] text-muted">주급 예산 여유</span>
                <span className="font-display text-[18px] font-bold">{formatMoney(club.finance.wageBudget - wages)}</span>
              </div>
            </div>
            <span className="text-[12px] text-muted">주급</span>
            <Stepper label="주급" value={wage} onChange={setWage} step={Math.max(10, Math.round((demand * 0.05) / 10) * 10)} format={formatMoney} />
            <span className="text-[12px] text-muted">{mode === 'renew' ? `연장 기간 (시즌 ${game.season + years}까지)` : `계약 기간 (시즌 ${game.season + years - 1}까지)`}</span>
            <Segmented label="계약 기간" tone="accent" size="sm" value={String(years)} onChange={(v) => setYears(Number(v))} options={[1, 2, 3, 4, 5].map((y) => ({ value: String(y), label: `${y}년` }))} />
            {mode === 'buy' && <span className="text-[12px] text-muted">합의한 이적료 {formatMoney(fee)}</span>}
            <button type="button" onClick={submitContract} className="h-12 rounded-xl border-none bg-accent text-[15px] font-bold text-bg">
              {mode === 'renew' ? '연장 제안' : '계약 제안'}
            </button>
          </>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="font-display text-[34px] font-bold text-accent">{mode === 'renew' ? '연장 완료' : '영입 완료'}</span>
            <span className="text-[14px] leading-relaxed text-ink-2">
              {p.name} · 주급 {formatMoney(wage)} · {years}년
              {mode === 'buy' ? ` · 이적료 ${formatMoney(fee)}` : ''}
            </span>
            <button type="button" onClick={onClose} className="h-12 w-full rounded-xl border-none bg-accent text-[15px] font-bold text-bg">
              확인
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

// ---------- Own player: contract & transfer actions ----------

export function ContractActionsSheet({ game, playerId, onClose, onRenew }: { game: GameState; playerId: string; onClose: () => void; onRenew: () => void }) {
  const { setTransferListed, releaseFirstTeamPlayer } = useGame.getState()
  const p = game.players[playerId]
  const listedPrice = game.transferList[playerId]
  const [price, setPrice] = useState(listedPrice ?? Math.round(marketValue(p) / 100) * 100)
  const [confirmRelease, setConfirmRelease] = useState(false)
  const comp = compensationFor(game, p)

  return (
    <Sheet open onClose={onClose} title={`계약 · 이적 · ${p.name}`}>
      <div className="flex flex-col gap-3 px-5 pt-0.5 pb-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['주급', formatMoney(p.contract.wage)],
            ['계약', `시즌 ${p.contract.until}까지`],
            ['시장 가치', formatMoney(marketValue(p))],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-2 py-2.5">
              <span className="text-[11px] text-muted">{k}</span>
              <span className="text-[13px] font-bold">{v}</span>
            </div>
          ))}
        </div>

        <button type="button" onClick={onRenew} className="flex h-12 items-center justify-between rounded-xl border border-[#2E3F5E] bg-surface-2 px-4 text-[14px] font-semibold text-ink">
          계약 연장 협상 <IconChevronRight size={18} />
        </button>

        <div className="flex flex-col gap-2 rounded-xl border border-line px-3.5 py-3">
          <span className="text-[14px] font-bold">판매 목록 {listedPrice !== undefined ? `· 요구액 ${formatMoney(listedPrice)}` : ''}</span>
          <span className="text-[12px] leading-relaxed text-muted">이적 기간에 다른 구단이 제안을 보냅니다. 요구액이 높을수록 제안이 드뭅니다.</span>
          <Stepper label="요구액" value={price} onChange={setPrice} step={niceStep(marketValue(p))} format={formatMoney} />
          <div className="grid grid-cols-2 gap-2">
            {listedPrice !== undefined ? (
              <button type="button" onClick={() => setTransferListed(p.id, null)} className="h-11 rounded-xl border border-line bg-surface-2 text-[13px] font-semibold text-ink">
                목록에서 내리기
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => setTransferListed(p.id, price)} className="h-11 rounded-xl border-none bg-accent text-[13px] font-bold text-bg">
              {listedPrice !== undefined ? '요구액 변경' : '판매 목록 등록'}
            </button>
          </div>
        </div>

        {!confirmRelease ? (
          <button type="button" onClick={() => setConfirmRelease(true)} className="h-11 rounded-xl border border-warn/40 bg-transparent text-[13px] font-semibold text-warn">
            계약 해지 (방출)
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-warn/40 bg-warn/8 px-3.5 py-3">
            <span className="text-[13px] leading-relaxed">
              위약금 {formatMoney(comp)}를 내고 {p.name}과(와) 계약을 해지할까요? 선수는 자유계약 신분이 됩니다.
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmRelease(false)} className="h-10 rounded-lg border border-line bg-surface-2 text-[13px] font-semibold text-ink">
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  releaseFirstTeamPlayer(p.id)
                  onClose()
                  navigate('squad', { replace: true })
                }}
                className="h-10 rounded-lg border-none bg-warn text-[13px] font-bold text-bg"
              >
                해지
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
