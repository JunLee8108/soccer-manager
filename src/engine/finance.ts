import { clamp } from './rng'
import type { Club, FinanceCategory, GameState } from './types'

/**
 * Club economy (all amounts in 만원).
 * Per round every club pays wages and facility upkeep and earns sponsorship
 * and broadcast money; home clubs also earn matchday income. Prize money is
 * paid by final position at the end of the season.
 */
export const TICKET_NET = 0.5
export const SPONSOR_PER_REP = 15
export const BROADCAST_PER_ROUND = 1200
export const UPKEEP_PER_LEVEL = 150
export const FACILITY_COST: Record<number, number> = { 2: 80000, 3: 150000, 4: 250000, 5: 400000 }
/** Cash the board insists on keeping after a facility investment. */
export const FACILITY_RESERVE = 50000

export const FINANCE_LABEL: Record<FinanceCategory, string> = {
  matchday: '관중 수입',
  sponsor: '스폰서',
  broadcast: '중계권',
  prize: '상금',
  sales: '선수 판매',
  wages: '주급',
  upkeep: '시설 유지비',
  purchases: '선수 영입',
  facilities: '시설 투자',
  compensation: '계약 해지 위약금',
  scouting: '스카우팅',
}

export const emptyFinance = (budget: number, wages: number): Club['finance'] => ({
  transferBudget: Math.max(0, Math.round((budget * 0.5) / 1000) * 1000),
  wageBudget: Math.round(Math.max(wages * 1.15, wages + 500)),
  season: {},
  history: [budget],
})

export function weeklyWages(game: GameState, club: Club): number {
  let total = 0
  for (const id of club.playerIds) total += game.players[id]?.contract.wage ?? 0
  for (const id of club.youthIds) total += game.players[id]?.contract.wage ?? 0
  return total
}

export function firstTeamWages(game: GameState, club: Club): number {
  return club.playerIds.reduce((s, id) => s + (game.players[id]?.contract.wage ?? 0), 0)
}

export function upkeepFor(club: Club): number {
  return (club.facilities.training + club.facilities.youth) * UPKEEP_PER_LEVEL
}

/** Expected attendance for a home match. `rank` is the current league position (null before kick-off). */
export function attendanceFor(club: Club, rank: number | null, clubCount: number): number {
  const form = rank === null ? 0.04 : ((clubCount - rank) / clubCount) * 0.08
  const fill = clamp(0.5 + club.reputation / 250 + form, 0.35, 1)
  return Math.round((club.capacity * fill) / 10) * 10
}

/** Record a money movement on a club. Positive = income. */
export function book(club: Club, category: FinanceCategory, amount: number) {
  if (amount === 0) return
  club.budget = Math.round(club.budget + amount)
  club.finance.season[category] = Math.round((club.finance.season[category] ?? 0) + amount)
}

/** Weekly income and expenses for every club. `attendance` holds home clubs' crowds this round. */
export function processRoundFinances(game: GameState, attendance: Record<string, number>) {
  for (const id of game.clubOrder) {
    const club = game.clubs[id]
    book(club, 'wages', -weeklyWages(game, club))
    book(club, 'upkeep', -upkeepFor(club))
    book(club, 'sponsor', club.reputation * SPONSOR_PER_REP)
    book(club, 'broadcast', BROADCAST_PER_ROUND)
    if (attendance[id]) book(club, 'matchday', Math.round(attendance[id] * TICKET_NET))
    club.finance.history = [...club.finance.history, club.budget].slice(-40)
  }
}

export function prizeMoney(rank: number, clubCount: number): number {
  return 10000 + (clubCount - rank) * 8000
}

/** Board budgets for a new season. */
export function setSeasonBudgets(game: GameState, club: Club) {
  const wages = weeklyWages(game, club)
  club.finance = emptyFinance(club.budget, wages)
}

export function seasonIncome(club: Club): number {
  return Object.values(club.finance.season).reduce((s, v) => s + Math.max(0, v ?? 0), 0)
}

export function seasonExpense(club: Club): number {
  return Object.values(club.finance.season).reduce((s, v) => s + Math.min(0, v ?? 0), 0)
}

export type FacilityKind = 'training' | 'youth'

export function upgradeQuote(club: Club, kind: FacilityKind): { cost: number | null; ok: boolean; reason?: string } {
  const level = club.facilities[kind]
  const cost = FACILITY_COST[level + 1] ?? null
  if (cost === null) return { cost: null, ok: false, reason: '최고 레벨입니다' }
  if (club.budget - cost < FACILITY_RESERVE) return { cost, ok: false, reason: '잔고가 부족합니다 (투자 후 ₩5억 이상 남아야 함)' }
  return { cost, ok: true }
}

export function upgradeFacility(game: GameState, clubId: string, kind: FacilityKind): boolean {
  const club = game.clubs[clubId]
  const q = upgradeQuote(club, kind)
  if (!q.ok || q.cost === null) return false
  book(club, 'facilities', -q.cost)
  club.facilities = { ...club.facilities, [kind]: club.facilities[kind] + 1 }
  return true
}
