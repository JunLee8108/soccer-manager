import type { DefLine, FormationId, Position, Press, Style } from '../types'

export type Side = 'home' | 'away'

export type EventType =
  | 'period' // kickoff, half-time, second half, full-time
  | 'goal'
  | 'shot' // saved / missed / blocked
  | 'card' // yellow
  | 'red'
  | 'sub'
  | 'injury'
  | 'info'

export type ShotOutcome = 'saved' | 'missed' | 'blocked' | 'post'

export interface MatchEvent {
  minute: number
  type: EventType
  side?: Side
  text: string
  playerId?: string
  assistId?: string
  outcome?: ShotOutcome
  /** Score after the event, for goals. */
  score?: [number, number]
}

export interface TeamStats {
  possessionMinutes: number
  shots: number
  onTarget: number
  xg: number
  passes: number
  passesCompleted: number
  corners: number
  fouls: number
  yellows: number
  reds: number
}

export interface MatchPlayer {
  id: string
  pos: Position
  energy: number
  rating: number
  goals: number
  assists: number
  yellow: boolean
  sentOff: boolean
  injured: boolean
  started: boolean
  minuteOn: number
  minuteOff: number | null
  saves: number
}

export interface TeamState {
  clubId: string
  formation: FormationId
  style: Style
  press: Press
  line: DefLine
  /** Players currently on the pitch (sent-off players are removed). */
  onPitch: MatchPlayer[]
  /** Substituted off, sent off or injured. */
  off: MatchPlayer[]
  bench: string[]
  subsLeft: number
  goals: number
  stats: TeamStats
  /** Whether the engine may make substitutions for this side. */
  aiControlled: boolean
}

export interface LiveMatch {
  fixtureId: string
  minute: number
  finished: boolean
  home: TeamState
  away: TeamState
  events: MatchEvent[]
  /** Per 5-minute bin: [home pressure, away pressure]. */
  momentum: [number, number][]
  possession: Side
  /** 0 = home goal line, 100 = away goal line. */
  ballX: number
  rng: number
  /** Pending corner header chance for the next minute. */
  cornerFor: Side | null
  /** Injuries suffered in this match, applied to the players afterwards. */
  injuries: { playerId: string; weeks: number; type: string }[]
}

export interface PlayerLine {
  id: string
  pos: Position
  rating: number
  goals: number
  assists: number
  energy: number
  started: boolean
  yellow: boolean
  sentOff: boolean
}

/** Compact post-match record of the user's last match. */
export interface MatchReport {
  fixtureId: string
  homeId: string
  awayId: string
  homeGoals: number
  awayGoals: number
  events: MatchEvent[]
  stats: { home: TeamStats; away: TeamStats }
  players: { home: PlayerLine[]; away: PlayerLine[] }
  momentum: [number, number][]
  motmId: string | null
}
