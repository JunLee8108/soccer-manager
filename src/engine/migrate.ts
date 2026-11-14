import { emptyFinance, weeklyWages } from './finance'
import { createYouth, facilitiesFor, NameFactory, professionalismFor, SAVE_VERSION } from './generator'
import { mixSeed, Rng } from './rng'
import type { GameState } from './types'

/**
 * Bring an older save up to the current format. Pure: returns a new object.
 * v1 → v2: personality, individual training, season-start attributes,
 * facilities and youth academies.
 */
export function migrateGame(input: GameState): GameState {
  if ((input.version ?? 1) >= SAVE_VERSION) return input
  const game = structuredClone(input)
  const rng = new Rng(mixSeed(game.seed, 0x5eed2))

  if ((game.version ?? 1) < 2) {
    for (const p of Object.values(game.players)) {
      p.professionalism ??= professionalismFor(rng)
      p.trainingFocus ??= 'balanced'
      p.seasonStart ??= { ...p.attrs }
    }
    const names = new NameFactory(rng, Object.values(game.players).map((p) => p.name))
    for (const id of game.clubOrder) {
      const club = game.clubs[id]
      club.facilities ??= facilitiesFor(rng, club.reputation)
      if (!club.youthIds) {
        club.youthIds = []
        const count = rng.int(3, 5)
        for (let i = 0; i < count; i++) {
          const pid = `p${game.nextId++}`
          game.players[pid] = createYouth(rng, { id: pid, clubId: id, season: game.season, youthLevel: club.facilities.youth, names })
          club.youthIds.push(pid)
        }
      }
    }
    game.version = 2
  }

  if (game.version < 3) {
    for (const id of game.clubOrder) {
      const club = game.clubs[id]
      club.finance ??= emptyFinance(club.budget, weeklyWages(game, club))
    }
    game.freeAgents ??= []
    game.scouted ??= []
    game.scoutQueue ??= []
    game.transferList ??= {}
    game.offers ??= []
    game.news ??= []
    game.board ??= { confidence: 60, status: 'ok', jobOffers: [] }
    game.version = 3
  }
  return game
}
