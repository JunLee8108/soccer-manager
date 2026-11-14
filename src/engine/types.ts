import type { MatchReport } from './match/types'

export type Position = 'GK' | 'LB' | 'CB' | 'RB' | 'DM' | 'CM' | 'AM' | 'LW' | 'RW' | 'ST'
export type Line = 'GK' | 'DF' | 'MF' | 'FW'
export type Foot = 'L' | 'R' | 'B'

export const POSITIONS: readonly Position[] = ['GK', 'LB', 'CB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']

export const LINE_OF: Record<Position, Line> = {
  GK: 'GK',
  LB: 'DF',
  CB: 'DF',
  RB: 'DF',
  DM: 'MF',
  CM: 'MF',
  AM: 'MF',
  LW: 'FW',
  RW: 'FW',
  ST: 'FW',
}

export const ATTR_KEYS = [
  // technical
  'finishing',
  'firstTouch',
  'dribbling',
  'passing',
  'heading',
  'tackling',
  'marking',
  // mental
  'composure',
  'positioning',
  'decisions',
  'workRate',
  'teamwork',
  'vision',
  // physical
  'pace',
  'acceleration',
  'stamina',
  'strength',
  'jumping',
  // goalkeeping
  'handling',
  'reflexes',
  'oneOnOne',
] as const

export type AttrKey = (typeof ATTR_KEYS)[number]
export type Attributes = Record<AttrKey, number>

export interface Injury {
  type: string
  weeks: number
}

export interface Contract {
  /** Weekly wage in 만원 (10,000 KRW). */
  wage: number
  /** Last season (inclusive) of the contract. */
  until: number
}

export interface SeasonStats {
  apps: number
  starts: number
  goals: number
  assists: number
  ratingSum: number
  rated: number
  yellows: number
  reds: number
  motm: number
  cleanSheets: number
}

export interface Player {
  id: string
  name: string
  nationality: string
  age: number
  position: Position
  secondary: Position[]
  foot: Foot
  height: number
  attrs: Attributes
  /** Potential ability on the same 1–100 scale as the overall rating. */
  potential: number
  /** Match fitness, 0–100. */
  condition: number
  /** 0–100. */
  morale: number
  injury: Injury | null
  /** Matches still to sit out. */
  suspension: number
  yellowAccum: number
  contract: Contract
  clubId: string
  shirt: number
  stats: SeasonStats
  /** Overall rating snapshot per played round, for the growth chart. */
  history: number[]
  /** Hidden personality trait (1–20): how well the player converts training into growth. */
  professionalism: number
  /** Individual training programme. */
  trainingFocus: IndividualFocus
  /** Attribute values at the start of the season, to show this season's changes. */
  seasonStart: Attributes
}

export type IndividualFocus = 'balanced' | 'shooting' | 'playmaking' | 'dribbling' | 'defending' | 'physical' | 'mental' | 'goalkeeping'

export type Style = 'possession' | 'balanced' | 'counter'
export type Press = 'low' | 'mid' | 'high'
export type DefLine = 'deep' | 'normal' | 'high'
export type FormationId = '4-3-3' | '4-4-2' | '4-2-3-1' | '4-1-4-1' | '3-5-2' | '5-3-2'

export interface Instructions {
  style: Style
  press: Press
  line: DefLine
}

export interface Tactics extends Instructions {
  formation: FormationId
  /** Player id per formation slot (same order as the formation's slots). */
  lineup: (string | null)[]
  bench: string[]
}

export type TrainingFocus = 'attack' | 'defense' | 'fitness' | 'tactics' | 'setpiece' | 'recovery'
export type Intensity = 'light' | 'normal' | 'hard'

export interface Club {
  id: string
  name: string
  short: string
  /** Two Latin letters shown on the crest. */
  crest: string
  color: string
  reputation: number
  stadium: string
  capacity: number
  /** In 만원. */
  budget: number
  /** First-team squad. */
  playerIds: string[]
  /** Youth academy players (not selectable for matches). */
  youthIds: string[]
  facilities: { training: number; youth: number }
  tactics: Tactics
  training: { focus: TrainingFocus; intensity: Intensity }
}

export interface Scorer {
  playerId: string
  clubId: string
  minute: number
}

export interface MatchSummary {
  homeGoals: number
  awayGoals: number
  scorers: Scorer[]
  motmId: string | null
}

export interface Fixture {
  id: string
  round: number
  homeId: string
  awayId: string
  result: MatchSummary | null
}

export type MessageTag = 'board' | 'scout' | 'medical' | 'finance' | 'match' | 'staff'

export interface Message {
  id: string
  season: number
  round: number
  tag: MessageTag
  title: string
  body: string
  read: boolean
}

export interface Objective {
  targetRank: number
  label: string
}

export interface StandingRow {
  clubId: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
  form: ('W' | 'D' | 'L')[]
}

export interface SeasonRecord {
  season: number
  rank: number
  points: number
  championId: string
  topScorerId: string | null
  topScorerName?: string
  topScorerGoals: number
}

export type ContractDecision = 'renew' | 'release'

export interface GameState {
  version: number
  seed: number
  /** RNG state for between-match random events. */
  rng: number
  season: number
  /** Index of the next round to be played. Equals the number of rounds at season end. */
  round: number
  userClubId: string
  clubs: Record<string, Club>
  clubOrder: string[]
  players: Record<string, Player>
  fixtures: Fixture[]
  inbox: Message[]
  objective: Objective
  history: SeasonRecord[]
  lastReport: MatchReport | null
  nextId: number
  managerName: string
  createdAt: number
  updatedAt: number
}
