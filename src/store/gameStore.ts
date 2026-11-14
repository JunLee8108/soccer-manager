import { create } from 'zustand'
import { FORMATIONS } from '../engine/data/formations'
import { createNewGame } from '../engine/generator'
import { BENCH_SIZE, isAvailable, refitLineup, autoLineup } from '../engine/lineup'
import { setInstructions, simulateToEnd, stepMinute, substitute } from '../engine/match/engine'
import type { LiveMatch } from '../engine/match/types'
import { completeRound, isSeasonOver, startNewSeason, startUserMatch } from '../engine/season'
import type { FormationId, GameState, Instructions, Intensity, TrainingFocus } from '../engine/types'
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

  ensureMatch(): void
  tick(): void
  skipMatch(): void
  setSpeed(s: Speed): void
  setPaused(p: boolean): void
  matchSub(outId: string, inId: string): boolean
  matchInstructions(ins: Partial<Instructions>): void
  finishMatch(): Promise<void>
  beginNextSeason(): Promise<void>
}

const repo = createSaveRepository()
let saveTimer: ReturnType<typeof setTimeout> | null = null

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

    async init() {
      try {
        const saves = await repo.list()
        set({ saves })
        const last = lastSlot()
        if (last !== null && saves.some((s) => s.slot === last)) {
          const game = await repo.load(last)
          if (game) set({ game, slot: last })
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
      set({ game, slot, match: null, halfTimeSeen: false, paused: false })
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
      set({ match: m, paused: atHalf ? true : get().paused, halfTimeSeen: halfTimeSeen || atHalf })
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

    async beginNextSeason() {
      const { game } = get()
      if (!game || !isSeasonOver(game)) return
      set({ game: startNewSeason(game) })
      await persist(get, true)
      await get().refreshSaves()
    },
  }
})

/** Selectors */
export const userClubOf = (g: GameState) => g.clubs[g.userClubId]
export const formationSlots = (f: FormationId) => FORMATIONS[f].slots
