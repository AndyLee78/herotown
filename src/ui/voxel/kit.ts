import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Voxel scenes are built from coloured boxes. A Builder collects boxes and
// merges them into one mesh (plus one for glowing boxes), so each part costs a
// single draw call instead of one per box.

const UNIT = new THREE.BoxGeometry(1, 1, 1).deleteAttribute('uv')
export const solidMaterial = new THREE.MeshLambertMaterial({ vertexColors: true })
export const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true })

export type BoxOptions = {
  glow?: boolean
  rx?: number
  ry?: number
  rz?: number
}

const matrix = new THREE.Matrix4()
const position = new THREE.Vector3()
const scale = new THREE.Vector3()
const rotation = new THREE.Quaternion()
const euler = new THREE.Euler()
const color = new THREE.Color()

export class Builder {
  private readonly solid: THREE.BufferGeometry[] = []
  private readonly glow: THREE.BufferGeometry[] = []
  private base: THREE.Matrix4 | null = null

  // Adds a box centred at (x, y, z).
  box(w: number, h: number, d: number, hex: string, x = 0, y = 0, z = 0, options: BoxOptions = {}): this {
    const geometry = UNIT.clone()
    euler.set(options.rx ?? 0, options.ry ?? 0, options.rz ?? 0)
    rotation.setFromEuler(euler)
    matrix.compose(position.set(x, y, z), rotation, scale.set(w, h, d))
    if (this.base) {
      matrix.premultiply(this.base)
    }
    geometry.applyMatrix4(matrix)
    color.set(hex)
    const count = geometry.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    ;(options.glow ? this.glow : this.solid).push(geometry)
    return this
  }

  // Runs `draw` with boxes placed in a moved and rotated frame.
  within(x: number, y: number, z: number, rx: number, ry: number, rz: number, draw: () => void): this {
    const previous = this.base
    euler.set(rx, ry, rz)
    const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(euler), new THREE.Vector3(1, 1, 1))
    this.base = previous ? previous.clone().multiply(local) : local
    draw()
    this.base = previous
    return this
  }

  get empty(): boolean {
    return this.solid.length === 0 && this.glow.length === 0
  }

  build({ castShadow = true, receiveShadow = true }: { castShadow?: boolean; receiveShadow?: boolean } = {}): THREE.Group {
    const group = new THREE.Group()
    if (this.solid.length > 0) {
      const mesh = new THREE.Mesh(merge(this.solid), solidMaterial)
      mesh.castShadow = castShadow
      mesh.receiveShadow = receiveShadow
      group.add(mesh)
    }
    if (this.glow.length > 0) {
      group.add(new THREE.Mesh(merge(this.glow), glowMaterial))
    }
    return group
  }
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false)
  for (const part of parts) {
    part.dispose()
  }
  parts.length = 0
  if (!merged) {
    throw new Error('Could not merge voxel geometry')
  }
  return merged
}

// Frees geometry and label textures under `root`. Shared materials stay.
export function disposeTree(root: THREE.Object3D) {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
    }
    if (object instanceof THREE.Sprite) {
      object.material.map?.dispose()
      object.material.dispose()
    }
  })
}

export function makeLabel(text: string, height = 0.32): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D is not available')
  }
  const font = '600 34px system-ui, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  context.font = font
  const width = Math.ceil(context.measureText(text).width) + 36
  canvas.width = width
  canvas.height = 56
  context.font = font
  context.fillStyle = 'rgba(255, 255, 255, 0.92)'
  context.beginPath()
  context.roundRect(2, 2, width - 4, 52, 26)
  context.fill()
  context.fillStyle = '#2d3a2e'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, width / 2, 30)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
  sprite.renderOrder = 10
  sprite.scale.set((width / 56) * height, height, 1)
  return sprite
}
