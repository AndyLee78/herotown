const OFFSET_KEY = 'herotown.timeOffset'

let offset = readOffset()
const listeners = new Set<() => void>()

export function gameNow(): number {
  return Date.now() + gameOffset()
}

export function gameOffset(): number {
  return import.meta.env.DEV ? offset : 0
}

export function addGameOffset(ms: number): void {
  if (!import.meta.env.DEV || ms <= 0) {
    return
  }
  offset += ms
  persist()
  emit()
}

export function resetGameOffset(): void {
  offset = 0
  persist()
  emit()
}

export function subscribeGameClock(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function offsetParts(ms: number): { days: number; hours: number; minutes: number } {
  const total = Math.max(0, Math.floor(ms / 60_000))
  return {
    days: Math.floor(total / 1_440),
    hours: Math.floor((total % 1_440) / 60),
    minutes: total % 60,
  }
}

export function offsetSteps(ms: number, maxStep: number): number[] {
  const steps: number[] = []
  let left = ms
  while (left > 0) {
    const chunk = Math.min(maxStep, left)
    steps.push(chunk)
    left -= chunk
  }
  return steps
}

function readOffset(): number {
  if (!import.meta.env.DEV || typeof localStorage === 'undefined') {
    return 0
  }
  const value = Number(localStorage.getItem(OFFSET_KEY))
  return Number.isFinite(value) && value > 0 ? value : 0
}

function persist(): void {
  if (!import.meta.env.DEV || typeof localStorage === 'undefined') {
    return
  }
  if (offset > 0) {
    localStorage.setItem(OFFSET_KEY, String(offset))
  } else {
    localStorage.removeItem(OFFSET_KEY)
  }
}

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}
