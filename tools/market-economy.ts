// Run: npx tsx tools/market-economy.ts
import { marketRules, smithRules, villageRules } from '../src/core/data'
import { freshState, reduce, townLevel, type BuildingId, type GameAction, type GameState, type MaterialName } from '../src/core/game'
import { canDeploy, createHero, generateHero } from '../src/core/hero'
import { MARKET_MATERIALS, buyQuote, merchantHere, seasonDeal, sellQuote } from '../src/core/market'
import { createRng } from '../src/core/rng'
import type { ClassId } from '../src/core/types'

const minute = 60_000
const start = 1_700_000_000_000
const horizon = 12 * 60
const seeds = Array.from({ length: 20 }, (_, index) => index + 1)
const campaign = ['deep_shaft', 'barrow', 'sunken_crypt', 'venom_marsh']
const sources: Record<MaterialName, string> = {
  wood: 'hill_cave', stone: 'deep_shaft', iron: 'abandoned_mine',
  bone: 'barrow', herb: 'moss_path', crystal: 'sunken_crypt',
}
type Cost = { gold: number } & Partial<Record<MaterialName, number>>

function initial(seed: number, market: boolean): GameState {
  const base = freshState(seed, start)
  const classes: ClassId[] = ['warrior', 'cleric', 'rogue', 'archer', 'mage']
  const roster = classes.map((klass, index) => createHero({
    ...generateHero(createRng(seed * 1009 + index), `h${index}`, 20, 0.5, klass),
    level: 10, training: 9,
  }))
  const town: GameState = {
    ...base, gold: 220, fame: 40, roster, visitors: [],
    cleared: ['hill_cave', 'moss_path', 'abandoned_mine'],
    materials: { wood: 8, stone: 5, iron: 0, bone: 24, herb: 12, crystal: 2 },
    buildings: { ...base.buildings, smith: 1, market: Number(market) },
  }
  return roster.reduce((state, hero) => reduce(state, { type: 'add', id: hero.id }), town)
}

function restock(state: GameState, cost: Cost) {
  const deficits = MARKET_MATERIALS.map((material) => ({
    material, count: Math.max(0, (cost[material] ?? 0) - state.materials[material]),
  })).filter(({ count }) => count > 0)
  let next = state
  let proceeds = 0
  let spent = 0
  const required = cost.gold + deficits.reduce((sum, { material, count }) => sum + buyQuote(state, material, count), 0)
  if (state.gold < required) {
    for (const material of MARKET_MATERIALS) {
      const surplus = Math.min(marketRules.maxTrade, next.materials[material] - Math.max(20, cost[material] ?? 0))
      if (surplus <= 0) continue
      // Sell the least that covers the shortfall, or the available surplus.
      let count = 1
      while (count < surplus && next.gold + sellQuote(next, material, count) < required) count += 1
      const sold = reduce(next, { type: 'trade', material, amount: -count })
      proceeds += sold.gold - next.gold
      next = sold
      if (next.gold >= required) break
    }
  }
  if (next.gold >= required) {
    for (const { material, count } of deficits) {
      const bought = reduce(next, { type: 'trade', material, amount: count })
      spent += next.gold - bought.gold
      next = bought
    }
  }
  return { state: next, proceeds, spent }
}

const projects = [
  { building: 'smith', level: 2 }, { building: 'alchemy', level: 1 },
  { building: 'smith', level: 3 }, { building: 'magic', level: 1 },
] as const satisfies { building: BuildingId; level: number }[]
const recipes = ['fine.blade', 'flame.blade']
const step = 10_000

function simulate(seed: number, market: boolean) {
  let state = initial(seed, market)
  const times: Record<string, number> = {}
  let purchases = 0
  let sales = 0
  let trips = 0
  for (let now = start; now <= start + horizon * minute; now += step) {
    state = reduce(state, { type: 'catchUp', now })
    const elapsed = (now - start) / minute
    const town = townLevel(state.fame).level
    for (const level of [4, 5]) if (town >= level) times[`town ${level}`] ??= elapsed
    for (const { building, level } of projects) if (state.buildings[building] >= level) times[`${building} ${level}`] ??= elapsed
    for (const id of recipes) if (state.stash.some((gear) => gear.recipeId === id)) times[id] ??= elapsed
    const project = projects.find(({ building, level }) => state.buildings[building] < level)
    const recipe = smithRules.recipes.find(({ id, smithLevel }) => recipes.includes(id) && !state.stash.some((gear) => gear.recipeId === id) && smithLevel <= state.buildings.smith)
    if (!project && recipes.every((id) => times[id] != null) && town >= 5) break
    let shortage: MaterialName | undefined
    const attempt = (cost: Cost, action: GameAction) => {
      if (market) {
        const stock = restock(state, cost)
        purchases += stock.spent
        sales += stock.proceeds
        state = stock.state
      }
      const next = reduce(state, action)
      if (next.notice) shortage ??= MARKET_MATERIALS.find((id) => state.materials[id] < (cost[id] ?? 0))
      else state = next
    }
    if (project && !state.construction) {
      const building = villageRules.buildings.find(({ id }) => id === project.building)!
      const cost = building.levels.find(({ level }) => level === project.level)!
      if (town >= building.unlockLevel) attempt(cost, { type: 'build', id: project.building, now })
    }
    if (recipe && !state.smith) attempt(recipe, { type: 'craft', recipeId: recipe.id, now })
    const deployable = state.roster.filter(canDeploy)
    if (!state.expeditions.length && deployable.length && !deployable.some(({ condition }) => condition === 'injured' || condition === 'critical')) {
      const nextDungeon = campaign.find((id) => !state.cleared.includes(id))
      const averageLevel = deployable.reduce((sum, hero) => sum + hero.level, 0) / deployable.length
      const progression = nextDungeon === 'venom_marsh' && averageLevel < 18 ? undefined : nextDungeon
      const supply = shortage && sources[shortage]
      const target = progression && (trips % 2 === 0 || !supply) ? progression : supply ?? 'abandoned_mine'
      const selected = reduce(state, { type: 'dungeon', id: target })
      const sent = reduce(selected, { type: 'depart', presetId: selected.presetId, confirm: true, now })
      if (sent.expeditions.length) {
        state = sent
        trips += 1
      }
    }
  }
  return { times, purchases, sales, trips }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? +((sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.floor(sorted.length / 2)]!) / 2).toFixed(1) : '—'
}

function roundTrips() {
  const rows = []
  const pressures = [-0.6, -0.59, -0.55, 0, 1.45, 1.49, 1.5]
  const representatives = Array.from({ length: 100 }, (_, index) => initial(index + 1, true))
  for (const level of [1, 2, 3]) {
    for (const keeper of [false, true]) {
      for (const order of [1, -1]) {
        let max = -Infinity
        let wins = 0
        let cases = 0
        let example = ''
        for (const material of MARKET_MATERIALS) {
          for (const mode of ['cheap', 'wanted', 'ordinary'] as const) {
            const match = representatives.find((state) => {
              const deal = seasonDeal(state)
              return mode === 'ordinary' ? deal.cheap !== material && deal.wanted !== material : deal[mode] === material
            })!
            for (const pressure of pressures) {
              const state = {
                ...match, gold: 10_000,
                buildings: { ...match.buildings, market: level },
                retirees: keeper ? [{ hero: match.roster[0]!, building: 'market' as const, retiredYear: match.calendar.year }] : [],
                materials: { ...match.materials, [material]: 100 },
                market: { ...match.market, pressure: { [material]: pressure } },
              }
              for (let count = 1; count <= marketRules.maxTrade; count += 1) {
                const first = reduce(state, { type: 'trade', material, amount: order * count })
                const second = reduce(first, { type: 'trade', material, amount: -order * count })
                if (first.notice || second.notice || second.materials[material] !== state.materials[material]) {
                  throw new Error(`Incomplete round trip for ${material} ×${count}`)
                }
                const profit = second.gold - state.gold
                cases += 1
                if (profit > 0) wins += 1
                if (profit > max) {
                  max = profit
                  example = `seed ${match.seed}, ${material} ${mode}, ${Math.round(pressure * 100)}%, ×${count}`
                }
              }
            }
          }
        }
        rows.push({ level, keeper, order: order === 1 ? 'buy–sell' : 'sell–buy', cases, wins, 'best net gold': max, example })
      }
    }
  }
  return rows
}

const control = seeds.map((seed) => simulate(seed, false))
const market = seeds.map((seed) => simulate(seed, true))
console.log('Paired seeds 1–20 at the Lv3 checkpoint. Market Lv1 is already built. Times in minutes, censored at 12h.')
console.table(['town 4', 'town 5', ...projects.map(({ building, level }) => `${building} ${level}`), ...recipes].map((goal) => {
  const a = control.flatMap(({ times }) => times[goal] == null ? [] : [times[goal]])
  const b = market.flatMap(({ times }) => times[goal] == null ? [] : [times[goal]])
  const paired = control.flatMap(({ times }, index) => times[goal] != null && market[index]!.times[goal] != null ? [times[goal] - market[index]!.times[goal]!] : [])
  return { goal, control: median(a), market: median(b), 'paired minutes saved': median(paired), reached: `${a.length}/${b.length}` }
}))
console.table([{
  'market buy gold': median(market.map(({ purchases }) => purchases)),
  'market sell gold': median(market.map(({ sales }) => sales)),
  'market net spend': median(market.map(({ purchases, sales }) => purchases - sales)),
  'control trips': median(control.map(({ trips }) => trips)),
  'market trips': median(market.map(({ trips }) => trips)),
}])
console.table(roundTrips())

const seasonal = seeds.flatMap((seed) => {
  const state = initial(seed, true)
  const { cheap } = seasonDeal(state)
  const nextCalendar = { ...state.calendar, season: 'summer' as const }
  if (seasonDeal({ ...state, calendar: nextCalendar }).wanted !== cheap) return []
  const funding = { ...state, gold: 10_000, market: { ...state.market, pressure: { [cheap]: marketRules.pressureMin } } }
  const bought = reduce(funding, { type: 'trade', material: cheap, amount: 25 })
  // Compare prices across seasons without mixing in wages or unrelated income.
  const repriced = { ...bought, calendar: nextCalendar, lastTickAt: start + minute }
  const sold = reduce(repriced, { type: 'trade', material: cheap, amount: -25 })
  return [{ seed, material: cheap, 'spring buy': funding.gold - bought.gold, 'summer sell': sold.gold - bought.gold, 'net gold': sold.gold - funding.gold }]
})
console.log('Across seasons: buy 25 on the spring discount at −60%, then sell on the summer premium one minute later.')
console.table(seasonal)

console.log('First visit at 12h, frozen town Lv3 and 220 gold, varying the smith level at arrival.')
console.table([0, 1, 2, 3].map((smith) => {
  const offers = seeds.map((seed) => {
    const state = initial(seed, true)
    const visited = reduce({ ...state, buildings: { ...state.buildings, smith } }, { type: 'catchUp', now: start + marketRules.merchant.everyMs })
    const gear = merchantHere(visited)?.offers[0]
    if (!gear || gear.kind !== 'gear') throw new Error('Merchant has no first gear offer')
    const purchased = reduce(visited, { type: 'buyOffer', offerId: gear.id })
    const funded = reduce({ ...visited, gold: 250 }, { type: 'buyOffer', offerId: gear.id })
    return { grade: gear.gear.grade, price: gear.price, bought: purchased.notice == null, funded: funded.notice == null }
  })
  return { smith, grade: offers[0]!.grade, price: median(offers.map(({ price }) => price)), 'bought at 220': offers.filter(({ bought }) => bought).length, 'bought at 250': offers.filter(({ funded }) => funded).length }
}))
