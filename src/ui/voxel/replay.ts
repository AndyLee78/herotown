import type { AffixId, DungeonReport, LogEntry, ReplayUnit } from '../../core'

// Turns a dungeon report's log into steps a 3D replay can play one by one.
// Pure data, so it can be tested without WebGL.

export type Hit = { targetId: string; amount: number; absorbed?: number; crit?: boolean }

export type StatusMark = 'poison' | 'paralyze' | 'slow' | 'silence'

type Base = { log: number; downs: string[] }

export type ReplayStep =
  | (Base & { type: 'floor'; floor: number; units: ReplayUnit[]; affixes?: AffixId[] })
  | (Base & { type: 'attack'; actorId: string; hits: Hit[]; counter?: boolean })
  | (Base & { type: 'heal'; actorId: string; targetId: string; amount: number })
  | (Base & { type: 'taunt' | 'buff' | 'debuff'; actorId: string })
  | (Base & { type: 'dot'; targetId: string; amount: number })
  | (Base & { type: 'burn'; targetId: string; amount: number })
  | (Base & { type: 'status'; targetId: string; status: StatusMark; on: boolean })
  | (Base & { type: 'potion'; actorId: string; potion: string })
  | (Base & { type: 'trap' })
  | (Base & { type: 'trapHit'; targetId: string; amount: number })
  | (Base & { type: 'disarm'; actorId: string })
  | (Base & { type: 'alert'; actorId: string })
  | (Base & { type: 'ambush'; actorId: string; targetId: string; amount: number })
  | (Base & { type: 'charge'; actorId: string })
  | (Base & { type: 'blast'; actorId: string; hits: Hit[] })
  | (Base & { type: 'interrupt'; actorId: string; targetId: string })
  | (Base & { type: 'brace'; actorId: string })
  | (Base & { type: 'phase'; actorId: string; phase: number })
  | (Base & { type: 'summon'; actorId: string; units: string[]; refs: string[]; hps: number[] })
  | (Base & { type: 'volley'; actorId: string })
  | (Base & { type: 'weaken'; targetId: string })
  | (Base & { type: 'cleanse'; targetId: string })
  | (Base & { type: 'miss'; actorId: string; targetId: string })
  | (Base & { type: 'thorns'; actorId: string; targetId: string; amount: number })
  | (Base & { type: 'twin'; actorId: string })
  | (Base & { type: 'enrage' | 'purge' | 'undying' | 'guardian'; actorId: string })
  | (Base & { type: 'revive'; actorId: string; targetId: string })
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
  let pendingCrit = false
  let pendingCounter = false
  report.log.forEach((entry, index) => {
    const previous = steps[steps.length - 1]
    const actorId = text(entry, 'actorId')
    const targetId = text(entry, 'targetId')
    const amount = number(entry, 'amount')
    const absorbed = number(entry, 'absorbed') || undefined
    switch (entry.key) {
      case 'log.floor': {
        const floor = number(entry, 'floor')
        const affixes = report.affixes?.length ? report.affixes : undefined
        steps.push({ type: 'floor', floor, units: floors[floor - 1] ?? [], affixes, log: index, downs: [] })
        break
      }
      case 'log.crit':
        // Marks the next blow from this actor on this tick as a critical hit.
        pendingCrit = true
        break
      case 'log.counter':
        // The next strike is a retaliate; fold the flag into that attack step.
        pendingCounter = true
        break
      case 'log.attack': {
        const hit: Hit = {
          targetId,
          amount,
          ...(absorbed ? { absorbed } : {}),
          ...(pendingCrit ? { crit: true } : {}),
        }
        pendingCrit = false
        // An ambush logs first, then the strike; fold the damage into that step.
        if (previous?.type === 'ambush' && previous.actorId === actorId && previous.targetId === targetId && entry.tick === lastTick) {
          previous.amount = amount
          previous.log = index
          pendingCounter = false
          break
        }
        // A blast logs first, then one attack per hero on the same tick.
        if (previous?.type === 'blast' && previous.actorId === actorId && entry.tick === lastTick) {
          previous.hits.push(hit)
          previous.log = index
          pendingCounter = false
          break
        }
        // One actor hitting several targets on the same tick is an area attack.
        if (previous?.type === 'attack' && previous.actorId === actorId && entry.tick === lastTick && !pendingCounter) {
          previous.hits.push(hit)
          previous.log = index
        } else {
          steps.push({
            type: 'attack',
            actorId,
            hits: [hit],
            ...(pendingCounter ? { counter: true } : {}),
            log: index,
            downs: [],
          })
        }
        pendingCounter = false
        break
      }
      case 'log.miss':
        steps.push({ type: 'miss', actorId, targetId, log: index, downs: [] })
        pendingCrit = false
        pendingCounter = false
        break
      case 'log.thorns':
        steps.push({ type: 'thorns', actorId, targetId, amount, log: index, downs: [] })
        break
      case 'log.twin':
        steps.push({ type: 'twin', actorId, log: index, downs: [] })
        break
      case 'log.enrage':
      case 'log.purge':
      case 'log.undying':
      case 'log.guardian':
        steps.push({ type: entry.key.slice(4) as 'enrage' | 'purge' | 'undying' | 'guardian', actorId, log: index, downs: [] })
        break
      case 'log.revive':
        steps.push({ type: 'revive', actorId, targetId, log: index, downs: [] })
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
      case 'log.burn':
        steps.push({ type: 'burn', targetId: actorId, amount, log: index, downs: [] })
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
      case 'log.trap':
        steps.push({ type: 'trap', log: index, downs: [] })
        break
      case 'log.trapHit':
        steps.push({ type: 'trapHit', targetId: actorId, amount, log: index, downs: [] })
        break
      case 'log.disarm':
        steps.push({ type: 'disarm', actorId, log: index, downs: [] })
        break
      case 'log.alert':
        steps.push({ type: 'alert', actorId, log: index, downs: [] })
        break
      case 'log.ambush':
        steps.push({ type: 'ambush', actorId, targetId, amount: 0, log: index, downs: [] })
        break
      case 'log.charge':
        steps.push({ type: 'charge', actorId, log: index, downs: [] })
        break
      case 'log.blast':
        steps.push({ type: 'blast', actorId, hits: [], log: index, downs: [] })
        break
      case 'log.interrupt':
        steps.push({ type: 'interrupt', actorId, targetId, log: index, downs: [] })
        break
      case 'log.brace':
        steps.push({ type: 'brace', actorId, log: index, downs: [] })
        break
      case 'log.phase':
        steps.push({ type: 'phase', actorId, phase: number(entry, 'phase'), log: index, downs: [] })
        break
      case 'log.summon': {
        const units = text(entry, 'units')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
        const refs = text(entry, 'refs')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
        // Real health of each summoned unit; missing on reports made before 3c fixes.
        const hps = text(entry, 'hps')
          .split(',')
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
        steps.push({ type: 'summon', actorId, units, refs, hps, log: index, downs: [] })
        break
      }
      case 'log.down':
        if (previous) {
          previous.downs.push(actorId)
          previous.log = index
        }
        break
      case 'log.volley':
        steps.push({ type: 'volley', actorId, log: index, downs: [] })
        break
      case 'log.weaken':
        steps.push({ type: 'weaken', targetId, log: index, downs: [] })
        break
      case 'log.cleanse':
        steps.push({ type: 'cleanse', targetId, log: index, downs: [] })
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
