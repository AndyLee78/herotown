import { migrate, type GameState } from '../core/game'

const DB_NAME = 'herotown'
const STORE = 'saves'
const KEY = 'main'
const LEGACY_KEY = 'herotown.save'

export async function loadGame(now: number): Promise<GameState> {
  const stored = await readRecord()
  if (stored) {
    return migrate(stored, now)
  }
  const legacy = readLegacy()
  const state = migrate(legacy, now)
  await writeRecord(state)
  if (legacy) {
    localStorage.removeItem(LEGACY_KEY)
  }
  return state
}

let writes = Promise.resolve()

export function storeGame(state: GameState): Promise<void> {
  const snapshot = state
  writes = writes.then(() => writeRecord(snapshot)).catch(() => undefined)
  return writes
}

function readLegacy(): unknown {
  const raw = localStorage.getItem(LEGACY_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readRecord(): Promise<unknown> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(KEY)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}

async function writeRecord(state: GameState): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(state, KEY)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
