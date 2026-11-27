import { bedsTaken, residents } from './family'
import type { GameState } from './game'
import { bedCount } from './game'
import { isChild } from './hero'
import type { Hero } from './types'

// The houses seen as rooms (Docs/house.md). This only groups people for the
// screen; marriage has no additional bed cost.
//
// - family: a couple sharing a double room with their underage children.
// - parent: a parent on their own with their children.
// - shared: everyone else, two to a room, empty beds last.
// Retirees sleep in town without a bed; they show in a family room when they
// have a spouse or children at home, and in `retirees` otherwise.

export type Room = {
  kind: 'family' | 'parent' | 'shared'
  members: Hero[]
  // Beds the room takes from the house (retirees take none).
  beds: number
  // Empty beds in a shared room.
  empty: number
  // A baby on the way in this family.
  expecting: boolean
}

export type HouseView = {
  beds: number
  used: number
  free: number
  // People without a bed when the house is too small (an old or imported save).
  overflow: number
  rooms: Room[]
  retirees: Hero[]
}

export function houseRooms(state: GameState): HouseView {
  const beds = bedCount(state.buildings.house)
  const used = bedsTaken(state)
  // The fallen who can still be revived keep their bed and their marriage,
  // so they stay in their room (review b1261a7).
  const people = residents(state)
  const inRoster = new Set(state.roster.map((hero) => hero.id))
  const placed = new Set<string>()
  const rooms: Room[] = []
  const bedsFor = (members: Hero[], expecting: boolean) => members.filter((hero) => inRoster.has(hero.id)).length + (expecting ? 1 : 0)
  const kidsOf = (ids: string[]) => people.filter((hero) => isChild(hero) && !placed.has(hero.id) && (hero.parents ?? []).some((id) => ids.includes(id)))

  // Couples first: the wife with her husband, then their children.
  const wives = people.filter((hero) => hero.gender === 'female' && hero.spouseId != null && people.some((other) => other.id === hero.spouseId))
  for (const wife of wives) {
    const husband = people.find((hero) => hero.id === wife.spouseId)!
    placed.add(wife.id).add(husband.id)
    const kids = kidsOf([wife.id, husband.id])
    kids.forEach((kid) => placed.add(kid.id))
    const members = [wife, husband, ...kids]
    const expecting = Boolean(wife.expecting || husband.expecting)
    rooms.push({ kind: 'family', members, beds: bedsFor(members, expecting), empty: 0, expecting })
  }

  // A parent on their own who still has children at home.
  for (const parent of people) {
    if (placed.has(parent.id) || isChild(parent)) {
      continue
    }
    const kids = kidsOf([parent.id])
    if (kids.length === 0 && !parent.expecting) {
      continue
    }
    placed.add(parent.id)
    kids.forEach((kid) => placed.add(kid.id))
    const members = [parent, ...kids]
    rooms.push({ kind: 'parent', members, beds: bedsFor(members, Boolean(parent.expecting)), empty: 0, expecting: Boolean(parent.expecting) })
  }

  // Everyone else in the roster shares, two to a room: women together, men
  // together (never one of each, review b1261a7), younger first.
  const rest = state.roster.filter((hero) => !placed.has(hero.id)).sort((a, b) => a.age - b.age)
  let free = Math.max(0, beds - used)
  for (const gender of ['female', 'male'] as const) {
    const group = rest.filter((hero) => hero.gender === gender)
    for (let index = 0; index < group.length; index += 2) {
      const members = group.slice(index, index + 2)
      const empty = members.length === 1 && free > 0 ? 1 : 0
      free -= empty
      rooms.push({ kind: 'shared', members, beds: members.length + empty, empty, expecting: false })
    }
  }
  for (; free > 0; free -= 2) {
    const empty = Math.min(2, free)
    rooms.push({ kind: 'shared', members: [], beds: empty, empty, expecting: false })
  }

  return {
    beds,
    used,
    free: Math.max(0, beds - used),
    overflow: Math.max(0, used - beds),
    rooms,
    retirees: people.filter((hero) => !placed.has(hero.id) && !inRoster.has(hero.id)),
  }
}
