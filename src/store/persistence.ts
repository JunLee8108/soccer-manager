import type { GameState } from '../engine/types'

export interface SaveMeta {
  slot: number
  clubId: string
  clubName: string
  managerName: string
  season: number
  round: number
  updatedAt: number
}

/**
 * Storage boundary for save games. The game only talks to this interface, so
 * the IndexedDB implementation can later sit behind (or next to) a cloud one.
 */
export interface SaveRepository {
  list(): Promise<SaveMeta[]>
  load(slot: number): Promise<GameState | null>
  save(slot: number, game: GameState): Promise<SaveMeta>
  remove(slot: number): Promise<void>
}

export const SLOT_COUNT = 3

function metaOf(slot: number, game: GameState): SaveMeta {
  const club = game.clubs[game.userClubId]
  return {
    slot,
    clubId: club.id,
    clubName: club.name,
    managerName: game.managerName,
    season: game.season,
    round: game.round,
    updatedAt: game.updatedAt,
  }
}

const DB_NAME = 'soccer-manager'
const DB_VERSION = 1
const GAMES = 'games'
const META = 'meta'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(GAMES)) db.createObjectStore(GAMES)
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode)
    let result: T | undefined
    const req = fn(t)
    if (req) req.onsuccess = () => (result = req.result)
    t.oncomplete = () => resolve(result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

export class IndexedDbSaveRepository implements SaveRepository {
  private dbPromise: Promise<IDBDatabase> | null = null

  private db() {
    this.dbPromise ??= openDb()
    return this.dbPromise
  }

  async list(): Promise<SaveMeta[]> {
    const db = await this.db()
    const all = await tx<SaveMeta[]>(db, [META], 'readonly', (t) => t.objectStore(META).getAll() as IDBRequest<SaveMeta[]>)
    return (all ?? []).sort((a, b) => a.slot - b.slot)
  }

  async load(slot: number): Promise<GameState | null> {
    const db = await this.db()
    const game = await tx<GameState>(db, [GAMES], 'readonly', (t) => t.objectStore(GAMES).get(slot) as IDBRequest<GameState>)
    return game ?? null
  }

  async save(slot: number, game: GameState): Promise<SaveMeta> {
    const db = await this.db()
    const meta = metaOf(slot, game)
    await tx(db, [GAMES, META], 'readwrite', (t) => {
      t.objectStore(GAMES).put(game, slot)
      t.objectStore(META).put(meta, slot)
    })
    return meta
  }

  async remove(slot: number): Promise<void> {
    const db = await this.db()
    await tx(db, [GAMES, META], 'readwrite', (t) => {
      t.objectStore(GAMES).delete(slot)
      t.objectStore(META).delete(slot)
    })
  }
}

/** Fallback when IndexedDB is unavailable (private mode on some browsers, tests). */
export class MemorySaveRepository implements SaveRepository {
  private games = new Map<number, GameState>()

  async list() {
    return [...this.games.entries()].map(([slot, g]) => metaOf(slot, g)).sort((a, b) => a.slot - b.slot)
  }

  async load(slot: number) {
    const g = this.games.get(slot)
    return g ? structuredClone(g) : null
  }

  async save(slot: number, game: GameState) {
    this.games.set(slot, structuredClone(game))
    return metaOf(slot, game)
  }

  async remove(slot: number) {
    this.games.delete(slot)
  }
}

export function createSaveRepository(): SaveRepository {
  try {
    if (typeof indexedDB !== 'undefined') return new IndexedDbSaveRepository()
  } catch {
    // fall through
  }
  return new MemorySaveRepository()
}

const LAST_SLOT_KEY = 'soccer-manager:last-slot'

export function rememberSlot(slot: number) {
  try {
    localStorage.setItem(LAST_SLOT_KEY, String(slot))
  } catch {
    // storage may be blocked; not critical
  }
}

export function lastSlot(): number | null {
  try {
    const v = localStorage.getItem(LAST_SLOT_KEY)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}
