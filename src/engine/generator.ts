import { CLUB_SEEDS, type ClubSeed } from './data/clubs'
import { BLOCKED_NAMES, FOREIGN, GIVEN_NAMES, SURNAMES } from './data/names'
import { emptyFinance } from './finance'
import { autoLineup } from './lineup'
import { ovrAt, POSITION_WEIGHTS, wageFor } from './ratings'
import { clamp, Rng } from './rng'
import { doubleRoundRobin } from './schedule'
import type {
  AttrKey,
  Attributes,
  Club,
  DefLine,
  FormationId,
  GameState,
  Objective,
  Player,
  Position,
  Press,
  SeasonStats,
  Style,
} from './types'
import { ATTR_KEYS, FREE_AGENT } from './types'

export const SAVE_VERSION = 3

const GK_ONLY: AttrKey[] = ['handling', 'reflexes', 'oneOnOne']
const OUTFIELD_SKILLS: AttrKey[] = ['finishing', 'dribbling', 'tackling', 'marking', 'heading', 'firstTouch']

/** Squad template: position and quality offset relative to the club level. */
export const SQUAD_TEMPLATE: [Position, number][] = [
  ['GK', 2], ['GK', -5], ['GK', -11],
  ['CB', 2], ['CB', 1], ['CB', -4], ['CB', -8],
  ['LB', 1], ['LB', -6],
  ['RB', 1], ['RB', -6],
  ['DM', 1], ['DM', -4],
  ['CM', 2], ['CM', 1], ['CM', -5],
  ['AM', 0],
  ['LW', 1], ['LW', -6],
  ['RW', 1], ['RW', -6],
  ['ST', 2], ['ST', -3], ['ST', -9],
]

const SECONDARY: Record<Position, Position[]> = {
  GK: [],
  CB: ['DM', 'RB', 'LB'],
  LB: ['LW', 'RB', 'CB'],
  RB: ['RW', 'LB', 'CB'],
  DM: ['CM', 'CB'],
  CM: ['DM', 'AM'],
  AM: ['CM', 'ST', 'LW', 'RW'],
  LW: ['RW', 'AM', 'ST'],
  RW: ['LW', 'AM', 'ST'],
  ST: ['AM', 'LW', 'RW'],
}

/** Relative frequency of positions among youth intakes. */
const YOUTH_POSITIONS: [Position, number][] = [
  ['GK', 1], ['CB', 2], ['LB', 1], ['RB', 1], ['DM', 1], ['CM', 2], ['AM', 1.2], ['LW', 1.2], ['RW', 1.2], ['ST', 2],
]

export const emptyStats = (): SeasonStats => ({
  apps: 0,
  starts: 0,
  goals: 0,
  assists: 0,
  ratingSum: 0,
  rated: 0,
  yellows: 0,
  reds: 0,
  motm: 0,
  cleanSheets: 0,
})

export function generateAttributes(rng: Rng, pos: Position, target: number, age: number): Attributes {
  const w = POSITION_WEIGHTS[pos]
  const maxW = Math.max(...Object.values(w).map((x) => x ?? 0))
  const base = target / 5
  const attrs = {} as Attributes
  for (const k of ATTR_KEYS) {
    const imp = (w[k] ?? 0) / maxW
    let mean: number
    if (GK_ONLY.includes(k) && pos !== 'GK') mean = rng.range(2, 6)
    else if (pos === 'GK' && OUTFIELD_SKILLS.includes(k)) mean = base * 0.38
    else mean = base * (0.64 + 0.36 * imp)
    let v = mean + rng.normal(1.5)
    if ((k === 'pace' || k === 'acceleration') && age > 29) v -= (age - 29) * 0.45
    if ((k === 'pace' || k === 'acceleration') && age < 21) v += 0.6
    if ((k === 'composure' || k === 'decisions' || k === 'positioning') && age < 22) v -= (22 - age) * 0.45
    if ((k === 'composure' || k === 'decisions') && age > 28) v += 0.7
    attrs[k] = clamp(Math.round(v), 1, 20)
  }
  // Nudge the position-relevant attributes until the overall rating hits the target.
  for (let iter = 0; iter < 10; iter++) {
    const diff = target - ovrAt(attrs, pos)
    if (Math.abs(diff) <= 1) break
    const step = diff / 5
    for (const key in w) {
      const k = key as AttrKey
      const delta = Math.round(step + rng.normal(0.35))
      attrs[k] = clamp(attrs[k] + (delta === 0 ? Math.sign(diff) : delta), 1, 20)
    }
  }
  return attrs
}

function potentialFor(rng: Rng, current: number, age: number): number {
  let room = 0
  if (age <= 18) room = rng.range(8, 26)
  else if (age <= 21) room = rng.range(4, 18)
  else if (age <= 24) room = rng.range(1, 10)
  else if (age <= 27) room = rng.range(0, 4)
  return clamp(Math.round(current + room), current, 94)
}

function ageFor(rng: Rng, offset: number): number {
  if (offset <= -7) return rng.int(17, 20)
  if (offset <= -4) return rng.int(19, 30)
  // Triangular-ish around 26.
  return clamp(Math.round(20 + rng.next() * 7 + rng.next() * 7), 19, 34)
}

export function professionalismFor(rng: Rng): number {
  return clamp(Math.round(11 + rng.normal(3.8)), 1, 20)
}

export class NameFactory {
  used: Set<string>
  rng: Rng

  constructor(rng: Rng, existing: Iterable<string> = []) {
    this.rng = rng
    this.used = new Set(existing)
  }

  korean(): string {
    const weights = SURNAMES.map(([, w]) => w)
    for (let i = 0; i < 80; i++) {
      const name = SURNAMES[this.rng.weighted(weights)][0] + this.rng.pick(GIVEN_NAMES)
      if (!this.used.has(name) && !BLOCKED_NAMES.has(name)) {
        this.used.add(name)
        return name
      }
    }
    // Fall back to a two-syllable given name built from two pool names.
    for (let i = 0; i < 200; i++) {
      const a = this.rng.pick(GIVEN_NAMES)
      const b = this.rng.pick(GIVEN_NAMES)
      const name = SURNAMES[this.rng.weighted(weights)][0] + a[0] + b[b.length - 1]
      if (!this.used.has(name) && !BLOCKED_NAMES.has(name)) {
        this.used.add(name)
        return name
      }
    }
    const name = `${SURNAMES[0][0]}${this.rng.pick(GIVEN_NAMES)}${this.used.size}`
    this.used.add(name)
    return name
  }

  foreign(code: string): string {
    const pool = FOREIGN[code]
    for (let i = 0; i < 80; i++) {
      const first = this.rng.pick(pool.first)
      const last = this.rng.pick(pool.last)
      const name = code === 'JPN' ? `${last} ${first}` : `${first} ${last}`
      if (!this.used.has(name)) {
        this.used.add(name)
        return name
      }
    }
    return this.korean()
  }
}

function heightFor(rng: Rng, pos: Position): number {
  if (pos === 'GK') return rng.int(184, 197)
  if (pos === 'CB') return rng.int(182, 194)
  if (pos === 'ST') return rng.int(176, 192)
  return rng.int(168, 186)
}

function footFor(rng: Rng, pos: Position): Player['foot'] {
  const r = rng.next()
  if (r < 0.06) return 'B'
  const leftBias = pos === 'LB' || pos === 'LW' ? 0.55 : 0.18
  return rng.next() < leftBias ? 'L' : 'R'
}

const STANDARD_SHIRTS: Partial<Record<Position, number[]>> = {
  GK: [1],
  RB: [2],
  LB: [3],
  CB: [4, 5],
  DM: [6],
  RW: [7],
  CM: [8, 10],
  ST: [9],
  AM: [10],
  LW: [11],
}

export function clubLevel(reputation: number): number {
  return 44 + reputation * 0.36
}

/** Training and youth facility levels (1–5) for a reputation. */
export function facilitiesFor(rng: Rng, reputation: number) {
  const base = Math.round((reputation - 50) / 8) + 1
  return {
    training: clamp(base, 1, 5),
    youth: clamp(base + rng.int(-1, 1), 1, 5),
  }
}

export function freeShirt(rng: Rng, taken: Set<number>, pos: Position, preferStandard: boolean): number {
  if (preferStandard) {
    const std = (STANDARD_SHIRTS[pos] ?? []).find((n) => !taken.has(n))
    if (std) return std
  }
  for (let i = 0; i < 200; i++) {
    const n = rng.int(12, 45)
    if (!taken.has(n)) return n
  }
  let n = 46
  while (taken.has(n)) n++
  return n
}

export interface CreatePlayerOptions {
  id: string
  clubId: string
  pos: Position
  target: number
  age: number
  season: number
  shirt: number
  names: NameFactory
  potential?: number
  foreignChance?: number
  contractYears?: number
}

export function createPlayer(rng: Rng, o: CreatePlayerOptions): Player {
  const attrs = generateAttributes(rng, o.pos, o.target, o.age)
  const current = ovrAt(attrs, o.pos)
  const foreign = rng.chance(o.foreignChance ?? 0.11)
  const nationality = foreign ? rng.pick(Object.keys(FOREIGN)) : 'KOR'
  const name = foreign ? o.names.foreign(nationality) : o.names.korean()
  const secondaryCount = rng.weighted([0.35, 0.45, 0.2])
  const secondary = rng.shuffle([...SECONDARY[o.pos]]).slice(0, secondaryCount)
  const potential = o.potential !== undefined ? clamp(Math.max(o.potential, current), current, 94) : potentialFor(rng, current, o.age)
  return {
    id: o.id,
    name,
    nationality,
    age: o.age,
    position: o.pos,
    secondary,
    foot: footFor(rng, o.pos),
    height: heightFor(rng, o.pos),
    attrs,
    potential,
    condition: rng.int(90, 100),
    morale: rng.int(60, 78),
    injury: null,
    suspension: 0,
    yellowAccum: 0,
    contract: { wage: wageFor(current, o.age), until: o.season + (o.contractYears ?? rng.int(0, 3)) },
    clubId: o.clubId,
    shirt: o.shirt,
    stats: emptyStats(),
    history: [current],
    professionalism: professionalismFor(rng),
    trainingFocus: 'balanced',
    seasonStart: { ...attrs },
  }
}

export function generateSquad(rng: Rng, seed: ClubSeed, names: NameFactory, nextId: () => string, season: number): Player[] {
  const level = clubLevel(seed.reputation)
  const players: Player[] = []
  const takenShirts = new Set<number>()
  const groupIndex: Partial<Record<Position, number>> = {}

  for (const [pos, offset] of SQUAD_TEMPLATE) {
    const idx = groupIndex[pos] ?? 0
    groupIndex[pos] = idx + 1
    const age = ageFor(rng, offset)
    const target = clamp(Math.round(level + offset + rng.normal(2.6)), 38, 90)
    const shirt = freeShirt(rng, takenShirts, pos, idx === 0)
    takenShirts.add(shirt)
    players.push(createPlayer(rng, { id: nextId(), clubId: seed.id, pos, target, age, season, shirt, names }))
  }
  return players
}

/** A youth academy prospect. Better youth facilities give higher potential and more wonderkids. */
export function createYouth(
  rng: Rng,
  o: { id: string; clubId: string; season: number; youthLevel: number; names: NameFactory; age?: number; shirt?: number },
): Player {
  const pos = YOUTH_POSITIONS[rng.weighted(YOUTH_POSITIONS.map(([, w]) => w))][0]
  const age = o.age ?? rng.int(15, 17)
  const target = clamp(Math.round(36 + o.youthLevel * 2 + (age - 15) * 3 + rng.normal(4)), 30, 58)
  const wonderkid = rng.chance(0.03 + 0.02 * o.youthLevel)
  const potential = wonderkid
    ? rng.int(84, 93)
    : clamp(Math.round(58 + o.youthLevel * 4 + rng.normal(7)), target + 8, 88)
  const p = createPlayer(rng, {
    id: o.id,
    clubId: o.clubId,
    pos,
    target,
    age,
    season: o.season,
    shirt: o.shirt ?? 0,
    names: o.names,
    potential,
    foreignChance: 0.03,
    contractYears: 3,
  })
  p.contract.wage = Math.max(30, Math.round(p.contract.wage * 0.5 / 10) * 10)
  return p
}

function aiTactics(rng: Rng, reputation: number): { formation: FormationId; style: Style; press: Press; line: DefLine } {
  const formations: FormationId[] = ['4-3-3', '4-4-2', '4-2-3-1', '4-1-4-1', '3-5-2', '5-3-2']
  const formation = formations[rng.weighted([3, 3, 3, 1.5, 1.2, reputation < 62 ? 1.5 : 0.5])]
  const strong = reputation >= 70
  const style: Style = (['possession', 'balanced', 'counter'] as Style[])[rng.weighted(strong ? [3, 2, 1] : [1, 2, 3])]
  const press: Press = (['low', 'mid', 'high'] as Press[])[rng.weighted(strong ? [1, 2, 2] : [2, 2, 1])]
  const line: DefLine = (['deep', 'normal', 'high'] as DefLine[])[rng.weighted(strong ? [1, 2, 2] : [2, 2, 1])]
  return { formation, style, press, line }
}

export function objectiveFor(reputationRank: number): Objective {
  if (reputationRank <= 3) return { targetRank: 2, label: '우승 경쟁 (2위 이내)' }
  if (reputationRank <= 7) return { targetRank: 4, label: '대륙컵 진출 (4위 이내)' }
  if (reputationRank <= 11) return { targetRank: 8, label: '중위권 (8위 이내)' }
  return { targetRank: 13, label: '1부 잔류 (13위 이내)' }
}

export interface NewGameOptions {
  seed: number
  userClubId: string
  managerName?: string
}

export function createNewGame({ seed, userClubId, managerName = '감독' }: NewGameOptions): GameState {
  const rng = new Rng(seed)
  const names = new NameFactory(rng)
  let counter = 1
  const nextId = () => `p${counter++}`
  const season = 1

  const clubs: Record<string, Club> = {}
  const players: Record<string, Player> = {}

  for (const seedClub of CLUB_SEEDS) {
    const squad = generateSquad(rng, seedClub, names, nextId, season)
    for (const p of squad) players[p.id] = p
    const facilities = facilitiesFor(rng, seedClub.reputation)
    const youth = Array.from({ length: rng.int(3, 5) }, () =>
      createYouth(rng, { id: nextId(), clubId: seedClub.id, season, youthLevel: facilities.youth, names }),
    )
    for (const p of youth) players[p.id] = p
    const isUser = seedClub.id === userClubId
    const t = isUser
      ? { formation: '4-3-3' as FormationId, style: 'balanced' as Style, press: 'mid' as Press, line: 'normal' as DefLine }
      : aiTactics(rng, seedClub.reputation)
    const budget = Math.round((100000 + (seedClub.reputation - 50) * 12000) / 1000) * 1000
    const wages = [...squad, ...youth].reduce((s, p) => s + p.contract.wage, 0)
    const club: Club = {
      ...seedClub,
      budget,
      finance: emptyFinance(budget, wages),
      playerIds: squad.map((p) => p.id),
      youthIds: youth.map((p) => p.id),
      facilities,
      tactics: { ...t, lineup: [], bench: [] },
      training: { focus: 'tactics', intensity: 'normal' },
    }
    const { lineup, bench } = autoLineup(club, players)
    club.tactics.lineup = lineup
    club.tactics.bench = bench
    clubs[club.id] = club
  }

  const clubOrder = CLUB_SEEDS.map((c) => c.id)
  const repRank = [...CLUB_SEEDS].sort((a, b) => b.reputation - a.reputation).findIndex((c) => c.id === userClubId) + 1
  const objective = objectiveFor(repRank)
  const user = clubs[userClubId]
  const now = Date.now()

  // A few unattached players are available from day one.
  const freeAgents: string[] = []
  for (let i = 0; i < 14; i++) {
    const pos = rng.pick(SQUAD_TEMPLATE)[0]
    const p = createPlayer(rng, {
      id: nextId(),
      clubId: FREE_AGENT,
      pos,
      target: Math.round(rng.range(52, 68)),
      age: rng.int(21, 31),
      season,
      shirt: 0,
      names,
      contractYears: 0,
    })
    players[p.id] = p
    freeAgents.push(p.id)
  }

  return {
    version: SAVE_VERSION,
    seed,
    rng: rng.state,
    season,
    round: 0,
    userClubId,
    clubs,
    clubOrder,
    players,
    fixtures: doubleRoundRobin(clubOrder, rng, season),
    inbox: [
      {
        id: 'm1',
        season,
        round: 0,
        tag: 'board',
        title: `${user.name}에 오신 것을 환영합니다`,
        body: `이사회의 이번 시즌 목표는 '${objective.label}'입니다. 이적시장이 4라운드 동안 열려 있으니 선수단을 파악하고 보강도 검토해 주세요.`,
        read: false,
      },
    ],
    objective,
    history: [],
    lastReport: null,
    freeAgents,
    scouted: [],
    scoutQueue: [],
    transferList: {},
    offers: [],
    news: [],
    board: { confidence: 60, status: 'ok', jobOffers: [] },
    nextId: counter,
    managerName,
    createdAt: now,
    updatedAt: now,
  }
}
