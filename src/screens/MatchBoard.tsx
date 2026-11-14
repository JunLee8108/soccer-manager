import { useMemo, useState } from 'react'
import { FORMATIONS, FORMATION_IDS } from '../engine/data/formations'
import { ATTR_LABEL } from '../engine/korean'
import { passPct, possessionPct, ratingTrend, strengthOfTeam, suggestSubs } from '../engine/match/engine'
import type { LiveMatch, MatchPlayer, Side, TeamState } from '../engine/match/types'
import { familiarity, POSITION_WEIGHTS, ratingAt, toDisplay, type Strength } from '../engine/ratings'
import type { AttrKey, DefLine, GameState, Press, Style } from '../engine/types'
import { useGame } from '../store/gameStore'
import { IconClose, IconPlay, IconSwap } from '../ui/Icons'
import { PosBadge, Segmented, Sheet, cx } from '../ui/kit'
import { PitchToken, energyColor } from '../ui/PitchToken'
import { LINE_OPTIONS, PRESS_OPTIONS, STYLE_OPTIONS } from './Tactics'

export type BoardTab = 'subs' | 'shape' | 'orders'

const ST_COLOR = { up: 'text-accent', down: 'text-warn' }

/** Pitch y (0–100 in formation data) squeezed so tokens fit inside the board pitch. */
const pitchY = (y: number) => 5 + y * 0.9

function keyAttrs(pos: MatchPlayer['pos']): AttrKey[] {
  const w = POSITION_WEIGHTS[pos]
  return (Object.keys(w) as AttrKey[]).sort((a, b) => (w[b] ?? 0) - (w[a] ?? 0)).slice(0, 5)
}

function avgEnergy(t: TeamState) {
  if (t.onPitch.length === 0) return 0
  return Math.round(t.onPitch.reduce((s, mp) => s + mp.energy, 0) / t.onPitch.length)
}

function notesFor(mp: MatchPlayer): { text: string; cls: string }[] {
  const out: { text: string; cls: string }[] = []
  if (mp.injured) out.push({ text: '부상 — 교체 필요', cls: 'bg-warn/16 text-warn' })
  if (mp.energy < 55) out.push({ text: '체력 저하', cls: 'bg-warn/16 text-warn' })
  if (ratingTrend(mp) <= -0.3) out.push({ text: '최근 15분 평점 하락', cls: 'bg-warn/16 text-warn' })
  if (mp.yellow && !mp.sentOff) out.push({ text: '경고 1회 — 퇴장 위험', cls: 'bg-caution/14 text-caution' })
  if (mp.rating >= 7.5) out.push({ text: '오늘 활약 중', cls: 'bg-accent/16 text-accent' })
  if (out.length === 0) out.push({ text: '특이 사항 없음', cls: 'bg-surface-2 text-muted' })
  return out
}

function trendText(v: number) {
  if (v > 0) return { text: `▲${v.toFixed(1)}`, cls: ST_COLOR.up }
  if (v < 0) return { text: `▼${(-v).toFixed(1)}`, cls: ST_COLOR.down }
  return { text: '–', cls: 'text-muted' }
}

function StrengthRow({ now, base }: { now: Strength; base: Strength }) {
  const rows: [string, number, number][] = [
    ['공격', toDisplay(now.attack), toDisplay(base.attack)],
    ['중원', toDisplay(now.midfield), toDisplay(base.midfield)],
    ['수비', toDisplay(now.defense), toDisplay(base.defense)],
  ]
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {rows.map(([label, v, b]) => {
        const d = v - b
        return (
          <div key={label} className="flex items-baseline justify-between rounded-[10px] border border-line bg-surface px-2.5 py-1.5">
            <span className="text-[12px] text-muted">{label}</span>
            <span className="font-display text-[18px] font-bold">
              {v}
              {d !== 0 && <span className={cx('ml-1 text-[12px]', d > 0 ? 'text-accent' : 'text-warn')}>{d > 0 ? `+${d}` : d}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function MatchBoard({
  game,
  match,
  side,
  initialTab,
  initialSelected,
  onClose,
  onResume,
}: {
  game: GameState
  match: LiveMatch
  side: Side
  initialTab: BoardTab
  initialSelected: string | null
  onClose: () => void
  onResume: () => void
}) {
  const { matchSub, matchSwap, matchFormation, matchInstructions, setAutoBoard } = useGame.getState()
  const autoBoard = useGame((s) => s.autoBoard)
  const [tab, setTab] = useState<BoardTab>(initialTab)
  const [selected, setSelected] = useState<string | null>(initialSelected)
  const [candidate, setCandidate] = useState<string | null>(null)
  const [swapFirst, setSwapFirst] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showAllTips, setShowAllTips] = useState(false)

  const t = side === 'home' ? match.home : match.away
  const oppT = side === 'home' ? match.away : match.home
  const club = game.clubs[t.clubId]
  const opp = game.clubs[oppT.clubId]
  const isHome = side === 'home'
  const slots = FORMATIONS[t.formation].slots
  const [homePct, awayPct] = possessionPct(match)
  const myPct = isHome ? homePct : awayPct
  const strength = strengthOfTeam(t, game, isHome)
  const [baseStrength] = useState(strength)
  const tips = suggestSubs(match, game, side)
  const selectedMp = t.onPitch.find((mp) => mp.id === selected) ?? null
  const status = match.finished ? '경기 종료' : match.minute === 45 ? '하프타임' : `${match.minute <= 45 ? '전반' : '후반'} ${match.minute}' · 일시정지됨`

  const tapToken = (mp: MatchPlayer) => {
    if (tab === 'shape') {
      if (!swapFirst) setSwapFirst(mp.id)
      else if (swapFirst === mp.id) setSwapFirst(null)
      else {
        const a = game.players[swapFirst].name
        const b = game.players[mp.id].name
        if (matchSwap(swapFirst, mp.id)) setNotice(`${a} ↔ ${b} 자리를 바꿨습니다.`)
        setSwapFirst(null)
      }
      return
    }
    setSelected(mp.id === selected ? null : mp.id)
    setCandidate(null)
  }

  const highlighted = tab === 'shape' ? swapFirst : selected

  return (
    <div className="fixed inset-0 z-40 flex justify-center" role="dialog" aria-modal="true" aria-label="경기 보드">
      <div className="pt-safe flex h-full w-full max-w-[430px] flex-col bg-bg md:border-x md:border-line-soft">
        <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3.5 pb-2">
          <button type="button" aria-label="보드 닫기" onClick={onClose} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink">
            <IconClose size={20} />
          </button>
          <div className="flex flex-col items-center gap-px text-center">
            <span className="text-[15px] font-bold">경기 보드</span>
            <span className="text-[11px] text-muted">{status}</span>
          </div>
          {match.finished ? (
            <span className="size-11" />
          ) : (
            <button type="button" onClick={onResume} className="flex h-11 shrink-0 items-center gap-1 rounded-xl border-none bg-accent px-3.5 text-[14px] font-bold text-bg">
              <IconPlay size={16} />
              재개
            </button>
          )}
        </header>

        <section aria-label="경기 상황" className="mx-4 flex shrink-0 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2">
          <span className="font-display text-[20px] font-bold whitespace-nowrap">
            <span className="text-accent">{club.short}</span> {t.goals} : {oppT.goals} <span className="text-away">{opp.short}</span>
          </span>
          <span className="flex-1" />
          <span className="text-[11px] text-muted">
            점유 <b className="text-ink">{myPct}%</b>
          </span>
          <span className="text-[11px] text-muted">
            슈팅{' '}
            <b className="text-ink">
              {t.stats.shots}:{oppT.stats.shots}
            </b>
          </span>
          <span className={cx('text-[11px] font-bold', t.subsLeft > 0 ? 'text-accent' : 'text-muted')}>교체 {t.subsLeft}회</span>
        </section>

        <div className="mx-4 mt-2.5 shrink-0">
          <Segmented
            label="보드 메뉴"
            value={tab}
            onChange={(v) => {
              setTab(v)
              setSwapFirst(null)
              setNotice(null)
            }}
            options={[
              { value: 'subs', label: '교체' },
              { value: 'shape', label: '위치·포메이션' },
              { value: 'orders', label: '팀 지시' },
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {tab === 'subs' && tips.length > 0 && t.subsLeft > 0 && (
            <div className="mx-4 mt-2.5 flex flex-col gap-1.5">
              {(showAllTips ? tips : tips.slice(0, 1)).map((tip) => (
                <div key={tip.outId} className="flex items-center gap-2.5 rounded-xl border border-accent/35 bg-accent/8 py-2 pr-2.5 pl-3">
                  <span className="shrink-0 rounded-md bg-accent px-[7px] py-0.5 text-[11px] font-bold text-bg">코치 추천</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-[13px] font-bold">
                      {game.players[tip.outId].name} → {game.players[tip.inId].name}
                    </span>
                    <span className="truncate text-[11px] text-muted">{tip.reasons.join(' · ')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(tip.outId)
                      setCandidate(tip.inId)
                    }}
                    className="h-8 shrink-0 rounded-lg border-none bg-accent px-3 text-[12px] font-bold text-bg"
                  >
                    적용
                  </button>
                </div>
              ))}
              {tips.length > 1 && (
                <button type="button" onClick={() => setShowAllTips(!showAllTips)} className="self-end border-none bg-transparent px-1 py-0.5 text-[12px] font-semibold text-accent">
                  {showAllTips ? '추천 접기' : `다른 추천 ${tips.length - 1}개 보기`}
                </button>
              )}
            </div>
          )}

          {tab === 'shape' && (
            <div className="mx-4 mt-2.5 flex flex-col gap-2">
              <div role="group" aria-label="포메이션" className="grid grid-cols-3 gap-1.5">
                {FORMATION_IDS.map((f) => {
                  const on = f === t.formation
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={on}
                      disabled={match.finished}
                      onClick={() => {
                        matchFormation(f)
                        setSwapFirst(null)
                        setNotice(`${f}로 바꿨습니다. 선수들이 가장 잘 맞는 자리로 이동했습니다.`)
                      }}
                      className={cx(
                        'h-[38px] rounded-[10px] border-[1.5px] font-display text-[17px] font-bold',
                        on ? 'border-accent bg-accent/12 text-accent' : 'border-line bg-surface text-ink-2',
                      )}
                    >
                      {f}
                    </button>
                  )
                })}
              </div>
              <StrengthRow now={strength} base={baseStrength} />
            </div>
          )}

          {tab !== 'orders' && (
            <>
              <section
                aria-label="경기 중 배치"
                className="relative mx-4 mt-2.5 h-[316px] overflow-hidden rounded-2xl border border-pitch-line"
                style={{ background: 'repeating-linear-gradient(180deg, #14331F 0px, #14331F 31.6px, #173A23 31.6px, #173A23 63.2px)' }}
              >
                <div className="absolute inset-x-0 top-1/2 h-px bg-white/18" />
                <div className="absolute top-1/2 left-1/2 -mt-[30px] -ml-[30px] size-[60px] rounded-full border border-white/18" />
                <div className="absolute inset-x-[24%] top-0 h-[14%] border border-t-0 border-white/18" />
                <div className="absolute inset-x-[24%] bottom-0 h-[14%] border border-b-0 border-white/18" />
                {t.onPitch.map((mp) => {
                  const p = game.players[mp.id]
                  const slot = slots[mp.slot] ?? { x: 50, y: 50 }
                  const value = ratingAt(p, mp.pos)
                  return (
                    <PitchToken
                      key={mp.id}
                      x={slot.x}
                      y={pitchY(slot.y)}
                      value={value}
                      energy={mp.energy}
                      name={p.name.split(' ').pop() ?? p.name}
                      rating={mp.rating}
                      yellow={mp.yellow}
                      injured={mp.injured}
                      offPos={familiarity(p, mp.pos) < 0.85}
                      selected={highlighted === mp.id}
                      label={`${mp.pos} ${p.name}, 능력 ${value}, 평점 ${mp.rating.toFixed(1)}, 체력 ${Math.round(mp.energy)}%`}
                      onClick={() => tapToken(mp)}
                    />
                  )
                })}
              </section>
              <div className="mx-4 mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-muted">
                <span>원 안: 능력치</span>
                <span>테두리: 체력</span>
                {tab === 'subs' ? <span>칩: 오늘 평점</span> : <span className="text-caution">노란색: 포지션 부적합</span>}
              </div>
            </>
          )}

          {tab === 'subs' && (
            <SubsPanel
              game={game}
              team={t}
              selected={selectedMp}
              onCandidate={setCandidate}
            />
          )}

          {tab === 'shape' && (
            <div className={cx('mx-4 mt-2.5 flex items-center gap-2 rounded-xl border px-3 py-2.5', swapFirst ? 'border-accent/40 bg-accent/8' : 'border-line bg-surface')}>
              <IconSwap size={18} className="shrink-0 text-accent" />
              <span className="text-[13px] leading-snug">
                {swapFirst ? `${game.players[swapFirst].name} 선택됨 — 자리를 바꿀 선수를 탭하세요` : (notice ?? '두 선수를 차례로 탭하면 자리가 바뀝니다.')}
              </span>
            </div>
          )}

          {tab === 'orders' && (
            <div className="mx-4 mt-3 flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3">
              {(
                [
                  ['플레이 스타일', STYLE_OPTIONS, t.style, (v: string) => matchInstructions({ style: v as Style })],
                  ['압박 강도', PRESS_OPTIONS, t.press, (v: string) => matchInstructions({ press: v as Press })],
                  ['수비 라인', LINE_OPTIONS, t.line, (v: string) => matchInstructions({ line: v as DefLine })],
                ] as const
              ).map(([label, options, value, onChange]) => (
                <div key={label} className="grid items-center gap-2" style={{ gridTemplateColumns: '82px minmax(0,1fr)' }}>
                  <span className="text-[13px] text-muted">{label}</span>
                  <Segmented label={label} tone="accent" size="sm" options={options as { value: string; label: string }[]} value={value} onChange={onChange} />
                </div>
              ))}
              <StrengthRow now={strength} base={baseStrength} />
              <p className="m-0 text-[12px] leading-relaxed text-muted">
                지고 있다면 역습·높은 압박으로 기회를, 이기고 있다면 낮은 라인으로 뒷공간을 줄여 보세요. 경기 중 변경은 이번 경기에만 적용됩니다.
              </p>
            </div>
          )}

          <label className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold">자동으로 보드 열기</span>
              <span className="text-[11px] text-muted">하프타임과 부상이 생겼을 때</span>
            </span>
            <input
              type="checkbox"
              checked={autoBoard}
              onChange={(e) => setAutoBoard(e.target.checked)}
              className="size-5 shrink-0 accent-[#A3E635]"
            />
          </label>
        </div>
      </div>

      <CompareSheet
        game={game}
        match={match}
        side={side}
        outId={candidate ? selected : null}
        inId={candidate}
        onClose={() => setCandidate(null)}
        onConfirm={(outId, inId) => {
          const name = game.players[inId].name
          if (matchSub(outId, inId)) {
            setNotice(`${name} 투입`)
            setSelected(null)
          }
          setCandidate(null)
        }}
      />
    </div>
  )
}

function SubsPanel({
  game,
  team,
  selected,
  onCandidate,
}: {
  game: GameState
  team: TeamState
  selected: MatchPlayer | null
  onCandidate: (id: string) => void
}) {
  if (team.subsLeft === 0) {
    return <div className="mx-4 mt-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px] text-muted">교체 카드를 모두 사용했습니다. 위치·포메이션과 팀 지시는 계속 바꿀 수 있어요.</div>
  }
  if (!selected) {
    return <div className="mx-4 mt-2.5 rounded-xl border border-dashed border-line px-3.5 py-3 text-[13px] text-muted">피치에서 교체할 선수를 탭하면 경기 기록과 교체 후보가 나옵니다.</div>
  }
  const p = game.players[selected.id]
  const trend = trendText(ratingTrend(selected))
  const pct = passPct(selected)
  const candidates = team.bench
    .map((id) => game.players[id])
    .filter(Boolean)
    .sort((a, b) => ratingAt(b, selected.pos) - ratingAt(a, selected.pos))

  return (
    <>
      <section aria-label="선택한 선수" className="mx-4 mt-2.5 flex flex-col gap-2 rounded-[14px] border border-line bg-surface px-3 py-2.5">
        <div className="flex items-center gap-2">
          <PosBadge pos={selected.pos} />
          <span className="min-w-0 truncate text-[15px] font-bold">{p.name}</span>
          <span className="flex-1" />
          <span className="shrink-0 text-[12px] text-muted">
            평점 <b className={cx('font-display text-[16px]', selected.rating >= 7 ? 'text-accent' : selected.rating < 6 ? 'text-warn' : 'text-ink')}>{selected.rating.toFixed(1)}</b>{' '}
            <span className={trend.cls}>{trend.text}</span>
          </span>
          <span className="shrink-0 text-[12px] text-muted">
            체력{' '}
            <b className="font-display text-[16px]" style={{ color: energyColor(selected.energy) }}>
              {Math.round(selected.energy)}%
            </b>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            [`${selected.shots}(${selected.onTarget})`, '슈팅(유효)'],
            [`${selected.keyPasses}`, '키패스'],
            [`${selected.tackles}`, '볼 탈취'],
            [pct === null ? '-' : `${pct}%`, '패스 성공'],
          ].map(([v, k]) => (
            <div key={k} className="flex flex-col items-center gap-px rounded-lg bg-surface-2 py-1.5">
              <span className="font-display text-[16px] font-bold">{v}</span>
              <span className="text-[10px] text-muted">{k}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {notesFor(selected).map((n) => (
            <span key={n.text} className={cx('rounded-full px-2 py-[3px] text-[11px] font-semibold', n.cls)}>
              {n.text}
            </span>
          ))}
        </div>
      </section>

      <section aria-label="교체 후보" className="mt-2.5 flex flex-col gap-1.5">
        <div className="flex justify-between px-4 text-[12px]">
          <span className="font-bold">교체 후보</span>
          <span className="text-muted">{selected.pos} 자리 예상 능력치순</span>
        </div>
        <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-1">
          {candidates.map((c, i) => {
            const fam = familiarity(c, selected.pos)
            const note = c.position === selected.pos ? '주 포지션' : fam >= 0.85 ? '가능 포지션' : '포지션 부적합'
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCandidate(c.id)}
                className={cx('flex w-[108px] shrink-0 flex-col gap-1 rounded-xl border bg-surface px-2.5 py-2 text-left text-ink', i === 0 ? 'border-accent/55' : 'border-line')}
              >
                <span className="flex items-center justify-between">
                  <PosBadge pos={c.position} className="w-auto px-1.5 text-[12px]" />
                  <span className="font-display text-[22px] leading-none font-bold">{ratingAt(c, selected.pos)}</span>
                </span>
                <span className="truncate text-[13px] font-semibold">{c.name}</span>
                <span className={cx('text-[10px]', fam < 0.85 ? 'text-caution' : 'text-muted')}>
                  {note} · {c.condition}%
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}

function CompareSheet({
  game,
  match,
  side,
  outId,
  inId,
  onClose,
  onConfirm,
}: {
  game: GameState
  match: LiveMatch
  side: Side
  outId: string | null
  inId: string | null
  onClose: () => void
  onConfirm: (outId: string, inId: string) => void
}) {
  const t = side === 'home' ? match.home : match.away
  const out = outId ? t.onPitch.find((mp) => mp.id === outId) : undefined
  const preview = useMemo(() => {
    if (!out || !inId) return null
    const incoming = game.players[inId]
    const after: TeamState = {
      ...t,
      onPitch: t.onPitch.map((mp) => (mp.id === out.id ? { ...mp, id: inId, energy: incoming.condition, injured: false } : mp)),
    }
    return {
      before: strengthOfTeam(t, game, side === 'home'),
      after: strengthOfTeam(after, game, side === 'home'),
      energyBefore: avgEnergy(t),
      energyAfter: avgEnergy(after),
    }
  }, [t, out, inId, game, side])
  if (!out || !inId || !preview) return null
  const op = game.players[out.id]
  const ip = game.players[inId]
  const attrs = keyAttrs(out.pos)
  const effect: [string, number, number][] = [
    ['공격', toDisplay(preview.before.attack), toDisplay(preview.after.attack)],
    ['중원', toDisplay(preview.before.midfield), toDisplay(preview.after.midfield)],
    ['수비', toDisplay(preview.before.defense), toDisplay(preview.after.defense)],
  ]

  return (
    <Sheet open onClose={onClose} title="교체 확인">
      <div className="flex flex-col gap-3.5 px-5 pt-0.5 pb-4">
        <span className="text-[12px] text-muted">
          교체 {t.subsLeft}회 → <b className="text-ink">{t.subsLeft - 1}회</b> 남음
        </span>
        <div className="grid items-stretch gap-1.5" style={{ gridTemplateColumns: 'minmax(0,1fr) 24px minmax(0,1fr)' }}>
          <div className="flex flex-col gap-1 rounded-[14px] border border-warn/35 bg-warn/8 px-3 py-2.5">
            <span className="text-[11px] font-bold text-warn">OUT</span>
            <span className="truncate text-[15px] font-bold">{op.name}</span>
            <span className="text-[12px] text-muted">
              {out.pos} · 능력 {ratingAt(op, out.pos)}
            </span>
            <span className="text-[12px] text-muted">
              평점 <b className="font-display text-[15px] text-ink">{out.rating.toFixed(1)}</b> · 체력{' '}
              <b className="font-display text-[15px]" style={{ color: energyColor(out.energy) }}>
                {Math.round(out.energy)}%
              </b>
            </span>
          </div>
          <div className="flex items-center justify-center text-muted" aria-hidden="true">
            →
          </div>
          <div className="flex flex-col gap-1 rounded-[14px] border border-accent/40 bg-accent/8 px-3 py-2.5">
            <span className="text-[11px] font-bold text-accent">IN</span>
            <span className="truncate text-[15px] font-bold">{ip.name}</span>
            <span className="text-[12px] text-muted">
              {out.pos} 예상 {ratingAt(ip, out.pos)}
              {ip.position === out.pos ? ' · 주 포지션' : ''}
            </span>
            <span className="text-[12px] text-muted">
              컨디션{' '}
              <b className="font-display text-[15px]" style={{ color: energyColor(ip.condition) }}>
                {ip.condition}%
              </b>
            </span>
          </div>
        </div>

        <div className="rounded-[14px] bg-bg px-3 py-1">
          <div className="grid h-7 items-center text-[11px] text-muted" style={{ gridTemplateColumns: 'minmax(0,1fr) 44px 44px 44px' }}>
            <span>{out.pos} 핵심 능력</span>
            <span className="text-center">OUT</span>
            <span className="text-center">IN</span>
            <span className="text-right">차이</span>
          </div>
          {attrs.map((k) => {
            const a = Math.round(op.attrs[k])
            const b = Math.round(ip.attrs[k])
            const d = b - a
            const color = d > 0 ? 'text-accent' : d < 0 ? 'text-warn' : 'text-ink-2'
            return (
              <div key={k} className="grid h-[30px] items-center border-t border-line-soft text-[13px]" style={{ gridTemplateColumns: 'minmax(0,1fr) 44px 44px 44px' }}>
                <span>{ATTR_LABEL[k]}</span>
                <span className="text-center font-display text-[16px] font-semibold text-ink-2">{a}</span>
                <span className={cx('text-center font-display text-[16px] font-bold', color)}>{b}</span>
                <span className={cx('text-right font-display text-[14px] font-bold', color)}>{d > 0 ? `+${d}` : d}</span>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {effect.map(([label, b, a]) => (
            <div key={label} className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-2 py-2">
              <span className="text-[11px] text-muted">{label}</span>
              <span className="font-display text-[16px] font-bold whitespace-nowrap">
                {b}
                <span className="text-[12px] text-muted"> → </span>
                <span className={a > b ? 'text-accent' : a < b ? 'text-warn' : ''}>{a}</span>
              </span>
            </div>
          ))}
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-2 py-2">
            <span className="text-[11px] text-muted">평균 체력</span>
            <span className="font-display text-[16px] font-bold whitespace-nowrap">
              {preview.energyBefore}
              <span className="text-[12px] text-muted"> → </span>
              <span className="text-accent">{preview.energyAfter}</span>
            </span>
          </div>
        </div>

        <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)' }}>
          <button type="button" onClick={onClose} className="h-[50px] rounded-xl border border-[#2E3F5E] bg-surface-2 text-[14px] font-semibold text-ink">
            다른 선수
          </button>
          <button type="button" onClick={() => onConfirm(out.id, inId)} className="h-[50px] rounded-xl border-none bg-accent text-[15px] font-bold text-bg">
            교체 확정
          </button>
        </div>
      </div>
    </Sheet>
  )
}
