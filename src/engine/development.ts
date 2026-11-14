import { ovr, POSITION_WEIGHTS } from './ratings'
import { clamp, type Rng } from './rng'
import type { AttrKey, Club, IndividualFocus, Player, TrainingFocus } from './types'
import { ATTR_KEYS } from './types'

/**
 * Player development.
 *
 * Each week a player earns "growth points" (attribute points, fractional).
 * How many depends on age, how far they are from their potential, training
 * intensity and facilities, minutes played, match form and professionalism.
 * The points are spread over attributes weighted by position, the team
 * training focus and the player's individual programme. From 30 physical
 * attributes start to decline, from 33 technical ones too.
 */

export const INDIVIDUAL_PROGRAMS: Record<IndividualFocus, { label: string; desc: string; attrs: AttrKey[] }> = {
  balanced: { label: '포지션 맞춤', desc: '포지션에 필요한 능력을 고르게', attrs: [] },
  shooting: { label: '슈팅', desc: '마무리 · 침착성 · 퍼스트터치', attrs: ['finishing', 'composure', 'firstTouch'] },
  playmaking: { label: '패스 · 시야', desc: '패스 · 시야 · 판단력', attrs: ['passing', 'vision', 'decisions', 'firstTouch'] },
  dribbling: { label: '드리블', desc: '드리블 · 퍼스트터치 · 가속력', attrs: ['dribbling', 'firstTouch', 'acceleration', 'composure'] },
  defending: { label: '수비', desc: '태클 · 마킹 · 위치선정 · 헤딩', attrs: ['tackling', 'marking', 'positioning', 'heading'] },
  physical: { label: '피지컬', desc: '속도 · 체력 · 근력 · 점프', attrs: ['pace', 'acceleration', 'stamina', 'strength', 'jumping'] },
  mental: { label: '멘탈', desc: '침착성 · 판단력 · 투지 · 팀워크', attrs: ['composure', 'decisions', 'workRate', 'teamwork', 'positioning'] },
  goalkeeping: { label: '골키핑', desc: '핸들링 · 반사신경 · 일대일', attrs: ['handling', 'reflexes', 'oneOnOne', 'positioning'] },
}

export function programsFor(p: Player): IndividualFocus[] {
  const all = Object.keys(INDIVIDUAL_PROGRAMS) as IndividualFocus[]
  return p.position === 'GK' ? all.filter((f) => f !== 'shooting' && f !== 'dribbling' && f !== 'defending') : all.filter((f) => f !== 'goalkeeping')
}

const TEAM_FOCUS_ATTRS: Record<TrainingFocus, AttrKey[]> = {
  attack: ['finishing', 'firstTouch', 'dribbling', 'composure', 'positioning'],
  defense: ['tackling', 'marking', 'positioning', 'heading', 'strength'],
  fitness: ['pace', 'acceleration', 'stamina', 'strength', 'jumping'],
  tactics: ['decisions', 'teamwork', 'positioning', 'vision', 'workRate'],
  setpiece: ['heading', 'passing', 'finishing', 'jumping', 'vision'],
  recovery: [],
}

const GK_ONLY: AttrKey[] = ['handling', 'reflexes', 'oneOnOne']
const OUTFIELD_ONLY: AttrKey[] = ['finishing', 'dribbling', 'tackling', 'marking', 'heading']
const PHYSICAL: AttrKey[] = ['pace', 'acceleration', 'stamina', 'strength', 'jumping']
const TECHNICAL: AttrKey[] = ['finishing', 'firstTouch', 'dribbling', 'passing', 'heading', 'tackling', 'marking']
const EXPERIENCE: AttrKey[] = ['composure', 'decisions', 'positioning']

const INTENSITY_GROWTH = { light: 0.75, normal: 1, hard: 1.25 } as const

/** Base weekly growth by age, in attribute points. */
export function ageGrowth(age: number): number {
  if (age <= 17) return 0.26
  const table: Record<number, number> = {
    18: 0.25, 19: 0.22, 20: 0.2, 21: 0.17, 22: 0.14, 23: 0.115, 24: 0.085, 25: 0.06, 26: 0.04, 27: 0.024, 28: 0.01,
  }
  return table[age] ?? 0
}

function physicalDecline(age: number): number {
  if (age < 30) return 0
  const table: Record<number, number> = { 30: 0.008, 31: 0.014, 32: 0.022, 33: 0.03, 34: 0.04 }
  return table[age] ?? 0.05
}

export const facilityMultiplier = (level: number) => 0.85 + 0.075 * (clamp(level, 1, 5) - 1)

export interface WeekContext {
  /** Minutes played this week (0 if no match). */
  minutes: number
  /** Match rating, if the player played. */
  rating: number | null
  /** Youth academy player (plays youth-team football). */
  youth: boolean
  /** Injured players barely develop. */
  injured?: boolean
}

export interface GrowthFactors {
  age: number
  room: number
  training: number
  minutes: number
  form: number
  personality: number
}

export function growthFactors(p: Player, club: Club, ctx: WeekContext): GrowthFactors {
  const t = club.training
  return {
    age: ageGrowth(p.age),
    room: clamp((p.potential - ovr(p)) / 8, 0, 1),
    training: INTENSITY_GROWTH[t.intensity] * facilityMultiplier(club.facilities.training) * (t.focus === 'recovery' ? 0.6 : 1),
    minutes: ctx.injured ? 0.3 : ctx.youth ? 0.85 : ctx.minutes >= 80 ? 1.25 : ctx.minutes > 0 ? 1 : 0.65,
    form: ctx.rating !== null ? clamp(1 + (ctx.rating - 6.5) * 0.15, 0.85, 1.25) : 1,
    personality: 0.75 + (0.5 * p.professionalism) / 20,
  }
}

/** Expected weekly growth points (before random noise). */
export function growthRate(p: Player, club: Club, ctx: WeekContext): number {
  const f = growthFactors(p, club, ctx)
  return f.age * f.room * f.training * f.minutes * f.form * f.personality
}

/** How growth points are shared between attributes. */
export function attributeWeights(p: Player, club: Club): Record<AttrKey, number> {
  const pos = POSITION_WEIGHTS[p.position]
  const maxW = Math.max(...Object.values(pos).map((x) => x ?? 0))
  const team = TEAM_FOCUS_ATTRS[club.training.focus]
  const own = INDIVIDUAL_PROGRAMS[p.trainingFocus ?? 'balanced'].attrs
  const w = {} as Record<AttrKey, number>
  for (const k of ATTR_KEYS) {
    let v = 0.15 + (pos[k] ?? 0) / maxW
    if (p.position === 'GK' && OUTFIELD_ONLY.includes(k)) v = 0.02
    if (p.position !== 'GK' && GK_ONLY.includes(k)) v = 0
    if (team.includes(k)) v *= 1.8
    if (own.includes(k)) v *= 2.5
    if (p.attrs[k] >= 20) v = 0
    w[k] = v
  }
  return w
}

export function declineRates(p: Player, club: Club): Partial<Record<AttrKey, number>> {
  // Keepers age more slowly.
  const age = p.position === 'GK' ? p.age - 3 : p.age
  const phys = physicalDecline(age) * (club.training.focus === 'fitness' ? 0.7 : 1)
  const tech = age >= 35 ? 0.015 : age >= 33 ? 0.008 : 0
  const out: Partial<Record<AttrKey, number>> = {}
  if (phys > 0) {
    for (const k of PHYSICAL) out[k] = k === 'strength' || k === 'jumping' ? phys * 0.5 : phys
  }
  if (tech > 0) {
    for (const k of TECHNICAL) out[k] = tech
    if (p.position === 'GK') for (const k of GK_ONLY) out[k] = tech
  }
  return out
}

/** Apply one week of development. Mutates the player's attributes. */
export function developPlayer(p: Player, club: Club, ctx: WeekContext, rng: Rng): void {
  const g = growthRate(p, club, ctx) * rng.range(0.8, 1.2)
  if (g > 0) {
    const w = attributeWeights(p, club)
    let total = 0
    for (const k of ATTR_KEYS) total += w[k]
    if (total > 0) {
      for (const k of ATTR_KEYS) {
        if (w[k] <= 0) continue
        p.attrs[k] = Math.min(20, p.attrs[k] + (g * w[k]) / total)
      }
    }
  }
  // Experience keeps sharpening the mind of regular players in their late 20s.
  if (ctx.minutes > 0 && p.age >= 27 && p.age <= 32) {
    for (const k of EXPERIENCE) p.attrs[k] = Math.min(20, p.attrs[k] + 0.004)
  }
  const decline = declineRates(p, club)
  for (const key in decline) {
    const k = key as AttrKey
    p.attrs[k] = Math.max(1, p.attrs[k] - (decline[k] ?? 0) * rng.range(0.7, 1.3))
  }
}

export type GrowthLevel = '높음' | '보통' | '낮음' | '유지' | '하락'

export interface GrowthProjection {
  /** Expected attribute points gained per week. */
  rate: number
  /** Expected attribute points lost per week. */
  decline: number
  level: GrowthLevel
  /** Attributes that benefit most. */
  top: AttrKey[]
  factors: GrowthFactors
}

/** Default context for a forecast, from the player's current role. */
export function expectedContext(p: Player, club: Club): WeekContext {
  if (club.youthIds?.includes(p.id)) return { minutes: 0, rating: null, youth: true }
  if (club.tactics.lineup.includes(p.id)) return { minutes: 90, rating: null, youth: false }
  if (club.tactics.bench.includes(p.id)) return { minutes: 20, rating: null, youth: false }
  return { minutes: 0, rating: null, youth: false }
}

export function projectGrowth(p: Player, club: Club, ctx: WeekContext = expectedContext(p, club)): GrowthProjection {
  const factors = growthFactors(p, club, ctx)
  const rate = factors.age * factors.room * factors.training * factors.minutes * factors.form * factors.personality
  const decline = Object.values(declineRates(p, club)).reduce((s, v) => s + (v ?? 0), 0)
  const w = attributeWeights(p, club)
  const top = (Object.keys(w) as AttrKey[]).sort((a, b) => w[b] - w[a]).slice(0, 2)
  let level: GrowthLevel
  if (decline > rate && decline > 0.02) level = '하락'
  else if (rate >= 0.18) level = '높음'
  else if (rate >= 0.08) level = '보통'
  else if (rate >= 0.03) level = '낮음'
  else level = '유지'
  return { rate, decline, level, top, factors }
}

export function professionalismLabel(v: number): string {
  if (v >= 16) return '프로페셔널'
  if (v >= 12) return '성실함'
  if (v >= 8) return '보통'
  return '느슨함'
}
