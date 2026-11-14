import { describe, expect, it } from 'vitest'
import { acceptJob, checkSack } from './board'
import { upgradeFacility, upgradeQuote } from './finance'
import { createNewGame } from './generator'
import { ovr } from './ratings'
import { Rng } from './rng'
import { completeRound, isSeasonOver, startNewSeason } from './season'
import {
  acceptOffer,
  askingPrice,
  budgetCheck,
  estimateOvr,
  evaluateBid,
  evaluateContract,
  executeTransfer,
  isKnown,
  listPlayer,
  releasePlayer,
  startScouting,
  wageDemand,
  windowState,
} from './transfers'
import type { GameState } from './types'
import { FREE_AGENT } from './types'

const fresh = () => createNewGame({ seed: 2026, userClubId: 'hanbit' })

function integrity(g: GameState) {
  const seen = new Map<string, string>()
  for (const id of g.clubOrder) {
    for (const pid of [...g.clubs[id].playerIds, ...g.clubs[id].youthIds]) {
      expect(seen.has(pid)).toBe(false)
      seen.set(pid, id)
      expect(g.players[pid].clubId).toBe(id)
    }
  }
  for (const pid of g.freeAgents) {
    expect(seen.has(pid)).toBe(false)
    expect(g.players[pid].clubId).toBe(FREE_AGENT)
  }
}

describe('transfer window', () => {
  it('opens at the start and in mid-season', () => {
    const g = fresh()
    expect(windowState(g).open).toBe(true)
    expect(windowState({ ...g, round: 4 }).open).toBe(false)
    expect(windowState({ ...g, round: 14 }).open).toBe(true)
    expect(windowState({ ...g, round: 20 }).opensAt).toBeNull()
  })
})

describe('bids and contracts', () => {
  it('accepts, counters or rejects bids by price', () => {
    const g = fresh()
    const seller = g.clubs.byeolbit
    const target = g.players[seller.playerIds[10]]
    const ask = askingPrice(g, target)
    expect(evaluateBid(g, target.id, ask).result).toBe('accept')
    const counter = evaluateBid(g, target.id, Math.round(ask * 0.7))
    expect(counter.result).toBe('counter')
    if (counter.result === 'counter') expect(counter.fee).toBe(ask)
    expect(evaluateBid(g, target.id, Math.round(ask * 0.3)).result).toBe('reject')
  })

  it('asks double for a stronger club’s best players', () => {
    const g = createNewGame({ seed: 3, userClubId: 'byeolbit' })
    const star = g.clubs.baekdu.playerIds.map((id) => g.players[id]).sort((a, b) => ovr(b) - ovr(a))[0]
    const ask = askingPrice(g, star)
    expect(evaluateBid(g, star.id, ask).result).not.toBe('accept')
    expect(evaluateBid(g, star.id, ask * 2).result).toBe('accept')
  })

  it('negotiates wages', () => {
    const g = fresh()
    const p = g.players[g.clubs.cheongram.playerIds[5]]
    const demand = wageDemand(g, p, 'hanbit')
    expect(evaluateContract(g, p.id, demand).result).toBe('accept')
    expect(evaluateContract(g, p.id, Math.round(demand * 0.93)).result).toBe('counter')
    expect(evaluateContract(g, p.id, Math.round(demand * 0.5)).result).toBe('reject')
  })

  it('moves the player and the money', () => {
    const g = fresh()
    const rng = new Rng(1)
    const seller = g.clubs.cheongram
    const p = g.players[seller.playerIds[8]]
    const fee = askingPrice(g, p)
    const userBefore = g.clubs.hanbit.budget
    const sellerBefore = seller.budget
    const tb = g.clubs.hanbit.finance.transferBudget
    expect(budgetCheck(g, fee, wageDemand(g, p, 'hanbit')).ok).toBe(true)
    executeTransfer(g, p.id, 'hanbit', fee, { wage: wageDemand(g, p, 'hanbit'), years: 3 }, rng)
    expect(p.clubId).toBe('hanbit')
    expect(g.clubs.hanbit.playerIds).toContain(p.id)
    expect(seller.playerIds).not.toContain(p.id)
    expect(g.clubs.hanbit.budget).toBe(userBefore - fee)
    expect(seller.budget).toBe(sellerBefore + fee)
    expect(g.clubs.hanbit.finance.transferBudget).toBe(Math.max(0, tb - fee))
    expect(p.contract.until).toBe(g.season + 2)
    expect(isKnown(g, p)).toBe(true)
    integrity(g)
  })

  it('blocks purchases over the board budget', () => {
    const g = fresh()
    expect(budgetCheck(g, g.clubs.hanbit.finance.transferBudget + 1000, 100).ok).toBe(false)
    expect(budgetCheck(g, 0, g.clubs.hanbit.finance.wageBudget).ok).toBe(false)
  })

  it('releases players into the free-agent pool with compensation', () => {
    const g = fresh()
    const p = g.players[g.clubs.hanbit.playerIds[20]]
    const before = g.clubs.hanbit.budget
    const comp = releasePlayer(g, p.id)
    expect(comp).toBeGreaterThan(0)
    expect(g.clubs.hanbit.budget).toBe(before - comp)
    expect(g.freeAgents).toContain(p.id)
    expect(p.clubId).toBe(FREE_AGENT)
    integrity(g)
  })
})

describe('scouting', () => {
  it('hides exact ratings until a scout reports back', () => {
    let g = fresh()
    const p = g.players[g.clubs.baekdu.playerIds[4]]
    expect(estimateOvr(g, p).exact).toBe(false)
    const est = estimateOvr(g, p)
    expect(est.low).toBeLessThanOrEqual(ovr(p))
    expect(est.high).toBeGreaterThanOrEqual(ovr(p))
    const before = g.clubs.hanbit.budget
    expect(startScouting(g, p.id).ok).toBe(true)
    expect(g.clubs.hanbit.budget).toBeLessThan(before)
    expect(startScouting(g, p.id).ok).toBe(false)
    g = completeRound(g, null)
    expect(isKnown(g, g.players[p.id])).toBe(true)
    expect(g.inbox.some((m) => m.title.includes('스카우트 보고서'))).toBe(true)
  })
})

describe('offers for listed players', () => {
  it('brings bids during the window and completes accepted sales', () => {
    let g = fresh()
    const squad = g.clubs.hanbit.playerIds.map((id) => g.players[id]).sort((a, b) => ovr(a) - ovr(b))
    for (const p of squad.slice(0, 4)) listPlayer(g, p.id, 3000)
    for (let r = 0; r < 3 && g.offers.length === 0; r++) g = completeRound(g, null)
    expect(g.offers.length).toBeGreaterThan(0)
    const offer = g.offers[0]
    const before = g.clubs.hanbit.budget
    expect(acceptOffer(g, offer.id, new Rng(2))).not.toBeNull()
    expect(g.players[offer.playerId].clubId).toBe(offer.fromClubId)
    expect(g.clubs.hanbit.budget).toBe(before + offer.fee)
    integrity(g)
  })
})

describe('board', () => {
  it('sacks a manager with no confidence left and allows a new job', () => {
    const g = fresh()
    g.round = 10
    g.board.confidence = 5
    expect(checkSack(g, new Rng(1))).toBe(true)
    expect(g.board.status).toBe('sacked')
    expect(g.board.jobOffers.length).toBe(3)
    const next = g.board.jobOffers[0]
    expect(g.clubs[next].reputation).toBeLessThan(g.clubs.hanbit.reputation)
    acceptJob(g, next)
    expect(g.userClubId).toBe(next)
    expect(g.board.status).toBe('ok')
  })

  it('charges for facility upgrades', () => {
    const g = fresh()
    const club = g.clubs.hanbit
    const level = club.facilities.training
    const q = upgradeQuote(club, 'training')
    if (q.ok && q.cost) {
      const before = club.budget
      expect(upgradeFacility(g, 'hanbit', 'training')).toBe(true)
      expect(club.facilities.training).toBe(level + 1)
      expect(club.budget).toBe(before - q.cost)
    } else {
      expect(upgradeFacility(g, 'hanbit', 'training')).toBe(false)
    }
  })
})

describe('economy over seasons', () => {
  it('keeps clubs solvent, squads valid and players unique', () => {
    let g = fresh()
    const start = Object.fromEntries(g.clubOrder.map((id) => [id, g.clubs[id].budget]))
    for (let s = 0; s < 3; s++) {
      while (!isSeasonOver(g)) g = completeRound(g, null)
      for (const id of g.clubOrder) {
        const club = g.clubs[id]
        const ledger = Object.values(club.finance.season).reduce((a, b) => a + (b ?? 0), 0)
        expect(Math.abs(club.budget - club.finance.history[0] - ledger)).toBeLessThan(2)
        expect(club.finance.season.prize ?? 0).toBeGreaterThan(0)
      }
      g = startNewSeason(g)
      integrity(g)
      for (const id of g.clubOrder) {
        const n = g.clubs[id].playerIds.length
        expect(n).toBeGreaterThanOrEqual(18)
        expect(n).toBeLessThanOrEqual(32)
      }
    }
    const summary = g.clubOrder.map((id) => ({ id, start: Math.round(start[id] / 10000), now: Math.round(g.clubs[id].budget / 10000) }))
    console.log('balances (억)', summary.map((s) => `${s.id}:${s.start}→${s.now}`).join(' '))
    console.log('news', g.news.slice(0, 5).map((n) => n.text))
    for (const id of g.clubOrder) {
      expect(g.clubs[id].budget).toBeGreaterThan(-300000)
      expect(g.clubs[id].budget).toBeLessThan(4000000)
    }
  }, 60_000)
})
