import { useState } from 'react'
import { confidenceLabel } from '../engine/board'
import { facilityMultiplier } from '../engine/development'
import { FINANCE_LABEL, firstTeamWages, seasonExpense, seasonIncome, upgradeQuote, upkeepFor, weeklyWages, type FacilityKind } from '../engine/finance'
import { formatMoney } from '../engine/korean'
import type { FinanceCategory, GameState } from '../engine/types'
import { useGame } from '../store/gameStore'
import { Sparkline } from '../ui/charts'
import { Card, Sheet, cx } from '../ui/kit'

const TONE = { good: 'text-accent', ok: 'text-caution', warn: 'text-warn', bad: 'text-warn' } as const
const BAR = { good: '#A3E635', ok: '#FACC15', warn: '#FB923C', bad: '#FB923C' } as const

export function BoardMeter({ game, compact = false }: { game: GameState; compact?: boolean }) {
  const c = game.board.confidence
  const l = confidenceLabel(c)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className={cx('text-muted', compact ? 'text-[12px]' : 'text-[13px]')}>이사회 신뢰도</span>
        <span className={cx('font-semibold', compact ? 'text-[12px]' : 'text-[13px]', TONE[l.tone])}>
          {Math.round(c)} · {l.label}
        </span>
      </div>
      <span className="flex h-1.5 overflow-hidden rounded-sm bg-line" aria-hidden="true">
        <span style={{ width: `${c}%`, background: BAR[l.tone] }} />
      </span>
    </div>
  )
}

const INCOME: FinanceCategory[] = ['matchday', 'sponsor', 'broadcast', 'prize', 'sales']
const EXPENSE: FinanceCategory[] = ['wages', 'upkeep', 'purchases', 'facilities', 'compensation', 'scouting']

const FACILITY_INFO: Record<FacilityKind, { title: string; effect: (lvl: number) => string }> = {
  training: { title: '훈련 시설', effect: (lvl) => `성장 속도 ×${facilityMultiplier(lvl).toFixed(2)}` },
  youth: { title: '유스 시설', effect: (lvl) => `유망주 잠재력·인원 향상 (Lv.${lvl})` },
}

export function FinancePanel({ game }: { game: GameState }) {
  const upgrade = useGame((s) => s.upgradeFacility)
  const [confirm, setConfirm] = useState<FacilityKind | null>(null)
  const club = game.clubs[game.userClubId]
  const f = club.finance
  const income = seasonIncome(club)
  const expense = seasonExpense(club)
  const net = income + expense
  const maxAbs = Math.max(1, ...INCOME.concat(EXPENSE).map((k) => Math.abs(f.season[k] ?? 0)))

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-muted">구단 잔고</span>
            <span className={cx('font-display text-[30px] leading-none font-bold', club.budget < 0 && 'text-warn')}>{formatMoney(club.budget)}</span>
            <span className={cx('text-[12px] font-semibold', net >= 0 ? 'text-accent' : 'text-warn')}>이번 시즌 {formatMoney(net, { sign: true })}</span>
          </div>
          {f.history.length > 1 && <Sparkline values={f.history.map((v) => Math.round(v / 1000))} width={140} height={48} label="라운드별 잔고 추이" />}
        </div>
        <BoardMeter game={game} />
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
            <span className="text-muted">이적 예산</span>
            <span className="font-display text-[17px] font-bold text-ink">{formatMoney(f.transferBudget)}</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
            <span className="text-muted">1군 주급 (주당)</span>
            <span className="font-display text-[17px] font-bold text-ink">{formatMoney(firstTeamWages(game, club))}</span>
            <span className="text-[11px] text-muted">예산 {formatMoney(f.wageBudget)}</span>
          </div>
        </div>
      </Card>

      <Card label="이번 시즌 수입과 지출" className="flex flex-col py-1">
        <div className="flex items-center justify-between px-4 py-2.5">
          <h2 className="m-0 text-[15px] font-bold">이번 시즌 수입 · 지출</h2>
          <span className="text-[12px] text-muted">주급·유지비 매 라운드</span>
        </div>
        {[...INCOME, ...EXPENSE].map((k) => {
          const v = f.season[k] ?? 0
          if (v === 0 && (k === 'prize' || k === 'sales' || k === 'purchases' || k === 'facilities' || k === 'compensation' || k === 'scouting')) return null
          const pos = v >= 0
          return (
            <div key={k} className="grid items-center gap-3 border-t border-line-soft px-4 py-2" style={{ gridTemplateColumns: '104px minmax(0,1fr) 72px' }}>
              <span className="text-[13px] text-muted">{FINANCE_LABEL[k]}</span>
              <span className="flex h-1.5 overflow-hidden rounded-sm bg-line" aria-hidden="true">
                <span style={{ width: `${(Math.abs(v) / maxAbs) * 100}%`, background: pos ? '#A3E635' : '#FB923C' }} />
              </span>
              <span className={cx('text-right text-[13px] font-semibold', pos ? 'text-ink' : 'text-warn')}>{formatMoney(v, { sign: v > 0 })}</span>
            </div>
          )
        })}
        <div className="flex justify-between border-t border-line-soft px-4 py-2.5 text-[12px] text-muted">
          <span>주당 고정비: 주급 {formatMoney(weeklyWages(game, club))} · 유지비 {formatMoney(upkeepFor(club))}</span>
        </div>
      </Card>

      <Card label="시설" className="flex flex-col py-1">
        <h2 className="m-0 px-4 py-2.5 text-[15px] font-bold">시설 투자</h2>
        {(['training', 'youth'] as FacilityKind[]).map((kind) => {
          const lvl = club.facilities[kind]
          const q = upgradeQuote(club, kind)
          return (
            <div key={kind} className="flex items-center gap-3 border-t border-line-soft px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[14px] font-semibold">
                  {FACILITY_INFO[kind].title} <span className="text-accent">Lv.{lvl}</span>
                </span>
                <span className="text-[12px] text-muted">{FACILITY_INFO[kind].effect(lvl)}</span>
                {!q.ok && q.reason && q.cost !== null && <span className="text-[11px] text-warn">{q.reason}</span>}
              </div>
              {q.cost === null ? (
                <span className="text-[12px] font-semibold text-muted">최고 레벨</span>
              ) : (
                <button
                  type="button"
                  disabled={!q.ok}
                  onClick={() => setConfirm(kind)}
                  className="flex h-11 shrink-0 flex-col items-center justify-center rounded-xl border-none bg-accent px-3 text-bg disabled:opacity-45"
                >
                  <span className="text-[12px] font-bold">Lv.{lvl + 1} 업그레이드</span>
                  <span className="text-[11px] font-semibold">{formatMoney(q.cost)}</span>
                </button>
              )}
            </div>
          )
        })}
        <p className="m-0 border-t border-line-soft px-4 py-2.5 text-[12px] leading-relaxed text-muted">시설 레벨이 오를수록 매 라운드 유지비(레벨당 {formatMoney(150)})도 늘어납니다.</p>
      </Card>

      <Sheet open={confirm !== null} onClose={() => setConfirm(null)} title="시설 투자">
        {confirm && (
          <div className="flex flex-col gap-3 px-5 pt-1 pb-4">
            <p className="m-0 text-[14px] leading-relaxed text-ink-2">
              {FACILITY_INFO[confirm].title}을(를) Lv.{club.facilities[confirm] + 1}로 올릴까요? 비용 {formatMoney(upgradeQuote(club, confirm).cost ?? 0)}가 잔고에서 빠집니다.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="h-12 rounded-xl border border-line bg-surface-2 text-[15px] font-semibold text-ink">
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  upgrade(confirm)
                  setConfirm(null)
                }}
                className="h-12 rounded-xl border-none bg-accent text-[15px] font-bold text-bg"
              >
                투자하기
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
