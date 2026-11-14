import { useState } from 'react'
import type { GameState } from '../engine/types'
import { goBack } from '../router'
import { useGame } from '../store/gameStore'
import { EmptyState, ScreenHeader, TAG_STYLE, cx } from '../ui/kit'

export function InboxScreen({ game }: { game: GameState }) {
  const markRead = useGame((s) => s.markRead)
  const markAllRead = useGame((s) => s.markAllRead)
  const [open, setOpen] = useState<string | null>(null)
  const unread = game.inbox.filter((m) => !m.read).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title="받은 메시지"
        subtitle={unread ? `읽지 않은 메시지 ${unread}개` : '모두 읽음'}
        onBack={() => goBack('')}
        right={
          unread > 0 ? (
            <button type="button" onClick={markAllRead} className="h-11 shrink-0 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink">
              모두 읽음
            </button>
          ) : undefined
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {game.inbox.length === 0 && <EmptyState title="메시지가 없습니다" />}
        <ul className="m-0 list-none p-0">
          {game.inbox.map((m) => {
            const expanded = open === m.id
            return (
              <li key={m.id} className="border-b border-line-soft">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => {
                    setOpen(expanded ? null : m.id)
                    if (!m.read) markRead(m.id)
                  }}
                  className="flex w-full items-start gap-3 border-none bg-transparent px-4 py-3 text-left text-ink"
                >
                  <span className={cx('w-[52px] shrink-0 rounded-full py-[3px] text-center text-[11px] font-bold', TAG_STYLE[m.tag].cls)}>{TAG_STYLE[m.tag].label}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={cx('text-[14px]', m.read ? 'font-medium text-ink-2' : 'font-bold')}>{m.title}</span>
                    <span className={cx('text-[13px] leading-relaxed text-muted', !expanded && 'truncate')}>{m.body}</span>
                    <span className="text-[11px] text-muted">
                      시즌 {m.season} · {m.round === 0 ? '개막 전' : `${m.round}라운드 후`}
                    </span>
                  </span>
                  {!m.read && <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
