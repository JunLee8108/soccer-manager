import { freeShirt } from './generator'
import { ovr, wageFor } from './ratings'
import type { Rng } from './rng'
import type { Club, GameState, Player } from './types'
import { FREE_AGENT } from './types'

export function clubOf(game: GameState, p: Player | undefined): Club | null {
  if (!p) return null
  return game.clubs[p.clubId] ?? null
}

export const isFreeAgent = (p: Player) => p.clubId === FREE_AGENT

/** Take a player out of his club's squad, academy and team sheet (the player object stays). */
export function detachPlayer(game: GameState, id: string) {
  const p = game.players[id]
  if (!p) return
  const club = game.clubs[p.clubId]
  if (club) {
    club.playerIds = club.playerIds.filter((x) => x !== id)
    club.youthIds = club.youthIds.filter((x) => x !== id)
    club.tactics = {
      ...club.tactics,
      lineup: club.tactics.lineup.map((x) => (x === id ? null : x)),
      bench: club.tactics.bench.filter((x) => x !== id),
    }
  }
  game.freeAgents = game.freeAgents.filter((x) => x !== id)
  delete game.transferList[id]
  game.offers = game.offers.filter((o) => o.playerId !== id)
}

/** Add a player to a club's first team with a free shirt number. */
export function attachPlayer(game: GameState, id: string, clubId: string, rng: Rng) {
  const p = game.players[id]
  const club = game.clubs[clubId]
  if (!p || !club) return
  detachPlayer(game, id)
  const taken = new Set(club.playerIds.map((x) => game.players[x].shirt))
  p.clubId = clubId
  p.shirt = freeShirt(rng, taken, p.position, false)
  club.playerIds = [...club.playerIds, id]
}

/** Remove a player from the game entirely (retirement, academy release). */
export function removePlayer(game: GameState, id: string) {
  detachPlayer(game, id)
  game.scouted = game.scouted.filter((x) => x !== id)
  game.scoutQueue = game.scoutQueue.filter((t) => t.playerId !== id)
  delete game.players[id]
}

/** Put a player into the free-agent pool. */
export function moveToFreeAgents(game: GameState, id: string) {
  const p = game.players[id]
  if (!p) return
  const wasUser = p.clubId === game.userClubId
  detachPlayer(game, id)
  p.clubId = FREE_AGENT
  p.shirt = 0
  p.contract = { wage: wageFor(ovr(p), p.age), until: game.season }
  game.freeAgents = [...game.freeAgents, id]
  // You know players who used to be yours.
  if (wasUser && !game.scouted.includes(id)) game.scouted = [...game.scouted, id]
}
