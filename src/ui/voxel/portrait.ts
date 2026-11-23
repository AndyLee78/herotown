import * as THREE from 'three'
import type { Hero } from '../../core'
import { battleTheme } from './BattleScene'
import { buildCharacter, idlePose, type Rig } from './character'
import { buildEnemy } from './enemies'
import { Builder, disposeTree } from './kit'
import { lookFor, lookKey } from './look'

// Hero cards and monster chips share one offscreen renderer. Each picture is
// taken once and cached, so a list costs no extra WebGL contexts.

const SIZE = 128
const cache = new Map<string, string>()
let stage: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera } | null = null

export function portraitUrl(hero: Pick<Hero, 'id' | 'classId' | 'gender' | 'age'>): string {
  const look = lookFor(hero)
  const key = `${hero.id}|${lookKey(look)}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const { renderer, scene, camera } = getStage()
  renderer.setClearColor(0x000000, 0)
  renderer.setSize(SIZE, SIZE, false)
  const rig = buildCharacter(look)
  idlePose(rig, 0, 0)
  rig.group.rotation.y = -0.45
  scene.add(rig.group)
  frameBust(camera, rig.height)
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(rig.group)
  disposeTree(rig.group)
  cache.set(key, url)
  return url
}

export function monsterPortraitUrl(refId: string): string {
  const key = `monster:${refId}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const { renderer, scene, camera } = getStage()
  renderer.setClearColor(0x000000, 0)
  renderer.setSize(SIZE, SIZE, false)
  const actor = buildEnemy(refId)
  if (isRig(actor)) {
    idlePose(actor, 0, 0)
  }
  actor.group.rotation.y = -0.5
  scene.add(actor.group)
  frameBust(camera, actor.height)
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(actor.group)
  disposeTree(actor.group)
  cache.set(key, url)
  return url
}

// One still of the dungeon: the battle theme's floor, wall, torch and crystal, plus the boss.
export function dungeonPreviewUrl(dungeonId: string, tier: number, bossId: string): string {
  const key = `dungeon:${dungeonId}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const theme = battleTheme(tier)
  const { renderer, scene, camera } = getStage()
  renderer.setClearColor(theme.sky, 1)
  renderer.setSize(360, 168, false)
  const room = new Builder()
  for (let x = -3; x <= 3; x += 1) {
    room.box(1, 0.3, 1, theme.floor[x & 1 ? 0 : 1] ?? theme.floor[0], x, -0.15, 0.4)
    room.box(1, 1.5, 0.4, theme.wall[x & 1 ? 0 : 2] ?? theme.wall[0], x, 0.75, -1.1)
  }
  room.box(0.1, 0.4, 0.1, '#3a2a20', -2.2, 1.15, -0.75).box(0.16, 0.18, 0.16, theme.light, -2.2, 1.42, -0.75, { glow: true })
  room.box(0.22, 0.5, 0.22, theme.crystal, 2.3, 0.25, 0.2, { glow: true })
  const built = room.build()
  const boss = buildEnemy(bossId)
  if (isRig(boss)) {
    idlePose(boss, 0, 0)
  }
  boss.group.position.set(0.15, 0, 0.55)
  boss.group.rotation.y = -0.35
  scene.add(built, boss.group)
  const halfW = 3.4
  const halfH = halfW * (168 / 360)
  camera.left = -halfW
  camera.right = halfW
  camera.top = halfH
  camera.bottom = -halfH
  camera.position.set(1.6, 1.7, 4.2)
  camera.lookAt(0, 0.7, 0)
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(built, boss.group)
  disposeTree(built)
  disposeTree(boss.group)
  cache.set(key, url)
  return url
}

function isRig(actor: { kind?: string }): actor is Rig {
  return actor.kind === 'humanoid'
}

function frameBust(camera: THREE.OrthographicCamera, height: number) {
  const centre = height * 0.62
  const half = Math.max(0.55, height * 0.48)
  camera.left = -half
  camera.right = half
  camera.top = half
  camera.bottom = -half
  camera.position.set(0, centre + 0.5, 4)
  camera.lookAt(0, centre, 0)
  camera.updateProjectionMatrix()
}

function getStage() {
  if (stage) {
    return stage
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(SIZE, SIZE, false)
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#ffffff', '#8fb36a', 1.8))
  const sun = new THREE.DirectionalLight('#fff1dc', 1.8)
  sun.position.set(2, 4, 5)
  scene.add(sun)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20)
  stage = { renderer, scene, camera }
  return stage
}
