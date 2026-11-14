import { useState } from 'react'
import { projectGrowth, type GrowthLevel } from '../engine/development'
import { ATTR_LABEL, formatMoney } from '../engine/korean'
import { ovr, potentialStars } from '../engine/ratings'
import { RECOVERY_FOCUS_BONUS, RECOVERY_RATE } from '../engine/season'
import type { GameState, Intensity, Player, TrainingFocus } from '../engine/types'
import { href } from '../router'
import { useGame } from '../store/gameStore'
import { Card, ConditionBar, EmptyState, PosBadge, ScreenHeader, Segmented, Stars, conditionColor, cx } from '../ui/kit'

type Tab = 'training' | 'youth' | 'transfer' | 'finance'

const FOCUS: { id: TrainingFocus; title: string; desc: string }[] = [
  { id: 'attack', title: '공격', desc: '슈팅 · 침투' },
  { id: 'defense', title: '수비', desc: '태클 · 위치선정' },
  { id: 'fitness', title: '체력', desc: '속도 · 지구력' },
  { id: 'tactics', title: '전술', desc: '조직력 · 판단력' },
  { id: 'setpiece', title: '세트피스', desc: '헤딩 · 킥' },
  { id: 'recovery', title: '회복', desc: '피로 · 부상 예방' },
]

const INTENSITY: Record<Intensity, { label: string; risk: string; riskCls: string; note: string }> = {
  light: { label: '가볍게', risk: '낮음', riskCls: 'text-accent', note: '성장 효과 낮음 · 컨디션 회복이 빠르고 부상 위험이 낮습니다.' },
  normal: { label: '보통', risk: '보통', riskCls: 'text-caution', note: '성장과 회복의 균형을 맞춥니다.' },
  hard: { label: '강하게', risk: '높음', riskCls: 'text-warn', note: '성장 효과 높음 · 회복이 느리고 훈련 중 부상 확률이 올라갑니다.' },
}

export const LEVEL_STYLE: Record<GrowthLevel, string> = {
  높음: 'bg-accent/16 text-accent',
  보통: 'bg-caution/14 text-caution',
  낮음: 'bg-line text-ink-2',
  유지: 'bg-line text-ink-2',
  하락: 'bg-warn/16 text-warn',
}

const TABS: Tab[] = ['training', 'youth', 'transfer', 'finance']

export function ClubScreen({ game, initialTab }: { game: GameState; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'training')
  const club = game.clubs[game.userClubId]
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title="클럽"
        subtitle={`${club.name} · 훈련 시설 Lv.${club.facilities.training} · 유스 시설 Lv.${club.facilities.youth}`}
      />
      <div className="shrink-0 px-4 pb-3.5">
        <Segmented
          label="클럽 메뉴"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'training', label: '훈련' },
            { value: 'youth', label: `유스 ${club.youthIds.length}` },
            { value: 'transfer', label: '이적' },
            { value: 'finance', label: '재정' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {tab === 'training' && <Training game={game} />}
        {tab === 'youth' && <Youth game={game} />}
        {tab === 'transfer' && (
          <Card>
            <EmptyState title="이적 시장은 M3 업데이트에서 열립니다" body="스카우팅, 이적 제안·협상, 계약 연장이 추가될 예정입니다." />
          </Card>
        )}
        {tab === 'finance' && <Finance game={game} />}
      </div>
    </div>
  )
}

export function GrowthRow({ game, p, sub }: { game: GameState; p: Player; sub?: string }) {
  const club = game.clubs[p.clubId]
  const g = projectGrowth(p, club)
  const detail = sub ?? (g.level === '하락' ? '신체 능력 하락 중' : g.level === '유지' ? '능력 유지' : `${g.top.map((k) => ATTR_LABEL[k]).join(' · ')} ▲`)
  return (
    <a
      href={href(`player/${p.id}`)}
      className="grid items-center gap-2.5 border-t border-line-soft px-3.5 py-2.5 text-ink no-underline"
      style={{ gridTemplateColumns: '38px minmax(0,1fr) auto' }}
    >
      <PosBadge pos={p.position} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate text-[14px] font-semibold">{p.name}</span>
          <span className="shrink-0 text-[12px] text-muted">
            {p.age}세 · {ovr(p)}
          </span>
        </span>
        <span className="truncate text-[12px] text-muted">{detail}</span>
      </span>
      <span className={cx('rounded-full px-2.5 py-[3px] text-[12px] font-bold', LEVEL_STYLE[g.level])}>{g.level}</span>
    </a>
  )
}

function Training({ game }: { game: GameState }) {
  const setTraining = useGame((s) => s.setTraining)
  const club = game.clubs[game.userClubId]
  const { focus, intensity } = club.training
  const info = INTENSITY[intensity]
  const recovery = Math.round(Math.min(0.95, RECOVERY_RATE[intensity] + (focus === 'recovery' ? RECOVERY_FOCUS_BONUS : 0)) * 100)
  const everyone = [...club.playerIds, ...club.youthIds].map((id) => game.players[id])
  const projections = everyone.map((p) => ({ p, g: projectGrowth(p, club) }))
  const growers = projections
    .filter((x) => x.g.level !== '하락' && x.g.rate > 0.02)
    .sort((a, b) => b.g.rate - a.g.rate)
    .slice(0, 5)
  const decliners = projections
    .filter((x) => x.g.level === '하락')
    .sort((a, b) => b.g.decline - a.g.decline)
    .slice(0, 3)
  const tired = club.playerIds
    .map((id) => game.players[id])
    .sort((a, b) => a.condition - b.condition)
    .slice(0, 4)

  return (
    <div className="flex flex-col gap-3.5">
      <section aria-label="이번 주 팀 훈련" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 text-[15px] font-bold">이번 주 팀 훈련</h2>
          <span className="text-[12px] text-muted">집중 1개 선택</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {FOCUS.map((f) => {
            const on = f.id === focus
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTraining({ focus: f.id })}
                className={cx(
                  'flex h-[70px] flex-col items-start justify-center gap-1 rounded-[14px] border-[1.5px] px-3 text-left',
                  on ? 'border-accent bg-accent/10' : 'border-line bg-surface',
                )}
              >
                <span className={cx('text-[15px] font-bold', on ? 'text-accent' : 'text-ink')}>{f.title}</span>
                <span className="text-[11px] text-muted">{f.desc}</span>
              </button>
            )
          })}
        </div>
      </section>

      <Card label="훈련 강도" className="flex flex-col gap-2.5 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold">훈련 강도</span>
          <span className={cx('text-[12px] font-semibold', info.riskCls)}>부상 위험 {info.risk}</span>
        </div>
        <Segmented
          label="훈련 강도"
          tone="accent"
          size="sm"
          value={intensity}
          onChange={(v) => setTraining({ intensity: v })}
          options={(Object.keys(INTENSITY) as Intensity[]).map((k) => ({ value: k, label: INTENSITY[k].label }))}
        />
        <span className="text-[12px] leading-relaxed text-muted">{info.note}</span>
        <span className="flex items-center justify-between border-t border-line-soft pt-2 text-[12px] text-muted">
          주간 컨디션 회복 (부족분 대비) <span className="font-display text-[16px] font-bold text-ink">{recovery}%</span>
        </span>
      </Card>

      <Card label="이번 주 성장 예상" className="flex flex-col py-1">
        <div className="flex items-center justify-between px-3.5 py-2">
          <h2 className="m-0 text-[15px] font-bold">이번 주 성장 예상</h2>
          <span className="text-[12px] text-muted">현재 역할 기준</span>
        </div>
        {growers.length === 0 && <div className="border-t border-line-soft px-3.5 py-3 text-[13px] text-muted">성장 중인 선수가 없습니다.</div>}
        {growers.map(({ p }) => (
          <GrowthRow key={p.id} game={game} p={p} />
        ))}
        {decliners.length > 0 && (
          <>
            <div className="border-t border-line-soft px-3.5 pt-2.5 pb-1 text-[12px] font-semibold text-warn">하락 주의</div>
            {decliners.map(({ p }) => (
              <GrowthRow key={p.id} game={game} p={p} />
            ))}
          </>
        )}
        <p className="m-0 border-t border-line-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-muted">
          어릴수록, 잠재력까지 여유가 있을수록, 많이 뛸수록 빨리 성장합니다. 훈련 강도·시설·선수 성격도 영향을 줍니다.
        </p>
      </Card>

      <Card label="컨디션 낮은 선수" className="flex flex-col py-1">
        <h2 className="m-0 px-3.5 py-2 text-[15px] font-bold">컨디션 낮은 선수</h2>
        {tired.map((p) => (
          <a
            key={p.id}
            href={href(`player/${p.id}`)}
            className="grid items-center gap-2.5 border-t border-line-soft px-3.5 py-2.5 text-ink no-underline"
            style={{ gridTemplateColumns: '38px minmax(0,1fr) 64px 40px' }}
          >
            <PosBadge pos={p.position} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] font-semibold">{p.name}</span>
              <span className="text-[12px] text-muted">{p.injury ? `${p.injury.type} · ${p.injury.weeks}주` : `${p.age}세`}</span>
            </span>
            <ConditionBar value={p.condition} />
            <span className="text-right font-display text-[15px] font-semibold" style={{ color: conditionColor(p.condition) }}>
              {p.condition}%
            </span>
          </a>
        ))}
      </Card>
    </div>
  )
}

function Youth({ game }: { game: GameState }) {
  const club = game.clubs[game.userClubId]
  const youth = club.youthIds
    .map((id) => game.players[id])
    .sort((a, b) => b.potential - a.potential || ovr(b) - ovr(a))
  const lvl = club.facilities.youth
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold">유스 아카데미</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-[3px] text-[12px] font-semibold text-ink-2">시설 Lv.{lvl}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[13px]">
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
            <span className="text-[11px] text-muted">아카데미 선수</span>
            <span className="font-display text-[22px] font-bold">{youth.length}명</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
            <span className="text-[11px] text-muted">다음 입단</span>
            <span className="text-[14px] leading-7 font-semibold">시즌 종료 후 {lvl >= 4 ? '3–5' : '2–4'}명</span>
          </div>
        </div>
        <p className="m-0 text-[12px] leading-relaxed text-muted">
          유스 선수는 경기에 나서지 않아도 유스 리그에서 꾸준히 성장합니다. 1군으로 올리면 출전 시간에 따라 더 빨리 큽니다. 20세가 되면 자동으로 승격되거나 방출됩니다.
        </p>
      </Card>

      <Card label="유스 선수 목록" className="overflow-hidden">
        {youth.length === 0 && <EmptyState title="아카데미에 선수가 없습니다" body="시즌이 끝나면 새 유망주가 입단합니다." />}
        {youth.map((p, i) => (
          <a
            key={p.id}
            href={href(`player/${p.id}`)}
            className={cx('grid h-[60px] items-center gap-2.5 px-3.5 text-ink no-underline', i > 0 && 'border-t border-line-soft')}
            style={{ gridTemplateColumns: '38px minmax(0,1fr) auto 46px' }}
          >
            <PosBadge pos={p.position} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[14px] font-semibold">{p.name}</span>
              <span className="text-[12px] text-muted">
                {p.age}세 · {projectGrowth(p, club).level === '높음' ? '빠르게 성장 중' : '성장 중'}
              </span>
            </span>
            <Stars n={potentialStars(p.potential)} className="text-[11px] tracking-[1px]" />
            <span className="text-right font-display text-[22px] font-bold">{ovr(p)}</span>
          </a>
        ))}
      </Card>
    </div>
  )
}

function Finance({ game }: { game: GameState }) {
  const club = game.clubs[game.userClubId]
  const wages = [...club.playerIds, ...club.youthIds].reduce((s, id) => s + game.players[id].contract.wage, 0)
  const rows: [string, string][] = [
    ['구단 예산', formatMoney(club.budget)],
    ['주급 총액 (유스 포함)', formatMoney(wages)],
    ['시즌 주급 지출 (30주)', formatMoney(wages * 30)],
    ['홈 구장', club.stadium],
    ['수용 인원', `${club.capacity.toLocaleString('ko-KR')}명`],
    ['구단 명성', `${club.reputation} / 100`],
  ]
  return (
    <Card className="flex flex-col divide-y divide-line-soft">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between px-4 py-3.5 text-[14px]">
          <span className="text-muted">{k}</span>
          <span className="font-semibold">{v}</span>
        </div>
      ))}
      <p className="m-0 px-4 py-3 text-[12px] leading-relaxed text-muted">관중·중계권 수입과 상금, 시설 투자, 이사회 예산 관리는 M3 업데이트에서 추가됩니다.</p>
    </Card>
  )
}
