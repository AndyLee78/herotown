import { townLevelOf } from '../src/core/game'
import { simulateVillage } from './village-balance'

const grades = ['common', 'fine', 'rare', 'epic', 'legend'] as const
const rows = [2, 3, 4].flatMap((seed) => {
  const { state: initial } = simulateVillage(seed, 65, 10, true, true)
  if (townLevelOf(initial).level < 10) {
    console.log('Lv10 not reached in 65 days:', seed)
    return []
  }
  return (['control', 'xp'] as const).map((option) => {
    const { late } = simulateVillage(seed, 65, undefined, true, true, 30, { initial, option }, true)
    if (!late?.studyLevels.length) throw new Error('Missing tracked party')
    const gear = late.acquired
    const row = { seed, option, levels: late.studyLevels.reduce((sum, n) => sum + n, 0) / late.studyLevels.length,
      gold: late.income.gold ?? 0, finalGold: late.final.gold, unique: gear.filter((item) => item.unique).length,
      ...Object.fromEntries(grades.map((grade) => [grade, gear.filter((item) => item.grade === grade).length])) }
    console.log(JSON.stringify(row))
    return row
  })
})
if (!rows.length) throw new Error('No completed pairs')
