import type { Fixture, GameState, Player, StandingRow } from './types'

export function computeStandings(clubIds: string[], fixtures: Fixture[]): StandingRow[] {
  const rows = new Map<string, StandingRow>()
  for (const id of clubIds) {
    rows.set(id, { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [] })
  }
  const played = fixtures.filter((f) => f.result).sort((a, b) => a.round - b.round)
  for (const f of played) {
    const r = f.result!
    const home = rows.get(f.homeId)
    const away = rows.get(f.awayId)
    if (!home || !away) continue
    home.played++
    away.played++
    home.gf += r.homeGoals
    home.ga += r.awayGoals
    away.gf += r.awayGoals
    away.ga += r.homeGoals
    if (r.homeGoals > r.awayGoals) {
      home.won++
      away.lost++
      home.form.push('W')
      away.form.push('L')
    } else if (r.homeGoals < r.awayGoals) {
      away.won++
      home.lost++
      home.form.push('L')
      away.form.push('W')
    } else {
      home.drawn++
      away.drawn++
      home.form.push('D')
      away.form.push('D')
    }
  }
  const list = [...rows.values()]
  for (const row of list) {
    row.gd = row.gf - row.ga
    row.points = row.won * 3 + row.drawn
    row.form = row.form.slice(-5)
  }
  return list.sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.clubId.localeCompare(b.clubId),
  )
}

export function standingsOf(game: GameState): StandingRow[] {
  return computeStandings(game.clubOrder, game.fixtures)
}

export function rankOf(game: GameState, clubId: string): number {
  return standingsOf(game).findIndex((r) => r.clubId === clubId) + 1
}

export interface LeaderRow {
  player: Player
  value: number
}

export function topScorers(game: GameState, limit = 10): LeaderRow[] {
  return Object.values(game.players)
    .filter((p) => p.stats.goals > 0)
    .sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists || a.stats.apps - b.stats.apps)
    .slice(0, limit)
    .map((player) => ({ player, value: player.stats.goals }))
}

export function topAssists(game: GameState, limit = 10): LeaderRow[] {
  return Object.values(game.players)
    .filter((p) => p.stats.assists > 0)
    .sort((a, b) => b.stats.assists - a.stats.assists || b.stats.goals - a.stats.goals)
    .slice(0, limit)
    .map((player) => ({ player, value: player.stats.assists }))
}

export function topRated(game: GameState, limit = 10): LeaderRow[] {
  const minApps = Math.max(1, Math.floor(game.round * 0.4))
  return Object.values(game.players)
    .filter((p) => p.stats.rated >= minApps)
    .map((player) => ({ player, value: player.stats.ratingSum / player.stats.rated }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}
