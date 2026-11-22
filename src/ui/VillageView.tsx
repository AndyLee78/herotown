import { useEffect, useRef } from 'react'
import type { Hero } from '../core'
import { SPRITE_SIZE, VIEW_HEIGHT, VIEW_WIDTH, paintCharacter, paintVillage } from './pixelArt'

const SCALE = 2
const PATH = [
  { x: 78, y: 163 },
  { x: 200, y: 163 },
  { x: 400, y: 163 },
  { x: 300, y: 163 },
  { x: 234, y: 192 },
  { x: 120, y: 163 },
]

type Walker = {
  id: string
  x: number
  y: number
  waypoint: number
  frameTime: number
  facing: 1 | -1
}

type Props = {
  heroes: Hero[]
  partyIds: string[]
  selectedId: string | null
  onSelect: (id: string) => void
  villageLabel: string
  buildingLabels: { hall: string; inn: string; house: string }
}

export function VillageView({ heroes, partyIds, selectedId, onSelect, villageLabel, buildingLabels }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(new Map<string, Walker>())
  const propsRef = useRef({ heroes, partyIds, selectedId, onSelect, buildingLabels })
  propsRef.current = { heroes, partyIds, selectedId, onSelect, buildingLabels }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const village = document.createElement('canvas')
    village.width = VIEW_WIDTH
    village.height = VIEW_HEIGHT
    village.getContext('2d')?.putImageData(new ImageData(paintVillage(), VIEW_WIDTH, VIEW_HEIGHT), 0, 0)

    const sprites = new Map<string, HTMLCanvasElement>()
    let last = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { heroes: roster, partyIds: party, selectedId: selected, buildingLabels: labels } = propsRef.current
      const walkers = syncWalkers(stateRef.current, roster)
      for (const walker of walkers) {
        stepWalker(walker, dt)
      }
      drawScene(context, village, sprites, roster, walkers, party, selected, labels)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={VIEW_WIDTH * SCALE}
      height={VIEW_HEIGHT * SCALE}
      className="village-canvas"
      aria-label={villageLabel}
      onClick={(event) => {
        const canvas = canvasRef.current
        if (!canvas) {
          return
        }
        const bounds = canvas.getBoundingClientRect()
        const x = ((event.clientX - bounds.left) / bounds.width) * VIEW_WIDTH
        const y = ((event.clientY - bounds.top) / bounds.height) * VIEW_HEIGHT
        const hit = [...stateRef.current.values()].find(
          (walker) => Math.hypot(walker.x - x, walker.y - 16 - y) < 18,
        )
        if (hit) {
          onSelect(hit.id)
        }
      }}
    />
  )
}

export function HeroPortrait({ hero }: { hero: Pick<Hero, 'id' | 'classId' | 'gender'> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }
    const source = document.createElement('canvas')
    source.width = SPRITE_SIZE
    source.height = SPRITE_SIZE
    source.getContext('2d')?.putImageData(new ImageData(paintCharacter(hero, 0), SPRITE_SIZE, SPRITE_SIZE), 0, 0)
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(source, 8, 0, 48, 48)
  }, [hero])

  return <canvas ref={canvasRef} className="portrait" width={64} height={64} aria-hidden="true" />
}

function syncWalkers(walkers: Map<string, Walker>, heroes: Hero[]): Walker[] {
  const ids = new Set(heroes.map((hero) => hero.id))
  for (const id of walkers.keys()) {
    if (!ids.has(id)) {
      walkers.delete(id)
    }
  }
  heroes.forEach((hero, index) => {
    if (walkers.has(hero.id)) {
      return
    }
    const waypoint = index % PATH.length
    const spot = PATH[waypoint]
    const lane = (index % 4) - 1.5
    walkers.set(hero.id, {
      id: hero.id,
      x: spot.x + lane * 18,
      y: spot.y + ((index % 3) - 1) * 14,
      waypoint,
      frameTime: index * 0.17,
      facing: 1,
    })
  })
  return heroes.flatMap((hero) => {
    const walker = walkers.get(hero.id)
    return walker ? [walker] : []
  })
}

function stepWalker(walker: Walker, dt: number) {
  const target = PATH[walker.waypoint]
  const dx = target.x - walker.x
  const dy = target.y - walker.y
  const distance = Math.hypot(dx, dy)
  if (distance < 2) {
    walker.waypoint = (walker.waypoint + 1) % PATH.length
    return
  }
  const step = Math.min(distance, 26 * dt)
  walker.x += (dx / distance) * step
  walker.y += (dy / distance) * step
  walker.frameTime += dt
  if (Math.abs(dx) > 0.5) {
    walker.facing = dx < 0 ? -1 : 1
  }
}

function drawScene(
  context: CanvasRenderingContext2D,
  village: HTMLCanvasElement,
  sprites: Map<string, HTMLCanvasElement>,
  heroes: Hero[],
  walkers: Walker[],
  partyIds: string[],
  selectedId: string | null,
  labels: { hall: string; inn: string; house: string },
) {
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, VIEW_WIDTH * SCALE, VIEW_HEIGHT * SCALE)
  context.drawImage(village, 0, 0, VIEW_WIDTH * SCALE, VIEW_HEIGHT * SCALE)

  const ordered = [...walkers].sort((a, b) => a.y - b.y)
  for (const walker of ordered) {
    const hero = heroes.find((entry) => entry.id === walker.id)
    if (!hero) {
      continue
    }
    const frame = (Math.floor(walker.frameTime * 6) % 2) as 0 | 1
    const sprite = spriteFor(sprites, hero, frame)
    const left = (walker.x - SPRITE_SIZE / 2) * SCALE
    const top = (walker.y - SPRITE_SIZE + 2) * SCALE
    context.fillStyle = 'rgba(20, 24, 16, 0.28)'
    context.beginPath()
    context.ellipse(walker.x * SCALE, walker.y * SCALE + 4, 16, 6, 0, 0, Math.PI * 2)
    context.fill()
    context.save()
    if (walker.facing < 0) {
      context.translate(left + SPRITE_SIZE * SCALE, top)
      context.scale(-1, 1)
      context.drawImage(sprite, 0, 0, SPRITE_SIZE * SCALE, SPRITE_SIZE * SCALE)
    } else {
      context.drawImage(sprite, left, top, SPRITE_SIZE * SCALE, SPRITE_SIZE * SCALE)
    }
    context.restore()
    if (partyIds.includes(hero.id)) {
      context.fillStyle = '#e2c56a'
      context.fillRect(walker.x * SCALE - 4, walker.y * SCALE + 8, 8, 4)
    }
    if (hero.id === selectedId) {
      context.strokeStyle = '#f4e2a4'
      context.lineWidth = 2
      context.strokeRect(left - 2, top - 2, SPRITE_SIZE * SCALE + 4, SPRITE_SIZE * SCALE + 4)
    }
    drawName(context, hero.name, walker.x * SCALE, top - 6)
  }

  drawName(context, labels.hall, 96 * SCALE, 80 * SCALE)
  drawName(context, labels.inn, 384 * SCALE, 80 * SCALE)
  drawName(context, labels.house, 234 * SCALE, 240 * SCALE)
}

function spriteFor(cache: Map<string, HTMLCanvasElement>, hero: Hero, frame: 0 | 1): HTMLCanvasElement {
  const key = `${hero.id}:${hero.classId}:${hero.gender}:${frame}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_SIZE
  canvas.height = SPRITE_SIZE
  canvas.getContext('2d')?.putImageData(new ImageData(paintCharacter(hero, frame), SPRITE_SIZE, SPRITE_SIZE), 0, 0)
  cache.set(key, canvas)
  return canvas
}

function drawName(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  context.font = '700 20px Segoe UI, sans-serif'
  context.textAlign = 'center'
  context.lineWidth = 4
  context.strokeStyle = '#1b140c'
  context.strokeText(text, x, y)
  context.fillStyle = '#f7f1e4'
  context.fillText(text, x, y)
}
