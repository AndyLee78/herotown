import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import type { BuildingId, Hero } from '../../core'
import { buildCharacter, idlePose, walkPose, type Rig } from './character'
import { Builder, disposeTree, makeLabel } from './kit'
import { hashString, lookFor, lookKey, seeded } from './look'
import { GATE, GATHER, INN_YARD, LOTS, PLAZA, buildLot, buildTerrain } from './world'

export type VillageSceneProps = {
  roster: Hero[]
  visitors: Hero[]
  // Heroes out on an expedition: they walk out of town and back in.
  awayIds: string[]
  partyIds: string[]
  selectedId: string | null
  buildings: Record<BuildingId, number>
  constructing: BuildingId | null
  labels: Record<BuildingId, string>
}

type Area = { minX: number; maxX: number; minZ: number; maxZ: number }

type Walker = {
  id: string
  kind: 'roster' | 'visitor'
  root: THREE.Group
  rig: Rig
  key: string
  // gather → pack → leave → gone when a party sets out; arrive when it comes home.
  state: 'idle' | 'walk' | 'gather' | 'pack' | 'leave' | 'gone' | 'arrive'
  away: boolean
  fresh: boolean
  timer: number
  target: THREE.Vector3
  speed: number
  phase: number
  random: () => number
  marker: THREE.Object3D | null
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
  private active = true
  private downAt: [number, number] | null = null
  private readonly raycaster = new THREE.Raycaster()

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onPick: (id: string) => void,
    private readonly onPickLot?: (id: BuildingId) => void,
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
    const living = props.roster.filter((hero) => hero.condition !== 'dead')
    this.syncWalkers([
      ...living.map((hero) => ({ hero, kind: 'roster' as const })),
      ...props.visitors.map((hero) => ({ hero, kind: 'visitor' as const })),
    ])
    this.paces = new Map(living.map((hero) => [hero.id, PACE[hero.condition]]))
    this.syncAway(new Set(props.awayIds))
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
    disposeTree(this.scene)
    this.renderer.dispose()
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
          this.placeIn(existing, kind === 'roster' ? PLAZA_AREA : YARD_AREA)
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
      }
      walker.root.add(walker.rig.group)
      this.placeIn(walker, kind === 'roster' ? PLAZA_AREA : YARD_AREA)
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

  private readonly tick = () => {
    this.frame = requestAnimationFrame(this.tick)
    const delta = Math.min(this.clock.getDelta(), 0.05)
    if (!this.active || document.hidden) {
      return
    }
    const time = this.clock.elapsedTime
    for (const walker of this.walkers.values()) {
      this.step(walker, delta, time)
    }
    this.controls.update()
    this.clampPan()
    this.renderer.render(this.scene, this.camera)
  }

  private step(walker: Walker, delta: number, time: number) {
    if (walker.marker) {
      walker.marker.rotation.y = time * 2
      walker.marker.position.y = walker.rig.height + 0.2 + Math.sin(time * 3 + walker.phase) * 0.04
    }
    const pace = walker.kind === 'roster' ? (this.paces.get(walker.id) ?? 1) : 0.8
    if (walker.state === 'gone') {
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
        const area = walker.kind === 'roster' ? PLAZA_AREA : YARD_AREA
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
    const hurry = walker.state === 'gather' || walker.state === 'leave' ? 1.4 : 1
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
        this.onPickLot?.(id)
        return
      }
    }
  }
}

function turnToward(current: number, target: number, step: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI
  if (diff < -Math.PI) {
    diff += Math.PI * 2
  }
  return current + Math.max(-step, Math.min(step, diff))
}
