import { useState } from 'react'
import { CLUB_SEEDS, LEAGUE_NAME } from '../engine/data/clubs'
import { clubLevel, objectiveFor } from '../engine/generator'
import { navigate } from '../router'
import { SLOT_COUNT, type SaveMeta } from '../store/persistence'
import { useGame } from '../store/gameStore'
import { IconChevronLeft, IconPlus, IconTrash } from '../ui/Icons'
import { Card, Crest, Sheet, cx } from '../ui/kit'

function formatDate(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function tierOf(rank: number) {
  if (rank <= 3) return { label: '강팀', cls: 'bg-accent/16 text-accent' }
  if (rank <= 7) return { label: '상위권', cls: 'bg-away/16 text-away' }
  if (rank <= 11) return { label: '중위권', cls: 'bg-line text-ink-2' }
  return { label: '하위권', cls: 'bg-warn/16 text-warn' }
}

export function MenuScreen() {
  const saves = useGame((s) => s.saves)
  const { loadGame, deleteSave } = useGame.getState()
  const [newSlot, setNewSlot] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<SaveMeta | null>(null)

  if (newSlot !== null) return <NewGame slot={newSlot} onCancel={() => setNewSlot(null)} />

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col items-center gap-3 px-6 pt-14 pb-8 text-center">
        <svg aria-hidden="true" width="64" height="74" viewBox="0 0 40 46">
          <path d="M20 2 4 8v13c0 10 7 18 16 22 9-4 16-12 16-22V8z" fill="#A3E635" />
          <circle cx="20" cy="22" r="8" fill="none" stroke="#0B1220" strokeWidth="2.5" />
        </svg>
        <h1 className="m-0 text-[28px] font-bold">축구 매니저</h1>
        <p className="m-0 text-[14px] leading-relaxed text-muted">
          {LEAGUE_NAME}의 클럽을 맡아
          <br />
          선수를 키우고 우승에 도전하세요.
        </p>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pb-8">
        <h2 className="m-0 px-1 text-[13px] font-semibold text-muted">저장 슬롯</h2>
        {Array.from({ length: SLOT_COUNT }, (_, slot) => {
          const meta = saves.find((s) => s.slot === slot)
          if (!meta) {
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setNewSlot(slot)}
                className="flex h-[76px] items-center gap-3 rounded-2xl border border-dashed border-line bg-transparent px-4 text-left text-ink"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-surface-2 text-accent">
                  <IconPlus size={20} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">새 게임</span>
                  <span className="text-[12px] text-muted">슬롯 {slot + 1} · 비어 있음</span>
                </span>
              </button>
            )
          }
          const seed = CLUB_SEEDS.find((c) => c.id === meta.clubId)
          return (
            <Card key={slot} className="flex items-center gap-3 p-3.5">
              {seed && <Crest club={seed} size={40} />}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-bold">{meta.clubName}</span>
                <span className="truncate text-[12px] text-muted">
                  {meta.managerName} 감독 · 시즌 {meta.season} · {meta.round === 0 ? '개막 전' : `${meta.round}라운드 진행`}
                </span>
                <span className="text-[11px] text-muted">슬롯 {slot + 1} · {formatDate(meta.updatedAt)}</span>
              </div>
              <button
                type="button"
                aria-label={`슬롯 ${slot + 1} 삭제`}
                onClick={() => setConfirmDelete(meta)}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-transparent text-muted"
              >
                <IconTrash size={18} />
              </button>
              <button
                type="button"
                onClick={async () => {
                  await loadGame(slot)
                  navigate('', { replace: true })
                }}
                className="h-11 shrink-0 rounded-xl border-none bg-accent px-4 text-[14px] font-bold text-bg"
              >
                이어하기
              </button>
            </Card>
          )
        })}
        <p className="m-0 px-1 pt-2 text-[12px] leading-relaxed text-muted">
          게임은 이 기기의 브라우저에 자동 저장됩니다. 클라우드 저장은 다음 업데이트에서 추가됩니다.
        </p>
      </div>

      <Sheet open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="저장 데이터 삭제">
        {confirmDelete && (
          <div className="flex flex-col gap-3 px-5 pt-1 pb-4">
            <p className="m-0 text-[14px] leading-relaxed text-ink-2">
              슬롯 {confirmDelete.slot + 1}의 {confirmDelete.clubName} (시즌 {confirmDelete.season}) 데이터를 삭제할까요? 되돌릴 수 없습니다.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="h-12 rounded-xl border border-line bg-surface-2 text-[15px] font-semibold text-ink">
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteSave(confirmDelete.slot)
                  setConfirmDelete(null)
                }}
                className="h-12 rounded-xl border-none bg-warn text-[15px] font-bold text-bg"
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function NewGame({ slot, onCancel }: { slot: number; onCancel: () => void }) {
  const newGame = useGame((s) => s.newGame)
  const busy = useGame((s) => s.busy)
  const [clubId, setClubId] = useState('hanbit')
  const [name, setName] = useState('')
  const byRep = [...CLUB_SEEDS].sort((a, b) => b.reputation - a.reputation)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 px-4 pt-[18px] pb-3">
        <button type="button" aria-label="뒤로" onClick={onCancel} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink">
          <IconChevronLeft size={20} />
        </button>
        <div className="flex flex-col gap-[3px]">
          <h1 className="m-0 text-[22px] font-bold">새 게임</h1>
          <span className="text-[12px] text-muted">슬롯 {slot + 1} · 맡을 클럽을 고르세요</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <label className="mb-3 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-muted">감독 이름</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
            placeholder="감독"
            className="h-12 rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-accent"
          />
        </label>
        <div role="radiogroup" aria-label="클럽 선택" className="flex flex-col gap-2">
          {byRep.map((c, i) => {
            const on = c.id === clubId
            const tier = tierOf(i + 1)
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setClubId(c.id)}
                className={cx('flex items-center gap-3 rounded-2xl border-[1.5px] p-3 text-left text-ink', on ? 'border-accent bg-accent/8' : 'border-line bg-surface')}
              >
                <Crest club={c} size={36} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-bold">{c.name}</span>
                    <span className={cx('shrink-0 rounded px-1.5 py-px text-[10px] font-bold', tier.cls)}>{tier.label}</span>
                  </span>
                  <span className="truncate text-[12px] text-muted">
                    목표 {objectiveFor(i + 1).label} · 평균 전력 {Math.round(clubLevel(c.reputation))}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-3">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            await newGame(slot, clubId, name)
            navigate('', { replace: true })
          }}
          className="h-[52px] w-full rounded-[14px] border-none bg-accent text-[16px] font-bold text-bg disabled:opacity-60"
        >
          {busy ? '리그를 만드는 중…' : `${CLUB_SEEDS.find((c) => c.id === clubId)?.name} 감독으로 시작`}
        </button>
      </div>
    </div>
  )
}
