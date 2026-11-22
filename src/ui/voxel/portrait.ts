import * as THREE from 'three'
import type { Hero } from '../../core'
import { buildCharacter, idlePose } from './character'
import { disposeTree } from './kit'
import { lookFor, lookKey } from './look'

// Hero cards show a small bust rendered once by a shared offscreen renderer
// and cached as an image, so a list of heroes costs no extra WebGL contexts.

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
  const rig = buildCharacter(look)
  idlePose(rig, 0, 0)
  rig.group.rotation.y = -0.45
  scene.add(rig.group)
  const centre = rig.height * 0.7
  const half = Math.max(0.5, rig.height * 0.44)
  camera.left = -half
  camera.right = half
  camera.top = half
  camera.bottom = -half
  camera.position.set(0, centre + 0.6, 4)
  camera.lookAt(0, centre, 0)
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(rig.group)
  disposeTree(rig.group)
  cache.set(key, url)
  return url
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
