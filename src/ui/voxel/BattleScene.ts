import * as THREE from 'three'
import type { DungeonReport, ReplayUnit } from '../../core'
import { buildCharacter, walkPose } from './character'
import { buildEnemy, idleActor, type Actor } from './enemies'
import { Builder, disposeTree } from './kit'
import { lookFor, seeded } from './look'
import type { Hit, ReplayStep } from './replay'

// Plays a dungeon report back as a 3D auto battle. The outcome is already
// decided by the core; this only shows the steps in order.

type AnimType = 'melee' | 'cast' | 'hit' | 'shout' | 'spawn' | 'die' | 'flee' | 'cheer'

type Anim = {
  type: AnimType
  t: number
  dur: number
  impactAt?: number
  onImpact?: () => void
  fired?: boolean
  to?: THREE.Vector3
  dir?: THREE.Vector3
}

type Fighter = {
  id: string
  side: 'hero' | 'enemy'
  ranged: boolean
  caster: boolean
  actor: Actor
  root: THREE.Group
  home: THREE.Vector3
  facing: number
  hp: number
  max: number
  alive: boolean
  dead: boolean
  anim: Anim | null
  phase: number
  bar: { group: THREE.Group; fill: THREE.Mesh }
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
  clear: 0.8,
  retreat: 1.4,
  end: 0,
}
const CASTERS = new Set(['mage', 'cleric', 'bard', 'crypt_lord', 'wraith'])
const THEMES = {
  1: { sky: '#2a2622', floor: ['#7a6a58', '#6f604f', '#84735f', '#756553'], wall: ['#5a4c40', '#524538', '#625244'], light: '#ffb85a', crystal: '#9fe8ff' },
  2: { sky: '#24262a', floor: ['#6a6660', '#625e58', '#726d66', '#5d5953'], wall: ['#4a4744', '#53504c', '#44413e'], light: '#ffa64d', crystal: '#ffcf5a' },
  3: { sky: '#1e1f2a', floor: ['#4e5266', '#565a70', '#4a4d60', '#525670'], wall: ['#3b3e4f', '#34374a', '#40435a'], light: '#c79bff', crystal: '#b48cff' },
} as const

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

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly report: DungeonReport,
    private readonly steps: ReplayStep[],
    tier: number,
    private readonly callbacks: BattleCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const theme = THEMES[(Math.min(3, Math.max(1, tier)) as 1 | 2 | 3)]
    this.scene.background = new THREE.Color(theme.sky)
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b6256', 1.5))
    const sun = new THREE.DirectionalLight('#fff1dc', 2)
    sun.position.set(4, 12, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 })
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    this.scene.add(sun, sun.target, this.bars)
    this.scene.add(this.buildArena(theme))
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
      this.callbacks.onDone()
    }
  }

  // Jumps to the final state without animation.
  skip() {
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
    this.callbacks.onDone()
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

  private buildArena(theme: (typeof THEMES)[keyof typeof THEMES]): THREE.Group {
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
    return b.build()
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
      this.animate(fighter, dt, time)
    }
    this.updateEffects(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private apply(step: ReplayStep, instant: boolean) {
    switch (step.type) {
      case 'floor':
        this.startFloor(step.units, instant)
        break
      case 'attack':
        this.attack(step.actorId, step.hits, step.downs, instant)
        return
      case 'heal': {
        const target = this.fighters.get(step.targetId)
        this.act(step.actorId, 'cast', instant, () => {
          if (target) {
            target.hp = Math.min(target.max, target.hp + step.amount)
            this.number(`+${step.amount}`, '#5fe07a', target)
            this.burst(this.chest(target), '#8ef08a', 10)
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
          this.damage(target, step.amount, '#9be36a', instant)
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
        if (step.victory) {
          for (const fighter of this.fighters.values()) {
            if (fighter.side === 'hero' && fighter.alive && !instant) {
              fighter.anim = { type: 'cheer', t: 0, dur: 1.6 }
              this.burst(this.chest(fighter).setY(1.6), pickColor(this.random), 8)
            }
          }
        }
        break
    }
    this.down(step.downs, instant)
  }

  private startFloor(units: ReplayUnit[], instant: boolean) {
    for (const fighter of [...this.fighters.values()]) {
      if (fighter.side === 'enemy') {
        this.removeFighter(fighter)
        this.fighters.delete(fighter.id)
      }
    }
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
        })
      }
    }
  }

  private addFighter(unit: ReplayUnit): Fighter {
    let actor: Actor
    let caster = false
    if (unit.side === 'hero') {
      const hero = this.report.party?.find((entry) => entry.id === unit.id)
      actor = buildCharacter(lookFor(hero ?? { id: unit.id, classId: 'warrior', gender: 'male', age: 25 }))
      caster = CASTERS.has(hero?.classId ?? '')
    } else {
      actor = buildEnemy(unit.refId)
      caster = CASTERS.has(unit.refId)
    }
    const root = new THREE.Group()
    root.add(actor.group)
    const facing = unit.side === 'hero' ? HERO_FACING : ENEMY_FACING
    root.rotation.y = facing
    this.scene.add(root)
    const bar = new THREE.Group()
    bar.add(new Builder().box(0.62, 0.09, 0.02, '#2b2b2b').build({ castShadow: false, receiveShadow: false }))
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.055, 0.03),
      new THREE.MeshBasicMaterial({ color: unit.side === 'hero' ? '#6cd26a' : '#e05a4a' }),
    )
    fill.position.z = 0.01
    bar.add(fill)
    this.bars.add(bar)
    const fighter: Fighter = {
      id: unit.id,
      side: unit.side,
      ranged: unit.reach === 'ranged',
      caster,
      actor,
      root,
      home: new THREE.Vector3(),
      facing,
      hp: unit.hp,
      max: unit.maxHp,
      alive: unit.hp > 0,
      dead: unit.hp <= 0,
      anim: null,
      phase: this.random() * 10,
      bar: { group: bar, fill },
    }
    this.fighters.set(unit.id, fighter)
    return fighter
  }

  private removeFighter(fighter: Fighter) {
    this.scene.remove(fighter.root)
    disposeTree(fighter.root)
    this.bars.remove(fighter.bar.group)
    disposeTree(fighter.bar.group)
    ;(fighter.bar.fill.material as THREE.Material).dispose()
  }

  private attack(actorId: string, hits: Hit[], downs: string[], instant: boolean) {
    const actor = this.fighters.get(actorId)
    const targets = hits.flatMap((hit) => {
      const target = this.fighters.get(hit.targetId)
      return target ? [{ target, amount: hit.amount }] : []
    })
    const landed = new Set<string>()
    const strike = (target: Fighter, amount: number) => {
      this.damage(target, amount, '#ffffff', instant)
      landed.add(target.id)
      if (downs.includes(target.id)) {
        this.down([target.id], instant)
      }
    }
    const finish = () => this.down(downs.filter((id) => !landed.has(id)), instant)
    if (instant || !actor || targets.length === 0) {
      for (const { target, amount } of targets) {
        strike(target, amount)
      }
      finish()
      return
    }
    if (actor.ranged || actor.caster) {
      actor.anim = {
        type: 'cast',
        t: 0,
        dur: 0.55,
        impactAt: 0.2,
        onImpact: () => {
          for (const { target, amount } of targets) {
            this.shoot(actor, target, () => strike(target, amount))
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
        for (const { target, amount } of targets) {
          strike(target, amount)
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

  private damage(target: Fighter, amount: number, color: string, instant: boolean) {
    target.hp = Math.max(0, target.hp - amount)
    if (instant) {
      return
    }
    this.number(String(amount), color, target)
    this.burst(this.chest(target), color === '#ffffff' ? '#ffffff' : color, 6)
    this.callbacks.onSound?.('hit')
    if (target.alive) {
      const source = target.side === 'hero' ? 1 : -1
      target.anim = { type: 'hit', t: 0, dur: 0.3, dir: new THREE.Vector3(-source, 0, 0) }
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

  private number(text: string, color: string, target: Fighter) {
    if (this.quiet) {
      return
    }
    const key = text + color
    let texture = this.numberTextures.get(key)
    if (!texture) {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 64
      const context = canvas.getContext('2d')
      if (!context) {
        return
      }
      context.font = '800 46px system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineWidth = 8
      context.strokeStyle = 'rgba(30, 30, 30, 0.85)'
      context.strokeText(text, 64, 34)
      context.fillStyle = color
      context.fillText(text, 64, 34)
      texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      this.numberTextures.set(key, texture)
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }))
    sprite.renderOrder = 20
    sprite.scale.set(0.8, 0.4, 1)
    sprite.position.copy(target.root.position).setY(target.actor.height + 0.4)
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
