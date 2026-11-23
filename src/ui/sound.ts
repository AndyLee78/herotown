// Short effects synthesized with Web Audio. No audio files.

export const SOUND_NAMES = [
  'tap',
  'open',
  'close',
  'coin',
  'build',
  'complete',
  'hit',
  'heal',
  'victory',
  'defeat',
  'levelUp',
  'notice',
  'depart',
  'return',
  'wish',
  'jackpot',
] as const

export type SoundName = (typeof SOUND_NAMES)[number]

export function isSoundName(value: string): value is SoundName {
  return (SOUND_NAMES as readonly string[]).includes(value)
}

const STORAGE_KEY = 'herotown.sound'
const FRAME_MS = 16
const HIT_GAP_MS = 90

export type SoundPrefs = { volume: number; muted: boolean }

let audio: AudioContext | null = null
let master: GainNode | null = null
const lastPlayed = new Map<SoundName, number>()

export function soundGap(name: SoundName): number {
  return name === 'hit' ? HIT_GAP_MS : FRAME_MS
}

export function soundBlocked(name: SoundName, now: number, previous: number | undefined): boolean {
  return previous != null && now - previous < soundGap(name)
}

export function loadSoundPrefs(): SoundPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { volume: 60, muted: false }
    }
    const parsed = JSON.parse(raw) as { volume?: unknown; muted?: unknown }
    const volume = typeof parsed.volume === 'number' ? parsed.volume : 60
    return { volume: Math.min(100, Math.max(0, volume)), muted: parsed.muted === true }
  } catch {
    return { volume: 60, muted: false }
  }
}

export function saveSoundPrefs(prefs: SoundPrefs) {
  const next = { volume: Math.min(100, Math.max(0, prefs.volume)), muted: prefs.muted }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private mode can refuse storage. The in-memory gain still updates.
  }
  applyGain(next)
}

export function unlockSound() {
  const context = ensure()
  if (context && context.state === 'suspended') {
    void context.resume()
  }
}

export function play(name: SoundName, scale = 1) {
  const prefs = loadSoundPrefs()
  if (prefs.muted || prefs.volume <= 0) {
    return
  }
  const context = ensure()
  if (!context || !master) {
    return
  }
  const nowMs = performance.now()
  if (soundBlocked(name, nowMs, lastPlayed.get(name))) {
    return
  }
  lastPlayed.set(name, nowMs)
  if (context.state === 'suspended') {
    void context.resume()
  }
  const start = context.currentTime
  const bus = context.createGain()
  bus.gain.setValueAtTime(Math.max(0, scale), start)
  bus.connect(master)
  voice(context, bus, name, start)
}

function ensure(): AudioContext | null {
  if (audio) {
    return audio
  }
  const Context = typeof globalThis.AudioContext === 'undefined' ? undefined : globalThis.AudioContext
  if (!Context) {
    return null
  }
  audio = new Context()
  master = audio.createGain()
  master.connect(audio.destination)
  applyGain(loadSoundPrefs())
  return audio
}

function applyGain(prefs: SoundPrefs) {
  if (!master || !audio) {
    return
  }
  master.gain.setValueAtTime(prefs.muted ? 0 : prefs.volume / 100, audio.currentTime)
}

function voice(context: AudioContext, output: GainNode, name: SoundName, start: number) {
  switch (name) {
    case 'tap':
      blip(context, output, start, 660, 0.08, 'sine', 0.18)
      break
    case 'open':
      blip(context, output, start, 440, 0.1, 'sine', 0.16)
      blip(context, output, start + 0.07, 660, 0.12, 'sine', 0.16)
      break
    case 'close':
      blip(context, output, start, 520, 0.14, 'sine', 0.14, 320)
      break
    case 'coin':
      blip(context, output, start, 880, 0.08, 'triangle', 0.18)
      blip(context, output, start + 0.08, 1320, 0.16, 'triangle', 0.16)
      break
    case 'build':
      blip(context, output, start, 180, 0.22, 'triangle', 0.22, 90)
      blip(context, output, start + 0.05, 360, 0.1, 'square', 0.06)
      break
    case 'complete':
      blip(context, output, start, 523, 0.12, 'triangle', 0.16)
      blip(context, output, start + 0.1, 659, 0.12, 'triangle', 0.16)
      blip(context, output, start + 0.2, 784, 0.22, 'triangle', 0.16)
      break
    case 'hit':
      noise(context, output, start, 0.08, 0.12)
      blip(context, output, start, 160, 0.1, 'square', 0.1, 70)
      break
    case 'heal':
      blip(context, output, start, 520, 0.22, 'sine', 0.14, 780)
      break
    case 'victory':
      blip(context, output, start, 523, 0.12, 'triangle', 0.16)
      blip(context, output, start + 0.12, 659, 0.12, 'triangle', 0.16)
      blip(context, output, start + 0.24, 784, 0.12, 'triangle', 0.16)
      blip(context, output, start + 0.36, 1046, 0.24, 'triangle', 0.16)
      break
    case 'defeat':
      blip(context, output, start, 392, 0.16, 'sine', 0.14, 311)
      blip(context, output, start + 0.16, 311, 0.18, 'sine', 0.12, 220)
      blip(context, output, start + 0.34, 196, 0.24, 'triangle', 0.12)
      break
    case 'levelUp':
      blip(context, output, start, 392, 0.1, 'triangle', 0.16)
      blip(context, output, start + 0.1, 523, 0.1, 'triangle', 0.16)
      blip(context, output, start + 0.2, 659, 0.22, 'triangle', 0.18)
      break
    case 'notice':
      blip(context, output, start, 740, 0.08, 'sine', 0.12)
      blip(context, output, start + 0.09, 880, 0.12, 'sine', 0.1)
      break
    case 'depart':
      blip(context, output, start, 392, 0.12, 'sawtooth', 0.08)
      blip(context, output, start, 523, 0.18, 'triangle', 0.16)
      blip(context, output, start + 0.16, 659, 0.28, 'triangle', 0.16)
      break
    case 'return':
      blip(context, output, start, 494, 0.12, 'sine', 0.12)
      blip(context, output, start + 0.1, 392, 0.12, 'sine', 0.12)
      blip(context, output, start + 0.22, 523, 0.2, 'triangle', 0.14)
      break
    case 'wish':
      blip(context, output, start, 988, 0.06, 'triangle', 0.16)
      blip(context, output, start + 0.05, 1318, 0.08, 'triangle', 0.14)
      blip(context, output, start + 0.1, 1568, 0.14, 'sine', 0.12)
      break
    case 'jackpot':
      blip(context, output, start, 523, 0.1, 'triangle', 0.16)
      blip(context, output, start + 0.08, 659, 0.1, 'triangle', 0.16)
      blip(context, output, start + 0.16, 784, 0.1, 'triangle', 0.16)
      blip(context, output, start + 0.24, 1046, 0.12, 'triangle', 0.18)
      blip(context, output, start + 0.36, 1318, 0.28, 'triangle', 0.18)
      break
    default:
      break
  }
}

function blip(
  context: AudioContext,
  output: GainNode,
  start: number,
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  slideTo?: number,
) {
  const osc = context.createOscillator()
  const amp = context.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + dur)
  }
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.02, dur / 3))
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(amp)
  amp.connect(output)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

function noise(context: AudioContext, output: GainNode, start: number, dur: number, gain: number) {
  const length = Math.max(1, Math.floor(context.sampleRate * dur))
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  const source = context.createBufferSource()
  const amp = context.createGain()
  source.buffer = buffer
  amp.gain.setValueAtTime(gain, start)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  source.connect(amp)
  amp.connect(output)
  source.start(start)
  source.stop(start + dur)
}
