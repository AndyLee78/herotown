import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { dungeonById, type DungeonReport } from '../core'
import { play } from './sound'
import { BattleScene, raidPoolFromReport } from './voxel/BattleScene'
import { buildSteps } from './voxel/replay'

const SPEEDS = [1, 2, 4] as const

export function BattleView({ report, describe }: { report: DungeonReport; describe: (index: number) => string }) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BattleScene | null>(null)
  const describeRef = useRef(describe)
  describeRef.current = describe
  const steps = useMemo(() => buildSteps(report), [report])
  const [playing, setPlaying] = useState(true)
  const [done, setDone] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const [caption, setCaption] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const dungeon = report.dungeonId ? dungeonById(report.dungeonId) : null
    const tier = dungeon?.tier ?? 1
    const raid = dungeon?.special === 'raid' ? raidPoolFromReport(report) : null
    const scene = new BattleScene(canvas, report, steps, tier, {
      onStep: (index) => setCaption(describeRef.current(index)),
      onDone: () => {
        setDone(true)
        setPlaying(false)
      },
      onSound: play,
    }, {
      special: dungeon?.special,
      element: dungeon?.element,
      difficulty: dungeon?.difficulty,
      raidBossId: raid?.bossId,
      raid: raid ? { start: raid.start, left: raid.left, max: raid.max } : undefined,
    })
    sceneRef.current = scene
    setDone(false)
    setPlaying(true)
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [report, steps])

  useEffect(() => {
    sceneRef.current?.setSpeed(speed)
  }, [speed])

  const toggle = () => {
    if (done) {
      sceneRef.current?.restart()
      setDone(false)
      setPlaying(true)
      return
    }
    sceneRef.current?.setPlaying(!playing)
    setPlaying(!playing)
  }

  return (
    <div className="battle-view">
      <canvas ref={canvasRef} className="battle-canvas" aria-label={t('battle.label')} />
      <p className="battle-caption" aria-live="polite">
        {caption}
      </p>
      <div className="row">
        <button type="button" className="btn small primary" onClick={toggle}>
          {done ? t('battle.replay') : playing ? t('battle.pause') : t('battle.play')}
        </button>
        <button type="button" className="btn small" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1)}>
          {t('battle.speed', { speed })}
        </button>
        <button type="button" className="btn small" disabled={done} onClick={() => sceneRef.current?.skip()}>
          {t('battle.skip')}
        </button>
      </div>
    </div>
  )
}
