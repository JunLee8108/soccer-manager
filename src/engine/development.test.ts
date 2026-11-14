import { describe, expect, it } from 'vitest'
import { developPlayer, growthRate, projectGrowth, type WeekContext } from './development'
import { createNewGame, createPlayer, NameFactory } from './generator'
import { migrateGame } from './migrate'
import { expiringPlayers, promoteYouth } from './offseason'
import { ovr } from './ratings'
import { Rng } from './rng'
import { completeRound, isSeasonOver, startNewSeason } from './season'
import type { Club, GameState, Player, Position } from './types'

const game = createNewGame({ seed: 9, userClubId: 'hanbit' })
const baseClub: Club = game.clubs.hanbit

function makePlayer(seed: number, o: { pos?: Position; target: number; age: number; potential?: number; pro?: number }): Player {
  const rng = new Rng(seed)
  const p = createPlayer(rng, {
    id: 'x',
    clubId: 'hanbit',
    pos: o.pos ?? 'ST',
    target: o.target,
    age: o.age,
    season: 1,
    shirt: 99,
    names: new NameFactory(rng),
    potential: o.potential,
    foreignChance: 0,
  })
  if (o.pro !== undefined) p.professionalism = o.pro
  return p
}

function club(overrides: Partial<Club> = {}): Club {
  return { ...structuredClone(baseClub), youthIds: [], ...overrides }
}

/** One season: 30 match weeks plus five pre-season weeks. */
function season(p: Player, c: Club, ctx: WeekContext, seed = 1) {
  const rng = new Rng(seed)
  for (let w = 0; w < 30; w++) developPlayer(p, c, ctx, rng)
  for (let w = 0; w < 5; w++) developPlayer(p, c, { minutes: 45, rating: null, youth: ctx.youth }, rng)
}

const STARTER: WeekContext = { minutes: 90, rating: 7, youth: false }
const UNUSED: WeekContext = { minutes: 0, rating: null, youth: false }

describe('development', () => {
  it('grows a young high-potential starter by several points a season', () => {
    const p = makePlayer(1, { target: 60, age: 18, potential: 86, pro: 12 })
    const before = ovr(p)
    season(p, club(), STARTER)
    const gain = ovr(p) - before
    expect(gain).toBeGreaterThanOrEqual(3)
    expect(gain).toBeLessThanOrEqual(9)
  })

  it('rewards playing time, training load, facilities and professionalism', () => {
    const p = makePlayer(2, { target: 58, age: 19, potential: 85, pro: 10 })
    const c = club()
    expect(growthRate(p, c, STARTER)).toBeGreaterThan(growthRate(p, c, UNUSED))
    const hard = club({ training: { focus: 'tactics', intensity: 'hard' }, facilities: { training: 5, youth: 3 } })
    const light = club({ training: { focus: 'tactics', intensity: 'light' }, facilities: { training: 1, youth: 3 } })
    expect(growthRate(p, hard, STARTER)).toBeGreaterThan(growthRate(p, light, STARTER) * 1.5)
    const pro = { ...p, professionalism: 19 }
    const lazy = { ...p, professionalism: 3 }
    expect(growthRate(pro, c, STARTER)).toBeGreaterThan(growthRate(lazy, c, STARTER))
  })

  it('steers growth with the individual programme', () => {
    const a = makePlayer(3, { target: 58, age: 18, potential: 88 })
    const b = structuredClone(a)
    b.trainingFocus = 'shooting'
    season(a, club(), STARTER, 5)
    season(b, club(), STARTER, 5)
    expect(b.attrs.finishing - b.seasonStart.finishing).toBeGreaterThan(a.attrs.finishing - a.seasonStart.finishing)
  })

  it('stops near potential and keeps attributes within 1–20', () => {
    const p = makePlayer(4, { target: 70, age: 17, potential: 76 })
    for (let s = 0; s < 8; s++) season(p, club(), STARTER, s + 10)
    expect(ovr(p)).toBeLessThanOrEqual(p.potential + 1)
    for (const v of Object.values(p.attrs)) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(20)
    }
  })

  it('makes veterans decline, physical attributes first', () => {
    const p = makePlayer(5, { pos: 'RW', target: 74, age: 33 })
    const pace = p.attrs.pace
    const before = ovr(p)
    season(p, club(), STARTER)
    expect(p.attrs.pace).toBeLessThan(pace - 0.5)
    expect(ovr(p)).toBeLessThan(before)
    expect(projectGrowth(p, club(), STARTER).level).toBe('하락')
  })
})

describe('offseason', () => {
  it('migrates a v1 save', () => {
    const old = structuredClone(game) as GameState
    old.version = 1
    for (const p of Object.values(old.players)) {
      delete (p as Partial<Player>).professionalism
      delete (p as Partial<Player>).seasonStart
    }
    for (const c of Object.values(old.clubs)) {
      delete (c as Partial<Club>).youthIds
      delete (c as Partial<Club>).facilities
    }
    const m = migrateGame(old)
    expect(m.version).toBe(3)
    expect(m.board.confidence).toBeGreaterThan(0)
    expect(Array.isArray(m.freeAgents)).toBe(true)
    for (const c of Object.values(m.clubs)) {
      expect(c.youthIds.length).toBeGreaterThan(0)
      expect(c.facilities.training).toBeGreaterThanOrEqual(1)
    }
    expect(Object.values(m.players).every((p) => p.professionalism >= 1 && p.seasonStart)).toBe(true)
  })

  it('promotes youth players into the first team', () => {
    const g = structuredClone(game)
    const id = g.clubs.hanbit.youthIds[0]
    expect(promoteYouth(g, id, new Rng(1))).toBe(true)
    expect(g.clubs.hanbit.playerIds).toContain(id)
    expect(g.clubs.hanbit.youthIds).not.toContain(id)
    expect(g.players[id].shirt).toBeGreaterThan(0)
  })

  it('applies contract decisions and keeps the league stable over five seasons', () => {
    let g = createNewGame({ seed: 314, userClubId: 'hanbit' })
    const leagueAvg = (s: GameState) => {
      const ps = s.clubOrder.flatMap((id) => s.clubs[id].playerIds.map((pid) => s.players[pid]))
      return ps.reduce((sum, p) => sum + ovr(p), 0) / ps.length
    }
    const start = leagueAvg(g)
    let retiredSeen = false

    for (let season = 1; season <= 5; season++) {
      while (!isSeasonOver(g)) g = completeRound(g, null)
      const expiring = expiringPlayers(g, 'hanbit')
      const decisions: Record<string, 'renew' | 'release'> = {}
      expiring.forEach((p, i) => (decisions[p.id] = i % 2 === 0 ? 'renew' : 'release'))
      const before = new Set(Object.keys(g.players))
      const oldest = Object.values(g.players).filter((p) => p.age >= 34).length
      g = startNewSeason(g, decisions)

      for (const [id, d] of Object.entries(decisions)) {
        if (d === 'release') expect(g.players[id]?.clubId ?? 'gone').not.toBe('hanbit')
        else if (g.players[id]) expect(g.players[id].contract.until).toBeGreaterThanOrEqual(g.season)
      }
      if (oldest > 0 && [...before].some((id) => !g.players[id])) retiredSeen = true

      for (const id of g.clubOrder) {
        const c = g.clubs[id]
        expect(c.playerIds.length).toBeGreaterThanOrEqual(20)
        expect(c.playerIds.length).toBeLessThanOrEqual(30)
        expect(c.youthIds.length).toBeGreaterThan(0)
        expect(c.tactics.lineup.filter(Boolean).length).toBe(11)
        for (const pid of [...c.playerIds, ...c.youthIds]) {
          expect(g.players[pid]).toBeDefined()
          expect(g.players[pid].clubId).toBe(id)
        }
        for (const pid of [...c.tactics.lineup, ...c.tactics.bench]) if (pid) expect(c.playerIds).toContain(pid)
      }
      expect(Object.values(g.players).every((p) => p.age <= 38)).toBe(true)
    }
    const end = leagueAvg(g)
    console.log('league average ovr', { start: start.toFixed(1), end: end.toFixed(1), players: Object.keys(g.players).length })
    expect(Math.abs(end - start)).toBeLessThan(4)
    expect(retiredSeen).toBe(true)
  }, 60_000)
})
