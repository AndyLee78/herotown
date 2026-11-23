import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { familyRules, type BuildingId, type Hero } from '../../core'
import { buildCharacter, idlePose, walkPose, type Rig } from './character'
import { Builder, disposeTree, makeLabel } from './kit'
import { hashString, lookFor, lookKey, seeded } from './look'
import { GATE, GATHER, INN_YARD, LOTS, PLAZA, buildCemetery, buildLot, buildTerrain } from './world'

export type VillageSceneProps = {
  roster: Hero[]
  visitors: Hero[]
  // Heroes out on an expedition: they walk out of town and back in.
  awayIds: string[]
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
}

type Area = { minX: number; maxX: number; minZ: number; maxZ: number }

type Walker = {
  id: string
  kind: 'roster' | 'visitor' | 'retiree'
  root: THREE.Group
  rig: Rig
  key: string
  // gather → pack → leave → gone when a party sets out; arrive when it comes home.
  state: 'idle' | 'walk' | 'gather' | 'pack' | 'leave' | 'gone' | 'arrive' | 'vow'
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
}

type LotView = { key: string; group: THREE.Group; label: THREE.Sprite | null; labelText: string; top: number }

const FRUSTUM = 14
const CAMERA_OFFSET = new THREE.Vector3(16, 16, 16)
const PAN_LIMIT = 9
const PICK_RADIUS = 28
const PLAZA_AREA: Area = { minX: PLAZA.min, maxX: PLAZA.max, minZ: PLAZA.min, maxZ: PLAZA.max }
const YARD_AREA: Area = INN_YARD
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
    this.syncGate(props.expeditions)
    this.syncFamily(living, new Set(props.awayIds))
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
    freeOwnMaterials(this.scene)
    disposeTree(this.scene)
    this.renderer.dispose()
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

  private burst(x: number, y: number, z: number, kind: 'wedding' | 'star') {
    const group = new THREE.Group()
    group.position.set(x, y, z)
    const colors = kind === 'star' ? ['#ffe08a', '#fff6c8', '#ffd84d'] : ['#e0584f', '#ff8fa3', '#f4b4c4', '#fff4ea']
    const count = kind === 'star' ? 8 : 16
    for (let index = 0; index < count; index += 1) {
      const size = kind === 'star' ? 0.22 : 0.16 + (index % 3) * 0.04
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, kind === 'star' ? size : size * 0.45, size * 0.7),
        new THREE.MeshBasicMaterial({ color: colors[index % colors.length] }),
      )
      const angle = (index / count) * Math.PI * 2
      const speed = kind === 'star' ? 0.35 : 0.7
      mesh.userData.velocity = new THREE.Vector3(Math.cos(angle) * speed * 0.55, 0.8 + (index % 4) * 0.15, Math.sin(angle) * speed * 0.55)
      group.add(mesh)
    }
    this.scene.add(group)
    this.bursts.push({ group, life: 2.6 })
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
      const key = lookKey(look)
      const existing = this.walkers.get(hero.id)
      if (existing && existing.key === key && existing.kind === kind) {
        continue
      }
      if (existing) {
        existing.root.remove(existing.rig.group)
        disposeTree(existing.rig.group)
        existing.rig = buildCharacter(look)
        existing.root.add(existing.rig.group)
        existing.key = key
        if (existing.kind !== kind) {
          existing.kind = kind
          this.placeIn(existing, kind === 'visitor' ? YARD_AREA : PLAZA_AREA)
        }
        if (existing.marker) {
          existing.marker.position.y = existing.rig.height + 0.2
        }
        continue
      }
      const random = seeded(hashString(hero.id) ^ 0x9e3779b9)
      const walker: Walker = {
        id: hero.id,
        kind,
        root: new THREE.Group(),
        rig: buildCharacter(look),
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
      }
      walker.root.add(walker.rig.group)
      this.placeIn(walker, kind === 'visitor' ? YARD_AREA : PLAZA_AREA)
      walker.root.rotation.y = random() * Math.PI * 2
      this.actors.add(walker.root)
      this.walkers.set(hero.id, walker)
    }
    for (const [id, walker] of this.walkers) {
      if (!seen.has(id)) {
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

  // Starts the walk out for heroes who just left, and the walk in for those
  // who just came back. Heroes already away when the page opens stay hidden.
  private syncAway(away: Set<string>) {
    let order = 0
    for (const walker of this.walkers.values()) {
      if (walker.kind !== 'roster') {
        continue
      }
      const isAway = away.has(walker.id)
      if (isAway && !walker.away) {
        walker.away = true
        if (walker.fresh) {
          walker.state = 'gone'
          walker.root.visible = false
        } else {
          walker.state = 'gather'
          walker.target.set(GATHER.x + ((order % 3) - 1) * 0.75, 0, GATHER.z + Math.floor(order / 3) * 0.75)
          order += 1
        }
      } else if (!isAway && walker.away) {
        walker.away = false
        walker.root.visible = true
        walker.root.position.set(GATE.x + (walker.random() - 0.5) * 1.2, 0, GATE.z)
        walker.state = 'arrive'
        walker.target.set(PLAZA.min + walker.random() * (PLAZA.max - PLAZA.min), 0, walker.random() * PLAZA.max)
      }
      walker.fresh = false
    }
  }

  private placeIn(walker: Walker, area: Area) {
    walker.root.position.set(
      area.minX + walker.random() * (area.maxX - area.minX),
      0,
      area.minZ + walker.random() * (area.maxZ - area.minZ),
    )
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
    this.bobFountain(time)
    this.bobSmoke(time)
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
      walker.timer -= delta
      if (walker.timer <= 0) {
        walker.state = 'idle'
        walker.timer = 1.2
      }
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
      walker.timer -= delta
      if (walker.timer <= 0) {
        if (this.parentOf.has(walker.id) && walker.solo <= 0 && walker.random() < 0.28) {
          walker.solo = 3 + walker.random() * 2
        }
        if (this.followsSomeone(walker) && walker.solo <= 0) {
          walker.timer = 0.6
          return
        }
        const area = walker.kind === 'visitor' ? YARD_AREA : PLAZA_AREA
        walker.target.set(
          area.minX + walker.random() * (area.maxX - area.minX),
          0,
          area.minZ + walker.random() * (area.maxZ - area.minZ),
        )
        walker.state = 'walk'
      }
      return
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
      } else {
        walker.state = 'idle'
        walker.timer = 1.5 + walker.random() * 4
      }
      return
    }
    const hurry = walker.state === 'gather' || walker.state === 'leave' ? 1.4 : walker.solo > 0 ? 1.65 : 1
    const stepLength = Math.min(distance, walker.speed * pace * hurry * delta)
    position.x += (dx / distance) * stepLength
    position.z += (dz / distance) * stepLength
    walker.root.rotation.y = turnToward(walker.root.rotation.y, Math.atan2(dx, dz), delta * 8)
    walkPose(walker.rig, time, walker.phase, walker.speed * pace)
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

function freeOwnMaterials(root: THREE.Object3D) {
  root.traverse((object) => {
    const materials = object.userData.materials as THREE.Material[] | undefined
    materials?.forEach((material) => material.dispose())
  })
}

function turnToward(current: number, target: number, step: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI
  if (diff < -Math.PI) {
    diff += Math.PI * 2
  }
  return current + Math.max(-step, Math.min(step, diff))
}
