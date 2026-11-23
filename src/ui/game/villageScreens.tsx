import { Lock } from 'lucide-react'
import { IconSheet, UiIcon } from './icons'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  adRules,
  adsRemaining,
  bedCount,
  dungeons,
  expeditionSlots,
  smithRules,
  timeRules,
  townLevel,
  villageRules,
  visitorCap,
  type BuildingId,
  type DungeonReport,
  type GameAction,
  type GameState,
} from '../../core'
import { gameNow, gameOffset, offsetParts, subscribeGameClock } from '../clock'
import { loadSoundPrefs, saveSoundPrefs, SOUND_NAMES } from '../sound'
import { canReplay } from '../voxel/replay'
import { Bar, Chip, CostList, Res, Window, affordable, formatEntry, itemLabel, useNow, waitLabel } from './kit'

const BattleView = lazy(() => import('../BattleView').then((mod) => ({ default: mod.BattleView })))

type Act = (action: GameAction) => void

export function Town({ save, onAction, busy, onWatch }: { save: GameState; onAction: Act; busy: boolean; onWatch: () => void }) {
  const { t } = useTranslation()
  const level = townLevel(save.fame)
  const next = villageRules.levels.find((entry) => entry.level === level.level + 1)
  const now = useNow(save.construction != null)
  const total = save.construction ? villageRules.buildings.find((b) => b.id === save.construction?.id)?.levels.find((l) => l.level === save.buildings[save.construction!.id] + 1)?.ms ?? 1 : 1
  return (
    <>
      <div className="card summary">
        <div>
          <strong className="name">{t('town.level', { level: level.level })}</strong>
          <span className="fame">
            <Res kind="fame" amount={next ? `${save.fame}/${next.fame}` : save.fame} light />
            {next ? <Bar value={save.fame} max={next.fame} tone="warn" /> : null}
          </span>
        </div>
        <span className="chips">
          <Chip>{t('town.beds', { used: save.roster.length, count: bedCount(save.buildings.house) })}</Chip>
          <Chip>{t('town.parties', { count: expeditionSlots(save.buildings.guild) })}</Chip>
          <Chip>{t('town.visitors', { count: visitorCap(save.buildings.inn) })}</Chip>
          {save.buildings.guild > 0 ? (
            <Chip tone={save.questClaimed ? 'good' : 'info'}>
              {save.questClaimed ? t('town.questDone') : t('town.quest', { progress: save.questProgress, count: villageRules.guild.questCount })}
            </Chip>
          ) : null}
        </span>
      </div>

      {save.construction ? (
        <div className="card building-now">
          <UiIcon name="town" size={22} />
          <div className="grow">
            <strong>{t('town.building', { name: t(`building.${save.construction.id}`), time: waitLabel(save.construction.finishAt - now) })}</strong>
            <Bar value={total - (save.construction.finishAt - now)} max={total} tone="info" />
          </div>
          <button type="button" className="btn ad small" disabled={busy} onClick={onWatch}>
            {t('action.adConstruction', { left: adsRemaining(save, 'construction', gameNow()), cap: adRules.construction.daily })}
          </button>
          {import.meta.env.DEV ? (
            <button type="button" className="btn small" onClick={() => onAction({ type: 'finishBuild', now: gameNow() })}>
              {t('action.finishNow')}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="banner">{t('town.slotFree')}</p>
      )}

      <div className="grid">
        {villageRules.buildings.map((building) => {
          const id = building.id as BuildingId
          const current = save.buildings[id]
          const cost = building.levels.find((entry) => entry.level === current + 1)
          const locked = level.level < building.unlockLevel
          const capped = !cost || current >= level.maxBuildingLevel
          const disabled = locked || capped || save.construction != null || !cost || !affordable(cost, save)
          return (
            <article key={id} className={locked ? 'card building locked' : 'card building'}>
              <div className="card-top">
                <strong className="name">{t(`building.${id}`)}</strong>
                <Chip tone={current > 0 ? 'good' : undefined}>{t('ui.level', { level: current })}</Chip>
              </div>
              <p className="muted">{t(`buildingHint.${id}`)}</p>
              {locked ? (
                <p className="locked-note">
                  <Lock size={14} /> {t('town.locked', { level: building.unlockLevel })}
                </p>
              ) : capped ? (
                <p className="muted">{t('town.maxed')}</p>
              ) : (
                <CostList cost={cost} save={save} />
              )}
              <button type="button" className="btn primary" disabled={disabled} onClick={() => onAction({ type: 'build', id, now: gameNow() })}>
                {current === 0 ? t('action.construct') : t('action.upgrade')}
              </button>
            </article>
          )
        })}
      </div>
    </>
  )
}

export function Smith({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  const working = save.smith != null
  const now = useNow(working)
  const recipes = smithRules.recipes.filter((recipe) => recipe.smithLevel <= 3)
  return (
    <>
      <p className="banner">
        <UiIcon name="smith" size={18} />
        {t('smith.level', { level: save.buildings.smith })} ·{' '}
        {save.smith ? t('smith.working', { name: t(`item.${save.smith.recipeId}`), time: waitLabel(save.smith.finishAt - now) }) : t('smith.idle')}
      </p>
      <div className="split wide-right">
        <div>
          <h3 className="section-title">{t('label.smith')}</h3>
          <div className="grid">
            {recipes.map((recipe) => {
              const locked = save.buildings.smith < recipe.smithLevel
              return (
                <article key={recipe.id} className={locked ? 'card locked' : 'card'}>
                  <strong className="name">{t(`item.${recipe.id}`)}</strong>
                  <span className="chips">
                    <Chip tone="info">{t(`grade.${recipe.grade}`)}</Chip>
                    {recipe.element ? <Chip tone="warn">{t(`element.${recipe.element}`)}</Chip> : null}
                  </span>
                  <p className="muted">{t('smith.stats', { attack: recipe.attack, defense: recipe.defense })}</p>
                  <CostList cost={recipe} save={save} />
                  <button
                    type="button"
                    className="btn primary"
                    disabled={locked || working || !affordable(recipe, save)}
                    onClick={() => onAction({ type: 'craft', recipeId: recipe.id, now: gameNow() })}
                  >
                    {locked ? t('smith.locked', { level: recipe.smithLevel }) : t('action.craft')}
                  </button>
                </article>
              )
            })}
          </div>
        </div>
        <div>
          <h3 className="section-title">{t('label.stash')}</h3>
          {save.stash.length === 0 ? <p className="muted">{t('hint.emptyStash')}</p> : null}
          <ul className="plain">
            {save.stash.map((item) => (
              <li key={item.id} className="line">
                <span>{itemLabel(t, item, 'warrior')}</span>
                <button
                  type="button"
                  className="btn small"
                  disabled={working || item.enhance >= smithRules.enhanceMax}
                  onClick={() => onAction({ type: 'enhance', gearId: item.id, now: gameNow() })}
                >
                  {t('ui.enhance')} <Res kind="iron" amount={smithRules.enhanceCost.iron} light /> <Res kind="gold" amount={smithRules.enhanceCost.gold} light />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

export function Report({ report }: { report: DungeonReport | null }) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(20)
  if (!report) {
    return <p className="empty">{t('ui.noReport')}</p>
  }
  const describe = (index: number) => {
    const entry = report.log[index]
    return entry ? formatEntry(t, entry) : ''
  }
  const recommended = dungeons.find((dungeon) => dungeon.id === report.dungeonId)?.recommendedLevel ?? 1
  return (
    <>
      <div className={report.victory ? 'result-banner win' : 'result-banner lose'}>
        <strong>{report.victory ? t('result.victory') : t('result.defeat')}</strong>
        {report.dungeonId ? <span>{t(`dungeon.${report.dungeonId}.name`)}</span> : null}
        {report.defeatReason ? (
          <span>{report.defeatReason === 'tooWeak' ? t('defeat.tooWeak', { level: recommended }) : t(`defeat.${report.defeatReason}`)}</span>
        ) : null}
        <span className="row">
          <Res kind="gold" amount={report.gold} light />
          <Chip>{t('result.xp', { xp: report.xp })}</Chip>
          <Chip>{t('result.floors', { count: report.floorsCleared })}</Chip>
        </span>
      </div>
      {canReplay(report) ? (
        <Suspense fallback={<div className="battle-canvas" />}>
          <BattleView report={report} describe={describe} />
        </Suspense>
      ) : null}
      <h3 className="section-title">{t('label.report')}</h3>
      <div className="unit-table">
        {report.units.map((unit) => (
          <div key={unit.id} className="unit-line">
            <strong>{unit.name}</strong>
            <Bar value={unit.hp} max={unit.maxHp} tone={unit.hp > 0 ? 'good' : 'bad'} />
            <span className="muted">
              {t('unit.hp', { hp: unit.hp, maxHp: unit.maxHp })} · {t('result.dealt', { amount: unit.dealt })} · {t('result.taken', { amount: unit.taken })} ·{' '}
              {t('result.healed', { amount: unit.healed })}
            </span>
          </div>
        ))}
      </div>
      <details className="fold">
        <summary>{t('label.log')}</summary>
        <ol className="log">
          {report.log.slice(0, shown).map((entry, index) => (
            <li key={`${entry.tick}-${entry.key}-${index}`}>{formatEntry(t, entry)}</li>
          ))}
        </ol>
        {shown < report.log.length ? (
          <button type="button" className="btn small" onClick={() => setShown(report.log.length)}>
            {t('action.all')}
          </button>
        ) : null}
      </details>
    </>
  )
}

export function Settings({
  save,
  notice,
  onLanguage,
  onExport,
  onImport,
  onAction,
  onJump,
  onResetClock,
}: {
  save: GameState
  notice: string | null
  onLanguage: (lng: 'en' | 'ko') => void
  onExport: () => void
  onImport: (text: string) => void
  onAction: Act
  onJump: (ms: number) => void
  onResetClock: () => void
}) {
  const { t, i18n } = useTranslation()
  const [revision, setRevision] = useState(0)
  const [sound, setSound] = useState(loadSoundPrefs)
  useEffect(() => subscribeGameClock(() => setRevision((value) => value + 1)), [])
  return (
    <>
      <h3 className="section-title">{t('label.language')}</h3>
      <div className="row">
        <button type="button" className={i18n.language === 'ko' ? 'btn gold' : 'btn'} onClick={() => onLanguage('ko')}>
          {t('action.ko')}
        </button>
        <button type="button" className={i18n.language === 'en' ? 'btn gold' : 'btn'} onClick={() => onLanguage('en')}>
          {t('action.en')}
        </button>
      </div>
      <h3 className="section-title">{t('sound.title')}</h3>
      <div className="row">
        <label className="field">
          <span>{t('sound.volume')} {sound.volume}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={sound.volume}
            onChange={(event) => {
              const volume = Number(event.target.value)
              const next = { ...sound, volume }
              setSound(next)
              saveSoundPrefs(next)
            }}
          />
        </label>
        <button
          type="button"
          className={sound.muted ? 'btn small gold' : 'btn small'}
          onClick={() => {
            const next = { ...sound, muted: !sound.muted }
            setSound(next)
            saveSoundPrefs(next)
          }}
        >
          {sound.muted ? t('sound.unmute') : t('sound.mute')}
        </button>
      </div>
      <h3 className="section-title">{t('label.save')}</h3>
      <p className="muted">{t('hint.backup')}</p>
      <div className="row">
        <button type="button" className="btn" onClick={onExport}>
          {t('action.export')}
        </button>
        <label className="btn file-button">
          {t('action.import')}
          <input
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void file.text().then(onImport)
              }
            }}
          />
        </label>
      </div>
      {notice ? <p className="banner bad">{notice}</p> : null}
      {import.meta.env.DEV ? (
        <>
          <h3 className="section-title">{t('screen.debug')}</h3>
          <p key={revision} className="muted">
            {t('debug.offset', offsetParts(gameOffset()))}
          </p>
          <div className="row">
            <button type="button" className="btn small" onClick={() => onJump(10 * 60_000)}>
              {t('debug.skip10')}
            </button>
            <button type="button" className="btn small" onClick={() => onJump(3_600_000)}>
              {t('debug.skipHour')}
            </button>
            <button type="button" className="btn small" onClick={() => onJump(timeRules.seasonMs)}>
              {t('debug.skipSeason')}
            </button>
            <button type="button" className="btn small" onClick={onResetClock}>
              {t('debug.resetOffset')}
            </button>
          </div>
          <div className="row">
            <button type="button" className="btn small" onClick={() => onAction({ type: 'debugGold' })}>
              {t('action.addGold')}
            </button>
            <button type="button" className="btn small" onClick={() => onAction({ type: 'refreshVisitors' })}>
              {t('action.refresh')}
            </button>
            <button type="button" className="btn small" onClick={() => onAction({ type: 'rest', times: 4 })}>
              {t('action.restFast')}
            </button>
            <button type="button" className="btn small danger" onClick={() => onAction({ type: 'reset', now: gameNow() })}>
              {t('action.reset')}
            </button>
          </div>
          <div className="row">
            <label className="field">
              <span>{t('label.seed')}</span>
              <input type="number" value={save.seed} onChange={(event) => onAction({ type: 'setSeed', seed: Number.parseInt(event.target.value, 10) || 0 })} />
            </label>
            <button type="button" className={save.seedLocked ? 'btn small gold' : 'btn small'} onClick={() => onAction({ type: 'lockSeed', locked: !save.seedLocked })}>
              {t('label.seedLocked')}
            </button>
          </div>
          <h3 className="section-title">{t('sound.samples')}</h3>
          <div className="row">
            {SOUND_NAMES.map((name) => (
              <button key={name} type="button" className="btn small" data-sound={name}>
                {t(`sound.${name}`)}
              </button>
            ))}
          </div>
          <h3 className="section-title">{t('debug.icons')}</h3>
          <IconSheet />
        </>
      ) : null}
    </>
  )
}

export function Absence({ save, busy, onWatch, onClose }: { save: GameState; busy: boolean; onWatch: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  const report = save.absence
  if (!report) {
    return null
  }
  const crafted = report.crafted ?? []
  return (
    <Window title={t('absence.title')} onClose={onClose} small>
      <p>{t('absence.hours', { hours: Math.max(1, Math.round(report.elapsedMs / 3_600_000)) })}</p>
      {report.capped ? <p className="muted">{t('absence.capped')}</p> : null}
      <p className="muted">{t('absence.season', { year: report.year, season: t(`season.${report.season}`) })}</p>
      <div className="reward-line">
        <Res kind="gold" amount={`+${report.goldGained}`} light />
        {(report.wagesPaid ?? 0) > 0 ? <Chip tone="warn">{t('absence.wages', { gold: report.wagesPaid })}</Chip> : null}
      </div>
      {(report.autoRuns ?? 0) > 0 ? <p>{t('absence.auto', { count: report.autoRuns, gold: report.autoGold })}</p> : null}
      {report.completed.length > 0 ? <p>{t('absence.completed', { names: report.completed.map((id) => t(`building.${id}`)).join(', ') })}</p> : null}
      {crafted.length > 0 ? <p>{t('absence.crafted', { names: crafted.map((id) => t(`item.${id}`)).join(', ') })}</p> : null}
      {report.visitors.length > 0 ? <p>{t('absence.visitors', { names: report.visitors.join(', ') })}</p> : null}
      {(report.aged ?? []).length > 0 ? (
        <p>{t('absence.aged', { names: (report.aged ?? []).map((hero) => t('absence.agedHero', { name: hero.name, age: hero.age })).join(', ') })}</p>
      ) : null}
      {report.completed.length === 0 && report.visitors.length === 0 && crafted.length === 0 && (report.aged ?? []).length === 0 ? <p className="muted">{t('absence.quiet')}</p> : null}
      <div className="actions">
        {report.adClaimed ? null : (
          <button type="button" className="btn ad" disabled={busy} onClick={onWatch}>
            {t('action.adAbsence', { left: adsRemaining(save, 'absence', gameNow()), cap: adRules.absence.daily })}
          </button>
        )}
        <button type="button" className="btn primary" onClick={onClose}>
          {t('absence.dismiss')}
        </button>
      </div>
    </Window>
  )
}

export function ConfirmDepart({ notice, onConfirm, onCancel }: { notice: 'seenDeath' | 'wornParty'; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  return (
    <Window title={t('action.fight')} onClose={onCancel} small>
      <p>{t(`result.${notice}`)}</p>
      <div className="actions">
        <button type="button" className="btn" onClick={onCancel}>
          {t('ui.cancel')}
        </button>
        <button type="button" className="btn danger" onClick={onConfirm}>
          {t('action.departAnyway')}
        </button>
      </div>
    </Window>
  )
}
