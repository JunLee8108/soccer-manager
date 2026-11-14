import { FORMATIONS } from './data/formations'
import { ovr, ratingAt } from './ratings'
import type { Club, FormationId, Line, Player, Position, Tactics } from './types'
import { LINE_OF } from './types'

export const BENCH_SIZE = 7

export function isAvailable(p: Player): boolean {
  return !p.injury && p.suspension === 0
}

/** Selection score: position rating with a small penalty for low fitness. */
function selectScore(p: Player, pos: Position): number {
  return ratingAt(p, pos) * (0.82 + 0.18 * (p.condition / 100))
}

/** Slots are filled in this order so scarce roles get first pick. */
const SLOT_PRIORITY: Position[] = ['GK', 'CB', 'ST', 'DM', 'CM', 'LB', 'RB', 'AM', 'LW', 'RW']

function slotOrder(formation: FormationId): number[] {
  const slots = FORMATIONS[formation].slots
  return slots
    .map((s, i) => ({ i, pri: SLOT_PRIORITY.indexOf(s.pos) }))
    .sort((a, b) => a.pri - b.pri || a.i - b.i)
    .map((s) => s.i)
}

function fillSlots(formation: FormationId, pool: Player[], preset: (string | null)[] = []): (string | null)[] {
  const slots = FORMATIONS[formation].slots
  const lineup: (string | null)[] = slots.map((_, i) => preset[i] ?? null)
  const used = new Set(lineup.filter((x): x is string => !!x))
  for (const i of slotOrder(formation)) {
    if (lineup[i]) continue
    let best: Player | null = null
    let bestScore = -1
    for (const p of pool) {
      if (used.has(p.id)) continue
      const s = selectScore(p, slots[i].pos)
      if (s > bestScore) {
        bestScore = s
        best = p
      }
    }
    if (best) {
      lineup[i] = best.id
      used.add(best.id)
    }
  }
  return lineup
}

export function pickBench(pool: Player[], excluded: Set<string>): string[] {
  const rest = pool.filter((p) => !excluded.has(p.id)).sort((a, b) => ovr(b) - ovr(a))
  const bench: Player[] = []
  const take = (pred: (p: Player) => boolean) => {
    const p = rest.find((x) => pred(x) && !bench.includes(x))
    if (p && bench.length < BENCH_SIZE) bench.push(p)
  }
  take((p) => p.position === 'GK')
  for (const line of ['DF', 'MF', 'FW'] as Line[]) take((p) => LINE_OF[p.position] === line)
  for (const p of rest) {
    if (bench.length >= BENCH_SIZE) break
    if (p.position === 'GK' && bench.some((b) => b.position === 'GK')) continue
    if (!bench.includes(p)) bench.push(p)
  }
  return bench.map((p) => p.id)
}

export function squadOf(club: Club, players: Record<string, Player>): Player[] {
  return club.playerIds.map((id) => players[id]).filter(Boolean)
}

/** Best available XI and bench for a formation. */
export function autoLineup(club: Club, players: Record<string, Player>, formation = club.tactics.formation) {
  const pool = squadOf(club, players).filter(isAvailable)
  const lineup = fillSlots(formation, pool)
  const bench = pickBench(pool, new Set(lineup.filter((x): x is string => !!x)))
  return { lineup, bench }
}

/** Switch formation while keeping the current starters where possible. */
export function refitLineup(club: Club, players: Record<string, Player>, formation: FormationId) {
  const squad = squadOf(club, players).filter(isAvailable)
  const currentIds = new Set(club.tactics.lineup.filter((x): x is string => !!x))
  const current = squad.filter((p) => currentIds.has(p.id))
  // First seat the current starters in the new shape, then fill any gaps.
  let lineup = fillSlots(formation, current)
  lineup = fillSlots(formation, squad, lineup)
  const starters = new Set(lineup.filter((x): x is string => !!x))
  const keptBench = club.tactics.bench.filter((id) => !starters.has(id) && squad.some((p) => p.id === id))
  const bench = keptBench.length >= BENCH_SIZE ? keptBench.slice(0, BENCH_SIZE) : fillBench(keptBench, squad, starters)
  return { lineup, bench }
}

function fillBench(kept: string[], squad: Player[], starters: Set<string>): string[] {
  const bench = [...kept]
  const extra = squad
    .filter((p) => !starters.has(p.id) && !bench.includes(p.id))
    .sort((a, b) => ovr(b) - ovr(a))
  for (const p of extra) {
    if (bench.length >= BENCH_SIZE) break
    bench.push(p.id)
  }
  return bench
}

/**
 * Replace unavailable players (injured / suspended / sold) in a club's tactics.
 * Returns the names of players who had to be replaced.
 */
export function repairTactics(club: Club, players: Record<string, Player>): { tactics: Tactics; replaced: string[] } {
  const squad = squadOf(club, players)
  const ok = (id: string | null) => !!id && squad.some((p) => p.id === id && isAvailable(p))
  const replaced: string[] = []
  const lineup = club.tactics.lineup.map((id) => {
    if (id && !ok(id)) {
      replaced.push(players[id]?.name ?? '')
      return null
    }
    return ok(id) ? id : null
  })
  const pool = squad.filter(isAvailable)
  const preset = lineup.slice()
  // Prefer bench players for the gaps, then anyone else.
  const benchPool = pool.filter((p) => club.tactics.bench.includes(p.id))
  let filled = fillSlots(club.tactics.formation, benchPool, preset)
  filled = fillSlots(club.tactics.formation, pool, filled)
  const starters = new Set(filled.filter((x): x is string => !!x))
  const bench = fillBench(
    club.tactics.bench.filter((id) => ok(id) && !starters.has(id)),
    pool,
    starters,
  )
  return { tactics: { ...club.tactics, lineup: filled, bench }, replaced: replaced.filter(Boolean) }
}

export function lineupProblems(club: Club, players: Record<string, Player>): Player[] {
  return club.tactics.lineup
    .map((id) => (id ? players[id] : undefined))
    .filter((p): p is Player => !!p && !isAvailable(p))
}
