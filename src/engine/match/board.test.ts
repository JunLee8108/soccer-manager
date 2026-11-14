import { describe, expect, it } from 'vitest'
import { FORMATIONS } from '../data/formations'
import { createNewGame } from '../generator'
import type { Fixture } from '../types'
import { changeFormation, createMatch, passPct, ratingTrend, simulateToEnd, stepMinute, substitute, suggestSubs, swapPositions } from './engine'
import type { LiveMatch } from './types'

const game = createNewGame({ seed: 77, userClubId: 'hanbit' })
const fixture: Fixture = { id: 'b1', round: 0, homeId: 'hanbit', awayId: 'cheongram', result: null }

function play(m: LiveMatch, minutes: number) {
  for (let i = 0; i < minutes && !m.finished; i++) stepMinute(m, game)
}

describe('per-player match stats', () => {
  it('add up to the team totals', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const m = simulateToEnd(createMatch(fixture, game, seed), game)
      for (const t of [m.home, m.away]) {
        const all = [...t.onPitch, ...t.off]
        expect(all.reduce((s, p) => s + p.shots, 0)).toBe(t.stats.shots)
        expect(all.reduce((s, p) => s + p.onTarget, 0)).toBe(t.stats.onTarget)
        expect(all.reduce((s, p) => s + p.fouls, 0)).toBe(t.stats.fouls)
        const passes = all.reduce((s, p) => s + p.passes, 0)
        expect(Math.abs(passes - t.stats.passes)).toBeLessThan(0.01)
        for (const p of all) {
          expect(p.onTarget).toBeLessThanOrEqual(p.shots)
          const pct = passPct(p)
          if (pct !== null) expect(pct).toBeGreaterThanOrEqual(45)
        }
        expect(all.reduce((s, p) => s + p.tackles, 0)).toBeGreaterThan(5)
      }
    }
  })

  it('logs ratings every five minutes for the trend', () => {
    const m = createMatch(fixture, game, 3)
    play(m, 30)
    const mp = m.home.onPitch[0]
    expect(mp.ratingLog.length).toBe(7)
    expect(typeof ratingTrend(mp)).toBe('number')
  })
})

describe('board actions', () => {
  it('swaps positions and slots of two players', () => {
    const m = createMatch(fixture, game, 5, 'hanbit')
    const [a, b] = [m.home.onPitch[8], m.home.onPitch[10]]
    const before = { aPos: a.pos, aSlot: a.slot, bPos: b.pos, bSlot: b.slot }
    expect(swapPositions(m, 'home', a.id, b.id)).toBe(true)
    expect(a.pos).toBe(before.bPos)
    expect(a.slot).toBe(before.bSlot)
    expect(b.pos).toBe(before.aPos)
    expect(b.slot).toBe(before.aSlot)
  })

  it('keeps slots consistent after a substitution', () => {
    const m = createMatch(fixture, game, 6, 'hanbit')
    const out = m.home.onPitch[9]
    const inId = m.home.bench[2]
    substitute(m, game, 'home', out.id, inId)
    const incoming = m.home.onPitch.find((p) => p.id === inId)!
    expect(incoming.slot).toBe(out.slot)
    expect(incoming.pos).toBe(out.pos)
  })

  it('changes formation keeping the keeper in goal and one player per slot', () => {
    const m = createMatch(fixture, game, 7, 'hanbit')
    play(m, 20)
    const gk = m.home.onPitch.find((p) => p.pos === 'GK')!.id
    for (const f of ['4-4-2', '3-5-2', '5-3-2', '4-2-3-1'] as const) {
      expect(changeFormation(m, game, 'home', f)).toBe(true)
      const slots = m.home.onPitch.map((p) => p.slot)
      expect(new Set(slots).size).toBe(m.home.onPitch.length)
      for (const p of m.home.onPitch) expect(p.pos).toBe(FORMATIONS[f].slots[p.slot].pos)
      expect(m.home.onPitch.find((p) => p.id === gk)!.pos).toBe('GK')
      expect(m.home.formation).toBe(f)
    }
    simulateToEnd(m, game)
    expect(m.finished).toBe(true)
  })

  it('suggests replacing a tired, struggling player', () => {
    const m = createMatch(fixture, game, 8, 'hanbit')
    play(m, 70)
    const target = m.home.onPitch.find((p) => p.pos !== 'GK')!
    target.energy = 35
    target.rating = 5.6
    const tips = suggestSubs(m, game, 'home')
    expect(tips.length).toBeGreaterThan(0)
    expect(tips[0].outId).toBe(target.id)
    expect(tips[0].reasons.some((r) => r.includes('체력'))).toBe(true)
    expect(m.home.bench).toContain(tips[0].inId)
    expect(new Set(tips.map((t) => t.inId)).size).toBe(tips.length)
  })

  it('lets the manager handle injuries on the user side', () => {
    let checked = 0
    for (let seed = 1; seed <= 400 && checked < 3; seed++) {
      const m = createMatch(fixture, game, seed, 'hanbit')
      while (!m.finished && !m.pendingInjury) stepMinute(m, game)
      if (!m.pendingInjury) continue
      const victim = m.home.onPitch.find((p) => p.id === m.pendingInjury!.playerId)!
      expect(victim.injured).toBe(true)
      expect(victim.energy).toBeLessThanOrEqual(25)
      const tips = suggestSubs(m, game, 'home')
      if (m.home.subsLeft > 0 && m.home.bench.length > 0) {
        expect(tips[0]?.outId).toBe(victim.id)
        substitute(m, game, 'home', victim.id, tips[0].inId)
        expect(m.pendingInjury).toBeNull()
      }
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('optimal slot assignment', () => {
  it('matches brute force on small matrices', async () => {
    const { assignMinCost } = await import('../assign')
    const { Rng } = await import('../rng')
    const rng = new Rng(4)
    const permute = (cols: number[], k: number): number[][] =>
      k === 0 ? [[]] : cols.flatMap((c) => permute(cols.filter((x) => x !== c), k - 1).map((rest) => [c, ...rest]))
    for (let trial = 0; trial < 40; trial++) {
      const n = rng.int(2, 5)
      const m = n + rng.int(0, 2)
      const cost = Array.from({ length: n }, () => Array.from({ length: m }, () => rng.int(0, 50)))
      const res = assignMinCost(cost)
      const total = res.reduce((s, j, i) => s + cost[i][j], 0)
      expect(new Set(res).size).toBe(n)
      const best = Math.min(...permute([...Array(m).keys()], n).map((perm) => perm.reduce((s, j, i) => s + cost[i][j], 0)))
      expect(total).toBe(best)
    }
  })

  it('keeps natural roles when switching formations back and forth', () => {
    const m = createMatch(fixture, game, 9, 'hanbit')
    const original = new Map(m.home.onPitch.map((p) => [p.id, p.pos]))
    changeFormation(m, game, 'home', '4-2-3-1')
    // Nobody should end up badly out of position when a fitting slot exists.
    for (const mp of m.home.onPitch) {
      const natural = game.players[mp.id].position
      if (mp.pos !== natural) expect(['DM', 'CM', 'AM', 'LW', 'RW', 'ST', 'LB', 'RB', 'CB']).toContain(mp.pos)
    }
    changeFormation(m, game, 'home', '4-3-3')
    const same = m.home.onPitch.filter((p) => original.get(p.id) === p.pos).length
    expect(same).toBeGreaterThanOrEqual(10)
  })

  it('leaves a low-priority slot empty when a player is missing', () => {
    const m = createMatch(fixture, game, 10, 'hanbit')
    m.home.onPitch = m.home.onPitch.filter((p) => p.pos !== 'CB' || p !== m.home.onPitch.find((x) => x.pos === 'CB'))
    expect(m.home.onPitch.length).toBe(10)
    changeFormation(m, game, 'home', '4-4-2')
    const filled = new Set(m.home.onPitch.map((p) => FORMATIONS['4-4-2'].slots[p.slot].pos))
    expect(filled.has('GK')).toBe(true)
    expect(filled.has('CB')).toBe(true)
  })
})
