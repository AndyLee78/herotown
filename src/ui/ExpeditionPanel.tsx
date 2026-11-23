import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { dungeonById, type Expedition, type GameState } from '../core'
import { Bar, formatEntry, useNow, waitLabel } from './game/kit'
import { play } from './sound'
import { BattleScene, replayLength } from './voxel/BattleScene'
import { buildSteps } from './voxel/replay'

type Phase = 'out' | 'battle' | 'back'

const COLLAPSE_KEY = 'herotown.expeditionPanel.collapsed'

function phaseAt(trip: Expedition, now: number): Phase {
  return now < trip.battleAt ? 'out' : now < trip.battleEndAt ? 'battle' : 'back'
}

// Shows expeditions in progress over the village: where the party is, the
// fight playing in time with the clock, the latest log lines and who is
// carrying the damage and healing.
export function ExpeditionPanel({ save }: { save: GameState }) {
  const { t } = useTranslation()
  const now = useNow(true)
  const [chosen, setChosen] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY)
      if (stored === '1' || stored === '0') {
        return stored === '1'
      }
    } catch {
      // Ignore a blocked store and use the screen size.
    }
    return window.innerHeight < 700
  })
  const trip = save.expeditions.find((entry) => entry.id === chosen) ?? save.expeditions[0]
  if (!trip) {
    return null
  }
  const toggle = () => {
    setCollapsed(!collapsed)
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '0' : '1')
    } catch {
      // Private mode: the panel just forgets.
    }
  }
  const phase = phaseAt(trip, now)
  return (
    <section className={collapsed ? 'expedition-panel collapsed' : 'expedition-panel'} aria-label={t('expedition.title')}>
      <header className="expedition-head">
        {save.expeditions.length > 1 ? (
          <span className="expedition-tabs">
            {save.expeditions.map((entry) => (
              <button key={entry.id} type="button" aria-pressed={entry.id === trip.id} onClick={() => setChosen(entry.id)}>
                {t(`dungeon.${entry.dungeonId}.name`)}
              </button>
            ))}
          </span>
        ) : (
          <strong>{t(`dungeon.${trip.dungeonId}.name`)}</strong>
        )}
        <span className="expedition-state">
          {t(`expedition.phase.${phase}`)} · {t('expedition.returnIn', { time: waitLabel(trip.returnAt - now) })}
        </span>
        <button type="button" className="icon-toggle" aria-label={t(collapsed ? 'expedition.expand' : 'expedition.collapse')} onClick={toggle}>
          {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </header>
      <Stages trip={trip} now={now} />
      {collapsed ? null : <LiveFight key={trip.id} trip={trip} phase={phase} />}
    </section>
  )
}

// Travel out, one segment per floor, travel back.
function Stages({ trip, now }: { trip: Expedition; now: number }) {
  const { t } = useTranslation()
  const floors = trip.report.floors?.length ?? 1
  const out = clamp((now - trip.departAt) / (trip.battleAt - trip.departAt))
  const fight = clamp((now - trip.battleAt) / (trip.battleEndAt - trip.battleAt))
  const back = clamp((now - trip.battleEndAt) / (trip.returnAt - trip.battleEndAt))
  return (
    <div className="stages">
      <span className="stage" title={t('expedition.phase.out')}>
        <Bar value={out} max={1} tone="info" />
      </span>
      {Array.from({ length: floors }, (_, index) => (
        <span key={index} className="stage" title={t('expedition.floor', { floor: index + 1 })}>
          <Bar value={clamp(fight * floors - index)} max={1} tone={index === floors - 1 ? 'bad' : 'warn'} />
        </span>
      ))}
      <span className="stage" title={t('expedition.phase.back')}>
        <Bar value={back} max={1} tone="good" />
      </span>
    </div>
  )
}

function LiveFight({ trip, phase }: { trip: Expedition; phase: Phase }) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BattleScene | null>(null)
  const steps = useMemo(() => buildSteps(trip.report), [trip.report])
  const [logIndex, setLogIndex] = useState(-1)
  const [resync, setResync] = useState(0)

  // Coming back to the tab re-joins the fight at the right moment.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) {
        setResync((value) => value + 1)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const tier = dungeonById(trip.dungeonId).tier
    const scene = new BattleScene(canvas, trip.report, steps, tier, {
      onStep: setLogIndex,
      onDone: () => undefined,
      onSound: (name) => {
        if (name === 'hit') {
          play('hit', 0.3)
        } else if (name === 'victory' || name === 'defeat') {
          play(name)
        }
      },
    })
    sceneRef.current = scene
    // Play the whole replay in exactly the time the fight takes on the clock.
    const fightSeconds = Math.max(1, (trip.battleEndAt - trip.battleAt) / 1000)
    const speed = replayLength(steps) / fightSeconds
    scene.setSpeed(speed)
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [trip, steps, resync])

  // Keep the replay paused while travelling out, and in step with the clock.
  const clockNow = useNow(true)
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) {
      return
    }
    if (phase === 'out') {
      scene.setPlaying(false)
    } else if (phase === 'battle') {
      scene.setPlaying(true)
    } else {
      scene.skip()
    }
  }, [phase])

  const fightSeconds = Math.max(1, (trip.battleEndAt - trip.battleAt) / 1000)
  const speed = replayLength(steps) / fightSeconds
  const joined = useRef<string | null>(null)
  useEffect(() => {
    const scene = sceneRef.current
    const key = `${trip.id}-${resync}`
    if (!scene || joined.current === key || phase !== 'battle') {
      return
    }
    joined.current = key
    scene.seek(((clockNow - trip.battleAt) / 1000) * speed)
  }, [clockNow, phase, resync, speed, trip])

  const lines = trip.report.log.slice(Math.max(0, logIndex - 3), logIndex + 1)
  const meters = useMemo(() => tally(trip, logIndex), [trip, logIndex])
  return (
    <div className="live">
      <ol className="live-log">
        {phase === 'out' ? <li>{t('expedition.travelling')}</li> : null}
        {phase !== 'out' ? lines.map((entry, index) => <li key={`${entry.tick}-${index}`}>{formatEntry(t, entry)}</li>) : null}
        {phase === 'back' ? <li>{t(trip.report.victory ? 'expedition.homeWin' : 'expedition.homeLose')}</li> : null}
      </ol>
      <canvas ref={canvasRef} className="live-canvas" aria-label={t('battle.label')} />
      <div className="meters">
        <MeterList title={t('expedition.damage')} rows={meters.damage} tone="bad" />
        <MeterList title={t('expedition.healing')} rows={meters.healing} tone="good" />
      </div>
    </div>
  )
}

function MeterList({ title, rows, tone }: { title: string; rows: { name: string; amount: number }[]; tone: 'good' | 'bad' }) {
  const top = rows[0]?.amount ?? 0
  return (
    <div className="meter">
      <strong>{title}</strong>
      {rows.slice(0, 3).map((row) => (
        <span key={row.name} className="meter-row">
          <span>{row.name}</span>
          <Bar value={row.amount} max={Math.max(1, top)} tone={tone} />
          <span>{row.amount}</span>
        </span>
      ))}
    </div>
  )
}

// Damage and healing by hero, counted from the log up to the current line.
function tally(trip: Expedition, logIndex: number) {
  const heroes = new Map((trip.report.units ?? []).filter((unit) => unit.side === 'hero').map((unit) => [unit.id, unit.name]))
  const damage = new Map<string, number>()
  const healing = new Map<string, number>()
  for (const entry of trip.report.log.slice(0, logIndex + 1)) {
    const actor = entry.params.actorId
    const amount = Number(entry.params.amount ?? 0)
    if (typeof actor !== 'string' || !heroes.has(actor)) {
      continue
    }
    if (entry.key === 'log.attack') {
      damage.set(actor, (damage.get(actor) ?? 0) + amount)
    } else if (entry.key === 'log.heal') {
      healing.set(actor, (healing.get(actor) ?? 0) + amount)
    }
  }
  const rows = (map: Map<string, number>) =>
    [...map.entries()].map(([id, amount]) => ({ name: heroes.get(id) ?? id, amount })).sort((a, b) => b.amount - a.amount)
  return { damage: rows(damage), healing: rows(healing) }
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}
