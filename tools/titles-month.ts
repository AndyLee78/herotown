import { simulateVillage } from './village-balance'
import { townLevelOf } from '../src/core/game'

const seed = Number(process.argv[2] ?? 2)
const { state: initial } = simulateVillage(seed, 65, 10, true, true)
function summary(state: typeof initial) {
  const people = [...state.roster, ...state.retirees.map(r => r.hero), ...state.graveyard]
  return { day: (state.lastTickAt - 1700000000000) / 86400000, town: townLevelOf(state).level,
    titled: people.filter(h => h.titles?.length).length,
    first: Math.min(...people.flatMap(h => Object.values(h.titleDates ?? {}))),
    leaders: people.sort((a,b) => (b.deeds?.wins ?? 0) - (a.deeds?.wins ?? 0)).slice(0, 5).map(h => h.deeds) }
}
console.log('Lv10', JSON.stringify(summary(initial)))
if (townLevelOf(initial).level >= 10) {
  const { state } = simulateVillage(seed, 65, undefined, true, true, 30, { initial, option: 'control' }, true)
  console.log('Month', JSON.stringify(summary(state)))
}
