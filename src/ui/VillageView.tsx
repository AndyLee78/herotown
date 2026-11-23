import { useEffect, useMemo, useRef } from 'react'
import type { BuildingId, Hero } from '../core'
import { portraitUrl } from './voxel/portrait'
import { VillageScene } from './voxel/VillageScene'

type Props = {
  roster: Hero[]
  visitors: Hero[]
  awayIds: string[]
  retirees: Hero[]
  partyIds: string[]
  selectedId: string | null
  onSelect: (id: string) => void
  onPickBuilding: (id: BuildingId) => void
  villageLabel: string
  buildings: Record<BuildingId, number>
  constructing: BuildingId | null
  buildingLabels: Record<BuildingId, string>
  expeditions: number
  active: boolean
  graves: { legend?: boolean }[]
}

export function VillageView({ roster, visitors, awayIds, retirees, partyIds, selectedId, onSelect, onPickBuilding, villageLabel, buildings, constructing, buildingLabels, expeditions, active, graves }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<VillageScene | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onPickBuildingRef = useRef(onPickBuilding)
  onPickBuildingRef.current = onPickBuilding
  const seenRoster = useRef<Map<string, string | null> | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const scene = new VillageScene(
      canvas,
      (id) => onSelectRef.current(id),
      (id) => onPickBuildingRef.current(id),
    )
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const weddings: [string, string][] = []
    const births: string[] = []
    const previous = seenRoster.current
    if (previous) {
      for (const hero of roster) {
        const before = previous.get(hero.id)
        if (before === undefined && hero.parents && hero.age === 0) {
          births.push(hero.id)
        }
        if (before !== undefined && hero.spouseId && before !== hero.spouseId && hero.id < hero.spouseId) {
          weddings.push([hero.id, hero.spouseId])
        }
      }
    }
    seenRoster.current = new Map(roster.map((hero) => [hero.id, hero.spouseId ?? null]))
    sceneRef.current?.update({
      roster,
      visitors,
      awayIds,
      retirees,
      partyIds,
      selectedId,
      buildings,
      constructing,
      labels: buildingLabels,
      expeditions,
      weddings,
      births,
      graves,
    })
  })

  useEffect(() => {
    sceneRef.current?.setActive(active)
  }, [active])

  return <canvas ref={canvasRef} className="village-canvas" aria-label={villageLabel} />
}

export function HeroPortrait({ hero }: { hero: Pick<Hero, 'id' | 'classId' | 'gender' | 'age'> }) {
  const { id, classId, gender, age } = hero
  const src = useMemo(() => portraitUrl({ id, classId, gender, age }), [id, classId, gender, age])
  return <img className="portrait-img" src={src} alt="" width={64} height={64} />
}
