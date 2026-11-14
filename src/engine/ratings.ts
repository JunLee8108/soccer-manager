import { clamp } from './rng'
import type { AttrKey, Attributes, Player, Position } from './types'
import { LINE_OF } from './types'

type Weights = Partial<Record<AttrKey, number>>

/** How much each attribute matters when playing a position. */
export const POSITION_WEIGHTS: Record<Position, Weights> = {
  GK: { handling: 3, reflexes: 3, oneOnOne: 2, positioning: 2, decisions: 1, composure: 1, jumping: 1, passing: 0.5 },
  CB: { tackling: 3, marking: 3, heading: 2, positioning: 2, strength: 2, jumping: 1.5, decisions: 1, composure: 1, pace: 1, passing: 0.5 },
  LB: { tackling: 2, marking: 2, pace: 2, stamina: 2, acceleration: 1.5, positioning: 1.5, passing: 1, dribbling: 1, teamwork: 1, workRate: 1 },
  RB: { tackling: 2, marking: 2, pace: 2, stamina: 2, acceleration: 1.5, positioning: 1.5, passing: 1, dribbling: 1, teamwork: 1, workRate: 1 },
  DM: { tackling: 2.5, positioning: 2.5, passing: 2, marking: 1.5, decisions: 1.5, stamina: 1.5, workRate: 1.5, strength: 1, teamwork: 1, composure: 1 },
  CM: { passing: 3, decisions: 2, vision: 2, firstTouch: 2, stamina: 1.5, workRate: 1.5, teamwork: 1.5, tackling: 1, composure: 1, dribbling: 1 },
  AM: { passing: 2.5, vision: 2.5, firstTouch: 2, dribbling: 2, composure: 1.5, finishing: 1.5, decisions: 1.5, acceleration: 1 },
  LW: { dribbling: 3, pace: 2.5, acceleration: 2.5, firstTouch: 1.5, passing: 1.5, finishing: 1.5, composure: 1, vision: 1 },
  RW: { dribbling: 3, pace: 2.5, acceleration: 2.5, firstTouch: 1.5, passing: 1.5, finishing: 1.5, composure: 1, vision: 1 },
  ST: { finishing: 3, composure: 2, firstTouch: 2, positioning: 2, heading: 1.5, pace: 1.5, acceleration: 1.5, dribbling: 1, strength: 1 },
}

/** Overall rating (1–100) of a set of attributes when played at `pos`. */
export function ovrAt(attrs: Attributes, pos: Position): number {
  const w = POSITION_WEIGHTS[pos]
  let sum = 0
  let total = 0
  for (const key in w) {
    const k = key as AttrKey
    const weight = w[k] ?? 0
    sum += attrs[k] * weight
    total += weight
  }
  return Math.round((sum / total) * 5)
}

export function ovr(p: Player): number {
  return ovrAt(p.attrs, p.position)
}

const CLOSE_PAIRS: Record<string, number> = {
  'LB-RB': 0.88,
  'LW-RW': 0.9,
  'CM-DM': 0.9,
  'AM-CM': 0.9,
  'AM-ST': 0.85,
  'AM-LW': 0.86,
  'AM-RW': 0.86,
  'LW-ST': 0.84,
  'RW-ST': 0.84,
  'CB-DM': 0.82,
  'LB-LW': 0.8,
  'RB-RW': 0.8,
}

/** 0–1 familiarity of a player with a slot position. */
export function familiarity(p: Pick<Player, 'position' | 'secondary'>, pos: Position): number {
  if (p.position === pos) return 1
  if (p.secondary.includes(pos)) return 0.94
  if (p.position === 'GK' || pos === 'GK') return 0.3
  const key = [p.position, pos].sort().join('-')
  if (CLOSE_PAIRS[key]) return CLOSE_PAIRS[key]
  if (LINE_OF[p.position] === LINE_OF[pos]) return 0.8
  return 0.65
}

/** Effective rating at a slot, combining attributes and familiarity. */
export function ratingAt(p: Player, pos: Position): number {
  return Math.round(ovrAt(p.attrs, pos) * familiarity(p, pos))
}

// ---- Zone scores used by the match engine (1–20 scale) ----

export function attackScore(a: Attributes): number {
  return (
    (a.finishing * 2 + a.dribbling * 1.5 + a.firstTouch * 1.5 + a.composure + a.pace + a.acceleration +
      a.positioning * 0.5 + a.passing * 0.5 + a.vision * 0.5) /
    9.5
  )
}

export function midfieldScore(a: Attributes): number {
  return (
    (a.passing * 2 + a.vision * 1.5 + a.decisions * 1.5 + a.firstTouch + a.teamwork + a.workRate + a.composure * 0.5 +
      a.stamina * 0.5 + a.tackling * 0.5) /
    9.5
  )
}

export function defenseScore(a: Attributes): number {
  return (
    (a.tackling * 2 + a.marking * 2 + a.positioning * 1.5 + a.strength + a.heading + a.decisions + a.pace * 0.5 +
      a.jumping * 0.5 + a.workRate * 0.5) /
    10
  )
}

export function keeperScore(a: Attributes): number {
  return (a.handling * 2 + a.reflexes * 2 + a.oneOnOne * 1.5 + a.positioning + a.decisions * 0.5 + a.jumping * 0.5) / 7.5
}

/** Share of a player's quality that flows into attack / midfield / defense, by slot. */
export const ROLE_WEIGHTS: Record<Position, [number, number, number]> = {
  GK: [0, 0.05, 0],
  CB: [0.03, 0.15, 1],
  LB: [0.2, 0.35, 0.75],
  RB: [0.2, 0.35, 0.75],
  DM: [0.1, 0.8, 0.55],
  CM: [0.3, 1, 0.3],
  AM: [0.75, 0.75, 0.08],
  LW: [0.9, 0.35, 0.1],
  RW: [0.9, 0.35, 0.1],
  ST: [1, 0.15, 0.03],
}

/** Reference weight sums (a 4-3-3) so other shapes shift strength up or down. */
export const ROLE_NORM: [number, number, number] = [3.96, 4.7, 4.88]

export interface Strength {
  attack: number
  midfield: number
  defense: number
  keeper: number
}

/** Static team strength for a list of (player, slot position) pairs. */
export function teamStrength(entries: { player: Player; pos: Position; factor?: number }[]): Strength {
  let atk = 0
  let mid = 0
  let def = 0
  let keeper = 6
  for (const { player, pos, factor = 1 } of entries) {
    const fam = familiarity(player, pos)
    const f = factor * (0.55 + 0.45 * fam)
    const [wa, wm, wd] = ROLE_WEIGHTS[pos]
    atk += wa * attackScore(player.attrs) * f
    mid += wm * midfieldScore(player.attrs) * f
    def += wd * defenseScore(player.attrs) * f
    if (pos === 'GK') keeper = keeperScore(player.attrs) * f
  }
  return { attack: atk / ROLE_NORM[0], midfield: mid / ROLE_NORM[1], defense: def / ROLE_NORM[2], keeper }
}

/**
 * Convert a 1–20 zone strength to a number on the same feel as player ratings.
 * Zone scores average in secondary attributes, so they run ~10% below OVR.
 */
export const toDisplay = (v: number) => Math.round(clamp(v * 5.5, 1, 99))

// ---- Radar ----

export interface RadarAxis {
  label: string
  value: number
}

export function radar(p: Player): RadarAxis[] {
  const a = p.attrs
  const r = (n: number) => Math.round(n)
  if (p.position === 'GK') {
    return [
      { label: '핸들링', value: a.handling },
      { label: '반사신경', value: a.reflexes },
      { label: '일대일', value: a.oneOnOne },
      { label: '공중볼', value: r((a.jumping + a.strength) / 2) },
      { label: '배급', value: r((a.passing + a.vision) / 2) },
      { label: '위치선정', value: a.positioning },
    ]
  }
  return [
    { label: '속도', value: r((a.pace + a.acceleration) / 2) },
    { label: '슈팅', value: r((a.finishing * 2 + a.composure) / 3) },
    { label: '패스', value: r((a.passing * 2 + a.vision + a.firstTouch) / 4) },
    { label: '수비', value: r((a.tackling + a.marking + a.positioning) / 3) },
    { label: '피지컬', value: r((a.strength + a.stamina + a.jumping) / 3) },
    { label: '드리블', value: r((a.dribbling * 2 + a.firstTouch) / 3) },
  ]
}

// ---- Value / stars ----

export function potentialStars(potential: number): number {
  if (potential >= 86) return 5
  if (potential >= 78) return 4
  if (potential >= 70) return 3
  if (potential >= 62) return 2
  return 1
}

export function starString(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

/** Market value in 만원. */
export function marketValue(p: Player): number {
  const o = ovr(p)
  const base = 2500 * Math.pow(1.13, o - 50)
  const age = p.age <= 21 ? 1.6 : p.age <= 24 ? 1.35 : p.age <= 28 ? 1.1 : p.age <= 31 ? 0.8 : 0.5
  const pot = 1 + Math.max(0, p.potential - o) / 35
  const raw = base * age * pot
  const unit = raw >= 10000 ? 1000 : 100
  return Math.max(500, Math.round(raw / unit) * unit)
}

/** Weekly wage in 만원 for a given overall rating. */
export function wageFor(o: number, age: number): number {
  const base = 25 * Math.pow(1.105, o - 50)
  const ageMul = age <= 20 ? 0.6 : 1
  return Math.max(30, Math.round((base * ageMul) / 10) * 10)
}

export function avgRating(p: Player): number | null {
  if (p.stats.rated === 0) return null
  return p.stats.ratingSum / p.stats.rated
}
