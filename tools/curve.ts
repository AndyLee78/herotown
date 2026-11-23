// A fixed lineup for comparison and starter lineups drawn from the real game.
import { classById, progression } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon } from '../src/core/dungeon'
import { freshState, presetById, reduce } from '../src/core/game'
import { createHero, generateHero } from '../src/core/hero'
import { createRng } from '../src/core/rng'
import type { ClassId, Hero, PartyMember, Row, Supplies } from '../src/core/types'

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
type Loadout = { supplies: Supplies; withoutHealer?: boolean }
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
  const outcomes = parties.map((party, index) => {
    const lineup = loadout?.withoutHealer ? party.filter(({ hero }) => classById(hero.classId).role !== 'healer') : party
    const leveled = partyAtLevel(lineup, level)
    let wins = 0
    for (let seed = 1; seed <= battles; seed += 1) {
      const result = runDungeon(leveled, dungeonId, DEFAULT_TACTICS, seed, loadout?.supplies)
      if (result.ok && result.report.victory) wins += 1
    }
    return { partySeed: index + 1, classes: lineup.map(({ hero }) => hero.classId), rate: wins / battles }
  }).sort((a, b) => a.rate - b.rate)
  const middle = Math.floor(outcomes.length / 2)
  const lowerMiddle = Math.floor((outcomes.length - 1) / 2)
  return {
    median: (outcomes[lowerMiddle]!.rate + outcomes[middle]!.rate) / 2,
    lowerQuartile: outcomes[Math.ceil(outcomes.length / 4) - 1]!.rate,
    weakest: outcomes[0]!,
  }
}
