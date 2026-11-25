// Run: npx tsx tools/tavern-effects.ts
import { familyRules, lifeRules, retirementRules, timeRules } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon } from '../src/core/dungeon'
import { bondOf, nextAge } from '../src/core/family'
import { freshState, reduce, type GameState } from '../src/core/game'
import { forgeGear, recipeById } from '../src/core/gear'
import { heirloomMods } from '../src/core/heirloom'
import { createHero, generateHero } from '../src/core/hero'
import { moraleOf } from '../src/core/morale'
import { createRng } from '../src/core/rng'
import { gatherLeft } from '../src/core/tavern'
import type { ClassId, Gender, Hero, PersonalityId } from '../src/core/types'
import { starterParties } from './curve'

const hour = 3_600_000
const start = 1_700_000_000_000
const seeds = Array.from({ length: 40 }, (_, index) => index + 1)

function hero(seed: number, id: string, classId: ClassId, gender: Gender, personality: PersonalityId): Hero {
  return createHero({ ...generateHero(createRng(seed), id, 0, 0.5, classId), age: 24, gender, personality, level: 16, training: 15 })
}

function town(seed: number, level: number, roster: Hero[]): GameState {
  const base = freshState(seed, start)
  const state = { ...base, gold: 1000, roster, cleared: ['hill_cave'], buildings: { ...base.buildings, house: 2, tavern: level } }
  return roster.reduce((next, member) => reduce(next, { type: 'add', id: member.id }), state)
}

function tick(state: GameState, target: number): GameState {
  while (state.lastTickAt < target) state = reduce(state, { type: 'catchUp', now: Math.min(target, state.lastTickAt + timeRules.maxOfflineMs) })
  return state
}

function trip(state: GameState): GameState {
  const sent = reduce(state, { type: 'depart', presetId: state.presetId, confirm: true, now: state.lastTickAt })
  const expedition = sent.expeditions[0]
  if (!expedition) throw new Error(`Could not start trial trip: ${sent.notice}`)
  return tick(sent, expedition.returnAt)
}

function orderedPair(seed: number, match: boolean) {
  return [hero(seed, 'a', 'warrior', 'male', match ? 'social' : 'hotheaded'), hero(seed, 'b', 'cleric', 'female', match ? 'gentle' : 'timid')]
}

function rounds(state: GameState): GameState {
  while (gatherLeft(state) > 0) {
    const next = reduce(state, { type: 'gather', heroIds: ['a', 'b'] })
    if (next.notice) throw new Error(`Could not gather: ${next.notice}`)
    state = next
  }
  return state
}

function familyTrial(seed: number, match: boolean, useRounds: boolean) {
  let state = town(seed, 1, orderedPair(seed, match))
  let wedding: number | undefined
  let birth: number | undefined
  for (let season = 0; season < 16 && birth == null; season += 1) {
    if (useRounds) state = rounds(state)
    for (const offset of [2, 8, 14]) state = trip(tick(state, start + season * timeRules.seasonMs + offset * hour))
    state = tick(state, start + (season + 1) * timeRules.seasonMs)
    const proposal = state.proposals[0]
    if (wedding == null && proposal) {
      state = reduce(state, { type: 'acceptProposal', a: proposal.a, b: proposal.b, now: state.lastTickAt })
      if (state.roster[0]?.spouseId) wedding = (state.lastTickAt - start) / hour
    }
    if (state.roster.some(({ parents }) => parents?.includes('a') && parents.includes('b'))) birth = (state.lastTickAt - start) / hour
  }
  return { wedding, birth }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? +((sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.floor(sorted.length / 2)]!) / 2).toFixed(2) : '—'
}

console.log('Family: same 40 seeds and tavern Lv1, three cave trips per season, first proposal accepted, up to 16 seasons.')
console.table([true, false].flatMap((match) => {
  const control = seeds.map((seed) => familyTrial(seed, match, false))
  const hosted = seeds.map((seed) => familyTrial(seed, match, true))
  return (['wedding', 'birth'] as const).map((event) => {
    const times = (runs: typeof control) => runs.flatMap((run) => run[event] == null ? [] : [run[event]!])
    const paired = control.flatMap((run, index) => run[event] != null && hosted[index]![event] != null ? [run[event]! - hosted[index]![event]!] : [])
    return { pair: match ? 'compatible' : 'clashing', event, 'no rounds (h)': median(times(control)), 'all rounds (h)': median(times(hosted)), 'paired hours saved': median(paired), reached: `${times(control).length}/${times(hosted).length}` }
  })
}))

console.log('Tavern levels: one season boundary, spring festival and one cave victory measured independently.')
console.table([0, 1, 2, 3].map((level) => {
  const pair = orderedPair(5, true)
  const base = town(5, level, pair)
  const seasonal = tick({ ...base, calendar: { ...base.calendar, intoSeasonMs: timeRules.seasonMs - 1000 } }, start + 1000)
  const festival = reduce(base, { type: 'festival' })
  const fought = trip(festival)
  const gathering = rounds({ ...base, roster: base.roster.map((member) => ({ ...member, fatigue: 45 })) })
  let available = gathering
  const minute = 60_000
  while (available.roster.some((member) => member.fatigue >= lifeRules.fatigue.tiredAt)) available = tick(available, available.lastTickAt + minute)
  return {
    level,
    'season affinity': +bondOf(seasonal, 'a', 'b').toFixed(2),
    'spring winning trip affinity': +bondOf(fought, 'a', 'b').toFixed(2),
    'social festival morale gain': +(moraleOf(festival.roster[0]!) - moraleOf(pair[0]!)).toFixed(2),
    'all rounds gold': base.gold - gathering.gold,
    'gold left from 100': 100 - (base.gold - gathering.gold),
    'all rounds fatigue': gathering.roster[0]!.fatigue - 45,
    'minutes until below 50 fatigue': (available.lastTickAt - start) / minute,
  }
}))

const weapon = recipeById('flame.blade')!
const armor = recipeById('fine.mail')!
const parties = starterParties(40)
console.log('Heirlooms: same two items and hero stats in each condition; 400 paired battles per cell.')
console.table([
  { dungeon: 'abandoned_mine', level: 1 },
  { dungeon: 'barrow', level: 3 },
  { dungeon: 'sunken_crypt', level: 5 },
  { dungeon: 'venom_marsh', level: 8 },
  { dungeon: 'haunted_citadel', level: 11 },
].map(({ dungeon, level }) => {
  const rates = [0, 1, 2, 3].map((generations) => {
    let wins = 0
    const heirloom = generations ? { ownerId: 'ancestor', ownerName: 'Ancestor', generations } : undefined
    for (const [index, members] of parties.entries()) {
      const prepared = members.map(({ hero: member, row }) => ({
        row,
        hero: createHero({ ...member, level, training: level - 1, parents: ['ancestor', 'other'], gear: [
          { ...forgeGear(weapon, `${member.id}-blade`), heirloom },
          { ...forgeGear(armor, `${member.id}-armor`), heirloom },
        ] }),
      }))
      const state = town(index, 0, prepared.map(({ hero: wearer }) => wearer))
      const party = prepared.map((member) => ({ ...member, heirloom: heirloomMods(state, member.hero) }))
      for (let battle = 0; battle < 10; battle += 1) {
        const result = runDungeon(party, dungeon, DEFAULT_TACTICS, index * 10 + battle + 1)
        if (result.ok && result.report.victory) wins += 1
      }
    }
    return 100 * wins / (parties.length * 10)
  })
  return { dungeon, level, plain: rates[0], '+6%': rates[1], '+9%': rates[2], '+12%': rates[3] }
}))

function yearsToRetire(age: number) {
  let years = 0
  for (let current = age; current < retirementRules.minAge; current = nextAge(current)) years += 1
  return years
}

console.log('Generation estimate: founder is 20 at year 0; child, grandchild and great-grandchild are born at years 0, 10 and 20.')
const retirements = [yearsToRetire(20), yearsToRetire(0), 10 + yearsToRetire(0)]
const lineage = Array.from({ length: 4 }, (_, index) => createHero({
  ...hero(5, `line-${index}`, 'warrior', 'male', 'social'),
  age: retirementRules.minAge,
  ...(index > 0 ? { parents: [`line-${index - 1}`, `other-${index}`] as [string, string] } : {}),
  ...(index === 0 ? { gear: [forgeGear(weapon, 'lineage-blade')] } : {}),
}))
let line = town(5, 0, lineage)
for (let index = 0; index < retirements.length; index += 1) {
  line = reduce(line, { type: 'retire', id: lineage[index]!.id })
  line = reduce(line, { type: 'bequeath', retireeId: lineage[index]!.id, gearId: 'lineage-blade', toId: lineage[index + 1]!.id })
  const recipient = line.roster.find(({ id }) => id === lineage[index + 1]!.id)
  if (recipient?.gear.find(({ id }) => id === 'lineage-blade')?.heirloom?.generations !== index + 1) throw new Error('Unexpected inheritance generation')
}
console.table(retirements.map((year, index) => ({
  generation: index + 1, 'elapsed game years': year, 'elapsed real days': year * timeRules.seasonMs * timeRules.seasons.length / (24 * hour),
})))
console.log(`Child growth changes at age ${familyRules.adultAge}; all three predecessors retire and pass the same item to the next descendant.`)
