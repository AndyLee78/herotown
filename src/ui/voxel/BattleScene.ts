import * as THREE from 'three'
import { monsterById, type AffixId, type DungeonReport, type Gear, type ReplayUnit } from '../../core'
import { buildCharacter, walkPose } from './character'
import { buildEnemy, idleActor, type Actor } from './enemies'
import { Builder, disposeTree } from './kit'
import { gearStyleOf, lookFor, seeded } from './look'
import type { Hit, ReplayStep, StatusMark } from './replay'

export type RaidBossId = 'wyrm' | 'lich' | 'titan'

export type EventSeason = 'spring' | 'summer' | 'autumn' | 'winter'

export type BattleBackdrop = {
  special?: 'weekday' | 'endless' | 'raid' | 'invasion' | 'event'
  element?: 'flame' | 'frost' | 'light'
  season?: EventSeason
  difficulty?: 1 | 2 | 3
  abyssFrom?: number
  // Weekly raid boss and its health pool for the big bar on floor 2 (Docs/endgame.md 4c).
  raidBossId?: RaidBossId
  raid?: { start: number | null; left?: number; max?: number }
  // Worn gear by hero id so weapon/armour types show in the replay (5b).
  gearByHero?: Record<string, Pick<Gear, 'grade' | 'slot' | 'type' | 'unique'>[]>
}

type BattleTheme = {
  sky: string
  floor: readonly string[]
  wall: readonly string[]
  light: string
  crystal: string
  kind: 'tier' | 'nest' | 'flame' | 'frost' | 'light' | 'abyss' | 'wyrm' | 'lich' | 'titan' | 'invasion' | EventSeason
  intensity: number
}

const RAID_BOSS_OF: Record<string, RaidBossId> = {
  elder_dragon: 'wyrm',
  crypt_lord: 'lich',
  citadel_lord: 'titan',
}

export function raidBossIdOf(refId: string): RaidBossId | null {
  return RAID_BOSS_OF[refId] ?? null
}

// Pool health for the raid bar when the expedition did not carry trip.raid.
export function raidPoolFromReport(report: DungeonReport): { start: number; left: number; max: number; bossId: RaidBossId } | null {
  const floor = report.floors?.[1]
  if (!floor) {
    return null
  }
  const boss = floor.find((unit) => unit.boss && unit.side === 'enemy') ?? floor.find((unit) => unit.side === 'enemy' && raidBossIdOf(unit.refId))
  if (!boss) {
    return null
  }
  const bossId = raidBossIdOf(boss.refId) ?? 'wyrm'
  const end = report.units.find((unit) => unit.id === boss.id)
  return { start: boss.hp, left: end?.hp ?? 0, max: boss.maxHp, bossId }
}

// Plays a dungeon report back as a 3D auto battle. The outcome is already
// decided by the core; this only shows the steps in order.

type AnimType = 'melee' | 'cast' | 'hit' | 'shout' | 'spawn' | 'die' | 'flee' | 'cheer' | 'drink' | 'disarm' | 'ambush' | 'brace' | 'charge' | 'exit' | 'dodge' | 'rise' | 'retaliate'

type Anim = {
  type: AnimType
  t: number
  dur: number
  impactAt?: number
  onImpact?: () => void
  fired?: boolean
  to?: THREE.Vector3
  dir?: THREE.Vector3
  // 'exit': seconds of cheering (or catching breath) before walking off, and
  // whether the walk is a limp after a defeat.
  hold?: number
  limp?: boolean
}

type Fighter = {
  id: string
  side: 'hero' | 'enemy'
  ranged: boolean
  caster: boolean
  elite: boolean
  actor: Actor
  root: THREE.Group
  home: THREE.Vector3
  facing: number
  hp: number
  max: number
  alive: boolean
  dead: boolean
  anim: Anim | null
  // A downed hero carried out on a friend's shoulders after the fight.
  carriedBy: Fighter | null
  phase: number
  baseScale: number
  bar: { group: THREE.Group; fill: THREE.Mesh }
  marks: THREE.Group
}

type Projectile = { mesh: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; spin: boolean; onArrive: () => void }
type Particle = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }
type Floater = { sprite: THREE.Sprite; t: number }

export type BattleSound = 'hit' | 'heal' | 'victory' | 'defeat'

export type BattleCallbacks = {
  onStep: (logIndex: number) => void
  onDone: () => void
  onSound?: (name: BattleSound) => void
}

const VIEW_WIDTH = 11.5
const VIEW_HEIGHT = 6.2
const CAMERA_OFFSET = new THREE.Vector3(0, 9, 11)
const LOOK_AT = new THREE.Vector3(0, 0.4, 0.4)
const HERO_FACING = Math.PI / 2 - 0.5
const ENEMY_FACING = -Math.PI / 2 + 0.5
const DURATION: Record<ReplayStep['type'], number> = {
  floor: 1.1,
  attack: 0.75,
  heal: 0.65,
  taunt: 0.6,
  buff: 0.6,
  debuff: 0.6,
  dot: 0.45,
  burn: 0.45,
  status: 0.35,
  potion: 0.7,
  trap: 0.7,
  trapHit: 0.35,
  disarm: 0.75,
  alert: 0.45,
  ambush: 0.95,
  charge: 0.85,
  blast: 0.9,
  interrupt: 0.8,
  brace: 0.45,
  phase: 0.7,
  summon: 0.9,
  volley: 0.55,
  weaken: 0.4,
  cleanse: 0.45,
  miss: 0.4,
  thorns: 0.4,
  twin: 0.25,
  enrage: 0.7,
  purge: 0.5,
  undying: 0.7,
  revive: 0.85,
  guardian: 1.0,
  clear: 0.8,
  retreat: 1.4,
  end: 0,
}
const CASTERS = new Set(['mage', 'cleric', 'bard', 'crypt_lord', 'wraith', 'necromancer', 'kobold_mystic'])
const BURN_COLOR = '#ff8a3d'
const SHIELD_COLOR = '#7fe3ff'
const ELITE_SCALE = 1.12
const STATUS_COLOR: Record<StatusMark, string> = { poison: '#6fbf4a', paralyze: '#ffe14a', slow: '#c4a574', silence: '#e05a4a' }
const POTION_COLOR: Record<string, string> = { heal: '#8ef08a', antidote: '#7dff9a', tonic: '#ffe14a', clarity: '#d7c4ff' }
const THEMES = {
  1: { sky: '#2a2622', floor: ['#7a6a58', '#6f604f', '#84735f', '#756553'], wall: ['#5a4c40', '#524538', '#625244'], light: '#ffb85a', crystal: '#9fe8ff', kind: 'tier' as const, intensity: 1 },
  2: { sky: '#24262a', floor: ['#6a6660', '#625e58', '#726d66', '#5d5953'], wall: ['#4a4744', '#53504c', '#44413e'], light: '#ffa64d', crystal: '#ffcf5a', kind: 'tier' as const, intensity: 1 },
  3: { sky: '#1e1f2a', floor: ['#4e5266', '#565a70', '#4a4d60', '#525670'], wall: ['#3b3e4f', '#34374a', '#40435a'], light: '#c79bff', crystal: '#b48cff', kind: 'tier' as const, intensity: 1 },
  nest: { sky: '#2a1210', floor: ['#5a3a30', '#4a2e28', '#6a4438', '#52342c'], wall: ['#4a2a22', '#3a1e18', '#5a3228'], light: '#ff6a3a', crystal: '#ffcf5a', kind: 'nest' as const, intensity: 2 },
  flame: { sky: '#2a1008', floor: ['#6a2e1a', '#5a2414', '#7a3820', '#4a1c10'], wall: ['#4a1e12', '#3a160c', '#5a2818'], light: '#ff6a3a', crystal: '#ffcf5a', kind: 'flame' as const, intensity: 1 },
  frost: { sky: '#101828', floor: ['#6a8498', '#5a7488', '#7a94a8', '#4a6478'], wall: ['#3a5068', '#2a4058', '#4a6078'], light: '#9fe8ff', crystal: '#d7f4ff', kind: 'frost' as const, intensity: 1 },
  light: { sky: '#2a2418', floor: ['#d4c8a8', '#c8b898', '#e0d4b8', '#bcac88'], wall: ['#b8a888', '#a89878', '#c8b898'], light: '#ffe27a', crystal: '#fff6c8', kind: 'light' as const, intensity: 1 },
  abyss: { sky: '#12081a', floor: ['#2a1838', '#221430', '#321c40', '#1a1028'], wall: ['#1a1028', '#140c20', '#221430'], light: '#9b6bff', crystal: '#c79bff', kind: 'abyss' as const, intensity: 1 },
  // Weekly raid arenas (Docs/endgame.md 4c).
  wyrm: { sky: '#2a0c08', floor: ['#5a2414', '#4a1c10', '#6a3020', '#3a1408'], wall: ['#3a160c', '#2a1008', '#4a2014'], light: '#ff6a3a', crystal: '#ffcf5a', kind: 'wyrm' as const, intensity: 2 },
  lich: { sky: '#0c1424', floor: ['#4a6078', '#3a5068', '#5a7088', '#2a4058'], wall: ['#2a3850', '#1a2840', '#3a4860'], light: '#9fe8ff', crystal: '#e6f4ff', kind: 'lich' as const, intensity: 2 },
  titan: { sky: '#1c1a18', floor: ['#6a6460', '#5a5450', '#7a746e', '#4a4440'], wall: ['#4a4440', '#3a3430', '#5a5450'], light: '#d9b54a', crystal: '#c9c5bb', kind: 'titan' as const, intensity: 2 },
  invasion: { sky: '#2a1010', floor: ['#5a3a30', '#4a2e28', '#6a4438', '#52342c'], wall: ['#3a2218', '#2a1810', '#4a2e24'], light: '#ff4a3a', crystal: '#ff8a3d', kind: 'invasion' as const, intensity: 2 },
  // Seasonal event arenas (Docs/endgame.md 4d).
  spring: { sky: '#1e2a1c', floor: ['#5a7a48', '#4a6a38', '#6a8a58', '#3a5a28'], wall: ['#3a5a30', '#2a4a20', '#4a6a40'], light: '#9fd36b', crystal: '#f4a0c0', kind: 'spring' as const, intensity: 2 },
  summer: { sky: '#2a1c10', floor: ['#7a5a38', '#6a4a28', '#8a6a48', '#5a3a18'], wall: ['#5a3a22', '#4a2a12', '#6a4a32'], light: '#ff8a3d', crystal: '#ffe27a', kind: 'summer' as const, intensity: 2 },
  autumn: { sky: '#2a1810', floor: ['#8a5a30', '#7a4a20', '#9a6a40', '#6a3a18'], wall: ['#5a3a1c', '#4a2a10', '#6a4a2c'], light: '#e2b340', crystal: '#c45c3a', kind: 'autumn' as const, intensity: 2 },
  winter: { sky: '#141c28', floor: ['#7a8a9a', '#6a7a8a', '#8a9aaa', '#5a6a7a'], wall: ['#4a5a6a', '#3a4a5a', '#5a6a7a'], light: '#d7f4ff', crystal: '#9fe8ff', kind: 'winter' as const, intensity: 2 },
} as const

const AFFIX_COLOR: Record<AffixId, string> = {
  venom: '#6fbf4a',
  traps: '#c4a574',
  ambush: '#6a6a6a',
  charged: '#ff6a3a',
  silence: '#e05a4a',
  paralyze: '#ffe14a',
  swift: '#7fe3ff',
  noRest: '#ff8a3d',
}

export function battleTheme(tier: number, dungeonId?: string, backdrop?: BattleBackdrop): BattleTheme {
  if (dungeonId === 'dragon_nest') {
    return THEMES.nest
  }
  if (backdrop?.special === 'weekday' && backdrop.element) {
    const base = THEMES[backdrop.element]
    return { ...base, intensity: backdrop.difficulty ?? 1 }
  }
  if (backdrop?.special === 'endless') {
    const depth = backdrop.abyssFrom ?? 0
    const t = Math.min(1, depth / 40)
    return {
      ...THEMES.abyss,
      sky: mixThemeColor('#12081a', '#1a0808', t),
      floor: THEMES.abyss.floor.map((hex) => mixThemeColor(hex, '#3a1418', t * 0.55)),
      wall: THEMES.abyss.wall.map((hex) => mixThemeColor(hex, '#2a0c10', t * 0.45)),
      light: mixThemeColor('#9b6bff', '#ff4a4a', t * 0.7),
      crystal: mixThemeColor('#c79bff', '#ff8a6a', t * 0.6),
      intensity: 1 + Math.floor(depth / 20),
    }
  }
  if (backdrop?.special === 'raid') {
    return THEMES[backdrop.raidBossId ?? 'wyrm']
  }
  if (backdrop?.special === 'invasion') {
    return THEMES.invasion
  }
  if (backdrop?.special === 'event' && backdrop.season) {
    return THEMES[backdrop.season]
  }
  return THEMES[(Math.min(3, Math.max(1, tier)) as 1 | 2 | 3)]
}

function mixThemeColor(a: string, b: string, t: number): string {
  const clamp = Math.min(1, Math.max(0, t))
  const parse = (hex: string) => {
    const value = hex.replace('#', '')
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)] as const
  }
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${hex(ar + (br - ar) * clamp)}${hex(ag + (bg - ag) * clamp)}${hex(ab + (bb - ab) * clamp)}`
}

export class BattleScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  private readonly clock = new THREE.Clock()
  private readonly resizer: ResizeObserver
  private readonly fighters = new Map<string, Fighter>()
  private readonly bars = new THREE.Group()
  private readonly projectiles: Projectile[] = []
  private readonly particles: Particle[] = []
  private readonly floaters: Floater[] = []
  private readonly embers: { mesh: THREE.Mesh; base: THREE.Vector3; phase: number; speed: number }[] = []
  private readonly numberTextures = new Map<string, THREE.CanvasTexture>()
  private readonly sparkGeometry = new THREE.BoxGeometry(1, 1, 1)
  private readonly sparkMaterials = new Map<string, THREE.MeshBasicMaterial>()
  private readonly random = seeded(7)
  private index = 0
  private wait = 0
  private speed = 1
  private running = true
  private quiet = false
  private frame = 0
  private shake = 0
  private readonly nest: boolean
  private readonly abyssFrom: number
  private readonly themeKind: BattleTheme['kind']
  private readonly raidSpecial: boolean
  private readonly raidPool: { start: number; left: number; max: number } | null
  private floorLabel: THREE.Sprite | null = null
  private readonly debris: { mesh: THREE.Mesh; base: THREE.Vector3; phase: number; speed: number }[] = []
  private wingShadow: THREE.Mesh | null = null
  private raidBar: { root: THREE.Group; fill: THREE.Mesh; max: number } | null = null
  private raidBossId: string | null = null
  private readonly gearByHero: Record<string, Pick<Gear, 'grade' | 'slot' | 'type' | 'unique'>[]>

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly report: DungeonReport,
    private readonly steps: ReplayStep[],
    tier: number,
    private readonly callbacks: BattleCallbacks,
    backdrop: BattleBackdrop = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.nest = report.dungeonId === 'dragon_nest'
    this.abyssFrom = backdrop.abyssFrom ?? 0
    this.gearByHero = backdrop.gearByHero ?? {}
    this.raidSpecial = backdrop.special === 'raid'
    const fromReport = this.raidSpecial ? raidPoolFromReport(report) : null
    const bossId = backdrop.raidBossId ?? fromReport?.bossId
    const theme = battleTheme(tier, report.dungeonId, { ...backdrop, raidBossId: bossId })
    this.themeKind = theme.kind
    const start = backdrop.raid?.start ?? fromReport?.start ?? null
    const max = backdrop.raid?.max ?? fromReport?.max ?? null
    const left = backdrop.raid?.left ?? fromReport?.left ?? null
    this.raidPool = this.raidSpecial && max != null && max > 0 ? { start: start ?? max, left: left ?? max, max } : null
    this.scene.background = new THREE.Color(theme.sky)
    const warm = theme.kind === 'flame' || theme.kind === 'nest' || theme.kind === 'abyss' || theme.kind === 'wyrm' || theme.kind === 'invasion' || theme.kind === 'summer' || theme.kind === 'autumn'
    const cool = theme.kind === 'frost' || theme.kind === 'lich' || theme.kind === 'winter'
    this.scene.add(new THREE.HemisphereLight(warm ? '#ffb080' : cool ? '#d0e8ff' : theme.kind === 'spring' ? '#e8ffe0' : '#ffffff', warm ? '#5a3020' : cool ? '#405060' : theme.kind === 'spring' ? '#4a6a40' : '#6b6256', warm ? 1.2 : 1.5))
    const sun = new THREE.DirectionalLight(
      theme.kind === 'flame' || theme.kind === 'nest' || theme.kind === 'wyrm' || theme.kind === 'invasion' || theme.kind === 'summer'
        ? '#ff6a3a'
        : theme.kind === 'light' || theme.kind === 'autumn'
          ? '#ffe8a8'
          : cool
            ? '#c8e8ff'
            : theme.kind === 'abyss'
              ? '#c79bff'
              : theme.kind === 'titan'
                ? '#e8dcc0'
                : theme.kind === 'spring'
                  ? '#c8f0a0'
                  : '#fff1dc',
      warm ? 1.6 : 2,
    )
    sun.position.set(warm ? -2 : 4, 12, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 })
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    this.scene.add(sun, sun.target, this.bars)
    this.scene.add(this.buildArena(theme))
    if (this.nest || theme.kind === 'flame' || theme.kind === 'wyrm' || theme.kind === 'invasion' || theme.kind === 'summer') {
      this.spawnEmbers(theme.light)
    }
    if (theme.kind === 'spring' || theme.kind === 'autumn' || theme.kind === 'winter') {
      this.spawnDebris(theme.crystal)
    }
    if (theme.kind === 'abyss') {
      this.spawnDebris(theme.crystal)
      this.setFloorLabel(this.abyssFrom + 1)
    }
    if (theme.kind === 'wyrm') {
      this.spawnWingShadow()
    }
    if (this.raidPool) {
      this.buildRaidBar(this.raidPool.max, this.raidPool.start)
      this.setRaidBarVisible(false)
    }
    this.camera.position.copy(LOOK_AT).add(CAMERA_OFFSET)
    this.camera.lookAt(LOOK_AT)
    this.resizer = new ResizeObserver(() => this.resize())
    this.resizer.observe(canvas)
    this.resize()
    this.frame = requestAnimationFrame(this.tick)
  }

  get playing(): boolean {
    return this.running && this.index < this.steps.length
  }

  setPlaying(playing: boolean) {
    this.running = playing
  }

  setSpeed(speed: number) {
    this.speed = speed
  }

  restart() {
    for (const fighter of this.fighters.values()) {
      this.removeFighter(fighter)
    }
    this.fighters.clear()
    for (const projectile of this.projectiles.splice(0)) {
      this.scene.remove(projectile.mesh)
      disposeTree(projectile.mesh)
    }
    this.index = 0
    this.wait = 0
    this.running = true
  }

  // Jumps to `seconds` into the replay (at 1× speed) without animating the
  // part it skips, so a live view can join a fight already in progress.
  seek(seconds: number) {
    this.quiet = true
    let start = 0
    let last: ReplayStep | null = null
    while (this.index < this.steps.length) {
      const step = this.steps[this.index]
      if (!step || start > seconds) {
        break
      }
      this.index += 1
      this.apply(step, true)
      last = step
      start += DURATION[step.type]
    }
    for (const fighter of this.fighters.values()) {
      fighter.anim = null
    }
    this.quiet = false
    this.wait = Math.max(0, start - seconds)
    if (last) {
      this.callbacks.onStep(last.log)
    }
    if (this.index >= this.steps.length) {
      this.exitAfterJump()
      this.callbacks.onDone()
    }
  }

  // Jumps to the final state without animation.
  skip() {
    // Already at the end: let whatever is playing (the walk out) finish.
    if (this.index >= this.steps.length && this.projectiles.length === 0) {
      return
    }
    this.quiet = true
    for (const projectile of this.projectiles.splice(0)) {
      this.scene.remove(projectile.mesh)
      disposeTree(projectile.mesh)
      projectile.onArrive()
    }
    while (this.index < this.steps.length) {
      const step = this.steps[this.index]
      this.index += 1
      if (step) {
        this.apply(step, true)
      }
    }
    for (const fighter of this.fighters.values()) {
      fighter.anim = null
    }
    this.quiet = false
    const last = this.steps[this.steps.length - 1]
    if (last) {
      this.callbacks.onStep(last.log)
    }
    this.exitAfterJump()
    this.callbacks.onDone()
  }

  // A jump to the end still lets the party walk out: the live view jumps there
  // the moment the fight's time is up, which used to cut the exit off.
  private exitAfterJump() {
    const last = this.steps[this.steps.length - 1]
    const fled = this.steps.some((step) => step.type === 'retreat')
    if (last?.type === 'end' && !fled && ![...this.fighters.values()].some((fighter) => fighter.anim?.type === 'exit')) {
      this.walkOut(last.victory)
    }
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.resizer.disconnect()
    disposeTree(this.scene)
    for (const texture of this.numberTextures.values()) {
      texture.dispose()
    }
    for (const material of this.sparkMaterials.values()) {
      material.dispose()
    }
    this.sparkGeometry.dispose()
    this.renderer.dispose()
  }

  private buildArena(theme: BattleTheme): THREE.Group {
    const random = seeded(11)
    const pick = (list: readonly string[]) => list[Math.floor(random() * list.length)] as string
    const b = new Builder()
    for (let x = -9; x < 9; x += 1) {
      for (let z = -4; z < 7; z += 1) {
        b.box(1, 0.4, 1, pick(theme.floor), x + 0.5, -0.2, z + 0.5)
      }
    }
    for (let x = -9; x < 9; x += 1) {
      const h = 1.6 + random() * 1.6
      b.box(1, h, 1, pick(theme.wall), x + 0.5, h / 2, -4.5)
    }
    for (const x of [-5.5, -1.5, 2.5, 6.5]) {
      b.box(0.12, 0.5, 0.12, '#3a2a20', x, 1.3, -3.9).box(0.2, 0.22, 0.2, theme.light, x, 1.62, -3.9, { glow: true })
    }
    for (const [x, z] of [[-7, 2.5], [6.8, 3], [-6.5, -2.8], [7, -2.5], [-8, 5], [8.2, 5.5]] as const) {
      b.box(0.5 + random() * 0.4, 0.3 + random() * 0.3, 0.5 + random() * 0.4, pick(theme.wall), x, 0.2, z)
    }
    for (const [x, z] of [[-7.6, -3.2], [7.4, 1.2], [-8.2, 3.6]] as const) {
      b.box(0.25, 0.6, 0.25, theme.crystal, x, 0.3, z, { glow: true }).box(0.18, 0.4, 0.18, theme.crystal, x + 0.25, 0.2, z + 0.1, { glow: true })
    }
    this.decorateArena(b, theme, random)
    return b.build()
  }

  private decorateArena(b: Builder, theme: BattleTheme, random: () => number) {
    const dense = theme.intensity
    if (theme.kind === 'flame') {
      for (let index = 0; index < 2 + dense; index += 1) {
        const x = -6 + index * (10 / (1 + dense)) + random() * 0.4
        const z = -2.8 + random() * 4
        b.box(0.45, 0.2, 0.45, '#3a1a10', x, 0.15, z)
        b.box(0.28, 0.9 + dense * 0.2, 0.28, '#ff6a3a', x, 0.7, z, { glow: true })
        b.box(0.16, 0.45, 0.16, '#ffd36b', x, 1.25 + dense * 0.1, z, { glow: true })
      }
      for (let index = 0; index < dense; index += 1) {
        b.box(0.8 + random() * 0.4, 0.12, 0.6 + random() * 0.3, '#ff4a2a', -4 + index * 3.5, 0.08, 4.2 + random(), { glow: true })
      }
    } else if (theme.kind === 'frost') {
      for (let index = 0; index < 3 + dense; index += 1) {
        const x = -7 + index * 2.2 + random() * 0.3
        const z = -3.2 + (index % 2) * 1.2
        const h = 0.8 + dense * 0.25 + random() * 0.4
        b.box(0.22, h, 0.22, '#d7f4ff', x, h / 2, z, { glow: true })
        b.box(0.12, h * 0.6, 0.12, '#9fe8ff', x + 0.2, h * 0.35, z + 0.1, { glow: true })
      }
      for (let index = 0; index < dense + 1; index += 1) {
        b.box(1.1, 0.1, 0.9, '#a8d0e8', -5 + index * 4, 0.08, 3.5 + random())
      }
    } else if (theme.kind === 'light') {
      for (let index = 0; index < 2 + dense; index += 1) {
        const x = -5.5 + index * 3.5
        b.box(0.35, 1.6 + dense * 0.2, 0.35, '#e8dcc0', x, 0.9, -3.6)
        b.box(0.55, 0.12, 0.55, '#d9b54a', x, 1.75 + dense * 0.1, -3.6)
        b.box(0.22, 0.7, 0.22, '#ffe27a', x, 2.15 + dense * 0.1, -3.6, { glow: true })
      }
      for (const x of [-7.2, 0, 7.2].slice(0, dense + 1)) {
        b.box(0.5, 0.08, 0.5, '#fff6c8', x, 0.12, 4.5, { glow: true })
      }
    } else if (theme.kind === 'abyss') {
      for (let index = 0; index < 4 + dense; index += 1) {
        const x = -7.5 + random() * 15
        const z = -3 + random() * 8
        const s = 0.2 + random() * 0.35
        b.box(s, s * 0.4, s * 0.8, theme.wall[0]!, x, 0.15 + random() * 0.4, z)
      }
      for (let index = 0; index < 2 + dense; index += 1) {
        const x = -6 + index * 4 + random()
        b.box(0.18, 0.9, 0.18, theme.crystal, x, 0.55, -3.5, { glow: true })
      }
    } else if (theme.kind === 'wyrm') {
      for (let index = 0; index < 4; index += 1) {
        const x = -6.5 + index * 3.5
        b.box(0.7, 0.18, 1.2, '#ff4a2a', x, 0.1, 3.8 + random() * 0.4, { glow: true })
        b.box(0.35, 1.1, 0.35, '#ff6a3a', x, 0.75, -3.2, { glow: true })
      }
      b.box(4.5, 0.2, 2.2, '#3a1408', 1.5, 0.12, 1.2)
    } else if (theme.kind === 'lich') {
      b.box(1.4, 0.35, 1.0, '#c9d4e0', 2.2, 0.3, 1.0)
      b.box(0.9, 1.3, 0.7, '#8a9aac', 2.2, 1.05, 0.9)
      b.box(1.1, 0.2, 0.9, '#d7f4ff', 2.2, 1.75, 0.9, { glow: true })
      for (let index = 0; index < 5; index += 1) {
        const x = -7 + index * 2.4
        b.box(0.2, 1.2 + random() * 0.5, 0.2, '#e6f4ff', x, 0.7, -3.3, { glow: true })
      }
    } else if (theme.kind === 'titan') {
      for (const [x, z, h] of [[-6.5, -2.8, 2.4], [-4.2, -3.2, 1.8], [5.5, -2.6, 2.8], [7.2, 2.5, 1.4], [-7.5, 3.2, 1.6]] as const) {
        const wall = theme.wall[Math.floor(random() * theme.wall.length)] ?? theme.wall[0]!
        b.box(0.9 + random() * 0.4, h, 0.7 + random() * 0.3, wall, x, h / 2, z)
      }
      b.box(2.2, 0.35, 0.9, '#8a8580', 0.5, 0.25, 3.5)
      b.box(0.7, 0.7, 0.7, '#d9b54a', 6.2, 0.45, 1.2, { glow: true })
    } else if (theme.kind === 'invasion') {
      for (let index = 0; index < 3; index += 1) {
        b.box(0.12, 1.5, 0.12, '#5a3a28', -5 + index * 4, 0.85, -3.5)
        b.box(0.55, 0.7, 0.05, '#c0392b', -5 + index * 4 + 0.35, 1.4, -3.5)
      }
      for (let index = 0; index < 4; index += 1) {
        b.box(0.45, 0.2, 0.45, '#3a2a20', -6 + index * 3.2, 0.15, 3.5)
        b.box(0.28, 0.55, 0.28, '#ff6a3a', -6 + index * 3.2, 0.55, 3.5, { glow: true })
      }
    } else if (theme.kind === 'spring') {
      for (let index = 0; index < 6; index += 1) {
        const x = -7 + index * 2.4 + random() * 0.3
        b.box(0.35, 0.12, 0.35, '#6a4a30', x, 0.12, 3.2 + random())
        b.box(0.14, 0.14, 0.14, index % 2 ? '#f4a0c0' : '#ffe08a', x, 0.28, 3.2)
        b.box(0.12, 0.12, 0.12, '#9fd36b', x + 0.12, 0.26, 3.3)
      }
      for (let index = 0; index < 4; index += 1) {
        b.box(0.2, 1.0, 0.2, '#4a6a38', -6 + index * 3.5, 0.6, -3.4)
        b.box(0.55, 0.35, 0.55, '#6fbf4a', -6 + index * 3.5, 1.15, -3.4)
      }
    } else if (theme.kind === 'summer') {
      for (let index = 0; index < 4; index += 1) {
        const x = -6 + index * 3.5
        b.box(0.1, 1.4, 0.1, '#6b4a30', x, 0.8, -3.4)
        b.box(0.45, 0.55, 0.05, '#e2b340', x + 0.3, 1.35, -3.4)
        b.box(0.5, 0.2, 0.5, '#3a2a20', x, 0.15, 3.6)
        b.box(0.3, 0.55, 0.3, '#ff8a3d', x, 0.55, 3.6, { glow: true })
      }
    } else if (theme.kind === 'autumn') {
      for (let index = 0; index < 5; index += 1) {
        const x = -7 + index * 3
        b.box(0.55, 0.45, 0.55, '#c45c3a', x, 0.35, 3.4)
        b.box(0.35, 0.2, 0.35, '#e2b340', x, 0.65, 3.4)
        b.box(0.25, 0.08, 0.4, '#8a3a1a', -6.5 + index * 2.8, 0.1, -2.8 + random())
      }
      for (let index = 0; index < 3; index += 1) {
        b.box(0.25, 1.2, 0.25, '#6a4a28', -5 + index * 4, 0.7, -3.5)
        b.box(0.7, 0.4, 0.7, '#c45c3a', -5 + index * 4, 1.35, -3.5)
      }
    } else if (theme.kind === 'winter') {
      for (let index = 0; index < 5; index += 1) {
        const x = -7 + index * 2.8
        const h = 0.7 + random() * 0.6
        b.box(0.22, h, 0.22, '#e6f4ff', x, h / 2, -3.3, { glow: true })
        b.box(0.9, 0.1, 0.7, '#d0e0f0', -6 + index * 3, 0.08, 3.5)
      }
      b.box(1.6, 0.9, 0.9, '#8a9aac', 2.4, 0.55, 1.0)
      b.box(1.2, 0.2, 0.7, '#d7f4ff', 2.4, 1.1, 1.0, { glow: true })
    }
  }

  private resize() {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width === 0 || height === 0) {
      return
    }
    this.renderer.setSize(width, height, false)
    // Fit both rows of both sides: at least VIEW_WIDTH wide and VIEW_HEIGHT tall.
    const aspect = width / height
    const halfHeight = Math.max(VIEW_HEIGHT / 2, VIEW_WIDTH / 2 / aspect)
    this.camera.left = -halfHeight * aspect
    this.camera.right = halfHeight * aspect
    this.camera.top = halfHeight
    this.camera.bottom = -halfHeight
    this.camera.updateProjectionMatrix()
  }

  private readonly tick = () => {
    this.frame = requestAnimationFrame(this.tick)
    const raw = Math.min(this.clock.getDelta(), 0.05)
    if (document.hidden) {
      return
    }
    const time = this.clock.elapsedTime
    const dt = this.running ? raw * this.speed : 0
    if (this.running && this.index < this.steps.length) {
      this.wait -= dt
      if (this.wait <= 0 && this.projectiles.length === 0) {
        const step = this.steps[this.index]
        this.index += 1
        if (step) {
          this.apply(step, false)
          this.callbacks.onStep(step.log)
          this.wait = DURATION[step.type]
        }
        if (this.index >= this.steps.length) {
          this.callbacks.onDone()
        }
      }
    }
    for (const fighter of this.fighters.values()) {
      // The walk out runs on the wall clock, so it still shows when the replay
      // is sped up or paused at the end, and fits the trip's return time.
      this.animate(fighter, fighter.anim?.type === 'exit' ? raw : dt, time)
    }
    this.updateEffects(dt)
    this.updateEmbers(time)
    this.syncRaidBar()
    if (this.wingShadow) {
      this.wingShadow.position.x = 1.2 + Math.sin(time * 0.55) * 1.4
      this.wingShadow.scale.x = 1 + Math.sin(time * 0.7) * 0.08
      const material = this.wingShadow.material as THREE.MeshBasicMaterial
      material.opacity = 0.22 + (Math.sin(time * 0.9) * 0.5 + 0.5) * 0.18
    }
    this.camera.position.copy(LOOK_AT).add(CAMERA_OFFSET)
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt)
      const strength = this.shake * 0.35
      this.camera.position.x += (this.random() - 0.5) * strength
      this.camera.position.y += (this.random() - 0.5) * strength * 0.5
    }
    this.camera.lookAt(LOOK_AT)
    this.renderer.render(this.scene, this.camera)
  }

  private apply(step: ReplayStep, instant: boolean) {
    switch (step.type) {
      case 'floor':
        this.startFloor(step.units, instant, step.floor)
        if (this.themeKind === 'abyss') {
          this.setFloorLabel(this.abyssFrom + step.floor)
        }
        if (step.affixes?.length && !instant) {
          this.showAffixes(step.affixes)
        }
        break
      case 'attack':
        this.attack(step.actorId, step.hits, step.downs, instant, step.counter)
        return
      case 'heal': {
        const target = this.fighters.get(step.targetId)
        const healer = this.fighters.get(step.actorId)
        this.act(step.actorId, 'cast', instant, () => {
          if (target) {
            target.hp = Math.min(target.max, target.hp + step.amount)
            this.number(`+${step.amount}`, '#5fe07a', target)
            this.burst(this.chest(target), '#8ef08a', 10)
            // Monster menders (necromancer, mystic, wisp) light the ally green.
            if (healer?.side === 'enemy') {
              this.burst(this.chest(target).setY(target.actor.height * 0.8), '#7dff9a', 8)
            }
            if (!instant) {
              this.callbacks.onSound?.('heal')
            }
          }
        })
        break
      }
      case 'taunt':
        this.act(step.actorId, 'shout', instant, () => {
          const actor = this.fighters.get(step.actorId)
          if (actor) {
            this.number('!', '#ff7a5a', actor)
            this.burst(this.chest(actor), '#ff7a5a', 10)
          }
        })
        break
      case 'buff':
      case 'debuff': {
        const actor = this.fighters.get(step.actorId)
        const side = step.type === 'buff' ? actor?.side : actor?.side === 'hero' ? 'enemy' : 'hero'
        this.act(step.actorId, 'cast', instant, () => {
          for (const fighter of this.fighters.values()) {
            if (fighter.side === side && fighter.alive) {
              this.burst(this.chest(fighter), step.type === 'buff' ? '#ffe27a' : '#b48cff', 6)
            }
          }
        })
        break
      }
      case 'dot': {
        const target = this.fighters.get(step.targetId)
        if (target) {
          this.setStatus(target, 'poison', true)
          this.damage(target, step.amount, '#9be36a', instant)
        }
        break
      }
      case 'burn': {
        const target = this.fighters.get(step.targetId)
        if (target) {
          this.damage(target, step.amount, BURN_COLOR, instant)
          if (!instant) {
            this.burst(this.chest(target), BURN_COLOR, 10)
            this.burst(this.chest(target).setY(target.actor.height * 0.9), '#ffcf5a', 6)
          }
        }
        break
      }
      case 'miss': {
        const target = this.fighters.get(step.targetId)
        if (target && !instant) {
          const away = target.side === 'hero' ? -1 : 1
          target.anim = { type: 'dodge', t: 0, dur: DURATION.miss, dir: new THREE.Vector3(0, 0, away) }
          this.burst(this.chest(target), '#dfe4ea', 5)
        }
        break
      }
      case 'thorns': {
        const source = this.fighters.get(step.actorId)
        const target = this.fighters.get(step.targetId)
        if (target) {
          if (source && !instant) {
            source.anim = { type: 'retaliate', t: 0, dur: DURATION.thorns, dir: target.root.position.clone().sub(source.root.position).setY(0).normalize() }
          }
          this.damage(target, step.amount, '#9be36a', instant)
          if (!instant) {
            this.burst(this.chest(target), '#6fbf4a', 8)
          }
        }
        break
      }
      case 'twin': {
        const actor = this.fighters.get(step.actorId)
        if (actor && !instant) {
          this.burst(this.chest(actor), '#ffe27a', 6)
          this.number('×2', '#ffe27a', actor)
        }
        break
      }
      case 'enrage': {
        const boss = this.fighters.get(step.actorId)
        if (boss) {
          if (!instant) {
            boss.anim = { type: 'shout', t: 0, dur: DURATION.enrage }
            this.burst(this.chest(boss), '#e05a4a', 16)
            this.burst(boss.root.position.clone().setY(0.2), '#ff4b3a', 10)
          }
          const next = boss.baseScale * 1.18
          boss.actor.group.scale.setScalar(next)
          boss.baseScale = next
          this.number('!', '#ff4b3a', boss)
        }
        break
      }
      case 'purge': {
        const boss = this.fighters.get(step.actorId)
        if (boss && !instant) {
          this.burst(this.chest(boss), '#f7f4ee', 14)
          this.burst(boss.root.position.clone().setY(boss.actor.height * 0.4), '#ffffff', 8)
        }
        break
      }
      case 'undying': {
        const hero = this.fighters.get(step.actorId)
        if (hero && !instant) {
          hero.anim = { type: 'rise', t: 0, dur: DURATION.undying }
          this.burst(this.chest(hero), '#ffe27a', 10)
          this.number('1', '#ffe27a', hero)
        }
        break
      }
      case 'revive': {
        const fallen = this.fighters.get(step.targetId)
        const saint = this.fighters.get(step.actorId)
        if (saint && !instant) {
          this.act(step.actorId, 'cast', instant, () => undefined)
        }
        if (fallen) {
          this.raiseFighter(fallen, Math.max(1, Math.round(fallen.max * 0.3)), instant, '#fff6c8')
        }
        break
      }
      case 'guardian': {
        if (!instant) {
          this.shake = Math.max(this.shake, 0.25)
        }
        for (const fighter of this.fighters.values()) {
          if (fighter.side === 'hero') {
            this.raiseFighter(fighter, Math.max(1, Math.round(fighter.max * 0.4)), instant, '#ffe27a')
          }
        }
        break
      }
      case 'status': {
        const target = this.fighters.get(step.targetId)
        if (target) {
          this.setStatus(target, step.status, step.on)
          if (step.on && !instant) {
            this.burst(this.chest(target), STATUS_COLOR[step.status], 6)
          }
        }
        break
      }
      case 'potion': {
        const drinker = this.fighters.get(step.actorId)
        if (drinker && !instant) {
          this.holdBottle(drinker)
        }
        this.act(step.actorId, 'drink', instant, () => {
          if (!drinker) {
            return
          }
          this.burst(this.chest(drinker), POTION_COLOR[step.potion] ?? '#fff6c8', 12)
          if (step.potion === 'antidote') {
            this.setStatus(drinker, 'poison', false)
          }
          if (step.potion === 'tonic') {
            this.setStatus(drinker, 'paralyze', false)
            this.setStatus(drinker, 'slow', false)
          }
          if (step.potion === 'clarity') {
            this.setStatus(drinker, 'silence', false)
          }
        })
        break
      }
      case 'trap':
        this.springTraps(instant)
        break
      case 'trapHit': {
        const victim = this.fighters.get(step.targetId)
        if (victim) {
          this.damage(victim, step.amount, '#c9a36b', instant)
        }
        break
      }
      case 'disarm': {
        const rogue = this.fighters.get(step.actorId)
        this.act(step.actorId, 'disarm', instant, () => {
          if (!rogue) {
            return
          }
          this.burst(this.chest(rogue), '#d9b54a', 8)
          const gear = gearIcon()
          gear.position.set(0, 0.25, 0)
          rogue.marks.add(gear)
          window.setTimeout(() => {
            rogue.marks.remove(gear)
            disposeTree(gear)
          }, 700)
        })
        break
      }
      case 'alert': {
        const watcher = this.fighters.get(step.actorId)
        if (watcher) {
          this.number('!', '#ffe14a', watcher)
          this.burst(new THREE.Vector3(watcher.root.position.x, watcher.actor.height + 0.4, watcher.root.position.z), '#ffe14a', 6)
        }
        break
      }
      case 'ambush': {
        const hunter = this.fighters.get(step.actorId)
        const prey = this.fighters.get(step.targetId)
        if (!hunter || !prey) {
          break
        }
        const beside = prey.root.position.clone()
        beside.x += hunter.side === 'enemy' ? -0.85 : 0.85
        beside.z += 0.15
        if (instant) {
          this.damage(prey, step.amount, '#ff7a5a', true)
          break
        }
        this.burst(hunter.root.position.clone().setY(0.4), '#6a6a6a', 10)
        hunter.anim = {
          type: 'ambush',
          t: 0,
          dur: DURATION.ambush,
          to: beside,
          onImpact: () => {
            this.burst(beside.clone().setY(0.5), '#6a6a6a', 8)
            this.damage(prey, step.amount, '#ff7a5a', false)
          },
          impactAt: 0.35,
        }
        break
      }
      case 'charge': {
        const boss = this.fighters.get(step.actorId)
        if (!boss) {
          break
        }
        this.number('!', '#ff4b3a', boss)
        if (!instant) {
          boss.anim = { type: 'charge', t: 0, dur: DURATION.charge }
          this.burst(this.chest(boss), '#c79bff', 14)
          this.burst(boss.root.position.clone().setY(0.2), '#7fe3ff', 10)
        }
        break
      }
      case 'blast': {
        const boss = this.fighters.get(step.actorId)
        for (const fighter of this.fighters.values()) {
          if (fighter.anim?.type === 'brace' || fighter.anim?.type === 'charge') {
            fighter.anim = null
          }
        }
        if (boss && !instant) {
          boss.anim = { type: 'shout', t: 0, dur: 0.55 }
        }
        const origin = boss ? this.chest(boss) : new THREE.Vector3(1.5, 0.8, 0.4)
        if (!instant) {
          this.burst(origin, '#ff7a5a', 18)
          this.burst(new THREE.Vector3(-1.2, 0.5, 0.4), '#ffe27a', 12)
        }
        for (const hit of step.hits) {
          const target = this.fighters.get(hit.targetId)
          if (target) {
            this.damage(target, hit.amount, '#ff7a5a', instant)
          }
        }
        break
      }
      case 'interrupt': {
        const breaker = this.fighters.get(step.actorId)
        const boss = this.fighters.get(step.targetId)
        if (!breaker) {
          break
        }
        if (boss?.anim?.type === 'charge') {
          boss.anim = null
        }
        if (instant) {
          this.burst(boss ? this.chest(boss) : this.chest(breaker), '#ffe27a', 10)
          break
        }
        if (breaker.ranged || breaker.caster) {
          this.act(step.actorId, 'cast', false, () => {
            if (boss) {
              this.burst(this.chest(boss), '#ffe27a', 16)
            }
          })
        } else {
          const to = boss ? boss.root.position.clone() : breaker.home.clone().add(new THREE.Vector3(1.2, 0, 0))
          to.x -= 0.7
          breaker.anim = {
            type: 'melee',
            t: 0,
            dur: DURATION.interrupt,
            to,
            impactAt: 0.35,
            onImpact: () => {
              if (boss) {
                this.burst(this.chest(boss), '#ffe27a', 16)
              }
            },
          }
        }
        break
      }
      case 'brace': {
        const hero = this.fighters.get(step.actorId)
        if (hero && !instant) {
          hero.anim = { type: 'brace', t: 0, dur: 8 }
        }
        break
      }
      case 'phase': {
        const boss = this.fighters.get(step.actorId)
        if (!boss) {
          break
        }
        if (!instant) {
          boss.anim = { type: 'shout', t: 0, dur: DURATION.phase }
          this.burst(this.chest(boss), '#e05a4a', 16)
          const base = boss.actor.group.scale.x
          boss.actor.group.scale.setScalar(base * 1.12)
        }
        this.number(String(step.phase), '#ff7a5a', boss)
        break
      }
      case 'summon':
        this.summonAdds(step.units, step.refs, step.hps, instant)
        break
      case 'volley': {
        const actor = this.fighters.get(step.actorId)
        if (actor && !instant) {
          this.act(step.actorId, actor.ranged || actor.caster ? 'cast' : 'melee', instant, () => {
            const origin = this.chest(actor)
            for (let index = 0; index < 7; index += 1) {
              const angle = -0.9 + (index / 6) * 1.8
              const tip = origin.clone().add(new THREE.Vector3(Math.cos(angle) * 2.4 * (actor.side === 'hero' ? 1 : -1), 0.1, Math.sin(angle) * 1.6))
              this.burst(tip, '#ffe27a', 4)
            }
            this.burst(origin, '#ffb04a', 10)
          })
        }
        break
      }
      case 'weaken': {
        const target = this.fighters.get(step.targetId)
        if (target) {
          this.banner('▼', '#c4a574', target.root.position.clone().setY(target.actor.height + 0.7))
          this.burst(this.chest(target), '#c4a574', 8)
        }
        break
      }
      case 'cleanse': {
        const target = this.fighters.get(step.targetId)
        if (target) {
          const chest = this.chest(target)
          this.burst(chest, '#7dff9a', 14)
          this.burst(chest.clone().setY(chest.y + 0.4), '#b8f5c8', 8)
        }
        break
      }
      case 'clear':
        for (const fighter of this.fighters.values()) {
          if (fighter.side === 'hero' && fighter.alive && !instant) {
            fighter.anim = { type: 'shout', t: 0, dur: 0.45 }
          }
        }
        break
      case 'retreat':
        for (const fighter of this.fighters.values()) {
          if (fighter.side === 'hero' && fighter.alive) {
            if (instant) {
              fighter.root.visible = false
              fighter.bar.group.visible = false
            } else {
              fighter.anim = { type: 'flee', t: 0, dur: 1.4 }
            }
          }
        }
        break
      case 'end':
        if (!instant) {
          this.callbacks.onSound?.(step.victory ? 'victory' : 'defeat')
        }
        if (step.victory && !instant) {
          for (const fighter of this.fighters.values()) {
            if (fighter.side === 'hero' && fighter.alive) {
              this.burst(this.chest(fighter).setY(1.6), pickColor(this.random), 8)
            }
          }
        }
        if (!instant) {
          this.walkOut(step.victory)
        }
        break
    }
    this.down(step.downs, instant)
  }

  // After the fight the party walks back out the way it came: cheering first
  // after a win, limping after a loss, with downed friends on their shoulders.
  private walkOut(victory: boolean) {
    const standing = [...this.fighters.values()].filter((fighter) => fighter.side === 'hero' && fighter.alive && fighter.root.visible)
    // A retreat already has them running off.
    if (standing.length === 0 || standing.some((fighter) => fighter.anim?.type === 'flee')) {
      return
    }
    const hold = victory ? 1.6 : 0.5
    const walk = victory ? 3 : 4.4
    for (const fighter of standing) {
      fighter.anim = { type: 'exit', t: 0, dur: hold + walk, hold, limp: !victory }
    }
    const downed = [...this.fighters.values()].filter((fighter) => fighter.side === 'hero' && !fighter.alive && fighter.dead)
    downed.forEach((fighter, index) => {
      fighter.carriedBy = standing[index % standing.length] ?? null
    })
  }

  private startFloor(units: ReplayUnit[], instant: boolean, floor = 1) {
    for (const fighter of [...this.fighters.values()]) {
      if (fighter.side === 'enemy') {
        this.removeFighter(fighter)
        this.fighters.delete(fighter.id)
      }
    }
    for (const fighter of this.fighters.values()) {
      this.clearStatuses(fighter)
    }
    this.raidBossId = null
    for (const side of ['hero', 'enemy'] as const) {
      for (const row of ['front', 'back'] as const) {
        const group = units.filter((unit) => unit.side === side && unit.row === row)
        group.forEach((unit, order) => {
          const fighter = this.fighters.get(unit.id) ?? this.addFighter(unit)
          const depth = side === 'hero' ? (row === 'front' ? -1.5 : -3.2) : row === 'front' ? (unit.boss ? 1.8 : 1.5) : 3.2
          const spacing = row === 'front' ? 2 : 1.9
          fighter.home.set(depth, 0, (order - (group.length - 1) / 2) * spacing + 0.4)
          fighter.root.position.copy(fighter.home)
          fighter.hp = unit.hp
          fighter.max = unit.maxHp
          fighter.alive = unit.hp > 0
          fighter.dead = unit.hp <= 0
          if (side === 'enemy' && !instant) {
            fighter.anim = { type: 'spawn', t: 0, dur: 0.6 + order * 0.1 }
          }
          if (this.raidSpecial && floor >= 2 && unit.side === 'enemy' && (unit.boss || raidBossIdOf(unit.refId))) {
            this.raidBossId = unit.id
          }
        })
      }
    }
    if (this.raidPool && this.raidBar) {
      const show = floor >= 2 && this.raidBossId != null
      this.setRaidBarVisible(show)
      if (show) {
        const boss = this.raidBossId ? this.fighters.get(this.raidBossId) : null
        this.setRaidBarHp(boss?.hp ?? this.raidPool.start)
      }
    }
  }

  private showAffixes(affixes: AffixId[]) {
    affixes.forEach((id, index) => {
      const color = AFFIX_COLOR[id]
      const x = (index - (affixes.length - 1) / 2) * 1.4
      const pos = new THREE.Vector3(x, 2.4, 0.4)
      this.burst(pos, color, 14)
      this.banner(id, color, pos)
    })
  }

  private banner(text: string, color: string, at: THREE.Vector3) {
    const key = `affix:${text}:${color}`
    let texture = this.numberTextures.get(key)
    if (!texture) {
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 64
      const context = canvas.getContext('2d')
      if (!context) {
        return
      }
      context.clearRect(0, 0, 160, 64)
      context.font = 'bold 28px sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineWidth = 8
      context.strokeStyle = 'rgba(30, 20, 16, 0.9)'
      context.strokeText(text, 80, 32)
      context.fillStyle = color
      context.fillText(text, 80, 32)
      texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      this.numberTextures.set(key, texture)
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }))
    sprite.renderOrder = 22
    sprite.scale.set(1.6, 0.64, 1)
    sprite.position.copy(at)
    this.scene.add(sprite)
    this.floaters.push({ sprite, t: 0 })
  }

  private spawnEmbers(color = '#ff8a3d') {
    let material = this.sparkMaterials.get(color)
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color, transparent: true })
      this.sparkMaterials.set(color, material)
    }
    for (let index = 0; index < 28; index += 1) {
      const mesh = new THREE.Mesh(this.sparkGeometry, material)
      mesh.scale.setScalar(0.04 + this.random() * 0.05)
      const base = new THREE.Vector3((this.random() - 0.5) * 10, this.random() * 3, (this.random() - 0.5) * 6)
      mesh.position.copy(base)
      this.scene.add(mesh)
      this.embers.push({ mesh, base, phase: this.random() * Math.PI * 2, speed: 0.4 + this.random() * 0.6 })
    }
  }

  private spawnWingShadow() {
    let material = this.sparkMaterials.get('wingShadow')
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: '#1a0808', transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      this.sparkMaterials.set('wingShadow', material)
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.2), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(1.2, 0.06, 0.6)
    this.scene.add(mesh)
    this.wingShadow = mesh
  }

  private buildRaidBar(max: number, current: number) {
    const root = new THREE.Group()
    root.position.set(0, 3.55, -2.4)
    const bg = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 0.08), new THREE.MeshBasicMaterial({ color: '#2a1810' }))
    const fill = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.14, 0.1), new THREE.MeshBasicMaterial({ color: '#e05a4a' }))
    fill.position.z = 0.02
    root.add(bg, fill)
    this.scene.add(root)
    this.raidBar = { root, fill, max }
    this.setRaidBarHp(current)
  }

  private setRaidBarVisible(show: boolean) {
    if (this.raidBar) {
      this.raidBar.root.visible = show
    }
  }

  private setRaidBarHp(current: number) {
    if (!this.raidBar) {
      return
    }
    const share = Math.max(0, Math.min(1, current / this.raidBar.max))
    this.raidBar.fill.scale.x = Math.max(0.001, share)
    this.raidBar.fill.position.x = (share - 1) * 2.5
  }

  private syncRaidBar() {
    if (!this.raidBar?.root.visible || !this.raidBossId) {
      return
    }
    const boss = this.fighters.get(this.raidBossId)
    if (boss) {
      this.setRaidBarHp(boss.hp)
    }
  }

  private spawnDebris(color: string) {
    let material = this.sparkMaterials.get(`debris:${color}`)
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 })
      this.sparkMaterials.set(`debris:${color}`, material)
    }
    for (let index = 0; index < 18; index += 1) {
      const mesh = new THREE.Mesh(this.sparkGeometry, material)
      const size = 0.08 + this.random() * 0.12
      mesh.scale.set(size, size * 0.45, size * 0.7)
      const base = new THREE.Vector3((this.random() - 0.5) * 12, 0.8 + this.random() * 2.4, (this.random() - 0.5) * 8)
      mesh.position.copy(base)
      this.scene.add(mesh)
      this.debris.push({ mesh, base, phase: this.random() * Math.PI * 2, speed: 0.25 + this.random() * 0.35 })
    }
  }

  private setFloorLabel(floor: number) {
    const key = `abyss-floor:${floor}`
    let texture = this.numberTextures.get(key)
    if (!texture) {
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 64
      const context = canvas.getContext('2d')
      if (!context) {
        return
      }
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = 'rgba(18, 8, 26, 0.55)'
      context.fillRect(8, 12, 144, 40)
      context.font = 'bold 28px sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#e6d4ff'
      context.fillText(`${floor}`, 80, 34)
      texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      this.numberTextures.set(key, texture)
    }
    if (!this.floorLabel) {
      this.floorLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }))
      this.floorLabel.renderOrder = 30
      this.floorLabel.scale.set(1.4, 0.56, 1)
      this.floorLabel.position.set(-6.2, 3.4, -2.2)
      this.scene.add(this.floorLabel)
    } else {
      this.floorLabel.material.map = texture
      this.floorLabel.material.needsUpdate = true
    }
  }

  private updateEmbers(time: number) {
    for (const ember of this.embers) {
      const rise = ((time * ember.speed + ember.phase) % 4) / 4
      ember.mesh.position.set(
        ember.base.x + Math.sin(time * 1.2 + ember.phase) * 0.25,
        0.2 + rise * 3.6,
        ember.base.z + Math.cos(time * 0.9 + ember.phase) * 0.2,
      )
      ember.mesh.scale.setScalar(0.03 + (1 - rise) * 0.06)
      const material = ember.mesh.material as THREE.MeshBasicMaterial
      material.opacity = 0.35 + (1 - rise) * 0.55
      material.transparent = true
    }
    for (const piece of this.debris) {
      piece.mesh.position.set(
        piece.base.x + Math.sin(time * piece.speed + piece.phase) * 0.55,
        piece.base.y + Math.sin(time * 0.7 + piece.phase) * 0.35,
        piece.base.z + Math.cos(time * piece.speed * 0.8 + piece.phase) * 0.45,
      )
      piece.mesh.rotation.y = time * piece.speed + piece.phase
      piece.mesh.rotation.x = time * 0.4 + piece.phase
    }
  }

  private addFighter(unit: ReplayUnit): Fighter {
    let actor: Actor
    let caster = false
    if (unit.side === 'hero') {
      const hero = this.report.party?.find((entry) => entry.id === unit.id)
      const face = hero ?? { id: unit.id, classId: 'warrior' as const, gender: 'male' as const, age: 25 }
      actor = buildCharacter(lookFor(face), gearStyleOf(this.gearByHero[unit.id] ?? []))
      caster = CASTERS.has(hero?.classId ?? '')
    } else {
      actor = buildEnemy(unit.refId)
      caster = CASTERS.has(unit.refId)
    }
    const elite = Boolean(unit.elite)
    if (elite) {
      actor.group.scale.multiplyScalar(ELITE_SCALE)
      actor.height *= ELITE_SCALE
    }
    const baseScale = actor.group.scale.x
    const root = new THREE.Group()
    root.add(actor.group)
    if (elite) {
      root.add(eliteAura())
    }
    const facing = unit.side === 'hero' ? HERO_FACING : ENEMY_FACING
    root.rotation.y = facing
    this.scene.add(root)
    const bar = new THREE.Group()
    bar.add(new Builder().box(0.62, 0.09, 0.02, '#2b2b2b').build({ castShadow: false, receiveShadow: false }))
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.055, 0.03),
      new THREE.MeshBasicMaterial({ color: unit.side === 'hero' ? '#6cd26a' : elite ? '#ff6a3a' : '#e05a4a' }),
    )
    fill.position.z = 0.01
    bar.add(fill)
    this.bars.add(bar)
    const marks = new THREE.Group()
    this.scene.add(marks)
    const fighter: Fighter = {
      id: unit.id,
      side: unit.side,
      ranged: unit.reach === 'ranged',
      caster,
      elite,
      actor,
      root,
      home: new THREE.Vector3(),
      facing,
      hp: unit.hp,
      max: unit.maxHp,
      alive: unit.hp > 0,
      dead: unit.hp <= 0,
      anim: null,
      carriedBy: null,
      phase: this.random() * 10,
      baseScale,
      bar: { group: bar, fill },
      marks,
    }
    this.fighters.set(unit.id, fighter)
    return fighter
  }

  private removeFighter(fighter: Fighter) {
    this.scene.remove(fighter.root)
    disposeTree(fighter.root)
    this.bars.remove(fighter.bar.group)
    this.scene.remove(fighter.marks)
    disposeTree(fighter.marks)
    disposeTree(fighter.bar.group)
    ;(fighter.bar.fill.material as THREE.Material).dispose()
  }

  private setStatus(fighter: Fighter, status: StatusMark, on: boolean) {
    const current = fighter.marks.getObjectByName(status)
    if (on && !current) {
      const icon = statusIcon(status)
      icon.name = status
      fighter.marks.add(icon)
    }
    if (!on && current) {
      fighter.marks.remove(current)
      disposeTree(current)
    }
  }

  private clearStatuses(fighter: Fighter) {
    for (const status of ['poison', 'paralyze', 'slow', 'silence'] as const) {
      this.setStatus(fighter, status, false)
    }
  }

  private summonAdds(ids: string[], refs: string[], hps: number[], instant: boolean) {
    const existing = [...this.fighters.values()].filter((fighter) => fighter.side === 'enemy' && fighter.alive)
    ids.forEach((id, index) => {
      if (this.fighters.has(id)) {
        return
      }
      const refId = refs[index] ?? refs[0] ?? 'skeleton'
      const def = monsterById(refId)
      const unit: ReplayUnit = {
        id,
        refId,
        side: 'enemy',
        row: def?.row ?? 'front',
        reach: def?.reach ?? 'melee',
        hp: hps[index] ?? def?.hp ?? 80,
        maxHp: hps[index] ?? def?.hp ?? 80,
        boss: def?.boss ?? false,
      }
      const fighter = this.addFighter(unit)
      const order = existing.length + index
      const row = unit.row
      const depth = row === 'front' ? 1.5 : 3.2
      const spacing = row === 'front' ? 2 : 1.9
      fighter.home.set(depth, 0, (order % 4 - 1.5) * spacing + 0.4)
      fighter.root.position.copy(fighter.home)
      if (instant) {
        return
      }
      this.burst(fighter.home.clone().setY(0.5), '#6a6a6a', 10)
      fighter.anim = { type: 'spawn', t: 0, dur: 0.65 + index * 0.08 }
    })
  }

  private springTraps(instant: boolean) {
    if (instant || this.quiet) {
      return
    }
    let material = this.sparkMaterials.get('#8a8f98')
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: '#8a8f98' })
      this.sparkMaterials.set('#8a8f98', material)
    }
    for (const [x, z] of [[-1.6, 0.4], [-0.4, -0.3], [0.8, 0.5], [-1.1, 1.1], [0.2, 1.0]] as const) {
      const spike = new THREE.Mesh(this.sparkGeometry, material)
      spike.scale.set(0.12, 0.7, 0.12)
      spike.position.set(x, 0.02, z)
      this.scene.add(spike)
      this.particles.push({
        mesh: spike,
        life: 0.65,
        velocity: new THREE.Vector3(0, 1.6, 0),
      })
    }
    this.burst(new THREE.Vector3(-0.4, 0.3, 0.4), '#c9a36b', 14)
  }

  private holdBottle(fighter: Fighter) {
    const existing = fighter.actor.group.getObjectByName('bottle')
    if (existing) {
      fighter.actor.group.remove(existing)
      disposeTree(existing)
    }
    const bottle = new Builder()
      .box(0.08, 0.16, 0.08, '#8fd4ef')
      .box(0.07, 0.04, 0.07, '#8a5a32', 0, 0.1, 0)
      .box(0.06, 0.08, 0.04, '#6fbf4a', 0, 0.02, 0.05)
      .build({ castShadow: false })
    bottle.name = 'bottle'
    bottle.position.set(0.24, fighter.actor.height * 0.55, 0.12)
    fighter.actor.group.add(bottle)
  }

  private attack(actorId: string, hits: Hit[], downs: string[], instant: boolean, counter = false) {
    const actor = this.fighters.get(actorId)
    const targets = hits.flatMap((hit) => {
      const target = this.fighters.get(hit.targetId)
      return target ? [{ target, amount: hit.amount, absorbed: hit.absorbed, crit: hit.crit }] : []
    })
    const landed = new Set<string>()
    const strike = (target: Fighter, amount: number, absorbed?: number, crit?: boolean) => {
      this.damage(target, amount, crit ? '#ffcf5a' : '#ffffff', instant, { absorbed, crit })
      landed.add(target.id)
      if (downs.includes(target.id)) {
        this.down([target.id], instant)
      }
    }
    const finish = () => this.down(downs.filter((id) => !landed.has(id)), instant)
    if (instant || !actor || targets.length === 0) {
      for (const { target, amount, absorbed, crit } of targets) {
        strike(target, amount, absorbed, crit)
      }
      finish()
      return
    }
    if (counter) {
      const prey = targets[0]?.target
      if (prey) {
        const beside = prey.root.position.clone()
        beside.x += actor.side === 'enemy' ? -0.7 : 0.7
        actor.anim = {
          type: 'retaliate',
          t: 0,
          dur: 0.55,
          to: beside,
          impactAt: 0.28,
          onImpact: () => {
            for (const { target, amount, absorbed, crit } of targets) {
              strike(target, amount, absorbed, crit)
            }
            finish()
          },
        }
        return
      }
    }
    if (actor.ranged || actor.caster) {
      actor.anim = {
        type: 'cast',
        t: 0,
        dur: 0.55,
        impactAt: 0.2,
        onImpact: () => {
          for (const { target, amount, absorbed, crit } of targets) {
            this.shoot(actor, target, () => strike(target, amount, absorbed, crit))
          }
          finish()
        },
      }
      return
    }
    const centre = new THREE.Vector3()
    for (const { target } of targets) {
      centre.add(target.root.position)
    }
    centre.divideScalar(targets.length)
    const direction = centre.clone().sub(actor.home).setY(0).normalize()
    actor.anim = {
      type: 'melee',
      t: 0,
      dur: 0.62,
      impactAt: 0.3,
      to: centre.addScaledVector(direction, -0.8),
      onImpact: () => {
        for (const { target, amount, absorbed, crit } of targets) {
          strike(target, amount, absorbed, crit)
        }
        finish()
      },
    }
  }

  private act(actorId: string, type: AnimType, instant: boolean, impact: () => void) {
    const actor = this.fighters.get(actorId)
    if (instant) {
      // Still apply the effect (heals change hp) but draw nothing.
      this.quietly(impact)
    } else if (!actor) {
      impact()
    } else {
      actor.anim = { type, t: 0, dur: 0.55, impactAt: 0.25, onImpact: impact }
    }
  }

  private damage(
    target: Fighter,
    amount: number,
    color: string,
    instant: boolean,
    extras: { absorbed?: number; crit?: boolean } = {},
  ) {
    target.hp = Math.max(0, target.hp - amount)
    if (instant) {
      return
    }
    if (extras.absorbed && extras.absorbed > 0) {
      this.burst(this.chest(target), SHIELD_COLOR, 12)
      this.burst(target.root.position.clone().setY(0.15), SHIELD_COLOR, 6)
    }
    if (extras.crit) {
      this.shake = Math.max(this.shake, 0.28)
      this.number(String(amount), color, target, true)
      this.burst(this.chest(target), '#ffcf5a', 12)
    } else {
      this.number(String(amount), color, target)
      this.burst(this.chest(target), color === '#ffffff' ? '#ffffff' : color, 6)
    }
    this.callbacks.onSound?.('hit')
    if (target.alive) {
      const source = target.side === 'hero' ? 1 : -1
      target.anim = { type: 'hit', t: 0, dur: 0.3, dir: new THREE.Vector3(-source, 0, 0) }
    }
  }

  // Bring a fallen (or battered) fighter back for revive / guardian.
  private raiseFighter(fighter: Fighter, hp: number, instant: boolean, color: string) {
    const wasDown = !fighter.alive || fighter.dead
    fighter.alive = true
    fighter.dead = false
    fighter.hp = Math.min(fighter.max, Math.max(fighter.hp, hp))
    fighter.carriedBy = null
    fighter.root.visible = true
    fighter.bar.group.visible = true
    fighter.root.position.copy(fighter.home)
    fighter.actor.group.rotation.set(0, 0, 0)
    fighter.actor.group.position.set(0, 0, 0)
    if (instant) {
      return
    }
    const chest = this.chest(fighter)
    this.burst(chest, color, 14)
    this.burst(chest.clone().setY(chest.y + 0.8), color, 8)
    if (wasDown) {
      // Light pillar: tall upward sparks.
      for (let index = 0; index < 6; index += 1) {
        this.burst(fighter.home.clone().setY(0.3 + index * 0.35), color, 3)
      }
      fighter.anim = { type: 'rise', t: 0, dur: 0.7 }
    }
  }

  private down(ids: string[], instant: boolean) {
    for (const id of ids) {
      const fighter = this.fighters.get(id)
      if (!fighter || !fighter.alive) {
        continue
      }
      fighter.alive = false
      fighter.hp = 0
      if (instant) {
        fighter.dead = true
        fighter.anim = null
      } else {
        fighter.anim = { type: 'die', t: 0, dur: 0.6 }
      }
    }
  }

  private quietly(run: () => void) {
    const previous = this.quiet
    this.quiet = true
    run()
    this.quiet = previous
  }

  private chest(fighter: Fighter): THREE.Vector3 {
    return fighter.root.position.clone().setY(fighter.actor.height * 0.6)
  }

  private animate(fighter: Fighter, dt: number, time: number) {
    const { actor, root } = fighter
    const bar = fighter.bar
    if (fighter.dead) {
      bar.group.visible = false
      const carrier = fighter.carriedBy
      if (carrier && actor.kind === 'humanoid') {
        // Across the carrier's shoulders, gone with them once they leave.
        const stack = [...this.fighters.values()].filter((other) => other.carriedBy === carrier).indexOf(fighter)
        root.visible = carrier.root.visible
        root.position.copy(carrier.root.position).setY(carrier.actor.height * 0.72 + stack * 0.32)
        root.rotation.y = carrier.root.rotation.y + Math.PI / 2
        actor.group.rotation.set(-1.45, 0, 0)
        actor.group.position.set(0, 0, -0.3)
        if (!carrier.anim && !carrier.alive) {
          fighter.home.copy(carrier.home)
          fighter.carriedBy = null
          root.visible = false
        }
        return
      }
      if (actor.kind === 'humanoid') {
        root.position.copy(fighter.home)
        actor.group.rotation.set(-1.45, 0, 0)
        actor.group.position.y = 0.05
      } else {
        root.visible = false
      }
      return
    }
    root.visible = true
    root.position.copy(fighter.home)
    root.rotation.y = fighter.facing
    idleActor(actor, time, fighter.phase)
    const anim = fighter.anim
    if (anim) {
      anim.t += dt
      const p = Math.min(1, anim.t / anim.dur)
      if (anim.onImpact && !anim.fired && anim.t >= (anim.impactAt ?? 0)) {
        anim.fired = true
        anim.onImpact()
      }
      this.pose(fighter, anim, p, time)
      if (p >= 1) {
        fighter.anim = null
        if (anim.type === 'die') {
          fighter.dead = true
        }
        if (anim.type === 'drink') {
          const bottle = actor.group.getObjectByName('bottle')
          if (bottle) {
            actor.group.remove(bottle)
            disposeTree(bottle)
          }
        }
        if (anim.type === 'exit') {
          root.visible = false
          fighter.alive = false
          fighter.home.x -= 12
        }
        if (anim.type === 'flee') {
          root.visible = false
          fighter.dead = false
          fighter.alive = false
          fighter.home.x -= 9
        }
      }
    }
    bar.group.visible = fighter.alive && root.visible
    bar.group.position.copy(root.position).setY(actor.height + 0.22)
    bar.group.quaternion.copy(this.camera.quaternion)
    fighter.marks.position.copy(root.position).setY(actor.height + 0.55)
    fighter.marks.quaternion.copy(this.camera.quaternion)
    const icons = fighter.marks.children
    icons.forEach((icon, index) => {
      icon.position.x = (index - (icons.length - 1) / 2) * 0.32
    })
    const ratio = fighter.max > 0 ? fighter.hp / fighter.max : 0
    bar.fill.scale.x = Math.max(0.001, ratio)
    bar.fill.position.x = (-0.58 * (1 - ratio)) / 2
  }

  private pose(fighter: Fighter, anim: Anim, p: number, time: number) {
    const { actor, root } = fighter
    const humanoid = actor.kind === 'humanoid' ? actor : null
    const creature = actor.kind === 'humanoid' ? null : actor
    if (anim.type === 'melee' && anim.to) {
      const k = p < 0.45 ? easeOut(p / 0.45) : 1 - easeIn((p - 0.45) / 0.55)
      root.position.lerpVectors(fighter.home, anim.to, k)
      if (humanoid) {
        humanoid.armR.rotation.x = p < 0.3 ? -2.5 * (p / 0.3) : p < 0.5 ? lerp(-2.5, -0.3, (p - 0.3) / 0.2) : lerp(-0.3, 0, (p - 0.5) / 0.5)
        humanoid.legL.rotation.x = Math.sin(p * Math.PI * 2) * 0.5
        humanoid.legR.rotation.x = -Math.sin(p * Math.PI * 2) * 0.5
      } else if (creature) {
        actor.group.position.y = Math.sin(p * Math.PI) * 0.4
        for (const [index, leg] of creature.legs.entries()) {
          leg.rotation.x = Math.sin(p * Math.PI * 4 + index) * 0.6
        }
      }
    } else if (anim.type === 'cast') {
      if (humanoid) {
        humanoid.armR.rotation.x = -2.7 * Math.sin(p * Math.PI)
      } else {
        actor.group.position.y = Math.sin(p * Math.PI) * 0.25
      }
    } else if (anim.type === 'hit' && anim.dir) {
      root.position.addScaledVector(anim.dir, Math.sin(p * Math.PI) * 0.22)
      actor.group.rotation.z = Math.sin(p * Math.PI * 3) * 0.14 * (1 - p)
    } else if (anim.type === 'shout') {
      actor.group.position.y = Math.sin(p * Math.PI) * 0.3
      if (humanoid) {
        humanoid.armL.rotation.x = -2.6 * Math.sin(p * Math.PI)
        humanoid.armR.rotation.x = -2.6 * Math.sin(p * Math.PI)
      }
    } else if (anim.type === 'spawn') {
      actor.group.position.y = (1 - easeOut(p)) * 2.5
    } else if (anim.type === 'die') {
      if (humanoid) {
        humanoid.group.rotation.x = -1.45 * easeOut(p)
      } else if (creature) {
        creature.body.scale.setScalar(Math.max(0.001, 1 - easeIn(p)))
        creature.body.position.y = creature.hover * (1 - p)
      }
    } else if (anim.type === 'flee') {
      root.rotation.y = -Math.PI / 2
      root.position.x = fighter.home.x - easeIn(p) * 9
      if (humanoid) {
        walkPose(humanoid, time, fighter.phase, 1.6)
      }
    } else if (anim.type === 'drink') {
      const tilt = Math.sin(p * Math.PI)
      const bottle = actor.group.getObjectByName('bottle')
      if (bottle) {
        bottle.rotation.z = -1.1 * tilt
        bottle.position.y = actor.height * 0.62 + tilt * 0.08
      }
      if (humanoid) {
        humanoid.armR.rotation.x = -1.5 * tilt
        humanoid.armR.rotation.z = -0.5 * tilt
      } else {
        actor.group.rotation.z = tilt * 0.2
      }
    } else if (anim.type === 'disarm') {
      root.position.y = fighter.home.y - 0.22 * Math.sin(Math.min(1, p * 2) * Math.PI)
      if (humanoid) {
        humanoid.armR.rotation.x = -1.2 - Math.sin(p * Math.PI * 4) * 0.5
        humanoid.armL.rotation.x = -0.8 - Math.sin(p * Math.PI * 4 + 1) * 0.4
        humanoid.legL.rotation.x = 0.6
        humanoid.legR.rotation.x = 0.9
      } else {
        actor.group.position.y = -0.15
      }
    } else if (anim.type === 'brace') {
      root.position.copy(fighter.home)
      if (humanoid) {
        humanoid.armL.rotation.x = -1.4
        humanoid.armR.rotation.x = -1.4
        humanoid.armL.rotation.z = 0.55
        humanoid.armR.rotation.z = -0.55
        humanoid.legL.rotation.x = 0.35
        humanoid.legR.rotation.x = 0.45
        humanoid.torso.rotation.x = 0.25
      } else {
        actor.group.position.y = -0.08
        actor.group.scale.set(1.05, 0.9, 1.05)
      }
    } else if (anim.type === 'charge') {
      const pulse = 1 + Math.sin(p * Math.PI * 4) * 0.08
      actor.group.scale.setScalar(pulse)
      actor.group.position.y = Math.sin(p * Math.PI) * 0.2
      if (humanoid) {
        humanoid.armL.rotation.x = -2.4
        humanoid.armR.rotation.x = -2.4
      }
    } else if (anim.type === 'ambush' && anim.to) {
      const k = p < 0.35 ? easeOut(p / 0.35) : p < 0.55 ? 1 : 1 - easeIn((p - 0.55) / 0.45)
      root.position.lerpVectors(fighter.home, anim.to, k)
      if (p < 0.2 || p > 0.8) {
        actor.group.scale.setScalar(0.2 + Math.min(1, p < 0.2 ? p / 0.2 : (1 - p) / 0.2) * 0.8)
      } else {
        actor.group.scale.setScalar(fighter.baseScale)
      }
    } else if (anim.type === 'dodge' && anim.dir) {
      // Sidestep whoosh — no floating "miss" text.
      root.position.addScaledVector(anim.dir, Math.sin(p * Math.PI) * 0.55)
      actor.group.rotation.y = Math.sin(p * Math.PI) * 0.35 * (anim.dir.z >= 0 ? 1 : -1)
    } else if (anim.type === 'rise') {
      // Kneel then stand (undying / revive).
      const kneel = p < 0.45 ? easeOut(p / 0.45) : 1 - easeIn((p - 0.45) / 0.55)
      if (humanoid) {
        humanoid.torso.rotation.x = 0.55 * kneel
        humanoid.legL.rotation.x = 0.9 * kneel
        humanoid.legR.rotation.x = 1.1 * kneel
        humanoid.armL.rotation.x = -0.4 * kneel
        humanoid.armR.rotation.x = -0.4 * kneel
        actor.group.position.y = -0.12 * kneel
      } else {
        actor.group.position.y = -0.1 * kneel
        actor.group.scale.setScalar(fighter.baseScale * (1 - 0.08 * kneel))
      }
    } else if (anim.type === 'retaliate') {
      if (anim.to) {
        const k = p < 0.4 ? easeOut(p / 0.4) : 1 - easeIn((p - 0.4) / 0.6)
        root.position.lerpVectors(fighter.home, anim.to, k * 0.7)
      } else if (anim.dir) {
        root.position.addScaledVector(anim.dir, Math.sin(p * Math.PI) * 0.35)
      }
      if (humanoid) {
        humanoid.armR.rotation.x = -2.2 * Math.sin(p * Math.PI)
      } else {
        actor.group.position.y = Math.sin(p * Math.PI) * 0.2
      }
    } else if (anim.type === 'exit') {
      const hold = anim.hold ?? 0
      if (anim.t < hold) {
        if (!anim.limp) {
          this.pose(fighter, { type: 'cheer', t: anim.t, dur: hold }, anim.t / hold, time)
        } else if (humanoid) {
          // Catching breath, hands on knees.
          humanoid.torso.rotation.x = 0.35
          humanoid.armL.rotation.x = -0.6
          humanoid.armR.rotation.x = -0.6
        }
        return
      }
      const k = (anim.t - hold) / Math.max(0.01, anim.dur - hold)
      const carrying = [...this.fighters.values()].some((other) => other.carriedBy === fighter)
      root.rotation.y = -Math.PI / 2
      root.position.x = fighter.home.x - easeIn(Math.min(1, k)) * 12
      if (humanoid) {
        walkPose(humanoid, time, fighter.phase, anim.limp ? 0.8 : 1.3)
        if (anim.limp) {
          // One leg dragging, the body rocking with each step.
          humanoid.legR.rotation.x *= 0.3
          actor.group.rotation.z = Math.sin(time * 5 + fighter.phase) * 0.12
          actor.group.position.y = -Math.abs(Math.sin(time * 5 + fighter.phase)) * 0.06
        }
        if (carrying) {
          humanoid.armL.rotation.x = -2.6
          humanoid.armR.rotation.x = -2.6
        }
      }
    } else if (anim.type === 'cheer') {
      actor.group.position.y = Math.abs(Math.sin(p * Math.PI * 3)) * 0.35
      if (humanoid) {
        humanoid.armL.rotation.x = -2.8
        humanoid.armR.rotation.x = -2.8
      }
    }
  }

  private shoot(actor: Fighter, target: Fighter, onArrive: () => void) {
    const from = this.chest(actor)
    const to = this.chest(target)
    const b = new Builder()
    const arrow = !actor.caster
    if (arrow && actor.side === 'hero') {
      b.box(0.04, 0.04, 0.45, '#8d6e4f').box(0.07, 0.07, 0.08, '#dfe4ea', 0, 0, 0.24)
    } else {
      const color = actor.side === 'hero' ? (this.heroClass(actor) === 'cleric' ? '#ffe27a' : '#7fe3ff') : enemyBolt(actor)
      b.box(0.18, 0.18, 0.18, color, 0, 0, 0, { glow: true })
    }
    const mesh = b.build({ castShadow: false })
    mesh.position.copy(from)
    mesh.lookAt(to)
    this.scene.add(mesh)
    this.projectiles.push({ mesh, from, to, t: 0, dur: arrow ? 0.22 : 0.32, spin: !arrow, onArrive })
  }

  private heroClass(fighter: Fighter): string {
    return this.report.party?.find((entry) => entry.id === fighter.id)?.classId ?? ''
  }

  private number(text: string, color: string, target: Fighter, big = false) {
    if (this.quiet) {
      return
    }
    const key = `${text}|${color}|${big ? 'b' : 'n'}`
    let texture = this.numberTextures.get(key)
    if (!texture) {
      const canvas = document.createElement('canvas')
      canvas.width = big ? 192 : 128
      canvas.height = big ? 96 : 64
      const context = canvas.getContext('2d')
      if (!context) {
        return
      }
      context.font = big ? '900 64px system-ui, sans-serif' : '800 46px system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineWidth = big ? 10 : 8
      context.strokeStyle = 'rgba(30, 30, 30, 0.85)'
      context.strokeText(text, canvas.width / 2, canvas.height / 2 + 2)
      context.fillStyle = color
      context.fillText(text, canvas.width / 2, canvas.height / 2 + 2)
      texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      this.numberTextures.set(key, texture)
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }))
    sprite.renderOrder = 20
    sprite.scale.set(big ? 1.35 : 0.8, big ? 0.7 : 0.4, 1)
    sprite.position.copy(target.root.position).setY(target.actor.height + (big ? 0.55 : 0.4))
    sprite.position.x += (this.random() - 0.5) * 0.3
    this.scene.add(sprite)
    this.floaters.push({ sprite, t: 0 })
  }

  private burst(position: THREE.Vector3, color: string, count: number) {
    if (this.quiet) {
      return
    }
    let material = this.sparkMaterials.get(color)
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color })
      this.sparkMaterials.set(color, material)
    }
    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(this.sparkGeometry, material)
      mesh.scale.setScalar(0.05 + this.random() * 0.04)
      mesh.position.copy(position)
      this.scene.add(mesh)
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3((this.random() - 0.5) * 3.2, 1 + this.random() * 1.6, (this.random() - 0.5) * 3.2),
        life: 0.35 + this.random() * 0.25,
      })
    }
  }

  private updateEffects(dt: number) {
    for (let index = this.floaters.length - 1; index >= 0; index -= 1) {
      const floater = this.floaters[index]
      if (!floater) {
        continue
      }
      floater.t += dt
      floater.sprite.position.y += dt * 0.9
      floater.sprite.material.opacity = 1 - Math.min(1, Math.max(0, (floater.t - 0.5) / 0.4))
      if (floater.t > 0.9) {
        this.scene.remove(floater.sprite)
        floater.sprite.material.dispose()
        this.floaters.splice(index, 1)
      }
    }
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index]
      if (!particle) {
        continue
      }
      particle.life -= dt
      particle.velocity.y -= 7 * dt
      particle.mesh.position.addScaledVector(particle.velocity, dt)
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh)
        this.particles.splice(index, 1)
      }
    }
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index]
      if (!projectile) {
        continue
      }
      projectile.t += dt
      const k = Math.min(1, projectile.t / projectile.dur)
      projectile.mesh.position.lerpVectors(projectile.from, projectile.to, k)
      projectile.mesh.position.y += Math.sin(k * Math.PI) * 0.25
      if (projectile.spin) {
        projectile.mesh.rotation.z += dt * 12
      }
      if (k >= 1) {
        this.scene.remove(projectile.mesh)
        disposeTree(projectile.mesh)
        this.projectiles.splice(index, 1)
        projectile.onArrive()
      }
    }
  }
}

function enemyBolt(fighter: Fighter): string {
  return fighter.caster ? '#b48cff' : '#a6e05a'
}

function gearIcon(): THREE.Group {
  return new Builder()
    .box(0.22, 0.06, 0.06, '#d9b54a')
    .box(0.06, 0.22, 0.06, '#d9b54a')
    .box(0.14, 0.14, 0.06, '#c9a36b')
    .box(0.06, 0.06, 0.08, '#6b4a30')
    .build({ castShadow: false })
}

// Subtle red rim under an elite — readable without drowning the model.
function eliteAura(): THREE.Group {
  return new Builder()
    .box(0.7, 0.04, 0.7, '#e05a4a', 0, 0.04, 0, { glow: true })
    .box(0.5, 0.03, 0.5, '#ff6a3a', 0, 0.08, 0, { glow: true })
    .build({ castShadow: false, receiveShadow: false })
}

function statusIcon(status: StatusMark): THREE.Group {
  const icon = new Builder()
  if (status === 'poison') {
    icon.box(0.12, 0.16, 0.08, '#3faf4a').box(0.08, 0.08, 0.06, '#b6e68a', 0, 0.12, 0)
  } else if (status === 'paralyze') {
    icon.box(0.08, 0.16, 0.04, '#ffe14a', -0.04, 0.06, 0, { rz: 0.6 })
    icon.box(0.08, 0.14, 0.04, '#ffe14a', 0.06, -0.04, 0, { rz: 0.6 })
  } else if (status === 'slow') {
    icon.box(0.18, 0.1, 0.12, '#c4a574').box(0.1, 0.1, 0.08, '#8a6a42', 0.04, 0.08, 0)
  } else {
    icon.box(0.22, 0.16, 0.04, '#f7f4ee')
    icon.box(0.14, 0.03, 0.05, '#e05a4a', 0, 0, 0.03, { rz: 0.8 })
    icon.box(0.14, 0.03, 0.05, '#e05a4a', 0, 0, 0.03, { rz: -0.8 })
  }
  return icon.build({ castShadow: false })
}

function pickColor(random: () => number): string {
  const colors = ['#ffe27a', '#7fe3ff', '#f7a8c4', '#9be36a']
  return colors[Math.floor(random() * colors.length)] as string
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)
}

function easeIn(t: number): number {
  return Math.pow(Math.min(1, Math.max(0, t)), 3)
}

// How long a replay runs at 1× speed, in seconds.
export function replayLength(steps: ReplayStep[]): number {
  return steps.reduce((sum, step) => sum + DURATION[step.type], 0)
}
