import type { TFunction } from 'i18next'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  STAT_KEYS,
  canDeploy,
  combatRules,
  dungeons,
  exportSave,
  importSave,
  bedCount,
  classById,
  expeditionSlots,
  lifeRules,
  smithRules,
  potentialBand,
  progression,
  reduce,
  statRange,
  timeRules,
  townLevel,
  villageRules,
  visitorCap,
  visitorStay,
  type BuildingId,
  type DungeonReport,
  type GameAction,
  type GameState,
  type Gear,
  type Hero,
  type LogEntry,
  type TargetPriority,
} from '../core'
import { addGameOffset, gameNow, gameOffset, offsetParts, offsetSteps, resetGameOffset, subscribeGameClock } from './clock'
import { josa } from './josa'
import { loadGame, storeGame } from './storage'
import { canReplay } from './voxel/replay'

const VillageView = lazy(() => import('./VillageView').then((mod) => ({ default: mod.VillageView })))
const HeroPortrait = lazy(() => import('./VillageView').then((mod) => ({ default: mod.HeroPortrait })))
const BattleView = lazy(() => import('./BattleView').then((mod) => ({ default: mod.BattleView })))

type Screen = 'town' | 'inn' | 'roster' | 'party' | 'result' | 'village' | 'smith' | 'save' | 'debug'

export function App() {
  const { t, i18n } = useTranslation()
  const [save, setSave] = useState<GameState | null>(null)
  const [screen, setScreen] = useState<Screen>('village')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [shown, setShown] = useState(12)
  const [fileNotice, setFileNotice] = useState<string | null>(null)

  useEffect(() => {
    document.title = t('app.title')
    document.documentElement.lang = i18n.language
  }, [i18n.language, t])

  useEffect(() => {
    const now = gameNow()
    let cancel = false
    void loadGame(now).then((loaded) => {
      if (!cancel) {
        setSave(reduce(loaded, { type: 'catchUp', now }))
      }
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!save) {
      return
    }
    void storeGame(save)
  }, [save])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSave((current) => (current ? reduce(current, { type: 'catchUp', now: gameNow() }) : current))
    }, timeRules.tickMs)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!save) {
      return
    }
    const stay = visitorStay(save.buildings.inn)
    const dueTimes = save.visitors.map((hero) => (hero.arrivedAt ?? save.lastTickAt) + stay)
    if (save.visitors.length < visitorCap(save.buildings.inn)) {
      dueTimes.push(save.nextVisitorAt)
    }
    if (dueTimes.length === 0) {
      return
    }
    const due = Math.max(Math.min(...dueTimes), save.lastTickAt + 1)
    const delay = Math.max(250, due - gameNow() + 40)
    const timer = window.setTimeout(() => {
      setSave((current) => (current ? reduce(current, { type: 'catchUp', now: gameNow() }) : current))
    }, delay)
    return () => window.clearTimeout(timer)
  }, [save])

  const jumpClock = (ms: number) => {
    const base = gameNow()
    addGameOffset(ms)
    setSave((current) => {
      if (!current) {
        return current
      }
      let next = current
      let cursor = base
      for (const step of offsetSteps(ms, timeRules.maxOfflineMs)) {
        cursor += step
        next = reduce(next, { type: 'catchUp', now: cursor })
      }
      return next
    })
  }

  const resetClock = () => {
    resetGameOffset()
    const now = gameNow()
    setSave((current) => (current ? reduce(current, { type: 'catchUp', now }) : current))
  }

  const apply = (action: GameAction) => {
    setSave((current) => {
      if (!current) {
        return current
      }
      const next = reduce(current, action)
      if (action.type === 'depart' && !next.notice) {
        window.setTimeout(() => {
          setShown(12)
          setScreen('result')
        }, 0)
      }
      return next
    })
  }

  const heroes = useMemo(() => [...(save?.visitors ?? []), ...(save?.roster ?? [])], [save])

  if (!save) {
    return (
      <main>
        <h1>{t('app.title')}</h1>
      </main>
    )
  }

  const selected = heroes.find((hero) => hero.id === selectedId) ?? null
  const overlayOpen = screen !== 'village' || Boolean(save.notice || save.warning || save.absence)
  const buildingLabels = Object.fromEntries(villageRules.buildings.map((building) => [building.id, t(`building.${building.id}`)])) as Record<BuildingId, string>
  const screens = (['town', 'inn', 'roster', 'party', 'result', 'village', 'smith', 'save', 'debug'] as const).filter(
    (item) => item !== 'debug' || import.meta.env.DEV,
  )

  const setLanguage = (lng: 'en' | 'ko') => {
    void i18n.changeLanguage(lng)
    localStorage.setItem('locale', lng)
  }

  return (
    <main>
      <header>
        <div>
          <h1>{t('app.title')}</h1>
          <p>{t('app.tagline')}</p>
        </div>
        <div className="toolbar">
          <strong>{t('app.gold', { gold: save.gold })}</strong>
          <strong>{t('resource.wood', { amount: save.materials.wood })}</strong>
          <strong>{t('resource.stone', { amount: save.materials.stone })}</strong>
          <strong>{t('resource.iron', { amount: save.materials.iron })}</strong>
          <strong>{t('resource.fame', { amount: save.fame })}</strong>
          <strong>{t('resource.bone', { amount: save.materials.bone })}</strong>
          <strong>{t('app.calendar', { year: save.calendar.year, season: t(`season.${save.calendar.season}`) })}</strong>
          <button type="button" aria-pressed={i18n.language === 'en'} onClick={() => setLanguage('en')}>
            {t('action.en')}
          </button>
          <button type="button" aria-pressed={i18n.language === 'ko'} onClick={() => setLanguage('ko')}>
            {t('action.ko')}
          </button>
        </div>
      </header>
      <section className="village-panel">
        <div className="village-stage">
          <Suspense fallback={<div className="village-canvas" role="img" aria-label={t('label.village')} />}>
            <VillageView
              roster={save.roster}
              visitors={save.visitors}
              partyIds={save.party.map((slot) => slot.id)}
              selectedId={selectedId}
              onSelect={setSelectedId}
              villageLabel={t('label.village')}
              buildings={save.buildings}
              constructing={save.construction?.id ?? null}
              buildingLabels={buildingLabels}
              active={!overlayOpen}
            />
          </Suspense>
          {overlayOpen ? (
            <div className="village-overlay">
              {screen !== 'village' ? (
                <div className="overlay-close">
                  <button type="button" onClick={() => setScreen('village')}>
                    {t('action.close')}
                  </button>
                </div>
              ) : null}
              {save.notice ? <p className="notice">{t(`result.${save.notice}`)}</p> : null}
              {save.notice === 'seenDeath' ? (
                <p className="notice">
                  <button type="button" onClick={() => apply({ type: 'depart', confirm: true })}>
                    {t('action.departAnyway')}
                  </button>
                </p>
              ) : null}
              {save.warning ? <p className="notice">{t('result.wages')}</p> : null}
              {save.absence ? <Absence report={save.absence} onClose={() => apply({ type: 'dismissAbsence' })} /> : null}
              {screen === 'town' ? (
                <Town
                  save={save}
                  onBuild={(id) => apply({ type: 'build', id, now: gameNow() })}
                  onFinish={() => apply({ type: 'finishBuild', now: gameNow() })}
                />
              ) : null}
              {screen === 'inn' ? <Inn save={save} onHire={(id) => apply({ type: 'hire', id, now: gameNow() })} language={i18n.language} /> : null}
              {screen === 'roster' ? (
                <Roster
                  save={save}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onRest={() => apply({ type: 'rest', times: 1 })}
                  selected={selected}
                  onAction={apply}
                />
              ) : null}
              {screen === 'party' ? <Party save={save} onAction={apply} /> : null}
              {screen === 'result' && save.report ? <Report report={save.report} shown={shown} onShown={setShown} /> : null}
              {screen === 'result' && !save.report ? <p>{t('hint.emptyParty')}</p> : null}
              {screen === 'smith' ? <Smith save={save} onAction={apply} /> : null}
              {screen === 'save' ? (
                <SaveFile
                  save={save}
                  notice={fileNotice}
                  onExport={() => downloadSave(exportSave(save))}
                  onImport={(text) => {
                    try {
                      setSave(importSave(text, gameNow()))
                      setFileNotice(null)
                    } catch (error) {
                      setFileNotice(t(`result.${error instanceof Error ? error.message : 'checksum'}`))
                    }
                  }}
                />
              ) : null}
              {screen === 'debug' && import.meta.env.DEV ? (
                <Debug
                  save={save}
                  onGold={() => apply({ type: 'debugGold' })}
                  onRefresh={() => apply({ type: 'refreshVisitors' })}
                  onLock={(locked) => apply({ type: 'lockSeed', locked })}
                  onSeed={(seed) => apply({ type: 'setSeed', seed })}
                  onFast={() => apply({ type: 'rest', times: progression.debugRestTimes })}
                  onReset={() => apply({ type: 'reset', now: gameNow() })}
                  onJump={jumpClock}
                  onResetClock={resetClock}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <p>{t('hint.village')}</p>
      </section>
      <nav className="toolbar">
        {screens.map((item) => (
          <button key={item} type="button" aria-pressed={screen === item} onClick={() => setScreen(item)}>
            {t(`screen.${item}`)}
          </button>
        ))}
      </nav>
    </main>
  )
}

function Portrait({ hero }: { hero: Hero }) {
  return (
    <Suspense fallback={<span className="portrait" />}>
      <HeroPortrait hero={hero} />
    </Suspense>
  )
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(gameNow())
  useEffect(() => {
    if (!active) {
      return
    }
    const pull = () => setNow(gameNow())
    const timer = window.setInterval(pull, 1000)
    const unsubscribe = subscribeGameClock(pull)
    return () => {
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [active])
  return now
}

function waitLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function Inn({ save, onHire, language }: { save: GameState; onHire: (id: string) => void; language: string }) {
  const { t } = useTranslation()
  const cap = visitorCap(save.buildings.inn)
  const stay = visitorStay(save.buildings.inn)
  const waiting = save.visitors.length < cap
  const now = useNow(true)
  const nextLeave = save.visitors.reduce((soon, hero) => Math.min(soon, (hero.arrivedAt ?? save.lastTickAt) + stay), Number.POSITIVE_INFINITY)
  return (
    <section>
      <h2>{t('label.visitors')}</h2>
      <p>
        {waiting
          ? t('hint.nextVisitor', { time: waitLabel(save.nextVisitorAt - now) })
          : t('hint.innFull', { count: cap, time: waitLabel(nextLeave - now) })}
      </p>
      {save.visitors.length === 0 ? <p>{t('hint.innEmpty')}</p> : null}
      <div className="grid">
        {save.visitors.map((hero) => (
          <article key={hero.id} className="card column">
            <Portrait hero={hero} />
            <strong>{hero.name}</strong>
            <p>{language.startsWith('ko') ? t('hint.inn', { name: josa(hero.name, '이') }) : t('hint.inn', { name: hero.name })}</p>
            <p>{t('hint.staying', { time: waitLabel((hero.arrivedAt ?? save.lastTickAt) + stay - now) })}</p>
            <p>
              {t(`gender.${hero.gender}`)} · {t(`class.${hero.classId}`)} · {t('hero.age', { age: hero.age })}
            </p>
            <p>{hero.traitIds.map((trait) => t(`trait.${trait}`)).join(', ')}</p>
            <p>{t(`potential.${potentialBand(hero.potential)}`)}</p>
            <ul>
              {STAT_KEYS.map((key) => {
                const range = statRange(hero.stats[key])
                return (
                  <li key={key}>
                    {t(`stat.${key}`)} {t('hero.range', range)}
                  </li>
                )
              })}
            </ul>
            <button type="button" onClick={() => onHire(hero.id)} disabled={save.gold < progression.hireCost}>
              {t('action.hire', { cost: progression.hireCost })}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function Roster({
  save,
  selectedId,
  selected,
  onSelect,
  onRest,
  onAction,
}: {
  save: GameState
  selectedId: string | null
  selected: Hero | null
  onSelect: (id: string) => void
  onRest: () => void
  onAction: (action: GameAction) => void
}) {
  const { t } = useTranslation()
  const roster = save.roster
  return (
    <section className="split">
      <div>
        <div className="toolbar">
          <h2>{t('label.roster')}</h2>
          <button type="button" onClick={onRest} disabled={roster.length === 0}>
            {t('action.rest')}
          </button>
        </div>
        {roster.length === 0 ? <p>{t('hint.emptyRoster')}</p> : null}
        <div className="grid">
          {roster.map((hero) => (
            <button
              key={hero.id}
              type="button"
              className={hero.id === selectedId ? 'card selected' : 'card'}
              onClick={() => onSelect(hero.id)}
            >
              <Portrait hero={hero} />
              <span>
                {hero.name} · {t(`class.${hero.classId}`)} · {t(`condition.${hero.condition}`)}
                {hero.deaths > 0 ? ` · ${t('hero.seenDeath')}` : ''}
              </span>
            </button>
          ))}
        </div>
        <h2>{t('label.graveyard')}</h2>
        {save.graveyard.length === 0 ? <p>{t('hint.graveyard')}</p> : null}
        <ul>
          {save.graveyard.map((grave) => (
            <li key={grave.id}>
              {grave.name} · {t(`class.${grave.classId}`)} · {t('hero.level', { level: grave.level })} ·{' '}
              {t('hero.clears', { count: grave.clears.length })}
            </li>
          ))}
        </ul>
      </div>
      {selected && roster.some((hero) => hero.id === selected.id) ? (
        <HeroDetail hero={selected} save={save} onAction={onAction} />
      ) : null}
    </section>
  )
}

function HeroDetail({ hero, save, onAction }: { hero: Hero; save: GameState; onAction: (action: GameAction) => void }) {
  const { t } = useTranslation()
  const [confirmDismiss, setConfirmDismiss] = useState(false)
  const waiting = hero.treatAt != null || hero.resurrectAt != null
  const now = useNow(waiting)
  const skills = classById(hero.classId).skills
  const careAt = hero.resurrectAt ?? hero.treatAt
  return (
    <article className="card column">
      <h2>{t('label.detail')}</h2>
      <Portrait hero={hero} />
      <strong>{hero.name}</strong>
      <p>
        {t(`gender.${hero.gender}`)} · {t(`class.${hero.classId}`)} · {t('hero.age', { age: hero.age })} ·{' '}
        {t('hero.level', { level: hero.level })}
      </p>
      <p>
        {t(`condition.${hero.condition}`)} · {hero.traitIds.map((trait) => t(`trait.${trait}`)).join(', ')}
      </p>
      {hero.deaths > 0 ? <p>{t('hero.seenDeath')}</p> : null}
      {careAt != null ? <p>{t(hero.resurrectAt != null ? 'hero.reviving' : 'hero.treating', { time: waitLabel(careAt - now) })}</p> : null}
      <p>{t('hero.points', { count: hero.skillPoints })}</p>
      <ul>
        {skills.map((skill) => (
          <li key={skill.id}>
            {t(`skill.${skill.id}`)}
            {hero.learned.includes(skill.id) ? (
              ` · ${t('hero.learned')}`
            ) : (
              <button type="button" disabled={hero.skillPoints < 1} onClick={() => onAction({ type: 'learn', id: hero.id, skillId: skill.id })}>
                {t('action.learn')}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p>{hero.gear.map((item) => itemLabel(t, item, hero.classId)).join(', ') || t('hero.noGear')}</p>
      {hero.gear.map((item) => (
        <button key={item.id} type="button" onClick={() => onAction({ type: 'unequip', heroId: hero.id, slot: item.slot })}>
          {t('action.unequip', { name: itemLabel(t, item, hero.classId) })}
        </button>
      ))}
      {save.stash.map((item) => (
        <button key={item.id} type="button" onClick={() => onAction({ type: 'equip', heroId: hero.id, gearId: item.id })}>
          {t('action.equip', { name: itemLabel(t, item, hero.classId) })}
        </button>
      ))}
      <ul>
        {STAT_KEYS.map((key) => (
          <li key={key}>
            {t(`stat.${key}`)} {hero.stats[key]}
          </li>
        ))}
      </ul>
      {hero.condition === 'injured' || hero.condition === 'critical' ? (
        <button type="button" onClick={() => onAction({ type: 'treat', id: hero.id, now: gameNow() })}>
          {t('action.treat')}
        </button>
      ) : null}
      {hero.condition === 'dead' && hero.deaths === 1 ? (
        <button type="button" disabled={save.gold < lifeRules.reviveCost} onClick={() => onAction({ type: 'revive', id: hero.id, now: gameNow() })}>
          {t('action.revive', { cost: lifeRules.reviveCost })}
        </button>
      ) : null}
      {confirmDismiss ? (
        <button type="button" onClick={() => onAction({ type: 'dismiss', id: hero.id })}>
          {t('action.confirmDismiss')}
        </button>
      ) : (
        <button type="button" onClick={() => setConfirmDismiss(true)}>
          {t('action.dismiss')}
        </button>
      )}
      {canDeploy(hero) ? null : <p>{t('result.dead')}</p>}
    </article>
  )
}

function Party({ save, onAction }: { save: GameState; onAction: (action: GameAction) => void }) {
  const { t } = useTranslation()
  const front = save.party.filter((slot) => slot.row === 'front').length
  const back = save.party.length - front

  return (
    <section className="split">
      <div>
        <h2>{t('label.party')}</h2>
        <p>{t('hint.emptyParty')}</p>
        <div className="grid">
          {save.roster.map((hero) => (
            <button key={hero.id} type="button" onClick={() => onAction({ type: 'add', id: hero.id })} disabled={!canDeploy(hero)}>
              {hero.name} · {t(`class.${hero.classId}`)} · {t(`condition.${hero.condition}`)}
            </button>
          ))}
        </div>
        {save.party.map((slot) => {
          const hero = save.roster.find((entry) => entry.id === slot.id)
          if (!hero) {
            return null
          }
          return (
            <div key={slot.id} className="party-row">
              <span>
                {hero.name} · {t(`row.${slot.row}`)}
              </span>
              <button type="button" aria-pressed={slot.row === 'front'} onClick={() => onAction({ type: 'row', id: slot.id, row: 'front' })}>
                {t('action.front')}
              </button>
              <button type="button" aria-pressed={slot.row === 'back'} onClick={() => onAction({ type: 'row', id: slot.id, row: 'back' })}>
                {t('action.back')}
              </button>
              <button type="button" onClick={() => onAction({ type: 'remove', id: slot.id })}>
                {t('action.remove')}
              </button>
            </div>
          )
        })}
        <p>
          {t('row.front')} {front}/{combatRules.frontRowSize} · {t('row.back')} {back}/{combatRules.backRowSize}
        </p>
      </div>
      <div className="card column">
        <h2>{t('label.dungeon')}</h2>
        {dungeons.map((dungeon) => (
          <button
            key={dungeon.id}
            type="button"
            aria-pressed={save.dungeonId === dungeon.id}
            onClick={() => onAction({ type: 'dungeon', id: dungeon.id })}
          >
            {t(`dungeon.${dungeon.id}.name`)}
            {save.cleared.includes(dungeon.id) ? ` · ${t('dungeon.cleared')}` : ''}
          </button>
        ))}
        <p>{t(`dungeon.${save.dungeonId}.hint`)}</p>
        <h2>{t('label.auto')}</h2>
        <button type="button" aria-pressed={save.auto.enabled} onClick={() => onAction({ type: 'auto', enabled: !save.auto.enabled })}>
          {t('action.auto')}
        </button>
        <label>
          {t('label.policy')}
          <select
            value={save.auto.policy}
            onChange={(event) => onAction({ type: 'autoPolicy', policy: event.target.value as 'material' | 'safe' | 'fixed' })}
          >
            {(['safe', 'material', 'fixed'] as const).map((policy) => (
              <option key={policy} value={policy}>
                {t(`policy.${policy}`)}
              </option>
            ))}
          </select>
        </label>
        {save.auto.policy === 'material' ? (
          <label>
            {t('label.material')}
            <select
              value={save.auto.material}
              onChange={(event) => onAction({ type: 'autoMaterial', material: event.target.value as 'wood' | 'stone' | 'iron' | 'bone' })}
            >
              {(['wood', 'stone', 'iron', 'bone'] as const).map((material) => (
                <option key={material} value={material}>
                  {t(`material.${material}`)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            {t('label.autoDungeon')}
            <select value={save.auto.dungeonId} onChange={(event) => onAction({ type: 'autoDungeon', id: event.target.value })}>
              {dungeons.map((dungeon) => (
                <option key={dungeon.id} value={dungeon.id}>
                  {t(`dungeon.${dungeon.id}.name`)}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" onClick={() => onAction({ type: 'autoParty' })}>
          {t('action.autoParty')}
        </button>
        <p>{t('hint.auto')}</p>
        <h2>{t('label.tactics')}</h2>
        <label>
          {t('label.target')}
          <select
            value={save.tactics.target}
            onChange={(event) =>
              onAction({ type: 'tactics', tactics: { ...save.tactics, target: event.target.value as TargetPriority } })
            }
          >
            {(['lowestHp', 'backRow', 'boss'] as const).map((target) => (
              <option key={target} value={target}>
                {t(`target.${target}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('label.healBelow')}
          <input
            type="number"
            min={0}
            max={100}
            value={save.tactics.healBelow}
            onChange={(event) =>
              onAction({ type: 'tactics', tactics: { ...save.tactics, healBelow: clampPercent(event.target.value) } })
            }
          />
        </label>
        <label>
          {t('label.retreatBelow')}
          <input
            type="number"
            min={0}
            max={100}
            value={save.tactics.retreatBelow}
            onChange={(event) =>
              onAction({ type: 'tactics', tactics: { ...save.tactics, retreatBelow: clampPercent(event.target.value) } })
            }
          />
        </label>
        <button type="button" onClick={() => onAction({ type: 'depart' })} disabled={save.party.length === 0}>
          {t('action.fight')}
        </button>
      </div>
    </section>
  )
}

function Report({ report, shown, onShown }: { report: DungeonReport; shown: number; onShown: (count: number) => void }) {
  const { t } = useTranslation()
  const lines = report.log.slice(0, shown)
  const describe = (index: number) => {
    const entry = report.log[index]
    return entry ? formatEntry(t, entry) : ''
  }
  return (
    <>
    {canReplay(report) ? (
        <Suspense fallback={<div className="battle-canvas" />}>
          <BattleView report={report} describe={describe} />
        </Suspense>
      ) : null}
    <section className="split">
      <div>
        <h2>{t('label.log')}</h2>
        <div className="toolbar">
          <button type="button" onClick={() => onShown(Math.min(report.log.length, shown + 20))}>
            {t('action.faster')}
          </button>
          <button type="button" onClick={() => onShown(report.log.length)}>
            {t('action.all')}
          </button>
        </div>
        <ol className="log">
          {lines.map((entry, index) => (
            <li key={`${entry.tick}-${entry.key}-${index}`}>{formatEntry(t, entry)}</li>
          ))}
        </ol>
      </div>
      <article className="card column">
        <h2>{report.victory ? t('result.victory') : t('result.defeat')}</h2>
        {report.defeatReason ? <p>{t(`defeat.${report.defeatReason}`)}</p> : null}
        <p>{t('result.floors', { count: report.floorsCleared })}</p>
        <p>{t('result.gold', { gold: report.gold })}</p>
        <p>{t('result.xp', { xp: report.xp })}</p>
        <h2>{t('label.report')}</h2>
        <ul>
          {report.units.map((unit) => (
            <li key={unit.id}>
              {unit.name} · {t('unit.hp', { hp: unit.hp, maxHp: unit.maxHp })} · {t('result.dealt', { amount: unit.dealt })} ·{' '}
              {t('result.taken', { amount: unit.taken })} · {t('result.healed', { amount: unit.healed })}
            </li>
          ))}
        </ul>
      </article>
    </section>
    </>
  )
}

function Debug({
  save,
  onGold,
  onRefresh,
  onLock,
  onSeed,
  onFast,
  onReset,
  onJump,
  onResetClock,
}: {
  save: GameState
  onGold: () => void
  onRefresh: () => void
  onLock: (locked: boolean) => void
  onSeed: (seed: number) => void
  onFast: () => void
  onReset: () => void
  onJump: (ms: number) => void
  onResetClock: () => void
}) {
  const { t } = useTranslation()
  const [revision, setRevision] = useState(0)
  useEffect(() => subscribeGameClock(() => setRevision((value) => value + 1)), [])
  const offset = offsetParts(gameOffset())
  return (
    <section className="toolbar">
      <p key={revision}>{t('debug.offset', offset)}</p>
      <button type="button" onClick={() => onJump(10 * 60_000)}>
        {t('debug.skip10')}
      </button>
      <button type="button" onClick={() => onJump(3_600_000)}>
        {t('debug.skipHour')}
      </button>
      <button type="button" onClick={() => onJump(timeRules.seasonMs)}>
        {t('debug.skipSeason')}
      </button>
      <button type="button" onClick={onResetClock}>
        {t('debug.resetOffset')}
      </button>
      <button type="button" onClick={onGold}>
        {t('action.addGold')}
      </button>
      <button type="button" onClick={onRefresh}>
        {t('action.refresh')}
      </button>
      <button type="button" onClick={onFast}>
        {t('action.restFast')}
      </button>
      <button type="button" onClick={onReset}>
        {t('action.reset')}
      </button>
      <label>
        {t('label.seed')}
        <input
          type="number"
          value={save.seed}
          onChange={(event) => onSeed(Number.parseInt(event.target.value, 10) || 0)}
        />
      </label>
      <button type="button" aria-pressed={save.seedLocked} onClick={() => onLock(!save.seedLocked)}>
        {t('label.seedLocked')}
      </button>
    </section>
  )
}

function Absence({ report, onClose }: { report: NonNullable<GameState['absence']>; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <section className="card column">
      <h2>{t('absence.title')}</h2>
      <p>{t('absence.hours', { hours: Math.max(1, Math.round(report.elapsedMs / 3_600_000)) })}</p>
      {report.capped ? <p>{t('absence.capped')}</p> : null}
      <p>{t('absence.season', { year: report.year, season: t(`season.${report.season}`) })}</p>
      <p>{t('absence.gold', { gold: report.goldGained })}</p>
      {(report.wagesPaid ?? 0) > 0 ? <p>{t('absence.wages', { gold: report.wagesPaid })}</p> : null}
      {report.completed.length > 0 ? (
        <p>{t('absence.completed', { names: report.completed.map((id) => t(`building.${id}`)).join(', ') })}</p>
      ) : null}
      {report.visitors.length > 0 ? <p>{t('absence.visitors', { names: report.visitors.join(', ') })}</p> : null}
      {(report.autoRuns ?? 0) > 0 ? <p>{t('absence.auto', { count: report.autoRuns, gold: report.autoGold })}</p> : null}
      {(report.crafted ?? []).length > 0 ? (
        <p>{t('absence.crafted', { names: report.crafted.map((id) => t(`item.${id}`)).join(', ') })}</p>
      ) : null}
      {report.completed.length === 0 && report.visitors.length === 0 && (report.crafted ?? []).length === 0 ? (
        <p>{t('absence.quiet')}</p>
      ) : null}
      <button type="button" onClick={onClose}>
        {t('absence.dismiss')}
      </button>
    </section>
  )
}

function itemLabel(t: TFunction, item: Gear, fallback: Hero['classId']): string {
  const owner = item.id.split('.')[0] ?? fallback
  const classes = ['warrior', 'rogue', 'archer', 'mage', 'cleric', 'bard', 'dancer']
  const classId = classes.includes(owner) ? owner : fallback
  const name = item.recipeId === 'starter' ? t(`gear.${classId}.${item.slot}`) : t(`item.${item.recipeId}`)
  const extra = [
    t(`grade.${item.grade}`),
    item.element ? t(`element.${item.element}`) : '',
    item.option ? t(`option.${item.option}`) : '',
    item.enhance > 0 ? `+${item.enhance}` : '',
  ].filter(Boolean)
  return `${name} (${extra.join(', ')})`
}

function Smith({ save, onAction }: { save: GameState; onAction: (action: GameAction) => void }) {
  const { t } = useTranslation()
  const working = save.smith != null
  const now = useNow(working)
  const recipes = smithRules.recipes.filter((recipe) => recipe.smithLevel <= 3)
  return (
    <section className="split">
      <div>
        <h2>{t('label.smith')}</h2>
        <p>{t('smith.level', { level: save.buildings.smith })}</p>
        {save.smith ? (
          <p>{t('smith.working', { name: t(`item.${save.smith.recipeId}`), time: waitLabel(save.smith.finishAt - now) })}</p>
        ) : (
          <p>{t('smith.idle')}</p>
        )}
        {recipes.map((recipe) => (
          <article key={recipe.id} className="card column">
            <strong>{t(`item.${recipe.id}`)}</strong>
            <p>
              {t(`grade.${recipe.grade}`)} · {t('smith.stats', { attack: recipe.attack, defense: recipe.defense })}
              {recipe.element ? ` · ${t(`element.${recipe.element}`)}` : ''}
            </p>
            <p>{t('town.cost', recipe)}</p>
            <button
              type="button"
              disabled={save.buildings.smith < recipe.smithLevel || working}
              onClick={() => onAction({ type: 'craft', recipeId: recipe.id, now: gameNow() })}
            >
              {save.buildings.smith < recipe.smithLevel
                ? t('smith.locked', { level: recipe.smithLevel })
                : t('action.craft')}
            </button>
          </article>
        ))}
      </div>
      <div>
        <h2>{t('label.stash')}</h2>
        {save.stash.length === 0 ? <p>{t('hint.emptyStash')}</p> : null}
        {save.stash.map((item) => (
          <article key={item.id} className="card column">
            <strong>{itemLabel(t, item, 'warrior')}</strong>
            <button
              type="button"
              disabled={working || item.enhance >= smithRules.enhanceMax}
              onClick={() => onAction({ type: 'enhance', gearId: item.id, now: gameNow() })}
            >
              {t('action.enhance', { iron: smithRules.enhanceCost.iron, gold: smithRules.enhanceCost.gold })}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function Town({ save, onBuild, onFinish }: { save: GameState; onBuild: (id: BuildingId) => void; onFinish: () => void }) {
  const { t } = useTranslation()
  const level = townLevel(save.fame)
  const next = villageRules.levels.find((entry) => entry.level === level.level + 1)
  const now = useNow(save.construction != null)
  return (
    <section>
      <h2>{t('town.level', { level: level.level })}</h2>
      <p>{t('town.fame', { fame: save.fame, next: next?.fame ?? save.fame })}</p>
      <p>
        {t('town.beds', { used: save.roster.length, count: bedCount(save.buildings.house) })} ·{' '}
        {t('town.parties', { count: expeditionSlots(save.buildings.guild) })} ·{' '}
        {t('town.visitors', { count: visitorCap(save.buildings.inn) })}
      </p>
      {save.construction ? (
        <p className="toolbar">
          <span>
            {t('town.building', {
              name: t(`building.${save.construction.id}`),
              time: waitLabel(save.construction.finishAt - now),
            })}
          </span>
          {import.meta.env.DEV ? (
            <button type="button" onClick={onFinish}>
              {t('action.finishNow')}
            </button>
          ) : null}
        </p>
      ) : (
        <p>{t('town.slotFree')}</p>
      )}
      {save.buildings.guild > 0 ? (
        <p>
          {save.questClaimed
            ? t('town.questDone')
            : t('town.quest', { progress: save.questProgress, count: villageRules.guild.questCount })}
        </p>
      ) : null}
      <div className="grid">
        {villageRules.buildings.map((building) => {
          const id = building.id as BuildingId
          const current = save.buildings[id]
          const cost = building.levels.find((entry) => entry.level === current + 1)
          return (
            <article key={id} className="card column">
              <h2>{t(`building.${id}`)}</h2>
              <p>{t(`buildingHint.${id}`)}</p>
              <p>{t('town.buildingLevel', { level: current })}</p>
              {level.level < building.unlockLevel ? <p>{t('town.locked', { level: building.unlockLevel })}</p> : null}
              {cost ? (
                <p>{t('town.cost', { gold: cost.gold, wood: cost.wood, stone: cost.stone, iron: cost.iron })}</p>
              ) : (
                <p>{t('town.maxed')}</p>
              )}
              <button type="button" onClick={() => onBuild(id)} disabled={!cost}>
                {current === 0 ? t('action.construct') : t('action.upgrade')}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function SaveFile({
  notice,
  onExport,
  onImport,
}: {
  save: GameState
  notice: string | null
  onExport: () => void
  onImport: (text: string) => void
}) {
  const { t } = useTranslation()
  return (
    <section className="column">
      <h2>{t('label.save')}</h2>
      <p>{t('hint.backup')}</p>
      <div className="toolbar">
        <button type="button" onClick={onExport}>
          {t('action.export')}
        </button>
        <label className="file-button">
          {t('action.import')}
          <input
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) {
                return
              }
              void file.text().then(onImport)
            }}
          />
        </label>
      </div>
      {notice ? <p className="notice">{notice}</p> : null}
    </section>
  )
}

function downloadSave(contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'herotown-save.json'
  link.click()
  URL.revokeObjectURL(url)
}

function formatEntry(t: TFunction, entry: LogEntry): string {
  return t(entry.key, {
    ...entry.params,
    actor: labelFrom(t, entry.params, 'actor'),
    target: labelFrom(t, entry.params, 'target'),
  })
}

function labelFrom(t: TFunction, params: LogEntry['params'], prefix: 'actor' | 'target'): string {
  const name = params[`${prefix}Name`]
  if (typeof name === 'string') {
    return name
  }
  const key = params[`${prefix}Key`]
  if (typeof key === 'string') {
    return t('unit.indexed', { name: t(key), index: params[`${prefix}Index`] })
  }
  return ''
}

function clampPercent(value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return Math.max(0, Math.min(100, parsed))
}
