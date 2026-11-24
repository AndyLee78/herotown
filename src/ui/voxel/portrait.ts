import * as THREE from 'three'
import type { Hero } from '../../core'
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

const PREVIEW_W = 360
const PREVIEW_H = 168

// One cached still of the dungeon entrance: sky, distant ridge, the doorway, and a small boss.
export function dungeonPreviewUrl(dungeonId: string, tier: number, bossId: string, locked = false): string {
  const key = `dungeon:${dungeonId}:${locked ? 'locked' : 'open'}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const mood = ENTRANCE[dungeonId] ?? ENTRANCE.hill_cave
  void tier
  const { renderer, scene, camera } = getStage()
  const hemi = scene.children.find((child): child is THREE.HemisphereLight => child instanceof THREE.HemisphereLight)
  const sun = scene.children.find((child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight)
  const saved = {
    sky: hemi?.color.clone(),
    ground: hemi?.groundColor.clone(),
    hemi: hemi?.intensity,
    sun: sun?.color.clone(),
    sunLevel: sun?.intensity,
    sunPos: sun?.position.clone(),
    far: camera.far,
  }
  if (hemi) {
    hemi.color.set(mood.hemiSky)
    hemi.groundColor.set(mood.hemiGround)
    hemi.intensity = mood.hemiLevel * (locked ? 0.3 : 1)
  }
  if (sun) {
    sun.color.set(mood.sun)
    sun.intensity = mood.sunLevel * (locked ? 0.3 : 1)
    sun.position.set(mood.sunX, 6, 4)
  }
  renderer.setClearColor(tone(mood.skyBottom, locked), 1)
  renderer.setSize(PREVIEW_W, PREVIEW_H, false)
  const halfW = 4.7
  const halfH = halfW * (PREVIEW_H / PREVIEW_W)
  camera.left = -halfW
  camera.right = halfW
  camera.top = halfH
  camera.bottom = -halfH
  camera.far = 80
  camera.position.set(4.6, 4.2, 6.4)
  camera.lookAt(0, 1.05, -0.6)
  camera.updateProjectionMatrix()

  const sky = makeSky(mood.skyTop, mood.skyBottom, locked)
  const aim = new THREE.Vector3(0, 1.05, -0.6)
  const back = aim.clone().sub(camera.position).normalize()
  sky.position.copy(aim).addScaledVector(back, 10)
  sky.lookAt(camera.position)

  const land = new Builder()
  ridge(land, locked, mood.ridge)
  slab(land, locked, mood.ground)
  mood.draw(land, locked)
  if (locked) {
    question(land)
  }
  const built = land.build({ castShadow: false, receiveShadow: false })
  const water = mood.water ? waterSheet(locked, typeof mood.water === 'string' ? mood.water : '#3d8ec8') : null
  const boss = buildEnemy(bossId)
  if (isRig(boss)) {
    idlePose(boss, 0, 0)
  }
  const scale = (halfH * 2 * 0.4) / Math.max(boss.height, 0.2)
  boss.group.scale.setScalar(scale)
  boss.group.position.set(0.15, 0.16, 0.7)
  boss.group.rotation.y = 0.55
  if (locked) {
    blacken(boss.group)
  }
  scene.add(sky, built, boss.group)
  if (water) {
    scene.add(water)
  }
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(sky, built, boss.group)
  if (water) {
    scene.remove(water)
    disposeMesh(water)
  }
  disposeMesh(sky)
  disposeTree(built)
  disposeTree(boss.group)
  if (hemi && saved.sky && saved.ground != null && saved.hemi != null) {
    hemi.color.copy(saved.sky)
    hemi.groundColor.copy(saved.ground)
    hemi.intensity = saved.hemi
  }
  if (sun && saved.sun && saved.sunLevel != null && saved.sunPos) {
    sun.color.copy(saved.sun)
    sun.intensity = saved.sunLevel
    sun.position.copy(saved.sunPos)
  }
  camera.far = saved.far
  cache.set(key, url)
  return url
}

type Entrance = {
  skyTop: string
  skyBottom: string
  hemiSky: string
  hemiGround: string
  sun: string
  sunLevel: number
  hemiLevel: number
  sunX: number
  ridge: string
  ground: [string, string]
  water?: boolean | string
  draw: (land: Builder, locked: boolean) => void
}

const ENTRANCE: Record<string, Entrance> = {
  hill_cave: {
    skyTop: '#ffd7a8',
    skyBottom: '#e36a3c',
    hemiSky: '#ffd0a0',
    hemiGround: '#6e8f45',
    sun: '#ffb15a',
    sunLevel: 2.1,
    hemiLevel: 1.3,
    sunX: -3,
    ridge: '#6d6248',
    ground: ['#7eae58', '#6c9848'],
    draw: hillCave,
  },
  moss_path: {
    skyTop: '#8eae86',
    skyBottom: '#2c4634',
    hemiSky: '#b7d0a4',
    hemiGround: '#3d5a38',
    sun: '#ffe2a8',
    sunLevel: 1.2,
    hemiLevel: 1.15,
    sunX: 2,
    ridge: '#3c4a38',
    ground: ['#5d7a48', '#4e6a3c'],
    draw: mossPath,
  },
  abandoned_mine: {
    skyTop: '#d5dbe0',
    skyBottom: '#8d97a0',
    hemiSky: '#e4e8ea',
    hemiGround: '#6a645c',
    sun: '#fff2dc',
    sunLevel: 1.6,
    hemiLevel: 1.2,
    sunX: 3,
    ridge: '#6a6762',
    ground: ['#8a8174', '#7a7266'],
    draw: abandonedMine,
  },
  deep_shaft: {
    skyTop: '#4a5564',
    skyBottom: '#1a2028',
    hemiSky: '#8aa0b4',
    hemiGround: '#3a342c',
    sun: '#d8e4ee',
    sunLevel: 0.7,
    hemiLevel: 0.7,
    sunX: 1,
    ridge: '#2c3138',
    ground: ['#4a463f', '#3e3a34'],
    draw: deepShaft,
  },
  barrow: {
    skyTop: '#4a3470',
    skyBottom: '#160e28',
    hemiSky: '#b9a4e0',
    hemiGround: '#3a3048',
    sun: '#c8b4ee',
    sunLevel: 0.8,
    hemiLevel: 0.75,
    sunX: -2,
    ridge: '#3a3450',
    ground: ['#4a5344', '#3e4638'],
    draw: barrow,
  },
  sunken_crypt: {
    skyTop: '#24506c',
    skyBottom: '#0c2030',
    hemiSky: '#8ec4d8',
    hemiGround: '#1e4a58',
    sun: '#9fd0e4',
    sunLevel: 0.85,
    hemiLevel: 0.8,
    sunX: 2,
    ridge: '#1e3848',
    ground: ['#3d5a52', '#314a44'],
    water: true,
    draw: sunkenCrypt,
  },
  venom_marsh: {
    skyTop: '#6d7a58',
    skyBottom: '#241c32',
    hemiSky: '#b7c4a0',
    hemiGround: '#3a4030',
    sun: '#d5d8b0',
    sunLevel: 0.65,
    hemiLevel: 0.8,
    sunX: -1,
    ridge: '#3c4434',
    ground: ['#4a5540', '#3c4a34'],
    water: '#3a5c42',
    draw: venomMarsh,
  },
  bandit_fort: {
    skyTop: '#e8a878',
    skyBottom: '#6a3a2e',
    hemiSky: '#f0c8a0',
    hemiGround: '#5a4838',
    sun: '#ffb070',
    sunLevel: 1.4,
    hemiLevel: 1.1,
    sunX: -2.5,
    ridge: '#4a3a30',
    ground: ['#6a5a48', '#5a4a3c'],
    draw: banditFort,
  },
  haunted_citadel: {
    skyTop: '#4a3a70',
    skyBottom: '#0e1020',
    hemiSky: '#9aa0d0',
    hemiGround: '#2a3048',
    sun: '#7fe3ff',
    sunLevel: 0.75,
    hemiLevel: 0.85,
    sunX: 1.5,
    ridge: '#2a3040',
    ground: ['#3a4250', '#2e3644'],
    draw: hauntedCitadel,
  },
  dragon_nest: {
    skyTop: '#e07040',
    skyBottom: '#2a1010',
    hemiSky: '#ffb080',
    hemiGround: '#5a3020',
    sun: '#ff6a3a',
    sunLevel: 1.1,
    hemiLevel: 0.95,
    sunX: -2,
    ridge: '#4a2a22',
    ground: ['#5a3a30', '#4a2e28'],
    draw: dragonNest,
  },
}

function hillCave(land: Builder, locked: boolean) {
  tree(land, locked, -2.5, -0.2, 1.35, '#3f7a34', '#2f6a2c')
  tree(land, locked, 2.7, -0.6, 1.6, '#4c8a3c', '#3a7430')
  tree(land, locked, -3.4, 1.1, 1.05, '#5a9444', '#3e7c34')
  arch(land, locked, 0, -1.15, '#5c564e', '#1a1614', '#6e675e')
  land.box(0.7, 0.4, 0.55, tone('#8a8178', locked), 2.3, 0.28, 1.7)
  land.box(0.4, 0.28, 0.35, tone('#6e675e', locked), 2.55, 0.5, 1.55)
  land.box(0.35, 0.22, 0.3, tone('#7dae55', locked), -2.1, 0.18, 2.05)
}

function mossPath(land: Builder, locked: boolean) {
  tree(land, locked, -2.8, -1.3, 2.15, '#2f6a38', '#245830')
  tree(land, locked, 2.6, -1.1, 2.35, '#347444', '#2a6238')
  tree(land, locked, -3.3, 0.6, 1.7, '#3d7a40', '#2e6434')
  tree(land, locked, 3.3, 0.4, 1.55, '#2c6234', '#234e2c')
  for (let step = 0; step < 5; step += 1) {
    land.box(0.85, 0.14, 0.55, tone(step % 2 ? '#6d8a62' : '#7f9a70', locked), -0.15, 0.12, 1.6 - step * 0.55)
    land.box(0.7, 0.08, 0.4, tone('#4e7a48', locked), -0.15, 0.2, 1.6 - step * 0.55)
  }
  arch(land, locked, 0.1, -1.35, '#5e6a58', '#142018', '#6e7a66')
  for (const [x, y, z] of [[-1.4, 1.5, 0.2], [1.6, 1.9, -0.4], [0.8, 1.2, 1.1], [-0.6, 2.1, 0.8]] as const) {
    land.box(0.12, 0.12, 0.12, tone('#d8f08a', locked), x, y, z, { glow: true })
  }
  land.box(0.45, 0.28, 0.4, tone('#6a7a58', locked), 2.2, 0.22, 1.85)
}

function abandonedMine(land: Builder, locked: boolean) {
  land.box(4.4, 2.6, 1.3, tone('#7a756e', locked), 0, 1.3, -1.7)
  land.box(3.2, 1.8, 0.5, tone('#2a2622', locked), 0, 0.9, -1.15)
  timber(land, locked, 0, -1.05)
  for (let z = -0.6; z <= 1.8; z += 0.45) {
    land.box(0.08, 0.08, 0.4, tone('#5c5148', locked), -0.28, 0.12, z)
    land.box(0.08, 0.08, 0.4, tone('#5c5148', locked), 0.28, 0.12, z)
    land.box(0.7, 0.05, 0.08, tone('#6a5a48', locked), 0, 0.1, z)
  }
  land.box(0.7, 0.45, 0.5, tone('#6b5344', locked), 0.15, 0.4, 1.15)
  land.box(0.85, 0.28, 0.62, tone('#4a4038', locked), 0.15, 0.62, 1.15)
  land.box(0.12, 0.55, 0.12, tone('#3a2a20', locked), -2.15, 0.45, 1.5)
  land.box(0.22, 0.22, 0.22, tone('#ffb15a', locked), -2.15, 0.82, 1.5, { glow: true })
  land.box(0.55, 0.32, 0.4, tone('#8a8174', locked), 2.35, 0.24, 1.9)
}

function deepShaft(land: Builder, locked: boolean) {
  land.box(2.4, 0.2, 2.2, tone('#1a1816', locked), 0, 0.2, -0.3)
  land.box(0.16, 2.3, 0.16, tone('#8a6a42', locked), -1.15, 1.15, -1.15)
  land.box(0.16, 2.3, 0.16, tone('#8a6a42', locked), 1.15, 1.15, -1.15)
  land.box(0.16, 1.5, 0.16, tone('#8a6a42', locked), -1.15, 0.75, 0.55)
  land.box(0.16, 1.5, 0.16, tone('#8a6a42', locked), 1.15, 0.75, 0.55)
  land.box(2.5, 0.14, 0.14, tone('#a07a48', locked), 0, 2.25, -1.15)
  land.box(0.14, 0.14, 1.9, tone('#a07a48', locked), -1.15, 1.45, -0.3)
  land.box(0.14, 0.14, 1.9, tone('#a07a48', locked), 1.15, 1.45, -0.3)
  land.box(0.55, 0.55, 0.16, tone('#6a5a48', locked), 0, 2.15, -1.15)
  land.box(0.16, 0.16, 0.16, tone('#c8b090', locked), 0, 2.15, -1.05)
  land.box(0.06, 1.7, 0.06, tone('#c2b6a2', locked), 0, 1.2, -0.85)
  land.box(0.28, 0.7, 0.28, tone('#ffe08a', locked), 1.7, 0.55, 0.4, { glow: true })
  land.box(0.4, 0.22, 0.35, tone('#5a5048', locked), -2.2, 0.2, 1.9)
}

function barrow(land: Builder, locked: boolean) {
  land.box(0.7, 0.7, 0.7, tone('#f4efe4', locked), 2.15, 3.15, -2.2, { glow: true })
  land.box(0.28, 0.08, 0.28, tone('#f4efe4', locked), 2.15, 3.15, -2.2, { glow: true })
  arch(land, locked, 0, -1.2, '#6a645c', '#120e18', '#7a746c')
  land.box(0.9, 1.15, 0.18, tone('#5a544c', locked), 0, 0.65, -1.05)
  for (const [x, z] of [[-1.8, 0.2], [-2.3, 1.2], [1.7, 0.35], [2.2, 1.3]] as const) {
    land.box(0.28, 0.62, 0.1, tone('#8a847c', locked), x, 0.4, z)
    land.box(0.18, 0.18, 0.12, tone('#6a645c', locked), x, 0.78, z)
  }
  land.box(0.22, 1.3, 0.22, tone('#4a3828', locked), -2.7, 0.65, -0.4)
  land.box(0.7, 0.1, 0.1, tone('#3a2c22', locked), -2.35, 1.15, -0.4, { rz: 0.5 })
  land.box(0.55, 0.1, 0.1, tone('#3a2c22', locked), -3.05, 1.25, -0.4, { rz: -0.6 })
  land.box(0.4, 0.2, 0.3, tone('#5a5448', locked), 2.4, 0.18, 1.95)
}

function sunkenCrypt(land: Builder, locked: boolean) {
  arch(land, locked, 0, -1.35, '#4a6670', '#07141c', '#5a7680')
  land.box(0.45, 1.35, 0.45, tone('#6a7c84', locked), -1.9, 0.67, -0.2)
  land.box(0.4, 0.55, 0.4, tone('#5a6c74', locked), -1.85, 1.5, -0.15)
  land.box(0.4, 0.7, 0.4, tone('#647880', locked), 1.85, 0.35, 0.3)
  land.box(0.55, 0.28, 0.5, tone('#7a8c90', locked), 1.7, 0.14, 0.55)
  land.box(0.32, 0.7, 0.32, tone('#b48cff', locked), -2.3, 0.5, 1.15, { glow: true })
  land.box(0.22, 0.45, 0.22, tone('#c9a6ff', locked), 2.15, 0.4, 1.55, { glow: true })
  land.box(0.5, 0.18, 0.35, tone('#4a5c60', locked), -2.5, 0.16, 1.9)
}

function venomMarsh(land: Builder, locked: boolean) {
  deadTree(land, locked, -2.7, -0.8, 1.7)
  deadTree(land, locked, 2.6, -0.5, 2.05)
  deadTree(land, locked, -3.2, 1.1, 1.25)
  arch(land, locked, 0, -1.3, '#4a5644', '#10140e', '#5a6850')
  land.box(1.3, 0.08, 0.9, tone('#2a4030', locked), -1.5, 0.14, 1.15)
  land.box(0.9, 0.08, 0.7, tone('#243828', locked), 1.7, 0.14, 0.4)
  land.box(0.55, 0.08, 0.45, tone('#314838', locked), 0.4, 0.16, 1.7)
  for (const [x, z] of [[-1.7, 0.6], [-1.2, 1.5], [1.5, 1.2], [2.1, 0.2]] as const) {
    land.box(0.06, 0.45, 0.06, tone('#6a7a48', locked), x, 0.3, z)
    land.box(0.14, 0.1, 0.08, tone('#7a8a50', locked), x, 0.52, z)
  }
  for (const [x, y, z] of [[-0.8, 1.3, 0.2], [1.1, 1.7, -0.2], [0.2, 1.05, 0.8], [-1.8, 1.6, -0.6]] as const) {
    land.box(0.55, 0.28, 0.4, tone('#d5e0c4', locked), x, y, z)
  }
}

function banditFort(land: Builder, locked: boolean) {
  const wood = '#8a6440'
  const dark = '#4a3428'
  for (const x of [-3.4, -2.7, -2.0, 2.0, 2.7, 3.4]) {
    land.box(0.28, 1.7, 0.28, tone(wood, locked), x, 0.85, -0.55)
    land.box(0.36, 0.22, 0.36, tone(dark, locked), x, 1.78, -0.55)
  }
  land.box(2.0, 0.22, 0.22, tone(dark, locked), -2.7, 1.45, -0.55)
  land.box(2.0, 0.22, 0.22, tone(dark, locked), 2.7, 1.45, -0.55)
  land.box(1.1, 2.1, 1.1, tone('#6a4a34', locked), -2.5, 1.05, 0.55)
  land.box(1.35, 0.24, 1.35, tone(dark, locked), -2.5, 2.15, 0.55)
  land.box(0.85, 0.85, 0.85, tone('#5a3a2a', locked), -2.5, 2.7, 0.55)
  land.box(1.15, 0.14, 1.15, tone('#9a7048', locked), -2.5, 3.15, 0.55)
  for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]] as const) {
    land.box(0.18, 0.4, 0.18, tone(wood, locked), -2.5 + dx, 3.4, 0.55 + dz)
  }
  land.box(0.65, 1.7, 0.65, tone('#5a4030', locked), 1.05, 0.85, -0.85)
  land.box(0.65, 1.7, 0.65, tone('#5a4030', locked), -1.05, 0.85, -0.85)
  land.box(2.8, 0.4, 0.65, tone('#6a4e38', locked), 0, 1.85, -0.85)
  land.box(1.25, 1.35, 0.32, tone('#1a1210', locked), 0, 0.78, -0.65)
  land.box(0.32, 0.6, 0.12, tone('#8a3a28', locked), 0.4, 0.9, -0.48)
  torch(land, locked, -1.5, 1.45, -0.2)
  torch(land, locked, 1.5, 1.45, -0.2)
  torch(land, locked, -2.5, 2.9, 1.05)
  land.box(0.6, 0.4, 0.45, tone('#6a4a34', locked), 2.5, 0.28, 1.55)
  land.box(0.45, 0.28, 0.4, tone('#5a3a2a', locked), 2.75, 0.22, 1.15)
  land.box(0.75, 0.2, 0.55, tone('#4a3428', locked), -1.8, 0.18, 1.8)
}

function torch(land: Builder, locked: boolean, x: number, y: number, z: number) {
  land.box(0.08, 0.4, 0.08, tone('#5a3a28', locked), x, y, z)
  land.box(0.16, 0.18, 0.16, tone('#ff8a3a', locked), x, y + 0.28, z, { glow: true })
  land.box(0.1, 0.12, 0.1, tone('#ffe08a', locked), x, y + 0.4, z, { glow: true })
}

function hauntedCitadel(land: Builder, locked: boolean) {
  const stone = '#5a6474'
  const dark = '#2a303c'
  land.box(1.1, 2.4, 1.1, tone(stone, locked), -2.6, 1.2, -0.2)
  land.box(1.3, 0.28, 1.3, tone(dark, locked), -2.6, 2.45, -0.2)
  land.box(0.85, 0.9, 0.85, tone('#4a5464', locked), -2.6, 3.0, -0.2)
  for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]] as const) {
    land.box(0.22, 0.4, 0.22, tone(stone, locked), -2.6 + dx, 3.55, -0.2 + dz)
  }
  land.box(0.9, 1.7, 0.9, tone('#4a5464', locked), 2.5, 0.85, 0.15)
  land.box(0.55, 0.7, 0.55, tone(dark, locked), 2.5, 1.95, 0.15)
  land.box(0.35, 0.9, 0.35, tone('#3a4454', locked), 2.5, 2.5, 0.15)
  land.box(0.75, 1.9, 0.75, tone(stone, locked), -1.15, 0.95, -0.95)
  land.box(0.75, 1.9, 0.75, tone(stone, locked), 1.15, 0.95, -0.95)
  land.box(3.1, 0.55, 0.75, tone('#6a7484', locked), 0, 2.05, -0.95)
  land.box(1.35, 1.45, 0.35, tone('#0e1018', locked), 0, 0.85, -0.75)
  land.box(0.45, 0.7, 0.12, tone('#3a2a58', locked), 0.4, 1.0, -0.55)
  for (const [x, y, z] of [[-1.5, 1.55, -0.35], [1.5, 1.55, -0.35], [-2.6, 3.2, 0.35], [2.5, 2.2, 0.5]] as const) {
    land.box(0.18, 0.28, 0.18, tone('#7fe3ff', locked), x, y, z, { glow: true })
    land.box(0.1, 0.14, 0.1, tone('#c9e8ff', locked), x, y + 0.2, z, { glow: true })
  }
  land.box(0.7, 0.45, 0.5, tone('#4a5464', locked), -2.0, 0.3, 1.5)
  land.box(0.5, 0.35, 0.4, tone(dark, locked), -1.6, 0.25, 1.2)
  land.box(0.55, 0.8, 0.45, tone('#3a4454', locked), 2.1, 0.4, 1.4)
  land.box(0.9, 0.2, 0.55, tone('#2a303c', locked), 0.8, 0.18, 1.7)
}

function dragonNest(land: Builder, locked: boolean) {
  const rock = '#5a3a30'
  const lava = '#ff5a28'
  land.box(5.5, 2.4, 2.2, tone(rock, locked), 0, 1.2, -1.1)
  land.box(2.2, 1.8, 1.4, tone('#3a221c', locked), -2.4, 0.9, -0.4)
  land.box(2.0, 2.2, 1.4, tone('#4a2e26', locked), 2.3, 1.1, -0.5)
  land.box(2.4, 2.0, 1.0, tone('#2a1410', locked), 0, 1.0, -0.55)
  land.box(1.4, 1.5, 0.4, tone('#1a0c08', locked), 0, 0.75, -0.15)
  land.box(0.7, 0.9, 0.35, tone(lava, locked), 0, 0.7, 0.05, { glow: true })
  land.box(0.35, 0.45, 0.2, tone('#ffcf5a', locked), 0, 1.25, 0.1, { glow: true })
  for (const [x, y, z, s] of [
    [-1.6, 0.22, 1.3, 0.35],
    [-1.1, 0.18, 1.6, 0.25],
    [1.4, 0.2, 1.4, 0.3],
    [0.9, 0.16, 1.7, 0.22],
    [0.2, 0.14, 1.5, 0.2],
  ] as const) {
    land.box(s, s * 0.35, s * 0.7, tone('#d9b54a', locked), x, y, z, { glow: true })
  }
  for (const [x, z, rx] of [[-2.0, 1.5, 0.6], [1.8, 1.6, -0.4], [0.5, 1.9, 1.1]] as const) {
    land.box(0.55, 0.12, 0.18, tone('#e9e4d4', locked), x, 0.12, z, { rz: rx })
    land.box(0.18, 0.12, 0.45, tone('#d8d0c0', locked), x + 0.15, 0.12, z + 0.2, { rx: 0.4 })
  }
  land.box(0.9, 0.55, 0.7, tone('#6a4438', locked), -2.5, 0.3, 1.2)
  land.box(0.7, 0.4, 0.55, tone('#4a2e26', locked), 2.4, 0.25, 1.3)
  land.box(0.25, 0.4, 0.25, tone(lava, locked), -1.8, 0.45, 0.6, { glow: true })
  land.box(0.2, 0.3, 0.2, tone('#ffcf5a', locked), 1.6, 0.4, 0.5, { glow: true })
}

function deadTree(land: Builder, locked: boolean, x: number, z: number, height: number) {
  land.box(0.22, height, 0.22, tone('#5a4636', locked), x, height / 2, z)
  land.box(0.55, 0.1, 0.1, tone('#4a3a2e', locked), x + 0.2, height * 0.72, z, { rz: 0.7 })
  land.box(0.4, 0.08, 0.08, tone('#3e3228', locked), x - 0.15, height * 0.55, z, { rz: -0.8 })
  land.box(0.18, 0.12, 0.12, tone('#4a6a38', locked), x, height * 0.4, z + 0.1)
}

function ridge(land: Builder, locked: boolean, color: string) {
  const peaks: Array<[number, number, number]> = [
    [-3.6, 1.5, 2.1],
    [-1.5, 2.05, 2.4],
    [0.7, 1.35, 1.8],
    [2.8, 1.85, 2.2],
    [4.6, 1.15, 1.6],
  ]
  for (const [x, height, width] of peaks) {
    land.box(width, height, 1.4, tone(color, locked), x, height / 2 - 0.1, -3.5)
  }
}

function slab(land: Builder, locked: boolean, colors: [string, string]) {
  land.box(14, 0.35, 12, tone(colors[0], locked), 0, -0.16, 0.4)
  for (let x = -4; x <= 4; x += 1) {
    for (let z = -1; z <= 3; z += 1) {
      land.box(0.96, 0.12, 0.96, tone((x + z) % 2 === 0 ? colors[0] : colors[1], locked), x, 0.08, z)
    }
  }
}

function arch(land: Builder, locked: boolean, x: number, z: number, stone: string, mouth: string, cap: string) {
  land.box(0.55, 1.7, 0.75, tone(stone, locked), x - 0.95, 0.85, z)
  land.box(0.55, 1.7, 0.75, tone(stone, locked), x + 0.95, 0.85, z)
  land.box(2.45, 0.48, 0.75, tone(cap, locked), x, 1.85, z)
  land.box(1.2, 1.15, 0.4, tone(mouth, locked), x, 0.72, z + 0.08)
}

function timber(land: Builder, locked: boolean, x: number, z: number) {
  const wood = tone('#a07848', locked)
  land.box(0.16, 1.7, 0.16, wood, x - 0.85, 0.85, z)
  land.box(0.16, 1.7, 0.16, wood, x + 0.85, 0.85, z)
  land.box(1.9, 0.16, 0.16, wood, x, 1.7, z)
  land.box(0.14, 1.15, 0.14, tone('#c4a06a', locked), x - 0.55, 0.7, z + 0.15, { rz: 0.15 })
  land.box(0.14, 1.15, 0.14, tone('#c4a06a', locked), x + 0.55, 0.7, z + 0.15, { rz: -0.15 })
}

function tree(land: Builder, locked: boolean, x: number, z: number, height: number, leaf: string, shadeLeaf: string) {
  land.box(0.28, height, 0.28, tone('#6b4630', locked), x, height / 2, z)
  land.box(1.05, 0.7, 1.05, tone(leaf, locked), x, height + 0.15, z)
  land.box(0.75, 0.5, 0.75, tone(shadeLeaf, locked), x, height + 0.55, z)
}

function question(land: Builder) {
  const cells: Array<[number, number]> = [
    [0, 6],
    [1, 6],
    [2, 6],
    [-1, 5],
    [3, 5],
    [3, 4],
    [2, 3],
    [1, 2],
    [1, 1],
    [1, -1],
  ]
  for (const [x, y] of cells) {
    land.box(0.46, 0.46, 0.28, '#5c3b22', x * 0.4, 1.25 + y * 0.4, 1.05, { glow: true })
    land.box(0.34, 0.34, 0.34, '#fff6e4', x * 0.4, 1.25 + y * 0.4, 1.12, { glow: true })
  }
}

function waterSheet(locked: boolean, hex: string): THREE.Mesh {
  const color = new THREE.Color(hex)
  if (locked) {
    color.multiplyScalar(0.3)
  }
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.1, 6),
    new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.55 }),
  )
  mesh.position.set(0, 0.18, 0.5)
  return mesh
}

function makeSky(top: string, bottom: string, locked: boolean): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(18, 10, 1, 1)
  const position = geometry.getAttribute('position')
  let minY = Infinity
  let maxY = -Infinity
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const hi = new THREE.Color(top)
  const lo = new THREE.Color(bottom)
  if (locked) {
    hi.multiplyScalar(0.3)
    lo.multiplyScalar(0.3)
  }
  const colors = new Float32Array(position.count * 3)
  for (let index = 0; index < position.count; index += 1) {
    const blend = (position.getY(index) - minY) / (maxY - minY || 1)
    const color = lo.clone().lerp(hi, blend)
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))
}

function blacken(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return
    }
    const color = object.geometry.getAttribute('color')
    if (!color) {
      return
    }
    for (let index = 0; index < color.count; index += 1) {
      color.setXYZ(index, 0.02, 0.02, 0.03)
    }
    color.needsUpdate = true
  })
}

function tone(hex: string, locked: boolean): string {
  if (!locked) {
    return hex
  }
  return `#${new THREE.Color(hex).multiplyScalar(0.3).getHexString()}`
}

function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose()
  const material = mesh.material
  if (Array.isArray(material)) {
    for (const entry of material) {
      entry.dispose()
    }
  } else {
    material.dispose()
  }
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
