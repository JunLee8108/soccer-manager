import { FORMATIONS } from './data/formations'
import { book, firstTeamWages } from './finance'
import { clubLevel, createPlayer, NameFactory, SQUAD_TEMPLATE } from './generator'
import { formatMoney } from './korean'
import { autoLineup } from './lineup'
import { marketValue, ovr, ratingAt, wageFor } from './ratings'
import { clamp, type Rng } from './rng'
import { attachPlayer, clubOf, isFreeAgent, moveToFreeAgents } from './squad'
import type { Club, GameState, IncomingOffer, Player, Position } from './types'
import { FREE_AGENT } from './types'

export const SCOUT_FEE = 300
export const MAX_SCOUTS = 3
/** Rounds (0-based) during which the transfer window is open. */
export const WINDOWS: [number, number][] = [
  [0, 3],
  [14, 17],
]
const OFFER_LIFETIME = 2
const MAX_FREE_AGENTS = 70
const MAX_NEWS = 30

const roundMoney = (v: number) => (v >= 10000 ? Math.round(v / 1000) * 1000 : Math.round(v / 100) * 100)

// ---- Window ----

export interface WindowState {
  open: boolean
  /** Rounds left including the current one. */
  closesIn: number | null
  /** 0-based round when the next window opens (this season). */
  opensAt: number | null
}

export function windowState(game: GameState): WindowState {
  const r = game.round
  for (const [a, b] of WINDOWS) if (r >= a && r <= b) return { open: true, closesIn: b - r + 1, opensAt: null }
  const next = WINDOWS.find(([a]) => a > r)
  return { open: false, closesIn: null, opensAt: next ? next[0] : null }
}

export function windowLabel(game: GameState): string {
  const w = windowState(game)
  if (w.open) return w.closesIn === 1 ? '이적시장 열림 · 이번 라운드 마감' : `이적시장 열림 · ${w.closesIn}라운드 후 마감`
  return w.opensAt !== null ? `이적시장 닫힘 · ${w.opensAt + 1}라운드 전에 열림` : '이적시장 닫힘 · 다음 시즌 개막 때 열림'
}

// ---- Knowledge / scouting ----

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function isKnown(game: GameState, p: Player): boolean {
  return p.clubId === game.userClubId || game.scouted.includes(p.id)
}

export interface Estimate {
  low: number
  high: number
  exact: boolean
}

/** What the user's staff believe a player's overall rating is. */
export function estimateOvr(game: GameState, p: Player): Estimate {
  const o = ovr(p)
  if (isKnown(game, p)) return { low: o, high: o, exact: true }
  const offset = (hash(`${p.id}:${game.season}`) % 7) - 3
  const c = o + offset
  return { low: clamp(c - 4, 1, 99), high: clamp(c + 4, 1, 99), exact: false }
}

export function isScouting(game: GameState, id: string) {
  return game.scoutQueue.some((t) => t.playerId === id)
}

export function startScouting(game: GameState, playerId: string): { ok: boolean; reason?: string } {
  const p = game.players[playerId]
  if (!p) return { ok: false, reason: '선수를 찾을 수 없습니다' }
  if (isKnown(game, p)) return { ok: false, reason: '이미 파악한 선수입니다' }
  if (isScouting(game, playerId)) return { ok: false, reason: '이미 스카우트가 보고 있습니다' }
  if (game.scoutQueue.length >= MAX_SCOUTS) return { ok: false, reason: `스카우트는 동시에 ${MAX_SCOUTS}명까지 볼 수 있습니다` }
  const club = game.clubs[game.userClubId]
  book(club, 'scouting', -SCOUT_FEE)
  game.scoutQueue = [...game.scoutQueue, { playerId, readyRound: game.round + 1 }]
  return { ok: true }
}

/** Finish scouting tasks that are due. Returns finished player ids. */
export function processScouting(game: GameState, all = false): string[] {
  const done = game.scoutQueue.filter((t) => all || t.readyRound <= game.round).map((t) => t.playerId)
  game.scoutQueue = game.scoutQueue.filter((t) => !done.includes(t.playerId))
  for (const id of done) if (game.players[id] && !game.scouted.includes(id)) game.scouted = [...game.scouted, id]
  return done.filter((id) => game.players[id])
}

// ---- Prices and demands ----

function squadRank(game: GameState, club: Club, p: Player) {
  return club.playerIds
    .map((id) => game.players[id])
    .sort((a, b) => ovr(b) - ovr(a))
    .findIndex((x) => x.id === p.id)
}

export function isUntouchable(game: GameState, p: Player, buyerId: string): boolean {
  const seller = clubOf(game, p)
  if (!seller) return false
  const buyer = game.clubs[buyerId]
  return squadRank(game, seller, p) < 2 && seller.reputation >= buyer.reputation + 4
}

/** What the selling club wants for a player. */
export function askingPrice(game: GameState, p: Player): number {
  const seller = clubOf(game, p)
  if (!seller) return 0
  const rank = squadRank(game, seller, p)
  const importance = rank < 3 ? 1.45 : rank < 11 ? 1.25 : rank < 16 ? 1.05 : 0.85
  const left = p.contract.until - game.season
  const contract = left <= 0 ? 0.65 : left === 1 ? 0.9 : 1
  const finance = seller.budget < 0 ? 0.85 : 1
  return roundMoney(marketValue(p) * importance * contract * finance)
}

/** Asking price as quoted to a specific buyer (key players cost double for bigger clubs' rivals). */
export function askingPriceFor(game: GameState, p: Player, buyerId = game.userClubId): number {
  const ask = askingPrice(game, p)
  return isUntouchable(game, p, buyerId) ? roundMoney(ask * 2) : ask
}

export function wageDemand(game: GameState, p: Player, buyerId: string): number {
  const buyer = game.clubs[buyerId]
  const seller = clubOf(game, p)
  const fromRep = seller?.reputation ?? 60
  let w = wageFor(ovr(p), p.age) * (1 + Math.max(0, fromRep - buyer.reputation) / 40)
  if (p.age <= 20) w *= 0.85
  if (seller && seller.id !== buyerId) w = Math.max(w, p.contract.wage * 1.1)
  if (seller && seller.id === buyerId) w = Math.max(w, p.contract.wage * 1.05)
  if (!seller) w *= 0.95
  return Math.max(30, Math.round(w / 10) * 10)
}

export type BidResult = { result: 'accept'; text: string } | { result: 'counter'; fee: number; text: string } | { result: 'reject'; text: string }

export function evaluateBid(game: GameState, playerId: string, fee: number, buyerId = game.userClubId): BidResult {
  const p = game.players[playerId]
  if (isFreeAgent(p)) return { result: 'accept', text: '자유계약 선수입니다.' }
  const seller = clubOf(game, p)!
  const ask = askingPriceFor(game, p, buyerId)
  const untouchable = isUntouchable(game, p, buyerId)
  if (fee >= ask) return { result: 'accept', text: `${seller.name}이(가) 제안을 수락했습니다.` }
  if (fee >= ask * 0.6) {
    return {
      result: 'counter',
      fee: ask,
      text: untouchable
        ? `${seller.name}은(는) 핵심 선수라며 ${formatMoney(ask)} 이상을 요구합니다.`
        : `${seller.name}이(가) ${formatMoney(ask)}를 요구합니다.`,
    }
  }
  return { result: 'reject', text: `제안이 너무 낮아 ${seller.name}이(가) 협상을 거절했습니다.` }
}

export type ContractResult = { result: 'accept'; text: string } | { result: 'counter'; wage: number; text: string } | { result: 'reject'; wage: number; text: string }

export function evaluateContract(game: GameState, playerId: string, wage: number, buyerId = game.userClubId): ContractResult {
  const p = game.players[playerId]
  const demand = wageDemand(game, p, buyerId)
  if (wage >= demand) return { result: 'accept', text: `${p.name}이(가) 계약 조건에 동의했습니다.` }
  if (wage >= demand * 0.9) return { result: 'counter', wage: demand, text: `${p.name}은(는) 주급 ${formatMoney(demand)}을 원합니다.` }
  return { result: 'reject', wage: demand, text: `${p.name}이(가) 조건이 맞지 않는다며 거절했습니다. (기대 주급 약 ${formatMoney(demand)})` }
}

/** Board limits for a purchase by the user. `replacesWage` is the current wage when renewing. */
export function budgetCheck(game: GameState, fee: number, wage: number, replacesWage = 0): { ok: boolean; reason?: string } {
  const club = game.clubs[game.userClubId]
  if (fee > club.finance.transferBudget) return { ok: false, reason: `이적 예산(${formatMoney(club.finance.transferBudget)})을 넘습니다.` }
  if (fee > club.budget) return { ok: false, reason: '구단 잔고가 부족합니다.' }
  const wages = firstTeamWages(game, club) - replacesWage + wage
  if (wages > club.finance.wageBudget) return { ok: false, reason: `주급 예산(${formatMoney(club.finance.wageBudget)}/주)을 넘습니다.` }
  return { ok: true }
}

function pushNews(game: GameState, text: string) {
  game.news = [{ season: game.season, round: game.round, text }, ...game.news].slice(0, MAX_NEWS)
}

/** Move a player to a new club, paying the fee and setting the new contract. */
export function executeTransfer(game: GameState, playerId: string, toClubId: string, fee: number, contract: { wage: number; years: number }, rng: Rng) {
  const p = game.players[playerId]
  const seller = clubOf(game, p)
  const buyer = game.clubs[toClubId]
  if (seller) {
    book(seller, 'sales', fee)
    // The board lets the manager reinvest half of the sale.
    seller.finance.transferBudget += Math.round(fee / 2)
  }
  book(buyer, 'purchases', -fee)
  buyer.finance.transferBudget = Math.max(0, buyer.finance.transferBudget - fee)
  attachPlayer(game, playerId, toClubId, rng)
  p.contract = { wage: contract.wage, until: game.season + Math.max(1, contract.years) - 1 }
  p.morale = Math.min(100, p.morale + 6)
  if (seller?.id === game.userClubId && !game.scouted.includes(playerId)) game.scouted = [...game.scouted, playerId]
  const from = seller ? seller.name : '자유계약'
  pushNews(game, fee > 0 ? `${buyer.name}, ${from}의 ${p.name} 영입 (${formatMoney(fee)})` : `${buyer.name}, ${p.name} 영입 (${from})`)
}

export function compensationFor(game: GameState, p: Player): number {
  const weeks = Math.max(0, (p.contract.until - game.season) * 30 + Math.max(0, 30 - game.round))
  return roundMoney(p.contract.wage * weeks * 0.5)
}

/** Terminate a user player's contract (paying compensation); he becomes a free agent. */
export function releasePlayer(game: GameState, playerId: string): number {
  const p = game.players[playerId]
  if (!p || p.clubId !== game.userClubId) return 0
  const comp = compensationFor(game, p)
  book(game.clubs[game.userClubId], 'compensation', -comp)
  moveToFreeAgents(game, playerId)
  pushNews(game, `${p.name}, 계약 해지 후 자유계약 신분이 됨`)
  return comp
}

export function renewContract(game: GameState, playerId: string, wage: number, years: number) {
  const p = game.players[playerId]
  if (!p) return
  p.contract = { wage, until: game.season + Math.max(1, years) }
  p.morale = Math.min(100, p.morale + 4)
}

export function listPlayer(game: GameState, playerId: string, price: number) {
  game.transferList = { ...game.transferList, [playerId]: Math.max(0, roundMoney(price)) }
}

export function unlistPlayer(game: GameState, playerId: string) {
  const next = { ...game.transferList }
  delete next[playerId]
  game.transferList = next
}

export function acceptOffer(game: GameState, offerId: string, rng: Rng): IncomingOffer | null {
  const offer = game.offers.find((o) => o.id === offerId)
  if (!offer || !windowState(game).open) return null
  const p = game.players[offer.playerId]
  if (!p || p.clubId !== game.userClubId) return null
  executeTransfer(game, p.id, offer.fromClubId, offer.fee, { wage: wageDemand(game, p, offer.fromClubId), years: p.age <= 26 ? 3 : 2 }, rng)
  return offer
}

export function rejectOffer(game: GameState, offerId: string) {
  game.offers = game.offers.filter((o) => o.id !== offerId)
}

// ---- AI market ----

function wantsCount(): Partial<Record<Position, number>> {
  const want: Partial<Record<Position, number>> = {}
  for (const [pos] of SQUAD_TEMPLATE) want[pos] = (want[pos] ?? 0) + 1
  return want
}

/** Bids from AI clubs for the user's players while the window is open. */
export function generateOffers(game: GameState, rng: Rng, notify: (title: string, body: string) => void) {
  if (!windowState(game).open) return
  const user = game.clubs[game.userClubId]
  const buyers = game.clubOrder.filter((id) => id !== user.id).map((id) => game.clubs[id])
  const tryOffer = (p: Player, fee: number, minRep: number) => {
    const candidates = buyers.filter(
      (c) => c.budget >= fee && c.playerIds.length < 28 && c.reputation >= minRep && !game.offers.some((o) => o.playerId === p.id && o.fromClubId === c.id),
    )
    if (candidates.length === 0) return
    const club = rng.pick(candidates)
    const offer: IncomingOffer = { id: `o${game.nextId++}`, playerId: p.id, fromClubId: club.id, fee: roundMoney(fee), expiresRound: game.round + OFFER_LIFETIME }
    game.offers = [...game.offers, offer]
    notify(`${p.name} 영입 제안`, `${club.name}이(가) ${p.name}에게 ${formatMoney(offer.fee)}를 제안했습니다. 클럽 > 이적에서 결정해 주세요.`)
  }
  for (const [id, price] of Object.entries(game.transferList)) {
    const p = game.players[id]
    if (!p || p.clubId !== user.id) continue
    if (rng.chance(0.4)) tryOffer(p, Math.max(price, 500) * rng.range(0.8, 1.05), 0)
  }
  const stars = user.playerIds
    .map((id) => game.players[id])
    .filter((p) => !(p.id in game.transferList))
    .sort((a, b) => ovr(b) - ovr(a))
    .slice(0, 5)
  for (const p of stars) if (rng.chance(0.05)) tryOffer(p, marketValue(p) * rng.range(1.1, 1.4), user.reputation - 5)
}

export function expireOffers(game: GameState) {
  const open = windowState(game).open
  game.offers = game.offers.filter((o) => open && o.expiresRound >= game.round && game.players[o.playerId]?.clubId === game.userClubId)
}

function weakestSlot(game: GameState, club: Club): { pos: Position; rating: number } | null {
  const { lineup } = autoLineup(club, game.players)
  const slots = FORMATIONS[club.tactics.formation].slots
  let worst: { pos: Position; rating: number } | null = null
  lineup.forEach((id, i) => {
    if (!id) return
    const pos = slots[i].pos
    const r = ratingAt(game.players[id], pos)
    if (!worst || r < worst.rating) worst = { pos, rating: r }
  })
  return worst
}

/** A handful of AI-to-AI deals per window round, plus free-agent signings for short squads. */
export function aiTransfers(game: GameState, rng: Rng) {
  if (!windowState(game).open) return
  const ai = rng.shuffle(game.clubOrder.filter((id) => id !== game.userClubId)).map((id) => game.clubs[id])
  let deals = 0
  for (const buyer of ai) {
    if (deals >= 2) break
    if (buyer.budget < 60000 || !rng.chance(0.35)) continue
    const weak = weakestSlot(game, buyer)
    if (!weak) continue
    const maxFee = buyer.budget * 0.45
    let best: { p: Player; score: number; fee: number } | null = null
    for (const p of Object.values(game.players)) {
      if (p.clubId === buyer.id || p.clubId === game.userClubId) continue
      const seller = clubOf(game, p)
      if (seller && (seller.youthIds.includes(p.id) || seller.playerIds.length <= 20 || seller.reputation > buyer.reputation + 3)) continue
      const r = ratingAt(p, weak.pos)
      if (r < weak.rating + 3) continue
      const fee = seller ? askingPrice(game, p) : 0
      if (fee > maxFee) continue
      if (seller && isUntouchable(game, p, buyer.id)) continue
      const score = r - fee / 20000
      if (!best || score > best.score) best = { p, score, fee }
    }
    if (!best) continue
    executeTransfer(game, best.p.id, buyer.id, best.fee, { wage: wageDemand(game, best.p, buyer.id), years: best.p.age <= 26 ? 3 : 2 }, rng)
    deals++
  }
  for (const club of ai) {
    if (club.playerIds.length >= 21) continue
    signBestFreeAgent(game, club, rng)
  }
}

function neededPosition(game: GameState, club: Club): Position {
  const want = wantsCount()
  const have: Partial<Record<Position, number>> = {}
  for (const id of club.playerIds) {
    const pos = game.players[id].position
    have[pos] = (have[pos] ?? 0) + 1
  }
  let best: Position = 'CM'
  let gap = -Infinity
  for (const pos of Object.keys(want) as Position[]) {
    const g = (want[pos] ?? 0) - (have[pos] ?? 0)
    if (g > gap) {
      gap = g
      best = pos
    }
  }
  return best
}

/** Sign the best free agent for the club's thinnest position. Returns the player or null. */
export function signBestFreeAgent(game: GameState, club: Club, rng: Rng, exclude: Set<string> = new Set()): Player | null {
  const pos = neededPosition(game, club)
  const pool = game.freeAgents.map((id) => game.players[id]).filter((p) => p && p.age <= 33 && !exclude.has(p.id))
  const pick = pool.filter((p) => p.position === pos).sort((a, b) => ovr(b) - ovr(a))[0] ?? pool.sort((a, b) => ratingAt(b, pos) - ratingAt(a, pos))[0]
  if (!pick || ratingAt(pick, pos) < clubLevel(club.reputation) - 18) return null
  executeTransfer(game, pick.id, club.id, 0, { wage: wageDemand(game, pick, club.id), years: pick.age <= 27 ? 2 : 1 }, rng)
  return pick
}

/** Keep the free-agent pool bounded and stocked with a few fresh names. */
export function maintainFreeAgents(game: GameState, rng: Rng) {
  let pool = game.freeAgents.filter((id) => game.players[id])
  // Old free agents retire.
  for (const id of pool) {
    const p = game.players[id]
    if (p.age >= 34 || (p.age >= 31 && rng.chance(0.4))) {
      delete game.players[id]
      pool = pool.filter((x) => x !== id)
    }
  }
  if (pool.length > MAX_FREE_AGENTS) {
    const keep = pool.map((id) => game.players[id]).sort((a, b) => ovr(b) - ovr(a)).slice(0, MAX_FREE_AGENTS)
    for (const id of pool) if (!keep.some((p) => p.id === id)) delete game.players[id]
    pool = keep.map((p) => p.id)
  }
  // A few unattached players looking for a club each season.
  const names = new NameFactory(rng, Object.values(game.players).map((p) => p.name))
  const fresh = Math.max(0, 12 - pool.length)
  for (let i = 0; i < fresh; i++) {
    const pos = rng.pick(SQUAD_TEMPLATE)[0]
    const p = createPlayer(rng, {
      id: `p${game.nextId++}`,
      clubId: FREE_AGENT,
      pos,
      target: Math.round(rng.range(52, 68)),
      age: rng.int(21, 31),
      season: game.season,
      shirt: 0,
      names,
      contractYears: 0,
    })
    game.players[p.id] = p
    pool.push(p.id)
  }
  game.freeAgents = pool
}
