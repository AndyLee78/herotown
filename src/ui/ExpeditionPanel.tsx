import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { dungeonById, type Expedition, type GameState } from '../core'
import { Bar, formatEntry, useNow, waitLabel } from './game/kit'
import { play } from './sound'
import { BattleScene, raidBossIdOf, raidPoolFromReport, replayLength } from './voxel/BattleScene'
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
      {collapsed ? null : <LiveFight key={trip.id} trip={trip} phase={phase} save={save} />}
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

function LiveFight({ trip, phase, save }: { trip: Expedition; phase: Phase; save: GameState }) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BattleScene | null>(null)
  const steps = useMemo(() => buildSteps(trip.report), [trip.report])
  const gearByHero = useMemo(() => {
    const map: Record<string, GameState['roster'][number]['gear']> = {}
    for (const member of trip.report.party ?? []) {
      const hero = save.roster.find((entry) => entry.id === member.id)
      if (hero) {
        map[hero.id] = hero.gear
      }
    }
    return map
  }, [save.roster, trip.report.party])
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
    const dungeon = dungeonById(trip.dungeonId)
    const fromReport = dungeon.special === 'raid' ? raidPoolFromReport(trip.report) : null
    const raidRef = trip.report.floors?.[1]?.find((unit) => unit.boss && unit.side === 'enemy')?.refId
    const scene = new BattleScene(canvas, trip.report, steps, dungeon.tier, {
      onStep: setLogIndex,
      onDone: () => undefined,
      onSound: (name) => {
        if (name === 'hit') {
          play('hit', 0.3)
        } else if (name === 'victory' || name === 'defeat') {
          play(name)
        }
      },
    }, {
      special: dungeon.special,
      element: dungeon.element,
      season: dungeon.season,
      difficulty: dungeon.difficulty,
      abyssFrom: trip.abyssFrom,
      raidBossId: fromReport?.bossId ?? (raidRef ? raidBossIdOf(raidRef) ?? undefined : undefined),
      raid: trip.raid
        ? { start: trip.raid.start, left: trip.raid.left, max: trip.raid.max }
        : fromReport
          ? { start: fromReport.start, left: fromReport.left, max: fromReport.max }
          : undefined,
      gearByHero,
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
  }, [trip, steps, resync, gearByHero])

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
  const lootDrops = useMemo(() => lootForTrip(save, trip), [save, trip])
  const showChest = phase === 'back' && trip.report.victory && (lootDrops.length > 0 || mayDropGear(trip))
  return (
    <div className="live">
      <ol className="live-log">
        {phase === 'out' ? <li>{t('expedition.travelling')}</li> : null}
        {phase !== 'out' ? lines.map((entry, index) => <li key={`${entry.tick}-${index}`}>{formatEntry(t, entry)}</li>) : null}
        {phase === 'back' ? <li>{t(trip.report.victory ? 'expedition.homeWin' : 'expedition.homeLose')}</li> : null}
      </ol>
      <div style={{ position: 'relative', minHeight: 0 }}>
        <canvas ref={canvasRef} className="live-canvas" aria-label={t('battle.label')} />
        {showChest ? <LootChest key={trip.id} count={Math.max(1, lootDrops.length)} /> : null}
      </div>
      <div className="meters">
        <MeterList title={t('expedition.damage')} rows={meters.damage} tone="bad" />
        <MeterList title={t('expedition.healing')} rows={meters.healing} tone="good" />
      </div>
    </div>
  )
}

// Gear found for this trip: loot rows whose source matches and whose stamp is
// the settlement time (returnAt) or the catch-up piece that covered it.
function lootForTrip(save: GameState, trip: Expedition) {
  const sources = new Set<string>([trip.dungeonId])
  if (trip.raid) {
    const boss = trip.report.floors?.[1]?.find((unit) => unit.boss && unit.side === 'enemy')
    const id = boss ? raidBossIdOf(boss.refId) : null
    if (id) {
      sources.add(`raid.${id}`)
    }
  }
  return (save.loot ?? []).filter(
    (entry) => (entry.trip ? entry.trip === trip.id : sources.has(entry.source) && entry.at <= trip.returnAt && entry.at >= trip.departAt),
  )
}

function mayDropGear(trip: Expedition): boolean {
  const dungeon = dungeonById(trip.dungeonId)
  return !dungeon.special || dungeon.special === 'raid'
}

function LootChest({ count }: { count: number }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(true), 80)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        right: 10,
        bottom: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 54,
          height: 40,
          background: '#6b4a30',
          border: '2px solid #3a2a20',
          borderRadius: 6,
          boxShadow: '0 4px 0 #3a2a20',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -2,
            right: -2,
            top: -2,
            height: 18,
            background: '#c9a43a',
            border: '2px solid #8a6a28',
            borderRadius: '6px 6px 2px 2px',
            transformOrigin: 'bottom center',
            transform: open ? 'translateY(-10px) rotate(-28deg)' : 'none',
            transition: 'transform 0.65s ease-out',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 8,
            width: 14,
            height: 14,
            marginLeft: -7,
            background: '#ffe27a',
            borderRadius: 3,
            boxShadow: open ? '0 0 10px #ffe27a' : 'none',
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(-18px) scale(1.15)' : 'translateY(0) scale(0.6)',
            transition: 'opacity 0.35s 0.25s, transform 0.55s 0.15s ease-out',
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#ffe27a' }}>×{count}</span>
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
