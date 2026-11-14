import { create } from 'zustand'
import { FORMATIONS } from '../engine/data/formations'
import { createNewGame } from '../engine/generator'
import { migrateGame } from '../engine/migrate'
import { promoteYouth, removePlayer } from '../engine/offseason'
import { Rng } from '../engine/rng'
import { BENCH_SIZE, isAvailable, refitLineup, autoLineup } from '../engine/lineup'
import { changeFormation, clearPendingInjury, setInstructions, simulateToEnd, stepMinute, substitute, swapPositions } from '../engine/match/engine'
import type { LiveMatch } from '../engine/match/types'
import { completeRound, isSeasonOver, startNewSeason, startUserMatch } from '../engine/season'
import type { ContractDecision, FormationId, GameState, IndividualFocus, Instructions, Intensity, TrainingFocus } from '../engine/types'
import { createSaveRepository, lastSlot, rememberSlot, type SaveMeta } from './persistence'

export type Speed = 1 | 2 | 4

/** A place in the team sheet: a formation slot or a bench seat. */
export type SheetSpot = { kind: 'slot'; index: number } | { kind: 'bench'; index: number }

interface GameStore {
  ready: boolean
  game: GameState | null
  slot: number | null
  saves: SaveMeta[]
  match: LiveMatch | null
  speed: Speed
  paused: boolean
  /** Half-time pause already shown for the current match. */
  halfTimeSeen: boolean
  busy: boolean
  /** Open the match board automatically at half-time and on injuries. */
  autoBoard: boolean
  setAutoBoard(v: boolean): void

  init(): Promise<void>
  refreshSaves(): Promise<void>
  newGame(slot: number, clubId: string, managerName: string): Promise<void>
  loadGame(slot: number): Promise<void>
  deleteSave(slot: number): Promise<void>
  exitToMenu(): Promise<void>

  setFormation(f: FormationId): void
  placePlayer(target: SheetSpot, playerId: string): void
  autoPick(): void
  setTeamInstructions(ins: Partial<Instructions>): void
  setTraining(t: Partial<{ focus: TrainingFocus; intensity: Intensity }>): void
  markRead(id: string): void
  markAllRead(): void
  setPlayerFocus(playerId: string, focus: IndividualFocus): void
  promoteYouth(playerId: string): void
  releaseYouth(playerId: string): void

  ensureMatch(): void
  tick(): void
  skipMatch(): void
  setSpeed(s: Speed): void
  setPaused(p: boolean): void
  matchSub(outId: string, inId: string): boolean
  matchSwap(idA: string, idB: string): boolean
  matchFormation(f: FormationId): void
  matchInstructions(ins: Partial<Instructions>): void
  finishMatch(): Promise<void>
  beginNextSeason(decisions: Record<string, ContractDecision>): Promise<void>
}

const repo = createSaveRepository()
let saveTimer: ReturnType<typeof setTimeout> | null = null

const AUTO_BOARD_KEY = 'soccer-manager:auto-board'
function readAutoBoard(): boolean {
  try {
    return localStorage.getItem(AUTO_BOARD_KEY) !== '0'
  } catch {
    return true
  }
}

function persist(get: () => GameStore, immediate = false) {
  const run = async () => {
    const { game, slot } = get()
    if (!game || slot === null) return
    try {
      await repo.save(slot, game)
    } catch (err) {
      console.error('Save failed', err)
    }
  }
  if (saveTimer) clearTimeout(saveTimer)
  if (immediate) return run()
  saveTimer = setTimeout(run, 400)
  return Promise.resolve()
}

export const useGame = create<GameStore>((set, get) => {
  /** Apply a change to the user's club tactics and save. */
  const updateUserClub = (fn: (game: GameState) => void) => {
    const { game } = get()
    if (!game) return
    const next = structuredClone(game)
    fn(next)
    next.updatedAt = Date.now()
    set({ game: next })
    void persist(get)
  }

  return {
    ready: false,
    game: null,
    slot: null,
    saves: [],
    match: null,
    speed: 2,
    paused: false,
    halfTimeSeen: false,
    busy: false,
    autoBoard: readAutoBoard(),

    setAutoBoard(v) {
      try {
        localStorage.setItem(AUTO_BOARD_KEY, v ? '1' : '0')
      } catch {
        // preference only
      }
      set({ autoBoard: v })
    },

    async init() {
      try {
        const saves = await repo.list()
        set({ saves })
        const last = lastSlot()
        if (last !== null && saves.some((s) => s.slot === last)) {
          const game = await repo.load(last)
          if (game) set({ game: migrateGame(game), slot: last })
        }
      } catch (err) {
        console.error('Could not read saves', err)
      }
      set({ ready: true })
    },

    async refreshSaves() {
      set({ saves: await repo.list() })
    },

    async newGame(slot, clubId, managerName) {
      set({ busy: true })
      const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
      const game = createNewGame({ seed, userClubId: clubId, managerName: managerName.trim() || '감독' })
      set({ game, slot, match: null, halfTimeSeen: false, paused: false })
      rememberSlot(slot)
      await persist(get, true)
      await get().refreshSaves()
      set({ busy: false })
    },

    async loadGame(slot) {
      const game = await repo.load(slot)
      if (!game) return
      rememberSlot(slot)
      set({ game: migrateGame(game), slot, match: null, halfTimeSeen: false, paused: false })
    },

    async deleteSave(slot) {
      await repo.remove(slot)
      if (get().slot === slot) set({ game: null, slot: null, match: null })
      await get().refreshSaves()
    },

    async exitToMenu() {
      await persist(get, true)
      set({ game: null, slot: null, match: null })
      await get().refreshSaves()
    },

    setFormation(formation) {
      updateUserClub((game) => {
        const club = game.clubs[game.userClubId]
        const { lineup, bench } = refitLineup(club, game.players, formation)
        club.tactics = { ...club.tactics, formation, lineup, bench }
      })
    },

    placePlayer(target, playerId) {
      updateUserClub((game) => {
        const club = game.clubs[game.userClubId]
        const p = game.players[playerId]
        if (!p || p.clubId !== club.id) return
        const lineup = [...club.tactics.lineup]
        const bench = [...club.tactics.bench]
        const li = lineup.indexOf(playerId)
        const bi = bench.indexOf(playerId)
        // Only available players can enter the team sheet from outside it.
        if (li < 0 && bi < 0 && !isAvailable(p)) return

        const displaced = target.kind === 'slot' ? lineup[target.index] ?? null : bench[target.index] ?? null
        if (displaced === playerId) return

        // Put the player in the target spot.
        if (target.kind === 'slot') lineup[target.index] = playerId
        else if (target.index < bench.length) bench[target.index] = playerId
        else bench.push(playerId)

        // The displaced player takes the vacated spot; from outside the sheet they simply drop out.
        if (li >= 0) lineup[li] = displaced
        else if (bi >= 0) {
          if (displaced) bench[bi] = displaced
          else bench.splice(bi, 1)
        }
        club.tactics = { ...club.tactics, lineup, bench: bench.slice(0, BENCH_SIZE) }
      })
    },

    autoPick() {
      updateUserClub((game) => {
        const club = game.clubs[game.userClubId]
        const { lineup, bench } = autoLineup(club, game.players)
        club.tactics = { ...club.tactics, lineup, bench }
      })
    },

    setTeamInstructions(ins) {
      updateUserClub((game) => {
        const club = game.clubs[game.userClubId]
        club.tactics = { ...club.tactics, ...ins }
      })
    },

    setTraining(t) {
      updateUserClub((game) => {
        const club = game.clubs[game.userClubId]
        club.training = { ...club.training, ...t }
      })
    },

    markRead(id) {
      updateUserClub((game) => {
        const m = game.inbox.find((x) => x.id === id)
        if (m) m.read = true
      })
    },

    markAllRead() {
      updateUserClub((game) => {
        for (const m of game.inbox) m.read = true
      })
    },

    setPlayerFocus(playerId, focus) {
      updateUserClub((game) => {
        const p = game.players[playerId]
        if (p && p.clubId === game.userClubId) p.trainingFocus = focus
      })
    },

    promoteYouth(playerId) {
      updateUserClub((game) => {
        if (game.players[playerId]?.clubId !== game.userClubId) return
        promoteYouth(game, playerId, new Rng(game.nextId * 7919 + game.round))
      })
    },

    releaseYouth(playerId) {
      updateUserClub((game) => {
        const club = game.clubs[game.userClubId]
        if (club.youthIds.includes(playerId)) removePlayer(game, playerId)
      })
    },

    ensureMatch() {
      const { game, match } = get()
      if (!game || isSeasonOver(game)) return
      if (match) return
      const m = startUserMatch(game)
      if (m) set({ match: m, halfTimeSeen: false, paused: false })
    },

    tick() {
      const { game, match, paused, halfTimeSeen } = get()
      if (!game || !match || paused || match.finished) return
      const m = { ...match }
      stepMinute(m, game)
      const atHalf = m.minute === 45 && !halfTimeSeen
      const injury = !!m.pendingInjury
      set({ match: m, paused: atHalf || injury ? true : get().paused, halfTimeSeen: halfTimeSeen || atHalf })
    },

    skipMatch() {
      const { game, match } = get()
      if (!game || !match) return
      // The assistant manager makes substitutions for the rest of the match.
      const m = { ...match, home: { ...match.home, aiControlled: true }, away: { ...match.away, aiControlled: true } }
      simulateToEnd(m, game)
      set({ match: m, paused: false, halfTimeSeen: true })
    },

    setSpeed(speed) {
      set({ speed })
    },

    setPaused(paused) {
      const { match } = get()
      if (!paused && match?.pendingInjury) {
        // Resuming without replacing the injured player: they play on hampered.
        const m = { ...match }
        clearPendingInjury(m)
        set({ match: m })
      }
      set({ paused })
    },

    matchSub(outId, inId) {
      const { game, match } = get()
      if (!game || !match) return false
      const side = match.home.clubId === game.userClubId ? 'home' : 'away'
      const m = { ...match }
      const ok = substitute(m, game, side, outId, inId)
      if (ok) set({ match: m })
      return ok
    },

    matchSwap(idA, idB) {
      const { game, match } = get()
      if (!game || !match) return false
      const side = match.home.clubId === game.userClubId ? 'home' : 'away'
      const m = { ...match, home: { ...match.home }, away: { ...match.away } }
      const ok = swapPositions(m, side, idA, idB)
      if (ok) set({ match: m })
      return ok
    },

    matchFormation(f) {
      const { game, match } = get()
      if (!game || !match) return
      const side = match.home.clubId === game.userClubId ? 'home' : 'away'
      const m = { ...match, home: { ...match.home }, away: { ...match.away } }
      if (changeFormation(m, game, side, f)) set({ match: m })
    },

    matchInstructions(ins) {
      const { game, match } = get()
      if (!game || !match) return
      const side = match.home.clubId === game.userClubId ? 'home' : 'away'
      const m = { ...match, home: { ...match.home }, away: { ...match.away } }
      setInstructions(m, side, ins)
      set({ match: m })
    },

    async finishMatch() {
      const { game, match } = get()
      if (!game || !match) return
      set({ busy: true })
      const next = completeRound(game, match)
      set({ game: next, match: null, halfTimeSeen: false, paused: false })
      await persist(get, true)
      await get().refreshSaves()
      set({ busy: false })
    },

    async beginNextSeason(decisions) {
      const { game } = get()
      if (!game || !isSeasonOver(game)) return
      set({ game: startNewSeason(game, decisions) })
      await persist(get, true)
      await get().refreshSaves()
    },
  }
})

/** Selectors */
export const userClubOf = (g: GameState) => g.clubs[g.userClubId]
export const formationSlots = (f: FormationId) => FORMATIONS[f].slots
