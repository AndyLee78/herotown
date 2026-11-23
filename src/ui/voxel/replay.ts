import type { DungeonReport, LogEntry, ReplayUnit } from '../../core'

// Turns a dungeon report's log into steps a 3D replay can play one by one.
// Pure data, so it can be tested without WebGL.

export type Hit = { targetId: string; amount: number }

export type StatusMark = 'poison' | 'paralyze' | 'slow' | 'silence'

type Base = { log: number; downs: string[] }

export type ReplayStep =
  | (Base & { type: 'floor'; floor: number; units: ReplayUnit[] })
  | (Base & { type: 'attack'; actorId: string; hits: Hit[] })
  | (Base & { type: 'heal'; actorId: string; targetId: string; amount: number })
  | (Base & { type: 'taunt' | 'buff' | 'debuff'; actorId: string })
  | (Base & { type: 'dot'; targetId: string; amount: number })
  | (Base & { type: 'status'; targetId: string; status: StatusMark; on: boolean })
  | (Base & { type: 'potion'; actorId: string; potion: string })
  | (Base & { type: 'clear'; floor: number })
  | (Base & { type: 'retreat' })
  | (Base & { type: 'end'; victory: boolean })

export function canReplay(report: DungeonReport): boolean {
  return Boolean(report.floors?.length && report.party?.length && report.log.some((entry) => typeof entry.params.actorId === 'string'))
}

export function buildSteps(report: DungeonReport): ReplayStep[] {
  const steps: ReplayStep[] = []
  const floors = report.floors ?? []
  let lastTick = -1
  report.log.forEach((entry, index) => {
    const previous = steps[steps.length - 1]
    const actorId = text(entry, 'actorId')
    const targetId = text(entry, 'targetId')
    const amount = number(entry, 'amount')
    switch (entry.key) {
      case 'log.floor': {
        const floor = number(entry, 'floor')
        steps.push({ type: 'floor', floor, units: floors[floor - 1] ?? [], log: index, downs: [] })
        break
      }
      case 'log.attack':
        // One actor hitting several targets on the same tick is an area attack.
        if (previous?.type === 'attack' && previous.actorId === actorId && entry.tick === lastTick) {
          previous.hits.push({ targetId, amount })
          previous.log = index
        } else {
          steps.push({ type: 'attack', actorId, hits: [{ targetId, amount }], log: index, downs: [] })
        }
        break
      case 'log.heal':
        steps.push({ type: 'heal', actorId, targetId, amount, log: index, downs: [] })
        break
      case 'log.taunt':
      case 'log.buff':
      case 'log.debuff':
        steps.push({ type: entry.key.slice(4) as 'taunt' | 'buff' | 'debuff', actorId, log: index, downs: [] })
        break
      case 'log.dot':
        steps.push({ type: 'dot', targetId: actorId, amount, log: index, downs: [] })
        break
      case 'log.paralyze':
        steps.push({ type: 'status', targetId, status: 'paralyze', on: true, log: index, downs: [] })
        break
      case 'log.paralyzed':
        steps.push({ type: 'status', targetId: actorId, status: 'paralyze', on: false, log: index, downs: [] })
        break
      case 'log.slow':
        steps.push({ type: 'status', targetId, status: 'slow', on: true, log: index, downs: [] })
        break
      case 'log.silence':
        steps.push({ type: 'status', targetId, status: 'silence', on: true, log: index, downs: [] })
        break
      case 'log.potion':
        steps.push({ type: 'potion', actorId, potion: text(entry, 'potion'), log: index, downs: [] })
        break
      case 'log.down':
        if (previous) {
          previous.downs.push(actorId)
          previous.log = index
        }
        break
      case 'log.floorClear':
        steps.push({ type: 'clear', floor: number(entry, 'floor'), log: index, downs: [] })
        break
      case 'log.retreat':
        steps.push({ type: 'retreat', log: index, downs: [] })
        break
      case 'log.victory':
        steps.push({ type: 'end', victory: true, log: index, downs: [] })
        break
      case 'log.defeat':
        steps.push({ type: 'end', victory: false, log: index, downs: [] })
        break
      default:
        break
    }
    lastTick = entry.tick
  })
  const last = steps[steps.length - 1]
  if (last && last.type !== 'end') {
    steps.push({ type: 'end', victory: report.victory, log: report.log.length - 1, downs: [] })
  }
  return steps
}

function text(entry: LogEntry, key: string): string {
  const value = entry.params[key]
  return typeof value === 'string' ? value : ''
}

function number(entry: LogEntry, key: string): number {
  const value = entry.params[key]
  return typeof value === 'number' ? value : 0
}
