import { useEffect, type ReactNode } from 'react'
import { useRoute } from './router'
import { ClubScreen } from './screens/Club'
import { HomeScreen } from './screens/Home'
import { InboxScreen } from './screens/Inbox'
import { LeagueScreen } from './screens/League'
import { MatchScreen } from './screens/Match'
import { MenuScreen } from './screens/Menu'
import { PlayerScreen } from './screens/Player'
import { ReportScreen } from './screens/Report'
import { SackedScreen } from './screens/Sacked'
import { SeasonScreen } from './screens/Season'
import { SquadScreen } from './screens/Squad'
import { TacticsScreen } from './screens/Tactics'
import { MarketScreen } from './screens/Transfers'
import { useGame } from './store/gameStore'
import { BottomNav, type NavKey } from './ui/BottomNav'
import { Toast } from './ui/Toast'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="pt-safe relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-bg md:border-x md:border-line-soft">
      {children}
      <Toast />
    </div>
  )
}

export default function App() {
  const ready = useGame((s) => s.ready)
  const game = useGame((s) => s.game)
  const route = useRoute()

  useEffect(() => {
    void useGame.getState().init()
  }, [])

  if (!ready) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center text-muted">불러오는 중…</div>
      </Shell>
    )
  }

  if (!game) {
    return (
      <Shell>
        <MenuScreen />
      </Shell>
    )
  }

  if (game.board?.status === 'sacked') {
    return (
      <Shell>
        <SackedScreen game={game} />
      </Shell>
    )
  }

  let screen: ReactNode
  let nav: NavKey | null | undefined
  switch (route.name) {
    case 'market':
      screen = <MarketScreen game={game} />
      nav = 'club'
      break
    case 'squad':
      screen = <SquadScreen game={game} />
      nav = 'squad'
      break
    case 'player':
      screen = <PlayerScreen key={route.id} game={game} id={route.id} />
      nav = 'squad'
      break
    case 'tactics':
      screen = <TacticsScreen game={game} />
      nav = 'tactics'
      break
    case 'match':
      screen = <MatchScreen game={game} />
      nav = undefined
      break
    case 'report':
      screen = <ReportScreen game={game} />
      nav = 'home'
      break
    case 'league':
      screen = <LeagueScreen game={game} />
      nav = 'league'
      break
    case 'club':
      screen = <ClubScreen key={route.tab ?? 'training'} game={game} initialTab={route.tab} />
      nav = 'club'
      break
    case 'inbox':
      screen = <InboxScreen game={game} />
      nav = 'home'
      break
    case 'season':
      screen = <SeasonScreen game={game} />
      nav = undefined
      break
    default:
      screen = <HomeScreen game={game} />
      nav = 'home'
  }

  return (
    <Shell>
      {screen}
      {nav !== undefined && <BottomNav active={nav} />}
    </Shell>
  )
}
