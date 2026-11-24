// A fixed lineup for comparison and starter lineups drawn from the real game.
import { classById, combatRules, nestRules, progression } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon } from '../src/core/dungeon'
import { freshState, presetById, reduce } from '../src/core/game'
import { createHero, generateHero } from '../src/core/hero'
import { createRng } from '../src/core/rng'
import { AFFIX_IDS } from '../src/core/nest'
import type { AffixId, ClassId, Hero, PartyMember, Row, Supplies, Tactics, TrinketId } from '../src/core/types'

const LINEUP: [ClassId, Row][] = [
  ['warrior', 'front'],
  ['rogue', 'front'],
  ['archer', 'back'],
  ['mage', 'back'],
  ['cleric', 'back'],
]

export const DEFAULT_PARTY_SAMPLES = 40
export const BATTLES_PER_PARTY = 10
export const MARSH_ID = 'venom_marsh'
type Loadout = { supplies: Supplies; withoutHealer?: boolean; prepare?: (party: PartyMember[]) => PartyMember[]; blast?: Tactics['blast']; affixes?: AffixId[]; prepareNest?: boolean }
export const FORT_ID = 'bandit_fort'
export const CITADEL_ID = 'haunted_citadel'
export const NEST_ID = 'dragon_nest'
export const nestPairs = AFFIX_IDS.flatMap((a, index) => AFFIX_IDS.slice(index + 1).map((b): AffixId[] => [a, b]))

export function nestPreparation(party: Hero[], affixes: readonly AffixId[]) {
  const tank = party.find((hero) => classById(hero.classId).role === 'tank') ?? party[0]
  const healer = party.find((hero) => classById(hero.classId).role === 'healer') ?? tank
  const trinkets: { id: TrinketId; heroId: string }[] = []
  const equip = (id: TrinketId, hero: Hero | undefined) => { if (hero) trinkets.push({ id, heroId: hero.id }) }
  const supplies: Supplies = {}
  for (const affix of affixes) {
    if (affix === 'venom') { supplies.antidote = 3; equip('poisonWard', tank) }
    if (affix === 'traps' && !party.some((hero) => hero.classId === 'rogue')) equip('trapSense', tank)
    if (affix === 'ambush') equip('alert', tank)
    if (affix === 'silence') { supplies.clarity = 3; equip('calm', healer) }
    if (affix === 'paralyze') { supplies.tonic = 3; equip('steady', tank) }
    if (affix === 'noRest') supplies.heal = 3
  }
  const breakers = party.filter((hero) => classById(hero.classId).interrupt).length
  const blast: Tactics['blast'] = affixes.includes('charged') && breakers < 2 ? 'brace' : 'interrupt'
  return { supplies, trinkets, blast }
}

export const citadelLoadouts = Object.fromEntries([0, 1, 2].flatMap((extra) =>
  (['interrupt', 'brace'] as const).map((blast): [string, Loadout] => [`extra${extra}-${blast}`, {
    supplies: {},
    blast,
    prepare(party) {
      // Pair the same stat/trait samples, keeping a tank, a healer and three damage dealers.
      const warrior = party.find(({ hero }) => hero.classId === 'warrior')!
      const cleric = party.find(({ hero }) => hero.classId === 'cleric')!
      const damage = party.filter((member) => member !== warrior && member !== cleric)
      return [warrior, cleric, ...damage.map((member, index) => {
        const classId = index < extra ? (index === 0 ? 'rogue' : 'archer') : 'mage'
        return { hero: createHero({ ...member.hero, classId }), row: index === 0 ? 'front' as const : 'back' as const }
      })]
    },
  }]),
))

function wear(member: PartyMember, ids: readonly TrinketId[]): PartyMember {
  const gear = ids.map((id) => ({ id: `${member.hero.id}-${id}`, recipeId: `trinket.${id}`, slot: 'trinket' as const, grade: 'common' as const, enhance: 0 }))
  return { ...member, hero: createHero({ ...member.hero, gear: [...member.hero.gear, ...gear] }) }
}

export function fortLoadout(rogue: boolean, trinkets: readonly TrinketId[]): Loadout {
  return { supplies: {}, prepare(party) {
    // Keep the same hero draws in each pair; ensure the remaining slots are damage dealers.
    const existingRogue = party.findIndex(({ hero }) => hero.classId === 'rogue')
    const recruit = existingRogue >= 0 ? existingRogue : party.findIndex(({ hero }) => classById(hero.classId).role === 'dps')
    let keptWarrior = false
    let keptCleric = false
    let front = 0
    let back = 0
    const heroes = party.map(({ hero }, index) => {
      let classId = hero.classId
      if (classId === 'warrior' && !keptWarrior) keptWarrior = true
      else if (classId === 'cleric' && !keptCleric) keptCleric = true
      else if (rogue && index === (recruit < 0 ? 2 : recruit)) classId = 'rogue'
      else if (classId === 'rogue' || classById(classId).role !== 'dps') classId = 'archer'
      const frontRow = classById(classId).reach === 'melee' ? front < combatRules.frontRowSize : back >= combatRules.backRowSize
      if (frontRow) front += 1
      else back += 1
      return { hero: createHero({ ...hero, classId }), row: frontRow ? 'front' as const : 'back' as const }
    })
    return heroes.map((member, index) => index === heroes.length - 1 ? wear(member, trinkets) : member)
  } }
}

export const fortLoadouts = Object.fromEntries([false, true].flatMap((rogue) =>
  ([['none', []], ['alert', ['alert']], ['both', ['alert', 'trapSense']]] as const)
    .map(([name, trinkets]) => [`${rogue ? 'rogue' : 'noRogue'}-${name}`, fortLoadout(rogue, trinkets)]),
))

export function wardLoadout(count: number): Loadout {
  return { supplies: {}, prepare(party) {
    const carriers = [...party].sort((a, b) => Number(b.hero.classId === 'warrior') - Number(a.hero.classId === 'warrior')
      || Number(b.row === 'front') - Number(a.row === 'front')).slice(0, count)
    return party.map((member) => carriers.includes(member) ? wear(member, ['poisonWard']) : member)
  } }
}
export const marshLoadouts = {
  none: { supplies: {} },
  antidote2: { supplies: { antidote: 2 } },
  mixed: { supplies: { heal: 2, antidote: 2 } },
  noHealer: { supplies: { heal: 4, antidote: 1 }, withoutHealer: true },
  antidote4: { supplies: { antidote: 4 } },
} satisfies Record<string, Loadout>

export function starterParties(samples: number): PartyMember[][] {
  return Array.from({ length: samples }, (_, index) => {
    const initial = freshState(index + 1, 0)
    const heroes = initial.visitors.slice(0, 5)
    // Use the actual preset row assignment; sampling does not depend on hire costs.
    let state = { ...initial, roster: heroes }
    for (const hero of heroes) state = reduce(state, { type: 'add', id: hero.id })
    const slots = presetById(state, state.presetId)?.slots ?? []
    return heroes.map((hero, slot) => ({ hero, row: slots[slot]!.row }))
  })
}

// A typical hire for each class: the first visitor of that class from fixed seeds.
function typicalParty(sample: number): Hero[] {
  return LINEUP.map(([classId], slot) => {
    for (let seed = sample * 1000 + slot * 97; ; seed += 1) {
      const hero = generateHero(createRng(seed), `c${slot}-${seed}`, 0)
      if (hero.classId === classId) {
        return hero
      }
    }
  })
}

function partyAtLevel(party: PartyMember[], level: number): PartyMember[] {
  return party.map(({ hero, row }) => ({
    row,
    hero: createHero({ ...hero, level, training: (level - 1) * progression.trainingPerLevel }),
  }))
}

export function winRate(dungeonId: string, level: number, samples: number): number {
  let wins = 0
  for (let sample = 0; sample < samples; sample += 1) {
    const party = typicalParty(sample).map((hero, index) => ({ hero, row: LINEUP[index]![1] }))
    const result = runDungeon(partyAtLevel(party, level), dungeonId, DEFAULT_TACTICS, sample + 1)
    if (result.ok && result.report.victory) {
      wins += 1
    }
  }
  return wins / samples
}

export function starterWinRates(parties: PartyMember[][], dungeonId: string, level: number, loadout?: Loadout, battles = BATTLES_PER_PARTY) {
  const defeats: Record<string, number> = {}
  let charges = 0
  let interrupts = 0
  const tactics = loadout?.blast ? { ...DEFAULT_TACTICS, blast: loadout.blast } : DEFAULT_TACTICS
  const outcomes = parties.map((party, index) => {
    let prepared = loadout?.prepare?.(party) ?? party
    if (loadout?.prepareNest && loadout.affixes?.includes('swift')) {
      const alternatives = parties[(index + 1) % parties.length]!
      const recruited = new Set<string>()
      prepared = prepared.map((member) => {
        const faster = alternatives.find(({ hero }) => hero.classId === member.hero.classId
          && hero.stats.agi > member.hero.stats.agi && !recruited.has(hero.id))
        if (!faster) return member
        recruited.add(faster.hero.id)
        return { ...member, hero: { ...faster.hero, id: member.hero.id } }
      })
    }
    const plan = loadout?.prepareNest && loadout.affixes ? nestPreparation(prepared.map(({ hero }) => hero), loadout.affixes) : undefined
    if (plan) prepared = prepared.map((member) => wear(member, plan.trinkets.filter(({ heroId }) => heroId === member.hero.id).map(({ id }) => id)))
    const lineup = loadout?.withoutHealer ? prepared.filter(({ hero }) => classById(hero.classId).role !== 'healer') : prepared
    const leveled = partyAtLevel(lineup, level)
    const chosenTactics = plan ? { ...tactics, blast: plan.blast } : tactics
    let wins = 0
    for (let seed = 1; seed <= battles; seed += 1) {
      const variant = loadout?.affixes ? {
        affixes: loadout.affixes,
        floors: nestRules.floors.map((options, floor) => ({ monsters: options[(index + (seed - 1) * (floor + 1) + floor) % options.length]! })),
      } : undefined
      const result = runDungeon(leveled, dungeonId, chosenTactics, seed, plan?.supplies ?? loadout?.supplies, variant)
      if (result.ok && loadout?.blast) {
        for (const { key } of result.report.log) {
          if (key === 'log.charge') charges += 1
          if (key === 'log.interrupt') interrupts += 1
        }
      }
      if (result.ok && result.report.victory) wins += 1
      else {
        const reason = result.ok ? result.report.defeatReason ?? 'unknown' : result.error
        defeats[reason] = (defeats[reason] ?? 0) + 1
      }
    }
    return { partySeed: index + 1, classes: lineup.map(({ hero }) => hero.classId), rate: wins / battles }
  }).sort((a, b) => a.rate - b.rate)
  const middle = Math.floor(outcomes.length / 2)
  const lowerMiddle = Math.floor((outcomes.length - 1) / 2)
  return {
    median: (outcomes[lowerMiddle]!.rate + outcomes[middle]!.rate) / 2,
    lowerQuartile: outcomes[Math.ceil(outcomes.length / 4) - 1]!.rate,
    weakest: outcomes[0]!,
    defeats,
    charges,
    interrupts,
  }
}
