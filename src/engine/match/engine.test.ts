import { describe, expect, it } from 'vitest'
import { createNewGame } from '../generator'
import { ovr } from '../ratings'
import type { Fixture, GameState } from '../types'
import { createMatch, simulateToEnd, substitute } from './engine'

function sim(game: GameState, homeId: string, awayId: string, seed: number) {
  const fixture: Fixture = { id: `t${seed}`, round: 0, homeId, awayId, result: null }
  return simulateToEnd(createMatch(fixture, game, seed), game)
}

function avgStarterOvr(game: GameState, clubId: string) {
  const ids = game.clubs[clubId].tactics.lineup.filter((x): x is string => !!x)
  return ids.reduce((s, id) => s + ovr(game.players[id]), 0) / ids.length
}

describe('match engine', () => {
  const game = createNewGame({ seed: 42, userClubId: 'hanbit' })

  it('is deterministic for the same seed', () => {
    const a = sim(game, 'hanbit', 'cheongram', 7)
    const b = sim(game, 'hanbit', 'cheongram', 7)
    expect(a.home.goals).toBe(b.home.goals)
    expect(a.away.goals).toBe(b.away.goals)
    expect(a.events.length).toBe(b.events.length)
  })

  it('produces realistic aggregate numbers', () => {
    const ids = game.clubOrder
    let goals = 0
    let homeWins = 0
    let draws = 0
    let awayWins = 0
    let shots = 0
    let yellows = 0
    let corners = 0
    const N = 600
    for (let i = 0; i < N; i++) {
      const h = ids[i % ids.length]
      const a = ids[(i * 7 + 3) % ids.length]
      if (h === a) continue
      const m = sim(game, h, a, 1000 + i)
      goals += m.home.goals + m.away.goals
      shots += m.home.stats.shots + m.away.stats.shots
      yellows += m.home.stats.yellows + m.away.stats.yellows
      corners += m.home.stats.corners + m.away.stats.corners
      if (m.home.goals > m.away.goals) homeWins++
      else if (m.home.goals < m.away.goals) awayWins++
      else draws++
      expect(m.minute).toBe(90)
      expect(m.home.onPitch.length).toBeGreaterThanOrEqual(7)
    }
    const played = homeWins + draws + awayWins
    const stats = {
      goals: goals / played,
      shotsPerTeam: shots / played / 2,
      yellows: yellows / played,
      corners: corners / played,
      home: homeWins / played,
      draw: draws / played,
      away: awayWins / played,
    }
    console.log('aggregate', stats)
    expect(stats.goals).toBeGreaterThan(2.1)
    expect(stats.goals).toBeLessThan(3.3)
    expect(stats.shotsPerTeam).toBeGreaterThan(8)
    expect(stats.shotsPerTeam).toBeLessThan(17)
    expect(stats.home).toBeGreaterThan(stats.away)
    expect(stats.draw).toBeGreaterThan(0.15)
    expect(stats.draw).toBeLessThan(0.35)
  })

  it('favours the stronger team', () => {
    const strong = 'baekdu'
    const weak = 'byeolbit'
    expect(avgStarterOvr(game, strong)).toBeGreaterThan(avgStarterOvr(game, weak))
    let strongWins = 0
    let weakWins = 0
    for (let i = 0; i < 200; i++) {
      const home = i % 2 === 0
      const m = sim(game, home ? strong : weak, home ? weak : strong, 5000 + i)
      const sg = home ? m.home.goals : m.away.goals
      const wg = home ? m.away.goals : m.home.goals
      if (sg > wg) strongWins++
      else if (wg > sg) weakWins++
    }
    console.log('strong vs weak', { strongWins, weakWins })
    expect(strongWins).toBeGreaterThan(weakWins * 2)
  })

  it('allows user substitutions up to the limit', () => {
    const fixture: Fixture = { id: 'sub', round: 0, homeId: 'hanbit', awayId: 'cheongram', result: null }
    const m = createMatch(fixture, game, 99, 'hanbit')
    const outId = m.home.onPitch[5].id
    const inId = m.home.bench[1]
    expect(substitute(m, game, 'home', outId, inId)).toBe(true)
    expect(m.home.onPitch.some((p) => p.id === inId)).toBe(true)
    expect(m.home.bench.includes(inId)).toBe(false)
    expect(m.home.subsLeft).toBe(4)
    // Cannot bring the substituted player back on.
    expect(substitute(m, game, 'home', inId, outId)).toBe(false)
  })
})
