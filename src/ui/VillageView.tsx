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
}

export function VillageView({ roster, visitors, awayIds, retirees, partyIds, selectedId, onSelect, onPickBuilding, villageLabel, buildings, constructing, buildingLabels, expeditions, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<VillageScene | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onPickBuildingRef = useRef(onPickBuilding)
  onPickBuildingRef.current = onPickBuilding

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
    sceneRef.current?.update({ roster, visitors, awayIds, retirees, partyIds, selectedId, buildings, constructing, labels: buildingLabels, expeditions })
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
