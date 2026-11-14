import { FORMATIONS } from '../data/formations'
import { keeperScore, ratingAt, teamStrength, type Strength } from '../ratings'
import { clamp, Rng } from '../rng'
import type { Club, Fixture, Instructions, Player, Position } from '../types'
import { LINE_OF } from '../types'
import {
  flavorText,
  goalText,
  injuryText,
  missText,
  redText,
  savedText,
  secondYellowText,
  subText,
  yellowText,
  type ChanceKind,
} from './commentary'
import type { LiveMatch, MatchEvent, MatchPlayer, MatchReport, PlayerLine, Side, TeamState, TeamStats } from './types'

export interface MatchContext {
  players: Record<string, Player>
  clubs: Record<string, Club>
}

export const MAX_SUBS = 5
const AI_SUB_LIMIT = 3
const HALF = 45
const FULL = 90

const PRESS_DRAIN = { low: 0.8, mid: 1, high: 1.3 } as const

const BASE_XG: Record<ChanceKind, number> = {
  through: 0.24,
  cutback: 0.21,
  header: 0.08,
  box: 0.095,
  long: 0.03,
  counter: 0.19,
  freekick: 0.06,
  penalty: 0.76,
  corner: 0.07,
}

const SHOOT_WEIGHTS: Record<Position, number> = { GK: 0, CB: 0.3, LB: 0.5, RB: 0.5, DM: 0.8, CM: 1.6, AM: 3, LW: 3, RW: 3, ST: 4 }
const HEADER_WEIGHTS: Record<Position, number> = { GK: 0, CB: 1.6, LB: 0.6, RB: 0.6, DM: 1, CM: 1.2, AM: 1, LW: 1.4, RW: 1.4, ST: 5 }
const LONG_WEIGHTS: Record<Position, number> = { GK: 0, CB: 0.3, LB: 0.6, RB: 0.6, DM: 1.6, CM: 3, AM: 3, LW: 2, RW: 2, ST: 1.5 }
const CORNER_WEIGHTS: Record<Position, number> = { GK: 0, CB: 3.5, LB: 0.5, RB: 0.5, DM: 1, CM: 1, AM: 0.5, LW: 0.5, RW: 0.5, ST: 3 }
const ASSIST_WEIGHTS: Record<Position, number> = { GK: 0.05, CB: 0.3, LB: 1.4, RB: 1.4, DM: 1, CM: 2.5, AM: 3, LW: 3, RW: 3, ST: 1.4 }
const CROSS_WEIGHTS: Record<Position, number> = { GK: 0, CB: 0.2, LB: 2.5, RB: 2.5, DM: 0.6, CM: 1.5, AM: 1.5, LW: 3.5, RW: 3.5, ST: 0.6 }
const FOUL_WEIGHTS: Record<Position, number> = { GK: 0.1, CB: 1.6, LB: 1.3, RB: 1.3, DM: 1.8, CM: 1.3, AM: 0.8, LW: 0.7, RW: 0.7, ST: 0.8 }

const INJURY_TYPES = ['햄스트링 부상', '발목 염좌', '종아리 근육 경련', '무릎 타박상', '허벅지 근육 부상', '어깨 탈구', '사타구니 부상']

const emptyStats = (): TeamStats => ({
  possessionMinutes: 0,
  shots: 0,
  onTarget: 0,
  xg: 0,
  passes: 0,
  passesCompleted: 0,
  corners: 0,
  fouls: 0,
  yellows: 0,
  reds: 0,
})

const fatigueFactor = (energy: number) => 0.72 + 0.28 * (energy / 100)
const moraleFactor = (morale: number) => 0.97 + 0.06 * (morale / 100)

function newMatchPlayer(p: Player, pos: Position, minute: number, started: boolean): MatchPlayer {
  const quality = (ratingAt(p, pos) - 65) / 50
  return {
    id: p.id,
    pos,
    energy: p.condition,
    rating: 6.3 + quality,
    goals: 0,
    assists: 0,
    yellow: false,
    sentOff: false,
    injured: false,
    started,
    minuteOn: minute,
    minuteOff: null,
    saves: 0,
  }
}

function buildTeam(club: Club, ctx: MatchContext, aiControlled: boolean): TeamState {
  const slots = FORMATIONS[club.tactics.formation].slots
  const onPitch: MatchPlayer[] = []
  club.tactics.lineup.forEach((id, i) => {
    const p = id ? ctx.players[id] : undefined
    if (p) onPitch.push(newMatchPlayer(p, slots[i].pos, 0, true))
  })
  const starters = new Set(onPitch.map((mp) => mp.id))
  return {
    clubId: club.id,
    formation: club.tactics.formation,
    style: club.tactics.style,
    press: club.tactics.press,
    line: club.tactics.line,
    onPitch,
    off: [],
    bench: club.tactics.bench.filter((id) => ctx.players[id] && !starters.has(id)),
    subsLeft: MAX_SUBS,
    goals: 0,
    stats: emptyStats(),
    aiControlled,
  }
}

export function createMatch(fixture: Fixture, ctx: MatchContext, seed: number, userClubId?: string): LiveMatch {
  const home = ctx.clubs[fixture.homeId]
  const away = ctx.clubs[fixture.awayId]
  return {
    fixtureId: fixture.id,
    minute: 0,
    finished: false,
    home: buildTeam(home, ctx, home.id !== userClubId),
    away: buildTeam(away, ctx, away.id !== userClubId),
    events: [{ minute: 0, type: 'period', text: `경기 시작! ${home.name}의 킥오프로 경기가 시작됩니다.` }],
    momentum: Array.from({ length: 18 }, () => [0, 0] as [number, number]),
    possession: 'home',
    ballX: 50,
    rng: seed >>> 0,
    cornerFor: null,
    injuries: [],
  }
}

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')
const sideIdx = (s: Side) => (s === 'home' ? 0 : 1)

function strengthOf(team: TeamState, ctx: MatchContext, isHome: boolean): Strength {
  const s = teamStrength(
    team.onPitch.map((mp) => {
      const p = ctx.players[mp.id]
      return { player: p, pos: mp.pos, factor: fatigueFactor(mp.energy) * moraleFactor(p.morale) }
    }),
  )
  if (isHome) {
    s.attack *= 1.04
    s.midfield *= 1.04
  }
  if (team.style === 'possession') s.midfield *= 1.05
  if (team.style === 'counter') {
    s.midfield *= 0.95
    s.attack *= 1.03
  }
  if (team.line === 'high') s.midfield *= 1.03
  if (team.line === 'deep') {
    s.attack *= 0.95
    s.defense *= 1.06
  }
  if (team.press === 'high') s.midfield *= 1.03
  if (team.press === 'low') {
    s.midfield *= 0.97
    s.defense *= 1.03
  }
  return s
}

interface StepEnv {
  m: LiveMatch
  ctx: MatchContext
  rng: Rng
  hadEvent: boolean
}

function team(m: LiveMatch, s: Side): TeamState {
  return s === 'home' ? m.home : m.away
}

function clubName(env: StepEnv, s: Side): string {
  return env.ctx.clubs[team(env.m, s).clubId].name
}

function nameOf(env: StepEnv, id: string): string {
  return env.ctx.players[id]?.name ?? '선수'
}

function push(env: StepEnv, e: Omit<MatchEvent, 'minute'>) {
  env.m.events.push({ minute: env.m.minute, ...e })
  if (e.type !== 'period') env.hadEvent = true
}

function addMomentum(m: LiveMatch, s: Side, v: number) {
  const bin = clamp(Math.floor((Math.max(1, m.minute) - 1) / 5), 0, 17)
  m.momentum[bin][sideIdx(s)] += v
}

function pickPlayer(env: StepEnv, t: TeamState, weights: Record<Position, number>, attr: (p: Player) => number, exclude?: string) {
  const list = t.onPitch.filter((mp) => mp.id !== exclude)
  if (list.length === 0) return null
  const w = list.map((mp) => weights[mp.pos] * Math.pow(Math.max(1, attr(env.ctx.players[mp.id])) / 10, 1.5))
  return list[env.rng.weighted(w)]
}

function bestBy(env: StepEnv, t: TeamState, score: (p: Player) => number): MatchPlayer | null {
  let best: MatchPlayer | null = null
  let bestScore = -Infinity
  for (const mp of t.onPitch) {
    if (mp.pos === 'GK') continue
    const s = score(env.ctx.players[mp.id])
    if (s > bestScore) {
      bestScore = s
      best = mp
    }
  }
  return best
}

function chooseKind(env: StepEnv, att: TeamState, def: TeamState): ChanceKind {
  const kinds: ChanceKind[] = ['through', 'cutback', 'header', 'box', 'long', 'counter']
  const w = [
    0.14 * (def.line === 'high' ? 1.6 : def.line === 'deep' ? 0.6 : 1) * (att.style === 'counter' ? 1.3 : 1),
    0.12,
    0.17,
    0.27 * (att.style === 'possession' ? 1.15 : 1),
    0.2 * (def.line === 'deep' ? 1.4 : 1),
    att.style === 'counter' ? 0.12 : 0.04,
  ]
  return kinds[env.rng.weighted(w)]
}

function resolveChance(env: StepEnv, side: Side, kind: ChanceKind, attS: Strength, defS: Strength) {
  const { m, ctx, rng } = env
  const att = team(m, side)
  const def = team(m, other(side))
  const P = (mp: MatchPlayer) => ctx.players[mp.id]

  let shooter: MatchPlayer | null
  if (kind === 'penalty') shooter = bestBy(env, att, (p) => p.attrs.finishing + p.attrs.composure)
  else if (kind === 'freekick') shooter = bestBy(env, att, (p) => p.attrs.passing + p.attrs.finishing + p.attrs.vision * 0.5)
  else if (kind === 'header') shooter = pickPlayer(env, att, HEADER_WEIGHTS, (p) => p.attrs.heading)
  else if (kind === 'corner') shooter = pickPlayer(env, att, CORNER_WEIGHTS, (p) => (p.attrs.heading + p.attrs.jumping) / 2)
  else if (kind === 'long') shooter = pickPlayer(env, att, LONG_WEIGHTS, (p) => p.attrs.finishing)
  else shooter = pickPlayer(env, att, SHOOT_WEIGHTS, (p) => p.attrs.finishing)
  if (!shooter) return

  let assister: MatchPlayer | null = null
  if (kind === 'corner') assister = bestBy(env, att, (p) => p.attrs.passing + p.attrs.vision)
  else if (kind === 'header') assister = pickPlayer(env, att, CROSS_WEIGHTS, (p) => p.attrs.passing, shooter.id)
  else if (kind !== 'penalty' && kind !== 'freekick' && kind !== 'long' && rng.chance(0.82)) {
    assister = pickPlayer(env, att, ASSIST_WEIGHTS, (p) => p.attrs.passing, shooter.id)
  }
  if (assister?.id === shooter.id) assister = null

  const sp = P(shooter)
  const headed = kind === 'header' || kind === 'corner'
  const fin =
    (headed ? sp.attrs.heading * 0.7 + sp.attrs.jumping * 0.3 : sp.attrs.finishing * 0.75 + sp.attrs.composure * 0.25) *
    fatigueFactor(shooter.energy)
  const pressure = clamp(1 + ((attS.attack - defS.defense) / defS.defense) * 0.5, 0.7, 1.35)
  const xg = clamp(BASE_XG[kind] * (1 + (fin - 12) * 0.05) * (kind === 'penalty' ? 1 : pressure), 0.01, 0.95)

  const keeper = def.onPitch.find((mp) => mp.pos === 'GK') ?? null
  const gk = keeper ? keeperScore(P(keeper).attrs) * fatigueFactor(keeper.energy) : 4
  const goalP = clamp(xg * (1 - (gk - 12) * 0.035), 0.005, 0.97)

  att.stats.shots++
  att.stats.xg += xg
  addMomentum(m, side, 3)
  m.ballX = side === 'home' ? rng.range(84, 95) : rng.range(5, 16)

  const shooterName = sp.name
  const assistName = assister ? P(assister).name : null

  if (rng.chance(goalP)) {
    att.goals++
    att.stats.onTarget++
    shooter.goals++
    shooter.rating += kind === 'penalty' ? 0.85 : 1.1
    if (assister) {
      assister.assists++
      assister.rating += 0.7
    }
    if (keeper) keeper.rating -= 0.35
    for (const mp of def.onPitch) if (LINE_OF[mp.pos] === 'DF') mp.rating -= 0.15
    addMomentum(m, side, 6)
    push(env, {
      type: 'goal',
      side,
      playerId: shooter.id,
      assistId: assister?.id,
      text: goalText(rng, kind, shooterName, assistName),
      score: [m.home.goals, m.away.goals],
    })
    m.possession = other(side)
    m.ballX = 50
    return
  }

  const onTargetP = kind === 'penalty' ? 0.6 : clamp(0.4 + (fin - 12) * 0.02, 0.25, 0.6)
  if (assister) assister.rating += 0.08
  if (rng.chance(onTargetP) && keeper) {
    att.stats.onTarget++
    keeper.saves++
    keeper.rating += xg > 0.2 ? 0.45 : 0.25
    shooter.rating += 0.05
    push(env, { type: 'shot', side, outcome: 'saved', playerId: shooter.id, text: savedText(rng, kind, shooterName, P(keeper).name) })
    if (rng.chance(0.3)) {
      att.stats.corners++
      m.cornerFor = side
    }
    return
  }
  const outcome = rng.chance(0.06) ? 'post' : rng.chance(0.33) ? 'blocked' : 'missed'
  shooter.rating -= xg > 0.25 ? 0.25 : 0.1
  push(env, { type: 'shot', side, outcome, playerId: shooter.id, text: missText(rng, kind, shooterName, assistName, outcome) })
  if (outcome === 'blocked' && rng.chance(0.4)) {
    att.stats.corners++
    m.cornerFor = side
  }
}

function removeFromPitch(t: TeamState, mp: MatchPlayer, minute: number) {
  t.onPitch = t.onPitch.filter((x) => x !== mp)
  mp.minuteOff = minute
  t.off.push(mp)
}

function bestBenchFor(env: StepEnv, t: TeamState, pos: Position): string | null {
  let best: string | null = null
  let bestScore = -1
  for (const id of t.bench) {
    const p = env.ctx.players[id]
    if (!p) continue
    const s = ratingAt(p, pos) * (0.85 + 0.15 * (p.condition / 100))
    if (s > bestScore) {
      bestScore = s
      best = id
    }
  }
  return best
}

function doSub(env: StepEnv, side: Side, outId: string, inId: string): boolean {
  const t = team(env.m, side)
  const idx = t.onPitch.findIndex((mp) => mp.id === outId)
  if (idx < 0 || t.subsLeft <= 0 || !t.bench.includes(inId)) return false
  const out = t.onPitch[idx]
  const incoming = newMatchPlayer(env.ctx.players[inId], out.pos, env.m.minute, false)
  out.minuteOff = env.m.minute
  t.off.push(out)
  t.onPitch[idx] = incoming
  t.bench = t.bench.filter((id) => id !== inId)
  t.subsLeft--
  push(env, { type: 'sub', side, playerId: inId, text: subText(clubName(env, side), nameOf(env, outId), nameOf(env, inId)) })
  return true
}

function handleInjury(env: StepEnv, side: Side) {
  const t = team(env.m, side)
  const outfield = t.onPitch.filter((mp) => mp.pos !== 'GK')
  if (outfield.length === 0) return
  const victim = outfield[Math.floor(env.rng.next() * outfield.length)]
  victim.injured = true
  victim.rating -= 0.1
  const weeks = [1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 6, 8][env.rng.int(0, 11)]
  env.m.injuries.push({ playerId: victim.id, weeks, type: env.rng.pick(INJURY_TYPES) })
  push(env, { type: 'injury', side, playerId: victim.id, text: injuryText(nameOf(env, victim.id)) })
  const replacement = t.subsLeft > 0 ? bestBenchFor(env, t, victim.pos) : null
  if (replacement) doSub(env, side, victim.id, replacement)
  else removeFromPitch(t, victim, env.m.minute)
}

function handleFoul(env: StepEnv, defSide: Side, attS: Strength, defS: Strength) {
  const { m, rng } = env
  const attSide = other(defSide)
  const offenderSide = rng.chance(0.72) ? defSide : attSide
  const t = team(m, offenderSide)
  t.stats.fouls++
  const offender = pickPlayer(env, t, FOUL_WEIGHTS, (p) => p.attrs.workRate + 4)
  if (!offender) return
  const cardP = 0.1 * (t.press === 'high' ? 1.15 : 1)
  if (rng.chance(cardP)) {
    const name = nameOf(env, offender.id)
    t.stats.yellows++
    offender.rating -= 0.35
    if (offender.yellow) {
      offender.sentOff = true
      t.stats.reds++
      offender.rating -= 1.2
      push(env, { type: 'red', side: offenderSide, playerId: offender.id, text: secondYellowText(name) })
      removeFromPitch(t, offender, m.minute)
      afterSendOff(env, offenderSide, offender)
    } else {
      offender.yellow = true
      push(env, { type: 'card', side: offenderSide, playerId: offender.id, text: yellowText(rng, name) })
    }
  } else if (rng.chance(0.0035)) {
    offender.sentOff = true
    t.stats.reds++
    offender.rating -= 1.6
    push(env, { type: 'red', side: offenderSide, playerId: offender.id, text: redText(nameOf(env, offender.id)) })
    removeFromPitch(t, offender, m.minute)
    afterSendOff(env, offenderSide, offender)
  }
  // Fouls by the defending side can give set pieces.
  if (offenderSide === defSide && !m.finished) {
    if (rng.chance(0.017)) resolveChance(env, attSide, 'penalty', attS, defS)
    else if (rng.chance(0.07)) resolveChance(env, attSide, 'freekick', attS, defS)
  }
}

function afterSendOff(env: StepEnv, side: Side, sentOff: MatchPlayer) {
  // A team that loses its keeper brings on the reserve keeper if it can.
  if (sentOff.pos !== 'GK') return
  const t = team(env.m, side)
  if (t.subsLeft <= 0) return
  const gk = t.bench.find((id) => env.ctx.players[id]?.position === 'GK')
  if (!gk) return
  const sacrifice = [...t.onPitch].sort((a, b) => a.rating - b.rating)[0]
  if (!sacrifice) return
  if (doSub(env, side, sacrifice.id, gk)) {
    const mp = t.onPitch.find((x) => x.id === gk)
    if (mp) mp.pos = 'GK'
  }
}

function aiSubs(env: StepEnv, side: Side) {
  const t = team(env.m, side)
  const minute = env.m.minute
  if (![58, 66, 74, 81].includes(minute)) return
  const used = MAX_SUBS - t.subsLeft
  if (used >= AI_SUB_LIMIT || t.bench.length === 0) return
  const perWindow = minute === 66 ? 2 : 1
  const candidates = t.onPitch
    .filter((mp) => mp.pos !== 'GK' && (mp.energy < 64 || (minute >= 66 && mp.rating < 6.0) || (minute >= 74 && mp.yellow)))
    .sort((a, b) => a.energy - b.energy)
  let made = 0
  for (const out of candidates) {
    if (made >= perWindow || MAX_SUBS - t.subsLeft >= AI_SUB_LIMIT) break
    const inId = bestBenchFor(env, t, out.pos)
    if (inId && doSub(env, side, out.id, inId)) made++
  }
}

function drainEnergy(env: StepEnv, t: TeamState) {
  for (const mp of t.onPitch) {
    const p = env.ctx.players[mp.id]
    const drain = 0.36 * (1.45 - p.attrs.stamina / 20) * PRESS_DRAIN[t.press] * (mp.pos === 'GK' ? 0.3 : 1)
    mp.energy = Math.max(0, mp.energy - drain)
  }
}

function finalizeRatings(m: LiveMatch, rng: Rng) {
  for (const side of ['home', 'away'] as Side[]) {
    const t = team(m, side)
    const o = team(m, other(side))
    const gd = t.goals - o.goals
    for (const mp of [...t.onPitch, ...t.off]) {
      const end = mp.minuteOff ?? FULL
      const played = end - mp.minuteOn
      let r = mp.rating
      if (played >= 20) r += clamp(gd, -3, 3) * 0.12
      if (o.goals === 0 && played >= 60 && (mp.pos === 'GK' || LINE_OF[mp.pos] === 'DF')) r += 0.45
      r += rng.normal(0.22)
      if (played < 20 && !mp.sentOff) r = 6.3 + (r - 6.3) * 0.5
      mp.rating = Math.round(clamp(r, 3.5, 10) * 10) / 10
    }
  }
}

export function motmOf(m: LiveMatch): string | null {
  let best: MatchPlayer | null = null
  for (const side of ['home', 'away'] as Side[]) {
    const t = team(m, side)
    for (const mp of [...t.onPitch, ...t.off]) {
      const played = (mp.minuteOff ?? FULL) - mp.minuteOn
      if (played < 30) continue
      if (!best || mp.rating > best.rating) best = mp
    }
  }
  return best?.id ?? null
}

/** Advance the match by one minute. Mutates `m`. */
export function stepMinute(m: LiveMatch, ctx: MatchContext): void {
  if (m.finished) return
  const rng = new Rng(m.rng)
  const env: StepEnv = { m, ctx, rng, hadEvent: false }
  m.minute++
  if (m.minute === HALF + 1) {
    push(env, { type: 'period', text: '후반전이 시작됩니다.' })
    m.possession = 'away'
  }

  const H = strengthOf(m.home, ctx, true)
  const A = strengthOf(m.away, ctx, false)

  // Possession: a Markov chain whose long-run share equals pHome.
  let pHome = 0.5 + ((H.midfield - A.midfield) / (H.midfield + A.midfield)) * 2.2
  const styleAdj = { possession: 0.05, balanced: 0, counter: -0.05 }
  pHome += styleAdj[m.home.style] - styleAdj[m.away.style]
  pHome += (m.home.press === 'high' ? 0.03 : 0) - (m.away.press === 'high' ? 0.03 : 0)
  pHome = clamp(pHome, 0.25, 0.75)
  if (!rng.chance(0.5)) m.possession = rng.chance(pHome) ? 'home' : 'away'

  const attSide = m.possession
  const defSide = other(attSide)
  const att = team(m, attSide)
  const def = team(m, defSide)
  const attS = attSide === 'home' ? H : A
  const defS = attSide === 'home' ? A : H

  att.stats.possessionMinutes++
  const passMul = att.style === 'possession' ? 1.25 : att.style === 'counter' ? 0.8 : 1
  const passes = Math.round(rng.range(5, 9) * passMul)
  const completion = clamp(0.77 + (attS.midfield - 12) * 0.025 + (att.style === 'possession' ? 0.04 : 0) - (def.press === 'high' ? 0.03 : 0), 0.62, 0.94)
  att.stats.passes += passes
  att.stats.passesCompleted += Math.round(passes * completion)
  def.stats.passes += 1
  def.stats.passesCompleted += rng.chance(0.75) ? 1 : 0
  addMomentum(m, attSide, 1)
  m.ballX = attSide === 'home' ? rng.range(52, 80) : rng.range(20, 48)
  for (const mp of att.onPitch) if (LINE_OF[mp.pos] === 'MF') mp.rating += 0.004

  // Corner follow-up from the previous minute.
  if (m.cornerFor) {
    const cs = m.cornerFor
    m.cornerFor = null
    if (rng.chance(0.32)) {
      resolveChance(env, cs, 'corner', cs === 'home' ? H : A, cs === 'home' ? A : H)
    }
  }

  // Open-play chance for the side in possession.
  const ratio = attS.attack / defS.defense
  let rate = 0.2 * Math.pow(ratio, 1.5)
  rate *= att.style === 'possession' ? 0.9 : att.style === 'counter' ? 1.18 : 1
  rate *= att.press === 'high' ? 1.05 : 1
  rate *= def.press === 'high' ? 1.06 : def.press === 'low' ? 0.94 : 1
  rate *= def.line === 'high' ? 1.08 : def.line === 'deep' ? 0.9 : 1
  if (rng.chance(rate)) {
    resolveChance(env, attSide, chooseKind(env, att, def), attS, defS)
  } else {
    for (const mp of def.onPitch) if (LINE_OF[mp.pos] === 'DF') mp.rating += 0.003
  }
  if (rng.chance(0.05)) {
    att.stats.corners++
    m.cornerFor = attSide
  }

  // Fouls and cards.
  const foulP = 0.24 * (def.press === 'high' ? 1.12 : 1)
  if (rng.chance(foulP)) handleFoul(env, defSide, attS, defS)

  // Injuries.
  for (const s of ['home', 'away'] as Side[]) if (rng.chance(0.0016)) handleInjury(env, s)

  drainEnergy(env, m.home)
  drainEnergy(env, m.away)

  if (m.home.aiControlled) aiSubs(env, 'home')
  if (m.away.aiControlled) aiSubs(env, 'away')

  if (!env.hadEvent && rng.chance(0.11) && att.onPitch.length > 0) {
    const mp = att.onPitch[Math.floor(rng.next() * att.onPitch.length)]
    push(env, { type: 'info', side: attSide, text: flavorText(rng, clubName(env, attSide), att, nameOf(env, mp.id)) })
  }

  if (m.minute === HALF) {
    push(env, { type: 'period', text: `전반전 종료. ${m.home.goals} : ${m.away.goals}` })
  }
  if (m.minute >= FULL) {
    finalizeRatings(m, rng)
    push(env, { type: 'period', text: `경기 종료! 최종 스코어 ${m.home.goals} : ${m.away.goals}` })
    m.finished = true
  }
  m.rng = rng.state
}

export function simulateToEnd(m: LiveMatch, ctx: MatchContext): LiveMatch {
  while (!m.finished) stepMinute(m, ctx)
  return m
}

/** User substitution. Returns false when not allowed. */
export function substitute(m: LiveMatch, ctx: MatchContext, side: Side, outId: string, inId: string): boolean {
  if (m.finished) return false
  const env: StepEnv = { m, ctx, rng: new Rng(m.rng), hadEvent: false }
  const ok = doSub(env, side, outId, inId)
  m.rng = env.rng.state
  return ok
}

export function setInstructions(m: LiveMatch, side: Side, ins: Partial<Instructions>) {
  const t = team(m, side)
  if (ins.style) t.style = ins.style
  if (ins.press) t.press = ins.press
  if (ins.line) t.line = ins.line
}

export function possessionPct(m: LiveMatch): [number, number] {
  const h = m.home.stats.possessionMinutes
  const a = m.away.stats.possessionMinutes
  if (h + a === 0) return [50, 50]
  const hp = Math.round((h / (h + a)) * 100)
  return [hp, 100 - hp]
}

export function liveStrength(m: LiveMatch, ctx: MatchContext, side: Side): Strength {
  return strengthOf(team(m, side), ctx, side === 'home')
}

function lines(t: TeamState): PlayerLine[] {
  return [...t.onPitch, ...t.off]
    .sort((a, b) => Number(b.started) - Number(a.started) || a.minuteOn - b.minuteOn)
    .map((mp) => ({
      id: mp.id,
      pos: mp.pos,
      rating: mp.rating,
      goals: mp.goals,
      assists: mp.assists,
      energy: Math.round(mp.energy),
      started: mp.started,
      yellow: mp.yellow,
      sentOff: mp.sentOff,
    }))
}

export function buildReport(m: LiveMatch, fixture: Fixture): MatchReport {
  return {
    fixtureId: fixture.id,
    homeId: fixture.homeId,
    awayId: fixture.awayId,
    homeGoals: m.home.goals,
    awayGoals: m.away.goals,
    events: m.events,
    stats: { home: { ...m.home.stats }, away: { ...m.away.stats } },
    players: { home: lines(m.home), away: lines(m.away) },
    momentum: m.momentum,
    motmId: motmOf(m),
  }
}
