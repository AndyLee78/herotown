import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import {
  familyRules,
  isChild,
  moraleOf,
  personalityOf,
  type BuildingId,
  type ClassId,
  type Gender,
  type Genes,
  type Hero,
  type PersonalityId,
} from '../../core'
import { buildBody, buildCharacter, idlePose, walkPose, type Rig } from './character'
import { Builder, disposeTree, makeLabel } from './kit'
import { gearAuraOf, hashString, lookFor, lookKey, seeded } from './look'
import { buildMoodBubble, idleSeconds, strollPace, type MoodKind } from './mood'
import {
  GATE,
  GATHER,
  INN_YARD,
  LOTS,
  PLAZA,
  buildCemetery,
  buildFestivalDecor,
  buildLot,
  buildMerchantCart,
  buildPromoteFx,
  buildShrineRelic,
  buildTerrain,
  buildToastTable,
  buildTownDecor,
  legendStatuePads,
  marketFront,
  merchantPark,
  shrinePedestals,
  tavernTableSpot,
  tavernYard,
  trainingPad,
  type FestivalKind,
} from './world'

type LegendProp = { id: string; name: string; classId: string; gender?: string; genes?: unknown }
type ShrineProp = { id: string; slot: string; grade: string }

export type VillageSceneProps = {
  roster: Hero[]
  visitors: Hero[]
  // Heroes out on an expedition: they walk out of town and back in.
  awayIds: string[]
  // Heroes at the training ground (Docs/skills.md).
  drillIds: string[]
  // Retired heroes stroll slowly around the plaza.
  retirees: Hero[]
  partyIds: string[]
  selectedId: string | null
  buildings: Record<BuildingId, number>
  constructing: BuildingId | null
  labels: Record<BuildingId, string>
  expeditions: number
  weddings: [string, string][]
  births: string[]
  graves: { legend?: boolean }[]
  wishes: number
  wishCap: number
  wishBurst: boolean
  wishJackpot: boolean
  // The wandering merchant is in town (Docs/market.md); the 3D for it comes with task 75.
  merchant: boolean
  // The latest round at the tavern (Docs/tavern.md); the 3D for it comes with task 83.
  tavernRound: { heroIds: string[]; at: number } | null
  // The festival held this season, if any (Docs/morale.md), for decorations (task 87).
  festival: 'spring' | 'summer' | 'autumn' | 'winter' | null
  // Legends for statues at the hall of fame (graves and retired legends), and
  // the heirlooms on display (Docs/legends.md).
  legends: LegendProp[]
  shrine: ShrineProp[]
  // The town level with promotions (Docs/endgame.md 4b), for the town's look and the promotion scene (task 100).
  townLevel: number
  // The coming invasion: warned (within six hours), when it hits, and the last result (Docs/endgame.md 4c, task 104).
  invasion: { warned: boolean; at: number; last: { at: number; won: boolean } | null } | null
}

type Area = { minX: number; maxX: number; minZ: number; maxZ: number }

type Walker = {
  id: string
  kind: 'roster' | 'visitor' | 'retiree'
  root: THREE.Group
  rig: Rig
  key: string
  // gather → pack → leave → gone when a party sets out; arrive when it comes home.
  // drill: hitting the scarecrow at the training ground.
  // toastWalk → toast: a tavern round (Docs/tavern.md).
  // promote: gather in the plaza for a town promotion (Docs/endgame.md 4b).
  state: 'idle' | 'walk' | 'gather' | 'pack' | 'leave' | 'gone' | 'arrive' | 'vow' | 'drill' | 'toastWalk' | 'toast' | 'promote'
  away: boolean
  fresh: boolean
  timer: number
  target: THREE.Vector3
  speed: number
  phase: number
  random: () => number
  marker: THREE.Object3D | null
  // Seconds left of running off alone. Children do this between following a parent.
  solo: number
  // Coming home: a sack of loot on the back, and a wounded hero leaning on a friend.
  load: THREE.Object3D | null
  leanOn: Walker | null
  slowTo: number
  // Docs/personality.md: village habits and sudden morale bubbles.
  personality: PersonalityId | null
  morale: number
  lastMorale: number | null
  fidget: number
  mood: THREE.Group | null
}

type MoodSlot = { group: THREE.Group; kind: MoodKind; life: number; host: Walker | null }

const MOOD_SPIKE = 8
const MAX_MOODS = 4
const EDGE_SPOTS: { x: number; z: number }[] = [
  { x: PLAZA.min - 0.8, z: PLAZA.min - 0.6 },
  { x: PLAZA.max + 0.8, z: PLAZA.min - 0.6 },
  { x: PLAZA.min - 0.8, z: PLAZA.max + 0.6 },
  { x: PLAZA.max + 0.8, z: PLAZA.max + 0.4 },
  { x: PLAZA.min - 1.2, z: 0 },
  { x: PLAZA.max + 1.2, z: 1.2 },
  { x: -3.5, z: PLAZA.min - 1 },
  { x: 3.5, z: PLAZA.min - 1 },
]

type LotView = { key: string; group: THREE.Group; label: THREE.Sprite | null; labelText: string; top: number }

const FRUSTUM = 14
const CAMERA_OFFSET = new THREE.Vector3(16, 16, 16)
const PAN_LIMIT = 9
const PICK_RADIUS = 28
const PLAZA_AREA: Area = { minX: PLAZA.min, maxX: PLAZA.max, minZ: PLAZA.min, maxZ: PLAZA.max }
const YARD_AREA: Area = INN_YARD
// Nobody walks through the fountain basin: walkers keep this far from its middle.
const FOUNTAIN_CLEAR = 1.75
const PACE: Record<Hero['condition'], number> = { healthy: 1, fatigued: 0.8, injured: 0.6, critical: 0.4, dead: 0 }

export class VillageScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
  private readonly controls: MapControls
  private readonly walkers = new Map<string, Walker>()
  private readonly lots = new Map<BuildingId, LotView>()
  private readonly actors = new THREE.Group()
  private readonly ring: THREE.Mesh
  private readonly clock = new THREE.Clock()
  private readonly resizer: ResizeObserver
  private selectedLabel: THREE.Sprite | null = null
  private selectedId: string | null = null
  private paces = new Map<string, number>()
  private frame = 0
  private gateLabel: THREE.Sprite | null = null
  private gateCount = -1
  private cemeteryKey = ''
  private cemetery: THREE.Group | null = null
  private wishMode = ''
  private wishDecor: THREE.Group | null = null
  private active = true
  private readonly spouseOf = new Map<string, string>()
  private readonly parentOf = new Map<string, string>()
  private readonly bursts: { group: THREE.Group; life: number }[] = []
  private downAt: [number, number] | null = null
  private readonly raycaster = new THREE.Raycaster()
  // Wandering merchant cart + figure, built once and shown while in town.
  private merchantWanted = false
  private merchantBooted = false
  private marketOpen = false
  private merchantRoot: THREE.Group | null = null
  private merchantWheels: THREE.Object3D | null = null
  private merchantPerson: THREE.Group | null = null
  private merchantRig: Rig | null = null
  private merchantState: 'hidden' | 'arrive' | 'idle' | 'leave' = 'hidden'
  private readonly merchantTarget = new THREE.Vector3()
  private merchantPhase = 0.7
  private merchantPace = 0
  private trainingOpen = false
  private tavernOpen = false
  private tavernRoundBooted = false
  private tavernRoundSeen: number | null = null
  private toastTable: THREE.Group | null = null
  private toastCups: THREE.Object3D | null = null
  private toastCenter = new THREE.Vector3()
  private toasting = false
  private festivalBooted = false
  private festivalKind: FestivalKind | null = null
  private festivalWithYard = false
  private festivalDecor: THREE.Group | null = null
  private townBooted = false
  private townLevel = 0
  private townDecor: THREE.Group | null = null
  private promoteFx: THREE.Group | null = null
  private promoteTimer = 0
  private legendsLevel = 0
  private statuesKey = ''
  private statuesRoot: THREE.Group | null = null
  private shrineKey = ''
  private shrineRoot: THREE.Group | null = null
  private readonly childIds = new Set<string>()
  private readonly moodSlots: MoodSlot[] = []

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onPick: (id: string) => void,
    private readonly onPickLot?: (id: BuildingId) => void,
    private readonly onWish?: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.scene.background = new THREE.Color('#cfe6f2')

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8fb36a', 1.6))
    const sun = new THREE.DirectionalLight('#fff1dc', 2.2)
    sun.position.set(10, 20, 7)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 70 })
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    this.scene.add(sun, sun.target)

    this.scene.add(buildTerrain(), this.actors)
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.54, 28),
      new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: 0.95 }),
    )
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.02

    this.camera.position.copy(CAMERA_OFFSET)
    this.camera.zoom = 0.62
    this.controls = new MapControls(this.camera, canvas)
    this.controls.enableRotate = false
    this.controls.enableDamping = true
    this.controls.screenSpacePanning = true
    this.controls.minZoom = 0.7
    this.controls.maxZoom = 3.5
    this.controls.target.set(0, 0, 0)
    this.controls.update()

    canvas.addEventListener('pointerdown', this.handleDown)
    canvas.addEventListener('pointerup', this.handleUp)
    this.resizer = new ResizeObserver(() => this.resize())
    this.resizer.observe(canvas)
    this.resize()
    this.frame = requestAnimationFrame(this.tick)
  }

  update(props: VillageSceneProps) {
    this.syncLots(props)
    this.syncCemetery(props.graves)
    const living = props.roster.filter((hero) => hero.condition !== 'dead')
    this.syncWalkers([
      ...living.map((hero) => ({ hero, kind: 'roster' as const })),
      ...props.visitors.map((hero) => ({ hero, kind: 'visitor' as const })),
      ...props.retirees.map((hero) => ({ hero, kind: 'retiree' as const })),
    ])
    this.paces = new Map(living.map((hero) => [hero.id, PACE[hero.condition]]))
    this.syncAway(new Set(props.awayIds))
    this.syncDrills(new Set(props.drillIds))
    this.syncGate(props.expeditions)
    this.syncFamily(living, new Set([...props.awayIds, ...props.drillIds]))
    for (const [first, second] of props.weddings) {
      this.playWedding(first, second)
    }
    for (const id of props.births) {
      this.playBirth(id)
    }
    this.syncWishDecor(props.wishes, props.wishCap)
    if (props.wishBurst) {
      this.playWish(props.wishJackpot)
    }
    this.marketOpen = (props.buildings.market ?? 0) > 0
    this.trainingOpen = (props.buildings.training ?? 0) > 0
    this.tavernOpen = (props.buildings.tavern ?? 0) > 0
    this.childIds.clear()
    for (const hero of living) {
      if (isChild(hero)) {
        this.childIds.add(hero.id)
      }
    }
    this.syncMerchant(props.merchant)
    this.syncTavernRound(props.tavernRound)
    this.syncFestival(props.festival)
    this.syncTown(props.townLevel)
    this.legendsLevel = props.buildings.legends ?? 0
    this.syncLegendStatues(props.legends)
    this.syncShrine(props.shrine)
    const party = new Set(props.partyIds)
    for (const walker of this.walkers.values()) {
      this.setMarker(walker, walker.kind === 'roster' && party.has(walker.id))
    }
    this.select(props.selectedId, living)
  }

  setActive(active: boolean) {
    this.active = active
    this.clock.getDelta()
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.resizer.disconnect()
    this.canvas.removeEventListener('pointerdown', this.handleDown)
    this.canvas.removeEventListener('pointerup', this.handleUp)
    this.controls.dispose()
    for (const slot of this.moodSlots) {
      this.releaseMood(slot)
    }
    if (this.toastTable) {
      this.scene.remove(this.toastTable)
      disposeTree(this.toastTable)
      this.toastTable = null
      this.toastCups = null
    }
    this.clearFestivalDecor()
    this.clearTownDecor()
    this.clearPromoteFx()
    this.clearLegendStatues()
    this.clearShrine()
    freeOwnMaterials(this.scene)
    disposeTree(this.scene)
    this.renderer.dispose()
  }

  private ensureMerchant() {
    if (this.merchantRoot) {
      return
    }
    const root = new THREE.Group()
    const cart = buildMerchantCart()
    root.add(cart)
    this.merchantWheels = cart.getObjectByName('wheels') ?? null
    const rig = buildBody({
      outfit: { body: '#6b4a8a', trim: '#e2b340', pants: '#3a2a40', weapon: 'none', hat: 'feather', scarf: true },
      skin: '#f0d2b0',
      eye: '#2a2a2a',
      blush: true,
      hair: '#3a2a20',
      style: 'short',
      beard: true,
      scale: 1,
      head: 1,
      stoop: 0,
    })
    const pack = new Builder()
      .box(0.28, 0.34, 0.16, '#6b4a33', 0, 0.18, -0.2)
      .box(0.12, 0.12, 0.08, '#8a5a32', 0, 0.34, -0.22)
      .box(0.06, 0.2, 0.04, '#c9a36b', -0.12, 0.22, -0.12)
      .box(0.06, 0.2, 0.04, '#c9a36b', 0.12, 0.22, -0.12)
      .build({ castShadow: false })
    rig.torso.add(pack)
    const person = new THREE.Group()
    person.add(rig.group)
    person.position.set(0.55, 0, 0.15)
    root.add(person)
    root.visible = false
    this.scene.add(root)
    this.merchantRoot = root
    this.merchantPerson = person
    this.merchantRig = rig
  }

  private syncMerchant(present: boolean) {
    this.ensureMerchant()
    const root = this.merchantRoot
    if (!root) {
      return
    }
    const park = merchantPark()
    // First paint: if they are already here, stand at the stall (no entrance roll).
    if (!this.merchantBooted) {
      this.merchantBooted = true
      this.merchantWanted = present
      if (present) {
        root.visible = true
        root.position.set(park.x, 0, park.z)
        root.rotation.y = Math.PI / 2
        this.merchantState = 'idle'
        if (this.merchantPerson) {
          this.merchantPerson.position.set(0.55, 0, 0.15)
        }
      }
      return
    }
    if (present && !this.merchantWanted) {
      // Fresh arrival: roll in from the south gate.
      root.visible = true
      root.position.set(GATE.x + 1.2, 0, GATE.z + 0.4)
      root.rotation.y = Math.atan2(park.x - root.position.x, park.z - root.position.z)
      this.merchantTarget.set(park.x, 0, park.z)
      this.merchantState = 'arrive'
      this.merchantPace = 0
    } else if (!present && this.merchantWanted) {
      root.visible = true
      this.merchantTarget.set(GATE.x + 1.2, 0, GATE.z + 0.6)
      this.merchantState = 'leave'
    }
    this.merchantWanted = present
  }

  private stepMerchant(delta: number, time: number) {
    const root = this.merchantRoot
    const rig = this.merchantRig
    if (!root || !rig || this.merchantState === 'hidden') {
      return
    }
    if (this.merchantState === 'idle') {
      const park = merchantPark()
      this.merchantPace += delta
      // Pace a short loop beside the cart, then wave.
      const loop = (Math.sin(this.merchantPace * 0.7) + 1) * 0.5
      if (this.merchantPerson) {
        this.merchantPerson.position.set(0.55 + loop * 0.55, 0, 0.15 - loop * 0.35)
        this.merchantPerson.rotation.y = loop > 0.55 ? -0.6 : 0.2
      }
      idlePose(rig, time, this.merchantPhase)
      if (loop > 0.7) {
        rig.armR.rotation.set(-1.1 + Math.sin(time * 5) * 0.45, 0, 0.35)
      }
      root.rotation.y = Math.PI / 2
      root.position.set(park.x, 0, park.z)
      return
    }
    const dx = this.merchantTarget.x - root.position.x
    const dz = this.merchantTarget.z - root.position.z
    const distance = Math.hypot(dx, dz)
    if (distance < 0.08) {
      if (this.merchantState === 'arrive') {
        this.merchantState = 'idle'
        this.merchantPace = 0
        root.rotation.y = Math.PI / 2
        if (this.merchantPerson) {
          this.merchantPerson.position.set(0.55, 0, 0.15)
          this.merchantPerson.rotation.y = 0.2
        }
      } else if (this.merchantState === 'leave') {
        this.merchantState = 'hidden'
        root.visible = false
      }
      idlePose(rig, time, this.merchantPhase)
      return
    }
    const step = Math.min(distance, 2.4 * delta)
    root.position.x += (dx / distance) * step
    root.position.z += (dz / distance) * step
    root.rotation.y = turnToward(root.rotation.y, Math.atan2(dx, dz), delta * 5)
    if (this.merchantWheels) {
      this.merchantWheels.rotation.x += step * 3.2
    }
    if (this.merchantPerson) {
      this.merchantPerson.position.set(0.55, 0, 0.15)
      this.merchantPerson.rotation.y = 0
    }
    walkPose(rig, time, this.merchantPhase, 1.1)
  }

  private syncGate(count: number) {
    if (count === this.gateCount) {
      return
    }
    this.gateCount = count
    if (this.gateLabel) {
      this.scene.remove(this.gateLabel)
      disposeTree(this.gateLabel)
      this.gateLabel = null
    }
    if (count <= 0) {
      return
    }
    const label = makeLabel(String(count), 0.42)
    label.position.set(GATE.x + 2.45, 1.35, GATE.z + 0.55)
    this.scene.add(label)
    this.gateLabel = label
  }

  // Couples share a walk. Children under 14 stick to one parent who is home.
  private syncFamily(roster: Hero[], away: Set<string>) {
    this.spouseOf.clear()
    this.parentOf.clear()
    const home = new Set(roster.filter((hero) => !away.has(hero.id)).map((hero) => hero.id))
    for (const hero of roster) {
      if (hero.spouseId && hero.id < hero.spouseId && home.has(hero.id) && home.has(hero.spouseId)) {
        this.spouseOf.set(hero.id, hero.spouseId)
      }
      if (hero.age < familyRules.adultAge) {
        const parent = hero.parents?.find((id) => home.has(id))
        if (parent) {
          this.parentOf.set(hero.id, parent)
        }
      }
    }
  }

  private playWedding(firstId: string, secondId: string) {
    const first = this.walkers.get(firstId)
    const second = this.walkers.get(secondId)
    if (first && second) {
      first.state = 'vow'
      second.state = 'vow'
      first.root.visible = true
      second.root.visible = true
      first.root.position.set(PLAZA.min * 0.15, 0, 0.2)
      second.root.position.set(PLAZA.max * 0.15, 0, 0.2)
      first.root.rotation.y = Math.atan2(second.root.position.x - first.root.position.x, second.root.position.z - first.root.position.z)
      second.root.rotation.y = Math.atan2(first.root.position.x - second.root.position.x, first.root.position.z - second.root.position.z)
      first.timer = 2.6
      second.timer = 2.6
    }
    this.burst(0, 1.3, 0.2, 'wedding')
  }

  private playBirth(id: string) {
    const house = LOTS.house
    this.burst(house.x, 3.3, house.z, 'star')
    const child = this.walkers.get(id)
    if (child) {
      child.root.position.set(house.x + 1.2, 0, house.z + 1.4)
    }
  }

  // First paint with an old round does nothing; a new `at` starts a toast (Docs/tavern.md).
  private syncTavernRound(round: { heroIds: string[]; at: number } | null) {
    if (!this.tavernRoundBooted) {
      this.tavernRoundBooted = true
      this.tavernRoundSeen = round?.at ?? null
      return
    }
    if (!round || round.at === this.tavernRoundSeen) {
      return
    }
    this.tavernRoundSeen = round.at
    this.startToast(round.heroIds)
  }

  private ensureToastTable() {
    if (this.toastTable) {
      return
    }
    const table = buildToastTable()
    this.scene.add(table)
    this.toastTable = table
    this.toastCups = table.getObjectByName('cups') ?? null
  }

  private startToast(heroIds: string[]) {
    if (!this.tavernOpen) {
      return
    }
    this.ensureToastTable()
    const spot = tavernTableSpot()
    this.toastCenter.set(spot.x, 0, spot.z)
    if (this.toastTable) {
      this.toastTable.position.set(spot.x, 0, spot.z)
      this.toastTable.visible = true
    }
    this.toasting = false
    let seated = 0
    for (const id of heroIds) {
      const walker = this.walkers.get(id)
      if (!walker || walker.kind !== 'roster') {
        continue
      }
      if (
        walker.state === 'gone' ||
        walker.state === 'leave' ||
        walker.state === 'gather' ||
        walker.state === 'pack' ||
        walker.state === 'arrive' ||
        walker.state === 'drill' ||
        walker.away
      ) {
        continue
      }
      const seat = spot.seats[seated % spot.seats.length]!
      seated += 1
      walker.state = 'toastWalk'
      walker.root.visible = true
      walker.target.set(seat.x, 0, seat.z)
      walker.speed = 1.35
      walker.leanOn = null
      walker.solo = 0
    }
    if (seated === 0 && this.toastTable) {
      this.toastTable.visible = false
    } else if (seated > 0) {
      this.toasting = true
    }
  }

  private endToastIfDone() {
    if (!this.toasting) {
      return
    }
    for (const walker of this.walkers.values()) {
      if (walker.state === 'toast' || walker.state === 'toastWalk') {
        return
      }
    }
    this.toasting = false
    if (this.toastTable) {
      this.toastTable.visible = false
    }
  }

  private bobToastCups(time: number) {
    if (!this.toastCups || !this.toastTable?.visible) {
      return
    }
    for (const child of this.toastCups.children) {
      const index = Number(child.name.replace('cup', '')) || 0
      child.position.y = 0.58 + Math.max(0, Math.sin(time * 6 + index * 1.2)) * 0.12
      child.rotation.z = Math.sin(time * 5 + index) * 0.15
    }
  }

  private burst(x: number, y: number, z: number, kind: 'wedding' | 'star' | 'festival' | 'promote') {
    const group = new THREE.Group()
    group.position.set(x, y, z)
    const colors =
      kind === 'star'
        ? ['#ffe08a', '#fff6c8', '#ffd84d']
        : kind === 'festival'
          ? ['#f4a0c0', '#ffe08a', '#9fd36b', '#8fd4ef', '#fff4ea', '#e0584f']
          : kind === 'promote'
            ? ['#ffe27a', '#fff6c8', '#c79bff', '#9fe8ff', '#d9b54a', '#ff8a3d']
            : ['#e0584f', '#ff8fa3', '#f4b4c4', '#fff4ea']
    const count = kind === 'star' ? 8 : kind === 'festival' ? 14 : kind === 'promote' ? 20 : 16
    for (let index = 0; index < count; index += 1) {
      const size = kind === 'star' ? 0.22 : kind === 'festival' || kind === 'promote' ? 0.12 + (index % 3) * 0.04 : 0.16 + (index % 3) * 0.04
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, kind === 'star' ? size : size * 0.45, size * 0.7),
        new THREE.MeshBasicMaterial({ color: colors[index % colors.length] }),
      )
      const angle = (index / count) * Math.PI * 2
      const speed = kind === 'star' ? 0.35 : kind === 'festival' ? 0.55 : kind === 'promote' ? 0.85 : 0.7
      mesh.userData.velocity = new THREE.Vector3(Math.cos(angle) * speed * 0.55, 0.8 + (index % 4) * 0.15, Math.sin(angle) * speed * 0.55)
      if ((kind === 'festival' || kind === 'promote') && index % 3 === 0) {
        mesh.userData.float = true
        mesh.userData.velocity.y *= 0.45
      }
      group.add(mesh)
    }
    this.scene.add(group)
    this.bursts.push({ group, life: kind === 'festival' ? 2.0 : kind === 'promote' ? 2.4 : 2.6 })
  }

  // Town look for Lv8–10, and a one-shot plaza ceremony when the town promotes.
  private syncTown(level: number) {
    const next = Math.max(1, Math.min(10, Math.floor(level)))
    if (!this.townBooted) {
      this.townBooted = true
      this.townLevel = next
      this.setTownDecor(next)
      return
    }
    if (next === this.townLevel) {
      return
    }
    const previous = this.townLevel
    this.townLevel = next
    this.setTownDecor(next)
    if (next > previous && next >= 8 && next <= 10 && previous === next - 1) {
      this.playPromotion(next)
    }
  }

  private setTownDecor(level: number) {
    this.clearTownDecor()
    if (level < 8) {
      return
    }
    const decor = buildTownDecor(level)
    this.scene.add(decor)
    this.townDecor = decor
  }

  private clearTownDecor() {
    if (!this.townDecor) {
      return
    }
    this.scene.remove(this.townDecor)
    freeOwnMaterials(this.townDecor)
    disposeTree(this.townDecor)
    this.townDecor = null
  }

  private playPromotion(level: number) {
    this.clearPromoteFx()
    const fx = buildPromoteFx(level)
    this.scene.add(fx)
    this.promoteFx = fx
    this.promoteTimer = 4.8
    const hall = LOTS.hall
    this.burst(hall.x, 3.2, hall.z, 'promote')
    this.burst(0, 1.6, 0, 'promote')
    this.burst(1.6, 1.4, 1.2, 'promote')
    this.burst(-1.4, 1.4, -1.0, 'promote')
    let index = 0
    for (const walker of this.walkers.values()) {
      if (walker.kind !== 'roster' || !walker.root.visible || walker.state === 'gone' || walker.state === 'leave' || walker.state === 'pack') {
        continue
      }
      const angle = (index / 8) * Math.PI * 2
      const radius = 1.6 + (index % 3) * 0.35
      walker.state = 'promote'
      walker.target.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
      keepOffFountain(walker.target)
      walker.timer = 4.8
      walker.root.visible = true
      index += 1
      if (index >= 12) {
        break
      }
    }
  }

  private clearPromoteFx() {
    if (!this.promoteFx) {
      return
    }
    this.scene.remove(this.promoteFx)
    freeOwnMaterials(this.promoteFx)
    disposeTree(this.promoteFx)
    this.promoteFx = null
    this.promoteTimer = 0
  }

  private stepPromoteFx(delta: number, time: number) {
    if (!this.promoteFx) {
      return
    }
    this.promoteTimer -= delta
    const pillar = this.promoteFx.getObjectByName('pillar')
    if (pillar) {
      pillar.scale.y = 1 + Math.sin(time * 4) * 0.06
      pillar.position.y = Math.sin(time * 3) * 0.08
    }
    const flags = this.promoteFx.getObjectByName('risingFlags')
    if (flags) {
      const rise = Math.min(1.2, (4.8 - this.promoteTimer) * 0.45)
      flags.position.y = rise
    }
    if (this.promoteTimer <= 0) {
      this.clearPromoteFx()
    }
  }

  // First paint with an old festival only shows props; null → kind fires confetti.
  private syncFestival(kind: FestivalKind | null) {
    const withYard = this.tavernOpen
    if (!this.festivalBooted) {
      this.festivalBooted = true
      this.festivalKind = kind
      this.festivalWithYard = withYard
      if (kind) {
        this.setFestivalDecor(kind, withYard)
      }
      return
    }
    if (kind === this.festivalKind && withYard === this.festivalWithYard) {
      return
    }
    const opened = this.festivalKind == null && kind != null
    this.festivalKind = kind
    this.festivalWithYard = withYard
    if (!kind) {
      this.clearFestivalDecor()
      return
    }
    this.setFestivalDecor(kind, withYard)
    if (opened) {
      this.burst(0, 1.45, 0, 'festival')
      this.burst(1.4, 1.25, -1.1, 'festival')
      this.burst(-1.2, 1.25, 1.0, 'festival')
    }
  }

  private setFestivalDecor(kind: FestivalKind, withYard: boolean) {
    this.clearFestivalDecor()
    const decor = buildFestivalDecor(kind, withYard)
    this.scene.add(decor)
    this.festivalDecor = decor
  }

  private clearFestivalDecor() {
    if (!this.festivalDecor) {
      return
    }
    this.scene.remove(this.festivalDecor)
    freeOwnMaterials(this.festivalDecor)
    disposeTree(this.festivalDecor)
    this.festivalDecor = null
  }

  // Marble statues of the first legends; rebuilt only when the list or hall level changes.
  private syncLegendStatues(legends: LegendProp[]) {
    const pads = legendStatuePads(this.legendsLevel)
    const shown = this.legendsLevel < 1 ? [] : legends.slice(0, pads.length)
    const key = `${this.legendsLevel}:${shown.map((entry) => entry.id).join(',')}`
    if (key === this.statuesKey) {
      return
    }
    this.statuesKey = key
    this.clearLegendStatues()
    if (shown.length === 0) {
      return
    }
    const root = new THREE.Group()
    root.name = 'legend-statues'
    shown.forEach((entry, index) => {
      const pad = pads[index]
      if (!pad) {
        return
      }
      const pedestal = new Builder()
        .box(0.55, 0.14, 0.55, '#c9c5bb', 0, 0.08, 0)
        .box(0.42, 0.1, 0.42, '#b8b4aa', 0, 0.18, 0)
        .build()
      pedestal.position.set(pad.x, 0, pad.z)
      root.add(pedestal)
      const gender: Gender = entry.gender === 'female' ? 'female' : 'male'
      const classId = entry.classId as ClassId
      const genes = isGenes(entry.genes) ? entry.genes : undefined
      const look = lookFor({ id: entry.id, classId, gender, age: 38, genes })
      const rig = buildCharacter(look)
      marbleize(rig.group)
      idlePose(rig, index * 0.7, index * 1.3)
      const figure = new THREE.Group()
      figure.add(rig.group)
      figure.position.set(pad.x, 0.22, pad.z)
      figure.rotation.y = Math.PI
      figure.scale.setScalar(1.05)
      root.add(figure)
    })
    this.scene.add(root)
    this.statuesRoot = root
  }

  private clearLegendStatues() {
    if (!this.statuesRoot) {
      return
    }
    this.scene.remove(this.statuesRoot)
    disposeTree(this.statuesRoot)
    this.statuesRoot = null
  }

  // Glowing heirloom models on pedestals around the hall.
  private syncShrine(shrine: ShrineProp[]) {
    const pads = this.legendsLevel < 1 ? [] : shrinePedestals(shrine.length)
    const shown = this.legendsLevel < 1 ? [] : shrine.slice(0, pads.length)
    const key = `${this.legendsLevel}:${shown.map((item) => `${item.id}:${item.slot}:${item.grade}`).join(',')}`
    if (key === this.shrineKey) {
      return
    }
    this.shrineKey = key
    this.clearShrine()
    if (shown.length === 0) {
      return
    }
    const root = new THREE.Group()
    root.name = 'legend-shrine'
    shown.forEach((item, index) => {
      const pad = pads[index]
      if (!pad) {
        return
      }
      const relic = buildShrineRelic(item.slot, item.grade)
      relic.position.set(pad.x, 0, pad.z)
      relic.userData.baseY = 0
      relic.userData.phase = index * 1.1
      root.add(relic)
    })
    this.scene.add(root)
    this.shrineRoot = root
  }

  private clearShrine() {
    if (!this.shrineRoot) {
      return
    }
    this.scene.remove(this.shrineRoot)
    disposeTree(this.shrineRoot)
    this.shrineRoot = null
  }

  private bobShrine(time: number) {
    if (!this.shrineRoot) {
      return
    }
    for (const child of this.shrineRoot.children) {
      const base = child.userData.baseY
      const phase = child.userData.phase
      if (typeof base === 'number' && typeof phase === 'number') {
        child.position.y = base + Math.sin(time * 2.2 + phase) * 0.04
        child.rotation.y = time * 0.6 + phase
      }
    }
  }

  private stepBursts(delta: number) {
    for (let index = this.bursts.length - 1; index >= 0; index -= 1) {
      const burst = this.bursts[index]
      if (!burst) {
        continue
      }
      burst.life -= delta
      for (const child of burst.group.children) {
        if (!(child instanceof THREE.Mesh)) {
          continue
        }
        const velocity = child.userData.velocity as THREE.Vector3
        child.position.addScaledVector(velocity, delta)
        if (!child.userData.float) {
          velocity.y -= delta * 0.28
        }
        child.rotation.x += delta * 2
        child.rotation.y += delta * 3
      }
      if (burst.life <= 0) {
        this.scene.remove(burst.group)
        burst.group.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose()
            const material = object.material
            if (Array.isArray(material)) {
              for (const entry of material) {
                entry.dispose()
              }
            } else {
              material.dispose()
            }
          }
        })
        this.bursts.splice(index, 1)
      }
    }
  }

  private bobSmoke(time: number) {
    this.lots.get('alchemy')?.group.traverse((object) => {
      if (object.name !== 'smoke') {
        return
      }
      const base = object.userData.baseY
      if (typeof base === 'number') {
        object.position.y = base + Math.sin(time * 2 + base * 4) * 0.08
      }
    })
  }

  private bobCrystals(time: number) {
    this.lots.get('magic')?.group.traverse((object) => {
      if (object.name !== 'crystal') {
        return
      }
      const base = object.userData.baseY
      if (typeof base === 'number') {
        object.position.y = base + Math.sin(time * 1.8 + base * 3) * 0.12
        object.rotation.y = time * 0.6 + base
      }
    })
  }

  private bobFountain(time: number) {
    this.lots.get('fountain')?.group.traverse((object) => {
      if (object.name !== 'jet') {
        return
      }
      const base = object.userData.baseY
      if (typeof base === 'number') {
        object.position.y = base + Math.sin(time * 3 + base) * 0.08
      }
    })
    this.wishDecor?.children.forEach((child, index) => {
      const base = child.userData.baseY
      if (typeof base === 'number') {
        child.position.y = base + Math.sin(time * 4 + index) * 0.05
      }
      child.rotation.y = time * 2
    })
  }

  private syncWishDecor(wishes: number, cap: number) {
    const mode = wishes <= 0 ? 'empty' : wishes >= cap ? 'full' : 'ready'
    if (mode === this.wishMode) {
      return
    }
    this.wishMode = mode
    if (this.wishDecor) {
      this.scene.remove(this.wishDecor)
      freeOwnMaterials(this.wishDecor)
      disposeTree(this.wishDecor)
      this.wishDecor = null
    }
    if (mode === 'empty') {
      return
    }
    const group = new THREE.Group()
    const count = mode === 'full' ? 5 : 4
    for (let index = 0; index < count; index += 1) {
      const coin = mode === 'full'
      const material = new THREE.MeshBasicMaterial({ color: coin ? '#e2b340' : '#f4fbff' })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(coin ? 0.16 : 0.08, coin ? 0.05 : 0.08, coin ? 0.16 : 0.08), material)
      const angle = (index / count) * Math.PI * 2
      mesh.position.set(Math.cos(angle) * 0.38, 0.06, Math.sin(angle) * 0.38)
      mesh.userData.baseY = mesh.position.y
      mesh.userData.materials = [material]
      group.add(mesh)
    }
    group.position.set(0, 0.42, 0)
    this.scene.add(group)
    this.wishDecor = group
  }

  private playWish(jackpot: boolean) {
    const group = new THREE.Group()
    const count = jackpot ? 16 : 4
    for (let index = 0; index < count; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: jackpot ? '#ffe27a' : '#e2b340' })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.14), material)
      const angle = (index / count) * Math.PI * 2
      const speed = jackpot ? 1.3 : 0.85
      mesh.userData.velocity = new THREE.Vector3(Math.cos(angle) * speed, 1.5 + (index % 3) * 0.2, Math.sin(angle) * speed)
      mesh.userData.materials = [material]
      group.add(mesh)
    }
    if (jackpot) {
      const material = new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.85 })
      const jet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), material)
      jet.position.y = 1.1
      jet.userData.velocity = new THREE.Vector3(0, 0.2, 0)
      jet.userData.float = true
      jet.userData.materials = [material]
      group.add(jet)
    }
    this.scene.add(group)
    this.bursts.push({ group, life: jackpot ? 2.6 : 1.4 })
  }

  private syncCemetery(graves: { legend?: boolean }[]) {
    const shown = graves.slice(-12)
    const key = `${graves.length}:${shown.map((grave) => (grave.legend ? '1' : '0')).join('')}`
    if (key === this.cemeteryKey) {
      return
    }
    this.cemeteryKey = key
    if (this.cemetery) {
      this.scene.remove(this.cemetery)
      disposeTree(this.cemetery)
      this.cemetery = null
    }
    if (shown.length === 0) {
      return
    }
    this.cemetery = buildCemetery(graves)
    this.scene.add(this.cemetery)
  }

  private syncLots(props: VillageSceneProps) {
    for (const id of Object.keys(LOTS) as BuildingId[]) {
      const level = props.buildings[id] ?? 0
      const constructing = props.constructing === id
      const key = `${level}:${constructing ? 1 : 0}`
      let view = this.lots.get(id)
      if (!view || view.key !== key) {
        if (view) {
          this.scene.remove(view.group)
          freeOwnMaterials(view.group)
          disposeTree(view.group)
        }
        const built = buildLot(id, level, constructing)
        this.scene.add(built.group)
        view = { key, group: built.group, label: null, labelText: '', top: built.top }
        this.lots.set(id, view)
      }
      const text = props.labels[id]
      if (view.labelText !== text || !view.label) {
        if (view.label) {
          view.group.remove(view.label)
          disposeTree(view.label)
        }
        view.label = makeLabel(text, 0.5)
        view.label.position.y = view.top + 0.45
        view.group.add(view.label)
        view.labelText = text
      }
    }
  }

  private syncWalkers(entries: { hero: Hero; kind: Walker['kind'] }[]) {
    const seen = new Set<string>()
    for (const { hero, kind } of entries) {
      seen.add(hero.id)
      const look = lookFor(hero)
      const aura = gearAuraOf(hero.gear)
      const key = `${lookKey(look)}|${aura ?? ''}`
      const existing = this.walkers.get(hero.id)
      if (existing && existing.key === key && existing.kind === kind) {
        this.touchMood(existing, hero)
        continue
      }
      if (existing) {
        existing.root.remove(existing.rig.group)
        disposeTree(existing.rig.group)
        existing.rig = buildCharacter(look, aura)
        existing.root.add(existing.rig.group)
        existing.key = key
        if (existing.kind !== kind) {
          existing.kind = kind
          this.placeIn(existing, kind === 'visitor' ? YARD_AREA : PLAZA_AREA)
        }
        if (existing.marker) {
          existing.marker.position.y = existing.rig.height + 0.2
        }
        this.touchMood(existing, hero)
        continue
      }
      const random = seeded(hashString(hero.id) ^ 0x9e3779b9)
      const walker: Walker = {
        id: hero.id,
        kind,
        root: new THREE.Group(),
        rig: buildCharacter(look, aura),
        key,
        state: 'idle',
        away: false,
        fresh: true,
        timer: random() * 3,
        target: new THREE.Vector3(),
        speed: 0.9 + random() * 0.3,
        phase: random() * 10,
        random,
        marker: null,
        solo: 0,
        load: null,
        leanOn: null,
        slowTo: 0,
        personality: null,
        morale: 60,
        lastMorale: null,
        fidget: 0,
        mood: null,
      }
      walker.root.add(walker.rig.group)
      this.placeIn(walker, kind === 'visitor' ? YARD_AREA : PLAZA_AREA)
      walker.root.rotation.y = random() * Math.PI * 2
      this.actors.add(walker.root)
      this.walkers.set(hero.id, walker)
      this.touchMood(walker, hero)
    }
    for (const [id, walker] of this.walkers) {
      if (!seen.has(id)) {
        this.clearMood(walker)
        if (this.ring.parent === walker.root) {
          this.ring.removeFromParent()
          this.selectedLabel = null
          this.selectedId = null
        }
        this.actors.remove(walker.root)
        disposeTree(walker.root)
        this.walkers.delete(id)
      }
    }
  }

  private touchMood(walker: Walker, hero: Hero) {
    if (walker.kind !== 'roster') {
      walker.personality = null
      walker.morale = moraleOf(hero)
      walker.lastMorale = walker.morale
      return
    }
    walker.personality = personalityOf(hero)
    const next = moraleOf(hero)
    if (walker.lastMorale != null) {
      const delta = next - walker.lastMorale
      if (delta >= MOOD_SPIKE) {
        this.showMood(walker, 'up')
      } else if (delta <= -MOOD_SPIKE) {
        this.showMood(walker, 'down')
      }
    }
    walker.morale = next
    walker.lastMorale = next
  }

  private showMood(walker: Walker, kind: MoodKind) {
    if (walker.state === 'gone' || !walker.root.visible) {
      return
    }
    this.clearMood(walker)
    let slot = this.moodSlots.find((entry) => entry.host === null && entry.kind === kind)
    if (!slot) {
      const active = this.moodSlots.filter((entry) => entry.host != null).length
      if (active >= MAX_MOODS) {
        const oldest = this.moodSlots
          .filter((entry) => entry.host != null)
          .sort((a, b) => a.life - b.life)[0]
        if (oldest) {
          this.releaseMood(oldest)
        }
      }
      slot = this.moodSlots.find((entry) => entry.host === null && entry.kind === kind)
    }
    if (!slot) {
      const group = buildMoodBubble(kind)
      this.scene.add(group)
      slot = { group, kind, life: 0, host: null }
      this.moodSlots.push(slot)
    }
    slot.host = walker
    slot.life = 2
    slot.group.visible = true
    walker.mood = slot.group
    this.placeMood(slot)
    // Settings (and other overlays) pause the tick; still paint the bubble once.
    if (!this.active) {
      this.renderer.render(this.scene, this.camera)
    }
  }

  private releaseMood(slot: MoodSlot) {
    if (slot.host?.mood === slot.group) {
      slot.host.mood = null
    }
    slot.host = null
    slot.life = 0
    slot.group.visible = false
  }

  private clearMood(walker: Walker) {
    const slot = this.moodSlots.find((entry) => entry.host === walker)
    if (slot) {
      this.releaseMood(slot)
    }
  }

  private placeMood(slot: MoodSlot) {
    const host = slot.host
    if (!host) {
      return
    }
    slot.group.position.set(host.root.position.x, host.rig.height + 0.75, host.root.position.z)
  }

  private stepMoods(delta: number, time: number) {
    for (const slot of this.moodSlots) {
      if (!slot.host) {
        continue
      }
      slot.life -= delta
      this.placeMood(slot)
      slot.group.position.y += 0.08 + Math.sin(time * 6) * 0.02
      slot.group.rotation.y = time * 1.5
      if (slot.life <= 0 || slot.host.state === 'gone' || !slot.host.root.visible) {
        this.releaseMood(slot)
      }
    }
  }

  // Personality habits while strolling the square (Docs/personality.md).
  private pickStrollTarget(walker: Walker) {
    const personality = walker.personality
    if (walker.kind === 'roster' && personality && this.rollPersonalityTarget(walker, personality)) {
      keepOffFountain(walker.target)
      return
    }
    const yardChance = personality === 'social' ? 0.22 : 0.08
    if (walker.kind === 'roster' && this.tavernOpen && walker.random() < yardChance) {
      const yard = tavernYard()
      walker.target.set(
        yard.minX + walker.random() * (yard.maxX - yard.minX),
        0,
        yard.minZ + walker.random() * (yard.maxZ - yard.minZ),
      )
    } else if (walker.kind === 'roster' && this.marketOpen && walker.random() < 0.12) {
      const front = marketFront()
      walker.target.set(
        front.minX + walker.random() * (front.maxX - front.minX),
        0,
        front.minZ + walker.random() * (front.maxZ - front.minZ),
      )
    } else {
      const area = walker.kind === 'visitor' ? YARD_AREA : PLAZA_AREA
      walker.target.set(
        area.minX + walker.random() * (area.maxX - area.minX),
        0,
        area.minZ + walker.random() * (area.maxZ - area.minZ),
      )
    }
    keepOffFountain(walker.target)
  }

  private rollPersonalityTarget(walker: Walker, personality: PersonalityId): boolean {
    const roll = walker.random()
    if (personality === 'social' && roll < 0.6) {
      const buddies = [...this.walkers.values()].filter(
        (other) => other.id !== walker.id && other.kind === 'roster' && this.canStroll(other) && other.root.visible,
      )
      if (buddies.length > 0) {
        const buddy = buddies[Math.floor(walker.random() * buddies.length)]!
        const angle = walker.random() * Math.PI * 2
        const dist = 0.55 + walker.random() * 0.45
        walker.target.set(buddy.root.position.x + Math.cos(angle) * dist, 0, buddy.root.position.z + Math.sin(angle) * dist)
        return true
      }
    }
    if (personality === 'loner' && roll < 0.7) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const spot = EDGE_SPOTS[Math.floor(walker.random() * EDGE_SPOTS.length)]!
        const x = spot.x + (walker.random() - 0.5) * 0.8
        const z = spot.z + (walker.random() - 0.5) * 0.8
        const crowded = [...this.walkers.values()].some(
          (other) => other.id !== walker.id && other.root.visible && Math.hypot(other.root.position.x - x, other.root.position.z - z) < 1.7,
        )
        if (!crowded) {
          walker.target.set(x, 0, z)
          return true
        }
      }
    }
    if (personality === 'ambitious' && roll < 0.55) {
      if (this.trainingOpen && walker.random() < 0.55) {
        const pad = trainingPad()
        walker.target.set(pad.x + (walker.random() - 0.5) * 1.2, 0, pad.z + (walker.random() - 0.5) * 1.2)
      } else {
        walker.target.set(GATE.x + (walker.random() - 0.5) * 1.6, 0, GATE.z - 1.2 - walker.random() * 1.4)
      }
      return true
    }
    if (personality === 'gentle' && roll < 0.55) {
      const soft = [...this.walkers.values()].filter(
        (other) =>
          other.id !== walker.id &&
          other.root.visible &&
          this.canStroll(other) &&
          (other.kind === 'retiree' || this.childIds.has(other.id)),
      )
      if (soft.length > 0) {
        const buddy = soft[Math.floor(walker.random() * soft.length)]!
        const angle = walker.random() * Math.PI * 2
        walker.target.set(buddy.root.position.x + Math.cos(angle) * 0.7, 0, buddy.root.position.z + Math.sin(angle) * 0.7)
        return true
      }
    }
    if (personality === 'timid' && roll < 0.65) {
      const lots = Object.values(LOTS)
      const lot = lots[Math.floor(walker.random() * lots.length)]!
      walker.target.set(lot.x + (walker.random() - 0.5) * lot.w * 0.5, 0, lot.z + lot.d / 2 + 0.45 + walker.random() * 0.5)
      return true
    }
    if (personality === 'hotheaded' && roll < 0.35) {
      walker.target.set(
        PLAZA.min + walker.random() * (PLAZA.max - PLAZA.min),
        0,
        PLAZA.min + walker.random() * (PLAZA.max - PLAZA.min),
      )
      return true
    }
    return false
  }

  private applyMoralePose(walker: Walker) {
    if (walker.morale > 30) {
      return
    }
    walker.rig.torso.rotation.x = Math.max(walker.rig.torso.rotation.x, 0.28)
    walker.rig.head.rotation.x = Math.max(walker.rig.head.rotation.x, 0.18)
    walker.rig.armL.rotation.x = Math.min(walker.rig.armL.rotation.x, -0.25)
    walker.rig.armR.rotation.x = Math.min(walker.rig.armR.rotation.x, -0.25)
  }

  // Heroes in training stand by the scarecrow and keep swinging.
  private syncDrills(drills: Set<string>) {
    const pad = trainingPad()
    let slot = 0
    for (const walker of this.walkers.values()) {
      if (walker.kind !== 'roster') {
        continue
      }
      const training = drills.has(walker.id)
      if (
        training &&
        walker.state !== 'drill' &&
        walker.state !== 'gone' &&
        walker.state !== 'leave' &&
        walker.state !== 'gather' &&
        walker.state !== 'pack' &&
        walker.state !== 'toast' &&
        walker.state !== 'toastWalk' &&
        walker.state !== 'promote'
      ) {
        walker.state = 'drill'
        walker.root.visible = true
        walker.target.set(pad.x + (slot % 2) * 0.55, 0, pad.z + Math.floor(slot / 2) * 0.55)
        walker.root.position.copy(walker.target)
        walker.root.rotation.y = Math.atan2(pad.faceX - pad.x, pad.faceZ - pad.z)
        slot += 1
      } else if (!training && walker.state === 'drill') {
        walker.state = 'idle'
        walker.timer = 0.8
        walker.target.set(PLAZA.min + walker.random() * (PLAZA.max - PLAZA.min), 0, walker.random() * PLAZA.max)
        keepOffFountain(walker.target)
      }
    }
  }

  // Starts the walk out for heroes who just left, and the walk in for those
  // who just came back. Heroes already away when the page opens stay hidden.
  // A lone scout (Docs/depth.md 3d) slips out the south gate without packing.
  private syncAway(away: Set<string>) {
    const leaving: Walker[] = []
    const returning: Walker[] = []
    for (const walker of this.walkers.values()) {
      if (walker.kind === 'roster' && away.has(walker.id) && !walker.away) {
        leaving.push(walker)
      }
    }
    const sneak = leaving.length === 1
    let order = 0
    for (const walker of this.walkers.values()) {
      if (walker.kind !== 'roster') {
        continue
      }
      const isAway = away.has(walker.id)
      if (isAway && !walker.away) {
        walker.away = true
        this.setLoad(walker, false)
        walker.leanOn = null
        walker.slowTo = 0
        if (walker.fresh) {
          walker.state = 'gone'
          walker.root.visible = false
        } else if (sneak) {
          walker.state = 'leave'
          walker.speed = 2.4
          walker.target.set(GATE.x + (walker.random() - 0.5) * 0.6, 0, GATE.z + 0.6)
        } else {
          walker.state = 'gather'
          walker.target.set(GATHER.x + ((order % 3) - 1) * 0.75, 0, GATHER.z + Math.floor(order / 3) * 0.75)
          order += 1
        }
      } else if (!isAway && walker.away) {
        walker.away = false
        returning.push(walker)
      }
      walker.fresh = false
    }
    this.walkHome(returning)
  }

  // The party comes back in through the south gate together: the sound carry
  // the loot, and each wounded hero leans on one of them.
  private walkHome(returning: Walker[]) {
    const wounded = (walker: Walker) => (this.paces.get(walker.id) ?? 1) < PACE.fatigued
    const sound = returning.filter((walker) => !wounded(walker))
    returning.forEach((walker, order) => {
      const dx = ((order % 3) - 1) * 0.75
      const dz = Math.floor(order / 3) * 0.75
      walker.speed = 0.9 + walker.random() * 0.3
      walker.root.visible = true
      walker.root.position.set(GATE.x + dx, 0, GATE.z + dz)
      walker.root.rotation.y = Math.PI
      walker.state = 'arrive'
      walker.target.set(GATHER.x + dx, 0, GATHER.z + 1.2 + dz)
      walker.leanOn = null
      walker.slowTo = 0
      if (!wounded(walker)) {
        this.setLoad(walker, true)
      }
    })
    returning.filter(wounded).forEach((walker, index) => {
      const friend = sound[index % Math.max(1, sound.length)]
      if (friend) {
        walker.leanOn = friend
        friend.slowTo = Math.min(friend.slowTo || 1, this.paces.get(walker.id) ?? 1)
        walker.root.position.set(friend.root.position.x + 0.45, 0, friend.root.position.z)
      }
    })
  }

  private setLoad(walker: Walker, on: boolean) {
    if (on && !walker.load) {
      const load = new Builder()
        .box(0.34, 0.38, 0.22, '#9c7448', 0, 0, 0)
        .box(0.36, 0.06, 0.24, '#5d4433', 0, 0.12, 0)
        .box(0.1, 0.08, 0.1, '#ffd84d', 0.06, 0.23, 0, { glow: true })
        .build({ castShadow: false })
      load.position.set(0, walker.rig.height * 0.55, -0.22)
      walker.root.add(load)
      walker.load = load
    } else if (!on && walker.load) {
      walker.root.remove(walker.load)
      disposeTree(walker.load)
      walker.load = null
    }
  }

  private placeIn(walker: Walker, area: Area) {
    walker.root.position.set(
      area.minX + walker.random() * (area.maxX - area.minX),
      0,
      area.minZ + walker.random() * (area.maxZ - area.minZ),
    )
    keepOffFountain(walker.root.position)
    walker.state = 'idle'
  }

  private setMarker(walker: Walker, on: boolean) {
    if (on && !walker.marker) {
      const marker = new Builder().box(0.14, 0.14, 0.14, '#ffd84d', 0, 0, 0, { glow: true, rx: Math.PI / 4, rz: Math.PI / 4 }).build({ castShadow: false })
      marker.position.y = walker.rig.height + 0.2
      walker.root.add(marker)
      walker.marker = marker
    } else if (!on && walker.marker) {
      walker.root.remove(walker.marker)
      disposeTree(walker.marker)
      walker.marker = null
    }
  }

  private select(id: string | null, roster: Hero[]) {
    const walker = id ? this.walkers.get(id) : undefined
    const hero = roster.find((entry) => entry.id === id)
    const name = hero?.name ?? ''
    if (this.selectedId === id && (!this.selectedLabel || this.selectedLabel.userData.name === name)) {
      if (walker && this.selectedLabel) {
        this.selectedLabel.position.y = walker.rig.height + (walker.marker ? 0.55 : 0.3)
      }
      return
    }
    this.selectedId = id
    this.ring.removeFromParent()
    if (this.selectedLabel) {
      this.selectedLabel.removeFromParent()
      disposeTree(this.selectedLabel)
      this.selectedLabel = null
    }
    if (!walker || !hero || walker.kind !== 'roster') {
      return
    }
    walker.root.add(this.ring)
    const label = makeLabel(name, 0.4)
    label.userData.name = name
    label.position.y = walker.rig.height + (walker.marker ? 0.55 : 0.3)
    walker.root.add(label)
    this.selectedLabel = label
  }

  private resize() {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width === 0 || height === 0) {
      return
    }
    this.renderer.setSize(width, height, false)
    const aspect = width / height
    const size = aspect < 1 ? (FRUSTUM / aspect) * 0.62 : FRUSTUM
    this.camera.left = (-size * aspect) / 2
    this.camera.right = (size * aspect) / 2
    this.camera.top = size / 2
    this.camera.bottom = -size / 2
    this.camera.updateProjectionMatrix()
  }

  private followsSomeone(walker: Walker): boolean {
    if ([...this.spouseOf.values()].includes(walker.id)) {
      return true
    }
    return this.parentOf.has(walker.id)
  }

  private canStroll(walker: Walker | undefined): walker is Walker {
    return walker != null && (walker.state === 'idle' || walker.state === 'walk')
  }

  // The lower id of a couple picks the path. The other, and young children, keep a side slot.
  private steerFamilies() {
    for (const [leaderId, followerId] of this.spouseOf) {
      const leader = this.walkers.get(leaderId)
      const follower = this.walkers.get(followerId)
      if (!this.canStroll(leader) || !this.canStroll(follower)) {
        continue
      }
      this.parkBeside(follower, leader, 0.62)
    }
    for (const [childId, parentId] of this.parentOf) {
      const child = this.walkers.get(childId)
      const parent = this.walkers.get(parentId)
      if (!this.canStroll(child) || !this.canStroll(parent) || child.solo > 0) {
        continue
      }
      this.parkBeside(child, parent, -0.48)
    }
  }

  private parkBeside(follower: Walker, leader: Walker, side: number) {
    const yaw = leader.root.rotation.y
    follower.target.set(leader.root.position.x + Math.cos(yaw) * side, 0, leader.root.position.z - Math.sin(yaw) * side)
    const distance = Math.hypot(follower.target.x - follower.root.position.x, follower.target.z - follower.root.position.z)
    if (distance > 0.18) {
      follower.state = 'walk'
    } else if (follower.state === 'walk') {
      follower.state = 'idle'
      follower.timer = 0.45
    }
  }

  private readonly tick = () => {
    this.frame = requestAnimationFrame(this.tick)
    const delta = Math.min(this.clock.getDelta(), 0.05)
    if (!this.active || document.hidden) {
      return
    }
    const time = this.clock.elapsedTime
    this.steerFamilies()
    for (const walker of this.walkers.values()) {
      this.step(walker, delta, time)
    }
    this.stepMerchant(delta, time)
    this.stepMoods(delta, time)
    this.bobFountain(time)
    this.bobSmoke(time)
    this.bobCrystals(time)
    this.bobToastCups(time)
    this.bobShrine(time)
    this.endToastIfDone()
    this.stepPromoteFx(delta, time)
    this.stepBursts(delta)
    this.controls.update()
    this.clampPan()
    this.renderer.render(this.scene, this.camera)
  }

  private step(walker: Walker, delta: number, time: number) {
    if (walker.marker) {
      walker.marker.rotation.y = time * 2
      walker.marker.position.y = walker.rig.height + 0.2 + Math.sin(time * 3 + walker.phase) * 0.04
    }
    const pace = walker.kind === 'roster' ? (this.paces.get(walker.id) ?? 1) : walker.kind === 'retiree' ? 0.55 : 0.8
    if (walker.solo > 0) {
      walker.solo = Math.max(0, walker.solo - delta)
    }
    if (walker.state === 'gone') {
      return
    }
    if (walker.state === 'vow') {
      idlePose(walker.rig, time, walker.phase)
      this.applyMoralePose(walker)
      walker.timer -= delta
      if (walker.timer <= 0) {
        walker.state = 'idle'
        walker.timer = 1.2
      }
      return
    }
    if (walker.state === 'promote') {
      walker.timer -= delta
      if (walker.timer <= 0) {
        walker.state = 'idle'
        walker.timer = 1.2
        return
      }
      const position = walker.root.position
      const dx = walker.target.x - position.x
      const dz = walker.target.z - position.z
      const distance = Math.hypot(dx, dz)
      if (distance >= 0.08) {
        const stepLength = Math.min(distance, walker.speed * pace * 1.55 * delta)
        position.x += (dx / distance) * stepLength
        position.z += (dz / distance) * stepLength
        keepOffFountain(position)
        walker.root.rotation.y = turnToward(walker.root.rotation.y, Math.atan2(dx, dz), delta * 8)
        walkPose(walker.rig, time, walker.phase, 1.2)
        return
      }
      const hall = LOTS.hall
      walker.root.rotation.y = turnToward(
        walker.root.rotation.y,
        Math.atan2(hall.x - position.x, hall.z - position.z),
        delta * 6,
      )
      idlePose(walker.rig, time, walker.phase)
      const raise = -1.4 + Math.sin(time * 6 + walker.phase) * 0.2
      walker.rig.armR.rotation.set(raise, 0.1, 0.3)
      walker.rig.armL.rotation.set(raise * 0.75, -0.1, -0.25)
      walker.rig.group.position.y = Math.abs(Math.sin(time * 5 + walker.phase)) * 0.04
      return
    }
    if (walker.state === 'toast') {
      walker.root.rotation.y = Math.atan2(
        this.toastCenter.x - walker.root.position.x,
        this.toastCenter.z - walker.root.position.z,
      )
      idlePose(walker.rig, time, walker.phase)
      const raise = -1.55 + Math.sin(time * 7 + walker.phase) * 0.25
      walker.rig.armR.rotation.set(raise, 0.15, 0.35)
      walker.rig.armL.rotation.set(raise * 0.7, -0.1, -0.25)
      walker.rig.group.position.y = Math.abs(Math.sin(time * 5 + walker.phase)) * 0.03
      walker.timer -= delta
      if (walker.timer <= 0) {
        walker.state = 'idle'
        walker.timer = 1 + walker.random() * 0.8
        this.endToastIfDone()
      }
      return
    }
    if (walker.state === 'drill') {
      const pad = trainingPad()
      walker.root.rotation.y = Math.atan2(pad.faceX - walker.root.position.x, pad.faceZ - walker.root.position.z)
      walkPose(walker.rig, time * 2.4, walker.phase, 1.6)
      walker.rig.group.position.y = Math.abs(Math.sin(time * 10 + walker.phase)) * 0.04
      return
    }
    if (walker.state === 'pack') {
      // A little hop while packing supplies, then off to the gate.
      idlePose(walker.rig, time, walker.phase)
      walker.rig.group.position.y = Math.abs(Math.sin(time * 9 + walker.phase)) * 0.07
      walker.timer -= delta
      if (walker.timer <= 0) {
        walker.state = 'leave'
        walker.target.set(GATE.x + (walker.random() - 0.5) * 0.8, 0, GATE.z + 0.6)
      }
      return
    }
    if (walker.state === 'idle') {
      idlePose(walker.rig, time, walker.phase)
      this.applyMoralePose(walker)
      walker.timer -= delta
      if (walker.timer <= 0) {
        if (this.parentOf.has(walker.id) && walker.solo <= 0 && walker.random() < 0.28) {
          walker.solo = 3 + walker.random() * 2
        }
        if (this.followsSomeone(walker) && walker.solo <= 0) {
          walker.timer = 0.6
          return
        }
        this.pickStrollTarget(walker)
        walker.state = 'walk'
        walker.fidget = walker.personality === 'hotheaded' ? 0.8 + walker.random() * 0.6 : 99
      }
      return
    }
    const friend = walker.leanOn
    if (friend) {
      if (walker.state === 'arrive' && friend.state === 'arrive') {
        // At the friend's side, an arm over their shoulder.
        const yaw = friend.root.rotation.y
        walker.target.set(friend.root.position.x + Math.cos(yaw) * 0.42, 0, friend.root.position.z - Math.sin(yaw) * 0.42)
      } else {
        walker.leanOn = null
      }
    }
    const position = walker.root.position
    const dx = walker.target.x - position.x
    const dz = walker.target.z - position.z
    const distance = Math.hypot(dx, dz)
    if (distance < 0.05) {
      if (walker.state === 'gather') {
        walker.state = 'pack'
        walker.timer = 1.2 + walker.random() * 0.6
      } else if (walker.state === 'leave') {
        walker.state = 'gone'
        walker.root.visible = false
      } else if (walker.state === 'toastWalk') {
        walker.state = 'toast'
        walker.timer = 3.4 + walker.random() * 0.8
        walker.root.rotation.y = Math.atan2(
          this.toastCenter.x - walker.root.position.x,
          this.toastCenter.z - walker.root.position.z,
        )
      } else if (walker.leanOn) {
        // Waiting on the friend who is helping them along.
        idlePose(walker.rig, time, walker.phase)
      } else {
        if (walker.state === 'arrive') {
          this.setLoad(walker, false)
          walker.slowTo = 0
        }
        walker.state = 'idle'
        walker.timer = idleSeconds(walker.personality, walker.random)
      }
      return
    }
    if (walker.state === 'walk' && walker.personality === 'hotheaded' && walker.kind === 'roster') {
      walker.fidget -= delta
      if (walker.fidget <= 0) {
        walker.fidget = 0.9 + walker.random() * 0.8
        if (walker.random() < 0.4) {
          this.pickStrollTarget(walker)
        }
      }
    }
    const trait = walker.kind === 'roster' ? strollPace(walker.personality, walker.morale) : 1
    const hurry =
      walker.state === 'gather' || walker.state === 'leave' || walker.state === 'toastWalk'
        ? 1.4
        : walker.solo > 0
          ? 1.65
          : 1
    const carrying = walker.state === 'arrive' && walker.slowTo > 0 ? walker.slowTo / pace : 1
    const lean = walker.leanOn ? 1.6 : 1
    const stepLength = Math.min(distance, walker.speed * pace * trait * hurry * carrying * lean * delta)
    position.x += (dx / distance) * stepLength
    position.z += (dz / distance) * stepLength
    // Slide around the fountain rim instead of through the basin; a little
    // sideways nudge keeps a walker heading straight at it from sticking.
    if (keepOffFountain(position)) {
      const fountain = LOTS.fountain
      const ox = position.x - fountain.x
      const oz = position.z - fountain.z
      const side = ox * dz - oz * dx >= 0 ? 1 : -1
      position.x += (-oz / FOUNTAIN_CLEAR) * side * stepLength * 0.5
      position.z += (ox / FOUNTAIN_CLEAR) * side * stepLength * 0.5
      keepOffFountain(position)
    }
    walker.root.rotation.y = turnToward(walker.root.rotation.y, Math.atan2(dx, dz), delta * 8)
    walkPose(walker.rig, time, walker.phase, walker.speed * pace * trait)
    this.applyMoralePose(walker)
    if (walker.leanOn) {
      // Limping, leaning in toward the friend, the near arm up on their shoulder.
      walker.rig.group.rotation.z = 0.18 + Math.sin(time * 6 + walker.phase) * 0.05
      walker.rig.armL.rotation.set(-0.4, 0, 1.2)
      walker.rig.legR.rotation.x *= 0.3
    }
  }

  private clampPan() {
    const target = this.controls.target
    const x = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, target.x))
    const z = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, target.z))
    if (x !== target.x || z !== target.z) {
      const shift = new THREE.Vector3(x - target.x, 0, z - target.z)
      target.add(shift)
      this.camera.position.add(shift)
    }
  }

  private readonly handleDown = (event: PointerEvent) => {
    this.downAt = [event.clientX, event.clientY]
  }

  private readonly handleUp = (event: PointerEvent) => {
    const start = this.downAt
    this.downAt = null
    if (!start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6) {
      return
    }
    // Small, moving heroes are hard to hit exactly, so pick the hero whose
    // body is nearest the tap within a finger-sized radius.
    const bounds = this.canvas.getBoundingClientRect()
    const point = new THREE.Vector3()
    let best: Walker | null = null
    let bestDistance = PICK_RADIUS
    for (const walker of this.walkers.values()) {
      if (walker.kind !== 'roster' || !walker.root.visible) {
        continue
      }
      point.copy(walker.root.position).setY(walker.rig.height * 0.5).project(this.camera)
      const x = bounds.left + ((point.x + 1) / 2) * bounds.width
      const y = bounds.top + ((1 - point.y) / 2) * bounds.height
      const distance = Math.hypot(event.clientX - x, event.clientY - y)
      if (distance < bestDistance) {
        best = walker
        bestDistance = distance
      }
    }
    if (best) {
      this.onPick(best.id)
      return
    }
    // Otherwise a tap on a building (or its lot) opens that building.
    const pointer = new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(pointer, this.camera)
    const groups = [...this.lots.entries()]
    const hit = this.raycaster.intersectObjects(
      groups.map(([, view]) => view.group),
      true,
    )[0]
    if (!hit) {
      return
    }
    for (const [id, view] of groups) {
      let object: THREE.Object3D | null = hit.object
      while (object && object !== view.group) {
        object = object.parent
      }
      if (object) {
        if (id === 'fountain') {
          this.onWish?.()
        } else {
          this.onPickLot?.(id)
        }
        return
      }
    }
  }
}

function isGenes(value: unknown): value is Genes {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return typeof record.skin === 'string' && typeof record.hair === 'string' && typeof record.eye === 'string'
}

// Desaturate character vertex colours into pale marble while keeping shared materials.
function marbleize(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return
    }
    const colors = object.geometry.getAttribute('color')
    if (!colors) {
      return
    }
    for (let index = 0; index < colors.count; index += 1) {
      const lum = colors.getX(index) * 0.3 + colors.getY(index) * 0.5 + colors.getZ(index) * 0.2
      const tone = 0.58 + lum * 0.32
      colors.setXYZ(index, tone * 0.96, tone * 0.95, tone * 0.9)
    }
    colors.needsUpdate = true
  })
}

function freeOwnMaterials(root: THREE.Object3D) {
  root.traverse((object) => {
    const materials = object.userData.materials as THREE.Material[] | undefined
    materials?.forEach((material) => material.dispose())
  })
}

// Moves a point inside the fountain's clearing out to its edge; says whether it moved.
function keepOffFountain(point: { x: number; z: number }): boolean {
  const fountain = LOTS.fountain
  const dx = point.x - fountain.x
  const dz = point.z - fountain.z
  const distance = Math.hypot(dx, dz)
  if (distance >= FOUNTAIN_CLEAR) {
    return false
  }
  if (distance < 1e-4) {
    point.x = fountain.x + FOUNTAIN_CLEAR
    return true
  }
  point.x = fountain.x + (dx / distance) * FOUNTAIN_CLEAR
  point.z = fountain.z + (dz / distance) * FOUNTAIN_CLEAR
  return true
}

function turnToward(current: number, target: number, step: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI
  if (diff < -Math.PI) {
    diff += Math.PI * 2
  }
  return current + Math.max(-step, Math.min(step, diff))
}
