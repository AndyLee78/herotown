// Run: npx tsx tools/raid-probe.ts
// How many runs a party needs to bring each raid boss down, and whether a
// strong party holds an invasion (Docs/endgame.md 4c tuning).
import { endgameRules } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon } from '../src/core/dungeon'
import { forgeGear, recipeById } from '../src/core/gear'
import { createHero } from '../src/core/hero'
import type { PartyMember } from '../src/core/types'
import { starterParties } from './curve'

const samples = starterParties(10)
type Grade = 'fine' | 'rare' | 'epic'

function withLevel(members: PartyMember[], level: number, grade: Grade): PartyMember[] {
  const blade = { fine: 'fine.blade', rare: 'flame.blade', epic: 'epic.blade' } as const
  const mail = { fine: 'fine.mail', rare: 'fine.mail', epic: 'epic.mail' } as const
  return members.map(({ hero, row }) => ({
    row,
    hero: createHero({ ...hero, level, training: level - 1, gear: [forgeGear(recipeById(blade[grade])!, `${hero.id}-b`), forgeGear(recipeById(mail[grade])!, `${hero.id}-m`)] }),
  }))
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

for (const boss of endgameRules.raid.bosses) {
  for (const [level, grade] of [[18, 'fine'], [20, 'rare'], [24, 'epic']] as const) {
    const runs = samples.map((party, index) => {
      let hp: number | null = null
      for (let run = 1; run <= 80; run += 1) {
        const raid = { hpScale: boss.hpScale, hp }
        const floors = [
          { monsters: [...boss.minions], scale: boss.scale * 0.6 },
          { monsters: [boss.boss, boss.minions[0]!], scale: boss.scale },
        ]
        const result = runDungeon(withLevel(party, level, grade), 'raid', DEFAULT_TACTICS, 500 + index * 97 + run, {}, { floors, raid })
        if (result.ok && raid.left != null) {
          hp = raid.left
        }
        if (hp === 0) {
          return run
        }
      }
      return 81
    })
    console.log(`${boss.id} Lv${level} ${grade}: runs to kill ${median(runs)} (min ${Math.min(...runs)}, max ${Math.max(...runs)})`)
  }
}

const rules = endgameRules.invasion
for (const [level, grade] of [[18, 'fine'], [20, 'rare'], [24, 'epic']] as const) {
  for (const count of [0, 3, 6]) {
    const scale = rules.scale * (1 + rules.scalePerInvasion * count)
    let held = 0
    samples.forEach((party, index) => {
      const result = runDungeon(withLevel(party, level, grade), 'invasion', DEFAULT_TACTICS, 900 + index, {}, { floors: rules.waves.map((monsters) => ({ monsters: [...monsters], scale })) })
      if (result.ok && result.report.victory) held += 1
    })
    console.log(`invasion #${count + 1} Lv${level} ${grade}: one party holds ${held}/${samples.length}`)
  }
}
