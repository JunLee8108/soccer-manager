import { useState } from 'react'
import { formatMoney } from '../engine/korean'
import { RECOVERY_FOCUS_BONUS, RECOVERY_RATE } from '../engine/season'
import type { GameState, Intensity, TrainingFocus } from '../engine/types'
import { href } from '../router'
import { useGame } from '../store/gameStore'
import { Card, ConditionBar, EmptyState, PosBadge, ScreenHeader, Segmented, conditionColor, cx } from '../ui/kit'

type Tab = 'training' | 'youth' | 'transfer' | 'finance'

const FOCUS: { id: TrainingFocus; title: string; desc: string }[] = [
  { id: 'attack', title: '공격', desc: '슈팅 · 침투' },
  { id: 'defense', title: '수비', desc: '태클 · 위치선정' },
  { id: 'fitness', title: '체력', desc: '지구력 · 속도' },
  { id: 'tactics', title: '전술', desc: '조직력 · 이해도' },
  { id: 'setpiece', title: '세트피스', desc: '프리킥 · 코너킥' },
  { id: 'recovery', title: '회복', desc: '피로 · 부상 예방' },
]

const INTENSITY: Record<Intensity, { label: string; risk: string; riskCls: string; note: string }> = {
  light: { label: '가볍게', risk: '낮음', riskCls: 'text-accent', note: '컨디션 회복이 빠르고 부상 위험이 낮습니다.' },
  normal: { label: '보통', risk: '보통', riskCls: 'text-caution', note: '회복과 훈련 강도의 균형을 맞춥니다.' },
  hard: { label: '강하게', risk: '높음', riskCls: 'text-warn', note: '회복이 느리고 훈련 중 부상 확률이 올라갑니다.' },
}

export function ClubScreen({ game }: { game: GameState }) {
  const [tab, setTab] = useState<Tab>('training')
  const club = game.clubs[game.userClubId]
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title="클럽" subtitle={`${club.name} · ${club.stadium} · 예산 ${formatMoney(club.budget)}`} />
      <div className="shrink-0 px-4 pb-3.5">
        <Segmented
          label="클럽 메뉴"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'training', label: '훈련' },
            { value: 'youth', label: '유스' },
            { value: 'transfer', label: '이적' },
            { value: 'finance', label: '재정' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {tab === 'training' && <Training game={game} />}
        {tab === 'youth' && (
          <Card>
            <EmptyState title="유스 아카데미는 M2 업데이트에서 열립니다" body="시즌마다 유망주가 입단하고, 훈련과 출전으로 성장하는 시스템이 함께 추가됩니다." />
          </Card>
        )}
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

function Training({ game }: { game: GameState }) {
  const setTraining = useGame((s) => s.setTraining)
  const club = game.clubs[game.userClubId]
  const { focus, intensity } = club.training
  const info = INTENSITY[intensity]
  const recovery = Math.round(Math.min(0.95, RECOVERY_RATE[intensity] + (focus === 'recovery' ? RECOVERY_FOCUS_BONUS : 0)) * 100)
  const tired = club.playerIds
    .map((id) => game.players[id])
    .sort((a, b) => a.condition - b.condition)
    .slice(0, 5)

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
        <span className="text-[12px] text-muted">{info.note}</span>
      </Card>

      <Card label="훈련 효과" className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between text-[14px]">
          <span className="text-muted">주간 컨디션 회복 (부족분 대비)</span>
          <span className="font-display text-[18px] font-bold">{recovery}%</span>
        </div>
        <p className="m-0 rounded-xl bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
          지금은 강도와 회복 집중이 컨디션과 부상에 영향을 줍니다. 훈련 집중에 따른 능력치 성장은 M2 업데이트에서 적용됩니다.
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

function Finance({ game }: { game: GameState }) {
  const club = game.clubs[game.userClubId]
  const wages = club.playerIds.reduce((s, id) => s + game.players[id].contract.wage, 0)
  const rows: [string, string][] = [
    ['구단 예산', formatMoney(club.budget)],
    ['주급 총액', formatMoney(wages)],
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
      <p className="m-0 px-4 py-3 text-[12px] leading-relaxed text-muted">관중·중계권 수입과 상금, 이사회 예산 관리는 M3 업데이트에서 추가됩니다.</p>
    </Card>
  )
}
