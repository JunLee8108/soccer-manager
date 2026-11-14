import { objectiveFor } from './generator'
import { clamp, type Rng } from './rng'
import { standingsOf } from './standings'
import type { GameState, MessageTag } from './types'

export const SACK_THRESHOLD = 15

export function confidenceLabel(v: number): { label: string; tone: 'good' | 'ok' | 'warn' | 'bad' } {
  if (v >= 75) return { label: '매우 만족', tone: 'good' }
  if (v >= 55) return { label: '만족', tone: 'good' }
  if (v >= 40) return { label: '보통', tone: 'ok' }
  if (v >= 25) return { label: '불만', tone: 'warn' }
  return { label: '경질 위기', tone: 'bad' }
}

type Notify = (tag: MessageTag, title: string, body: string) => void

/** Adjust board confidence after the user's match. */
export function updateConfidence(game: GameState, result: 'W' | 'D' | 'L', opponentId: string, notify: Notify) {
  const me = game.clubs[game.userClubId]
  const opp = game.clubs[opponentId]
  const gap = (opp.reputation - me.reputation) / 10
  let delta = result === 'W' ? 2 + Math.max(0, gap) * 0.8 : result === 'D' ? 0.5 + gap * 0.5 : Math.min(-0.5, -2 + Math.max(0, gap) * 0.8)

  if (game.round >= 6) {
    const rank = standingsOf(game).findIndex((r) => r.clubId === me.id) + 1
    const target = game.objective.targetRank
    if (rank <= target) delta += 0.6
    else if (rank > target + 3) delta -= Math.min(2, (rank - target - 3) * 0.4)
  }
  if (me.budget < 0) delta -= 2

  const before = game.board.confidence
  const after = clamp(Math.round((before + delta) * 10) / 10, 0, 100)
  game.board.confidence = after
  if (before >= 45 && after < 45) notify('board', '이사회의 우려', '최근 결과에 이사회가 우려를 표하고 있습니다. 반등이 필요합니다.')
  if (before >= 30 && after < 30) notify('board', '이사회 최후통첩', '이사회의 인내심이 한계에 가까워졌습니다. 결과가 나아지지 않으면 경질될 수 있습니다.')
}

/** End-of-season verdict on the objective. */
export function seasonEndConfidence(game: GameState, objectiveMet: boolean) {
  game.board.confidence = clamp(game.board.confidence + (objectiveMet ? 15 : -12), 0, 100)
}

export function jobOffersFor(game: GameState, rng: Rng): string[] {
  const me = game.clubs[game.userClubId]
  const others = game.clubOrder.filter((id) => id !== me.id)
  const weaker = others.filter((id) => game.clubs[id].reputation <= me.reputation - 3)
  const pool = weaker.length >= 3 ? weaker : [...others].sort((a, b) => game.clubs[a].reputation - game.clubs[b].reputation).slice(0, 5)
  return rng.shuffle([...pool]).slice(0, 3)
}

/** Sack the manager if confidence collapsed. Returns true when sacked. */
export function checkSack(game: GameState, rng: Rng, force = false): boolean {
  if (game.board.status === 'sacked') return true
  if (!force && (game.board.confidence >= SACK_THRESHOLD || game.round < 6)) return false
  game.board = { ...game.board, status: 'sacked', jobOffers: jobOffersFor(game, rng) }
  return true
}

/** Take over another club (after being sacked). */
export function acceptJob(game: GameState, clubId: string) {
  const club = game.clubs[clubId]
  if (!club) return
  game.userClubId = clubId
  game.board = { confidence: 55, status: 'ok', jobOffers: [] }
  const byRep = [...game.clubOrder].sort((a, b) => game.clubs[b].reputation - game.clubs[a].reputation)
  game.objective = objectiveFor(byRep.indexOf(clubId) + 1)
  game.transferList = {}
  game.offers = []
  for (const id of club.playerIds) if (!game.scouted.includes(id)) game.scouted.push(id)
}
