import { href } from '../router'
import { IconClub, IconHome, IconLeague, IconSquad, IconTactics } from './Icons'
import { cx } from './kit'

export type NavKey = 'home' | 'squad' | 'tactics' | 'league' | 'club'

const ITEMS: { key: NavKey; label: string; path: string; Icon: typeof IconHome }[] = [
  { key: 'home', label: '홈', path: '', Icon: IconHome },
  { key: 'squad', label: '스쿼드', path: 'squad', Icon: IconSquad },
  { key: 'tactics', label: '전술', path: 'tactics', Icon: IconTactics },
  { key: 'league', label: '리그', path: 'league', Icon: IconLeague },
  { key: 'club', label: '클럽', path: 'club', Icon: IconClub },
]

export function BottomNav({ active }: { active: NavKey | null }) {
  return (
    <nav aria-label="주 메뉴" className="pb-safe grid shrink-0 grid-cols-5 border-t border-line-soft bg-nav px-1 pt-1.5">
      {ITEMS.map(({ key, label, path, Icon }) => {
        const on = key === active
        return (
          <a
            key={key}
            href={href(path)}
            aria-current={on ? 'page' : undefined}
            className={cx(
              'flex min-h-[52px] flex-col items-center justify-center gap-[3px] text-[11px] no-underline',
              on ? 'font-bold text-accent' : 'font-medium text-muted',
            )}
          >
            <Icon size={24} />
            <span>{label}</span>
          </a>
        )
      })}
    </nav>
  )
}
