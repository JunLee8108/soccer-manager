import { describe, expect, it } from 'vitest'
import { BLOCKED_NAMES } from './data/names'
import { createNewGame } from './generator'
import { josa, formatMoney } from './korean'
import { isAvailable } from './lineup'
import { simulateToEnd, stepMinute } from './match/engine'
import { ovr } from './ratings'
import { Rng } from './rng'
import { doubleRoundRobin } from './schedule'
import { completeRound, isSeasonOver, startNewSeason, startUserMatch, totalRounds, userFixture } from './season'
import { computeStandings, standingsOf } from './standings'
import type { GameState } from './types'

describe('schedule', () => {
  const ids = Array.from({ length: 16 }, (_, i) => `c${i}`)
  const fixtures = doubleRoundRobin(ids, new Rng(1), 1)

  it('has 30 rounds of 8 matches', () => {
    expect(fixtures.length).toBe(240)
    for (let r = 0; r < 30; r++) {
      const round = fixtures.filter((f) => f.round === r)
      expect(round.length).toBe(8)
      const teams = round.flatMap((f) => [f.homeId, f.awayId])
      expect(new Set(teams).size).toBe(16)
    }
  })

  it('pairs every club twice, once at each ground', () => {
    for (const a of ids) {
      expect(fixtures.filter((f) => f.homeId === a).length).toBe(15)
      for (const b of ids) {
        if (a === b) continue
        expect(fixtures.filter((f) => f.homeId === a && f.awayId === b).length).toBe(1)
      }
    }
  })
})

describe('generator', () => {
  const game = createNewGame({ seed: 123, userClubId: 'hanbit' })

  it('builds 16 clubs with 24 players each and valid line-ups', () => {
    expect(game.clubOrder.length).toBe(16)
    for (const id of game.clubOrder) {
      const club = game.clubs[id]
      expect(club.playerIds.length).toBe(24)
      expect(club.tactics.lineup.filter(Boolean).length).toBe(11)
      expect(club.tactics.bench.length).toBe(7)
      const shirts = club.playerIds.map((p) => game.players[p].shirt)
      expect(new Set(shirts).size).toBe(24)
    }
  })

  it('gives stronger clubs better players', () => {
    const avg = (id: string) => {
      const ps = game.clubs[id].playerIds.map((p) => game.players[p])
      return ps.reduce((s, p) => s + ovr(p), 0) / ps.length
    }
    expect(avg('baekdu')).toBeGreaterThan(avg('byeolbit') + 4)
  })

  it('keeps attributes and ratings in range and names unique', () => {
    const names = new Set<string>()
    for (const p of Object.values(game.players)) {
      for (const v of Object.values(p.attrs)) {
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(20)
      }
      expect(ovr(p)).toBeGreaterThan(30)
      expect(ovr(p)).toBeLessThan(95)
      expect(p.potential).toBeGreaterThanOrEqual(ovr(p))
      expect(BLOCKED_NAMES.has(p.name)).toBe(false)
      expect(names.has(p.name)).toBe(false)
      names.add(p.name)
    }
  })

  it('is reproducible from the seed', () => {
    const again = createNewGame({ seed: 123, userClubId: 'hanbit' })
    expect(Object.values(again.players).map((p) => p.name)).toEqual(Object.values(game.players).map((p) => p.name))
  })
})

function playSeason(start: GameState): GameState {
  let game = start
  while (!isSeasonOver(game)) {
    const m = startUserMatch(game)
    expect(m).not.toBeNull()
    for (let i = 0; i < 30; i++) stepMinute(m!, game)
    simulateToEnd(m!, game)
    game = completeRound(game, m)
  }
  return game
}

describe('season', () => {
  it('plays a full season and starts the next one', () => {
    let game = createNewGame({ seed: 2024, userClubId: 'hanbit' })
    expect(userFixture(game)).toBeDefined()
    game = playSeason(game)

    expect(game.round).toBe(totalRounds(game))
    expect(game.fixtures.every((f) => f.result)).toBe(true)
    const table = standingsOf(game)
    expect(table.every((r) => r.played === 30)).toBe(true)
    const totalPoints = table.reduce((s, r) => s + r.points, 0)
    const draws = game.fixtures.filter((f) => f.result!.homeGoals === f.result!.awayGoals).length
    expect(totalPoints).toBe(240 * 3 - draws)
    expect(game.lastReport).not.toBeNull()
    expect(game.inbox.some((m) => m.title === '시즌 종료 평가')).toBe(true)

    // Goals in fixtures match player season stats.
    const fixtureGoals = game.fixtures.reduce((s, f) => s + f.result!.homeGoals + f.result!.awayGoals, 0)
    const playerGoals = Object.values(game.players).reduce((s, p) => s + p.stats.goals, 0)
    expect(playerGoals).toBe(fixtureGoals)

    const next = startNewSeason(game)
    expect(next.season).toBe(2)
    expect(next.round).toBe(0)
    expect(next.history.length).toBe(1)
    expect(next.fixtures.every((f) => !f.result)).toBe(true)
    expect(Object.values(next.players).every((p) => p.stats.apps === 0)).toBe(true)
    const someone = Object.keys(game.players)[0]
    expect(next.players[someone].age).toBe(game.players[someone].age + 1)
  })

  it('never fields unavailable players', () => {
    let game = createNewGame({ seed: 77, userClubId: 'garam' })
    for (let r = 0; r < 12; r++) {
      for (const id of game.clubOrder) {
        const club = game.clubs[id]
        for (const pid of club.tactics.lineup) {
          if (pid) expect(isAvailable(game.players[pid])).toBe(true)
        }
      }
      const m = startUserMatch(game)!
      game = completeRound(game, simulateToEnd(m, game))
    }
  })

  it('does not mutate the previous state', () => {
    const game = createNewGame({ seed: 5, userClubId: 'hanbit' })
    const snapshot = JSON.stringify(game)
    const m = startUserMatch(game)!
    completeRound(game, simulateToEnd(m, game))
    expect(JSON.stringify(game)).toBe(snapshot)
  })
})

describe('standings', () => {
  it('orders by points, then goal difference', () => {
    const rows = computeStandings(['a', 'b', 'c'], [
      { id: '1', round: 0, homeId: 'a', awayId: 'b', result: { homeGoals: 2, awayGoals: 0, scorers: [], motmId: null } },
      { id: '2', round: 1, homeId: 'c', awayId: 'a', result: { homeGoals: 1, awayGoals: 0, scorers: [], motmId: null } },
      { id: '3', round: 2, homeId: 'b', awayId: 'c', result: { homeGoals: 3, awayGoals: 0, scorers: [], motmId: null } },
    ])
    expect(rows.map((r) => r.clubId)).toEqual(['b', 'a', 'c'])
    expect(rows[0].points).toBe(3)
    expect(rows[0].gd).toBe(1)
  })
})

describe('korean helpers', () => {
  it('picks the right particle', () => {
    expect(josa('이도윤', '이/가')).toBe('이도윤이')
    expect(josa('서준혁', '은/는')).toBe('서준혁은')
    expect(josa('베렌', '을/를')).toBe('베렌을')
    expect(josa('하람', '이/가')).toBe('하람이')
    expect(josa('토마스', '이/가')).toBe('토마스가')
  })

  it('formats money', () => {
    expect(formatMoney(280000)).toBe('₩28억')
    expect(formatMoney(18000)).toBe('₩1.8억')
    expect(formatMoney(850)).toBe('₩850만')
  })
})
