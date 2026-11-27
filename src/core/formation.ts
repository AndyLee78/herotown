import { classById, combatRules, dungeonById } from './data'
import type { PartySlot } from './game'
import { canDeploy } from './hero'
import type { Hero, Role } from './types'

const preferredRoles: readonly Role[] = ['tank', 'dps', 'dps', 'support', 'healer']

function frontPriority(hero: Hero): number {
  const { role, reach } = classById(hero.classId)
  if (role === 'tank') return 0
  if (role === 'healer' || role === 'support') return 3
  return reach === 'melee' ? 1 : 2
}

export function autoFormation(roster: readonly Hero[], busy: ReadonlySet<string>, dungeonId?: string): PartySlot[] {
  const recommended = dungeonId ? dungeonById(dungeonId).recommendedLevel : 0
  const available = roster
    .filter((hero) => canDeploy(hero) && hero.condition !== 'critical' && !busy.has(hero.id))
    .sort((a, b) => Number(b.level >= recommended) - Number(a.level >= recommended) || b.level - a.level || a.fatigue - b.fatigue)
  const selected: Hero[] = []
  for (const role of preferredRoles.slice(0, combatRules.maxParty)) {
    const index = available.findIndex(({ classId }) => classById(classId).role === role)
    if (index >= 0) selected.push(available.splice(index, 1)[0]!)
  }
  selected.push(...available.slice(0, combatRules.maxParty - selected.length))

  // Keep healers and supports behind attackers when a ranged hero must fill the front.
  const rowOrder = [...selected].sort((a, b) => frontPriority(a) - frontPriority(b))
  const preferredFrontSize = selected.filter((hero) => frontPriority(hero) < 2).length
  const frontSize = Math.min(combatRules.frontRowSize, Math.max(preferredFrontSize, selected.length - combatRules.backRowSize))
  const front = new Set(rowOrder.slice(0, frontSize).map(({ id }) => id))
  return selected.map(({ id }) => ({ id, row: front.has(id) ? 'front' : 'back' }))
}
