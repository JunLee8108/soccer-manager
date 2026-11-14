import { developPlayer } from './development'
import { clubLevel, createPlayer, createYouth, freeShirt, NameFactory, SQUAD_TEMPLATE } from './generator'
import { ovr, potentialStars, wageFor } from './ratings'
import { clamp, type Rng } from './rng'
import type { Club, ContractDecision, GameState, Player, Position } from './types'

export const MIN_SQUAD = 20
const AI_TARGET_SQUAD = 23
const AI_MAX_SQUAD = 28
const OFFSEASON_WEEKS = 5

export interface ContractOffer {
  wage: number
  years: number
}

/** First-team players whose contract runs out at the end of the current season. */
export function expiringPlayers(game: GameState, clubId: string): Player[] {
  return game.clubs[clubId].playerIds.map((id) => game.players[id]).filter((p) => p && p.contract.until <= game.season)
}

export function renewalOffer(p: Player): ContractOffer {
  const o = ovr(p)
  const wage = Math.round((wageFor(o, p.age) * (p.age >= 31 ? 0.9 : 1.1)) / 10) * 10
  const years = p.age <= 23 ? 3 : p.age <= 29 ? 2 : 1
  return { wage: Math.max(30, wage), years }
}

/** Suggested decision for the user's expiring players. */
export function suggestedDecision(p: Player, club: Club, game: GameState): ContractDecision {
  const squad = club.playerIds.map((id) => game.players[id]).map(ovr).sort((a, b) => b - a)
  const median = squad[Math.floor(squad.length / 2)] ?? 60
  if (p.age >= 33 && ovr(p) < median) return 'release'
  return 'renew'
}

export function retirementChance(p: Player): number {
  const o = ovr(p)
  let chance = 0
  if (p.age >= 37) chance = 0.95
  else if (p.age === 36) chance = 0.75
  else if (p.age === 35) chance = 0.5
  else if (p.age === 34) chance = 0.3
  else if (p.age === 33) chance = 0.12
  if (p.age >= 31 && o < 52) chance += 0.2
  return clamp(chance, 0, 1)
}

export function removePlayer(game: GameState, id: string) {
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
  delete game.players[id]
}

export function promoteYouth(game: GameState, id: string, rng: Rng): boolean {
  const p = game.players[id]
  if (!p) return false
  const club = game.clubs[p.clubId]
  if (!club.youthIds.includes(id)) return false
  club.youthIds = club.youthIds.filter((x) => x !== id)
  club.playerIds = [...club.playerIds, id]
  const taken = new Set(club.playerIds.filter((x) => x !== id).map((x) => game.players[x].shirt))
  p.shirt = freeShirt(rng, taken, p.position, false)
  return true
}

function nextId(game: GameState) {
  return `p${game.nextId++}`
}

/** The position the squad is shortest of, relative to the standard template. */
function neededPosition(club: Club, game: GameState): Position {
  const want: Partial<Record<Position, number>> = {}
  for (const [pos] of SQUAD_TEMPLATE) want[pos] = (want[pos] ?? 0) + 1
  const have: Partial<Record<Position, number>> = {}
  for (const id of club.playerIds) {
    const pos = game.players[id].position
    have[pos] = (have[pos] ?? 0) + 1
  }
  let best: Position = 'CM'
  let bestGap = -Infinity
  for (const pos of Object.keys(want) as Position[]) {
    const gap = (want[pos] ?? 0) - (have[pos] ?? 0)
    if (gap > bestGap) {
      bestGap = gap
      best = pos
    }
  }
  return best
}

function signFreeAgent(game: GameState, club: Club, rng: Rng, names: NameFactory, offset: number): Player {
  const pos = neededPosition(club, game)
  const taken = new Set(club.playerIds.map((x) => game.players[x].shirt))
  const p = createPlayer(rng, {
    id: nextId(game),
    clubId: club.id,
    pos,
    target: clamp(Math.round(clubLevel(club.reputation) + offset + rng.normal(2.5)), 40, 88),
    age: rng.int(22, 31),
    season: game.season,
    shirt: freeShirt(rng, taken, pos, false),
    names,
    contractYears: rng.int(1, 2),
  })
  game.players[p.id] = p
  club.playerIds = [...club.playerIds, p.id]
  return p
}

export interface OffseasonReport {
  retired: string[]
  renewed: string[]
  released: string[]
  promoted: string[]
  youthReleased: string[]
  youthIn: string[]
  signed: string[]
}

/**
 * Everything that happens between seasons. Mutates `game` (callers pass a clone).
 * Returns what happened to the user's club, for the inbox.
 */
export function runOffseason(game: GameState, rng: Rng, decisions: Record<string, ContractDecision>): OffseasonReport {
  const report: OffseasonReport = { retired: [], renewed: [], released: [], promoted: [], youthReleased: [], youthIn: [], signed: [] }
  const names = new NameFactory(rng, Object.values(game.players).map((p) => p.name))
  const endingSeason = game.season
  const newSeason = endingSeason + 1

  // 1. Pre-season training.
  for (const id of game.clubOrder) {
    const club = game.clubs[id]
    for (const pid of [...club.playerIds, ...club.youthIds]) {
      const p = game.players[pid]
      const youth = club.youthIds.includes(pid)
      for (let w = 0; w < OFFSEASON_WEEKS; w++) developPlayer(p, club, { minutes: 45, rating: null, youth }, rng)
    }
  }

  // 2. Everyone gets a year older.
  for (const p of Object.values(game.players)) p.age++

  for (const id of game.clubOrder) {
    const club = game.clubs[id]
    const isUser = id === game.userClubId
    const level = clubLevel(club.reputation)

    // 3. Retirements.
    for (const pid of club.playerIds) {
      const p = game.players[pid]
      if (rng.chance(retirementChance(p))) {
        if (isUser) report.retired.push(`${p.name} (${p.age}세)`)
        removePlayer(game, pid)
      }
    }

    // 4. Contracts that ran out.
    for (const pid of club.playerIds) {
      const p = game.players[pid]
      if (p.contract.until > endingSeason) continue
      let decision: ContractDecision
      if (isUser) decision = decisions[pid] ?? 'renew'
      else {
        const useful = ovr(p) >= level - 4 || (p.age <= 24 && p.potential >= level)
        decision = p.age >= 33 && !useful ? 'release' : useful || rng.chance(0.7) ? 'renew' : 'release'
      }
      if (decision === 'renew') {
        const offer = renewalOffer(p)
        p.contract = { wage: offer.wage, until: newSeason + offer.years - 1 }
        if (isUser) report.renewed.push(p.name)
      } else {
        if (isUser) report.released.push(p.name)
        removePlayer(game, pid)
      }
    }

    // 5. Academy graduates.
    for (const pid of club.youthIds) {
      const p = game.players[pid]
      const o = ovr(p)
      if (isUser) {
        if (p.age >= 20) {
          if (o >= 55) {
            promoteYouth(game, pid, rng)
            report.promoted.push(p.name)
          } else {
            report.youthReleased.push(p.name)
            removePlayer(game, pid)
          }
        }
        continue
      }
      const ready = p.age >= 18 && (o >= level - 12 || potentialStars(p.potential) >= 4)
      if (ready && club.playerIds.length < 26) promoteYouth(game, pid, rng)
      else if (p.age >= 19) removePlayer(game, pid)
    }

    // 6. New youth intake.
    const intake = rng.int(2, 4) + (club.facilities.youth >= 4 ? 1 : 0)
    for (let i = 0; i < intake; i++) {
      const y = createYouth(rng, { id: nextId(game), clubId: id, season: newSeason, youthLevel: club.facilities.youth, names, age: rng.int(15, 16) })
      game.players[y.id] = y
      club.youthIds = [...club.youthIds, y.id]
      if (isUser) report.youthIn.push(`${y.name} (${y.position}, ${y.age}세)`)
    }

    // 7. Keep squads playable.
    if (isUser) {
      while (club.playerIds.length < MIN_SQUAD) {
        const p = signFreeAgent(game, club, rng, names, -5)
        report.signed.push(`${p.name} (${p.position})`)
      }
    } else {
      while (club.playerIds.length < AI_TARGET_SQUAD) signFreeAgent(game, club, rng, names, -3)
      if (club.playerIds.length > AI_MAX_SQUAD) {
        const surplus = club.playerIds
          .map((pid) => game.players[pid])
          .filter((p) => p.age >= 27)
          .sort((a, b) => ovr(a) - ovr(b))
          .slice(0, club.playerIds.length - AI_MAX_SQUAD)
        for (const p of surplus) removePlayer(game, p.id)
      }
    }
  }

  // 8. Fresh season state.
  for (const p of Object.values(game.players)) {
    p.condition = 100
    p.suspension = 0
    p.yellowAccum = 0
    p.morale = Math.round((p.morale + 68) / 2)
    p.history = [ovr(p)]
    p.seasonStart = { ...p.attrs }
  }
  return report
}
