import { describe, expect, it } from 'vitest'
import { createNewGame } from './generator'
import { completeRound, isSeasonOver } from './season'
import { standingsOf, topScorers } from './standings'
import type { GameState } from './types'

/** Play a season where the user's club is run like the AI ones (matches skipped). */
function autoSeason(seed: number) {
  let game: GameState = createNewGame({ seed, userClubId: 'hanbit' })
  let minCondition = 100
  while (!isSeasonOver(game)) {
    game = completeRound(game, null)
    for (const id of game.clubOrder) {
      const starters = game.clubs[id].tactics.lineup.filter((x): x is string => !!x)
      const avg = starters.reduce((s, pid) => s + game.players[pid].condition, 0) / starters.length
      minCondition = Math.min(minCondition, avg)
    }
  }
  return { game, minCondition }
}

describe('season balance', () => {
  it('keeps squads fit and lets stronger clubs finish higher', () => {
    let topRep = 0
    let bottomRep = 0
    for (const seed of [11, 22, 33]) {
      const { game, minCondition } = autoSeason(seed)
      const table = standingsOf(game)
      const rep = (i: number) => game.clubs[table[i].clubId].reputation
      const top = [0, 1, 2, 3].map(rep)
      const bottom = [12, 13, 14, 15].map(rep)
      topRep += top.reduce((a, b) => a + b, 0) / 4
      bottomRep += bottom.reduce((a, b) => a + b, 0) / 4
      const scorer = topScorers(game, 1)[0]
      console.log(`seed ${seed}`, {
        champion: game.clubs[table[0].clubId].name,
        championPts: table[0].points,
        lastPts: table[15].points,
        topRep: top,
        bottomRep: bottom,
        topScorerGoals: scorer?.value,
        minStarterCondition: Math.round(minCondition),
      })
      expect(minCondition).toBeGreaterThan(72)
      expect(scorer.value).toBeLessThan(40)
    }
    expect(topRep / 3).toBeGreaterThan(bottomRep / 3 + 6)
  }, 60_000)
})
