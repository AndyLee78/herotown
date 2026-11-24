import { Lock } from 'lucide-react'
import { IconSheet, UiIcon } from './icons'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  POTION_IDS,
  adRules,
  alchemyRules,
  brewTime,
  adsRemaining,
  ageBands,
  bedCount,
  deployAge,
  isChild,
  nextAge,
  dungeons,
  enchantTime,
  expeditionSlots,
  fountainLevel,
  fountainNextAt,
  fountainRules,
  fountainWishes,
  hallOfFame,
  magicRules,
  population,
  smithRules,
  timeRules,
  townLevel,
  villageRules,
  visitorCap,
  type BuildingId,
  type DungeonReport,
  type GameAction,
  type GameState,
  type Grave,
  type Hero,
} from '../../core'
import { gameNow, gameOffset, offsetParts, subscribeGameClock } from '../clock'
import { loadSoundPrefs, saveSoundPrefs, SOUND_NAMES } from '../sound'
import { canReplay } from '../voxel/replay'
import { dungeonPreviewUrl } from '../voxel/portrait'
import { GraveFace, bonusValue } from './heroScreens'
import { Bar, Chip, CostList, Portrait, Res, Window, affordable, formatEntry, itemLabel, useNow, waitLabel } from './kit'
import { josa } from '../josa'

const BattleView = lazy(() => import('../BattleView').then((mod) => ({ default: mod.BattleView })))

type Act = (action: GameAction) => void

export function Town({
  save,
  onAction,
  busy,
  onWatch,
  onAlchemy,
  onMagic,
  onSelectHero,
}: {
  save: GameState
  onAction: Act
  busy: boolean
  onWatch: () => void
  onAlchemy: () => void
  onMagic: () => void
  onSelectHero: (id: string) => void
}) {
  const { t } = useTranslation()
  const [census, setCensus] = useState(false)
  const [hall, setHall] = useState(false)
  const level = townLevel(save.fame)
  const people = population(save)
  const kids = save.roster.filter(isChild).sort((a, b) => b.age - a.age)
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
          <Chip>
            {t('town.beds', { used: save.roster.length, count: bedCount(save.buildings.house) })}
            {kids.length > 0 ? ` ${t('family.withChildren', { count: kids.length })}` : ''}
          </Chip>
          <button type="button" className="chip" onClick={() => setCensus(true)}>
            {t('family.population')}
          </button>
          <button type="button" className="chip" onClick={() => setHall(true)}>
            {t('family.hall')}
          </button>
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
              {id === 'fountain' ? <FountainFacts save={save} /> : null}
              {(() => {
                const keeper = save.retirees.find((retiree) => retiree.building === id)
                return keeper ? (
                  <Chip tone="good">
                    {t('retire.keeper', { name: keeper.hero.name })} · {t(`retire.bonus.${id}`, { value: bonusValue(id) })}
                  </Chip>
                ) : null
              })()}
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
              {id === 'alchemy' && current > 0 ? (
                <button type="button" className="btn" onClick={onAlchemy}>
                  {t('alchemy.open')}
                </button>
              ) : null}
              {id === 'magic' && current > 0 ? (
                <button type="button" className="btn" onClick={onMagic}>
                  {t('magic.open')}
                </button>
              ) : null}
            </article>
          )
        })}
      </div>
      {census ? (
        <Window title={t('family.population')} onClose={() => setCensus(false)} small>
          <table className="census">
            <thead>
              <tr>
                <th />
                <th>{t('gender.male')}</th>
                <th>{t('gender.female')}</th>
              </tr>
            </thead>
            <tbody>
              {ageBands.map((band) => (
                <tr key={band.id}>
                  <th>{t(`family.band.${band.id}`)}</th>
                  <td>{people.bands[band.id]?.male ?? 0}</td>
                  <td>{people.bands[band.id]?.female ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="chips">
            <Chip>{t('family.marriedCount', { count: people.married })}</Chip>
            <Chip>{t('family.singleCount', { count: people.single })}</Chip>
            <Chip>
              {t('family.beds', { used: people.beds.used, total: people.beds.total })}
              {kids.length > 0 ? ` ${t('family.withChildren', { count: kids.length })}` : ''}
            </Chip>
          </span>
          {kids.length > 0 ? (
            <>
              <h3 className="section-title">{t('family.kids')}</h3>
              <div className="hero-list">
                {kids.map((kid) => (
                  <button key={kid.id} type="button" className="hero-row" onClick={() => onSelectHero(kid.id)}>
                    <Portrait hero={kid} />
                    <span className="hero-row-body">
                      <strong>{kid.name}</strong>
                      <span className="chips">
                        <Chip>{t('family.kidAge', { age: kid.age })}</Chip>
                        <Chip tone="info">{t('family.kidYears', { years: yearsUntilGrown(kid.age) })}</Chip>
                      </span>
                      {parentNames(save, kid) ? <span className="muted">{t('family.kidParents', { names: parentNames(save, kid) })}</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </Window>
      ) : null}
      {hall ? <Hall save={save} onClose={() => setHall(false)} /> : null}
    </>
  )
}

// Game years until a child may go out (children age faster, Docs/generations.md).
function yearsUntilGrown(age: number): number {
  let years = 0
  for (let next = age; next < deployAge() && years < 50; next = nextAge(next)) {
    years += 1
  }
  return years
}

function parentNames(save: GameState, hero: Hero): string {
  const everyone = [...save.roster, ...save.retirees.map((retiree) => retiree.hero), ...save.graveyard]
  return (hero.parents ?? []).flatMap((id) => everyone.find((entry) => entry.id === id)?.name ?? []).join(', ')
}

// Children who just came of age join the hero lists with a welcome (Docs/tasks.md 50).
export function ComingOfAge({ save, onView, onClose }: { save: GameState; onView: (id: string) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const grown = save.comingOfAge.flatMap((id) => save.roster.find((hero) => hero.id === id) ?? [])
  if (grown.length === 0) {
    return null
  }
  const korean = i18n.language.startsWith('ko')
  return (
    <Window title={t('family.comingOfAge')} onClose={onClose} small>
      <div className="hero-list">
        {grown.map((hero) => (
          <article key={hero.id} className="hero-row">
            <Portrait hero={hero} />
            <span className="hero-row-body">
              <strong>{t('family.grownUp', { name: korean ? josa(hero.name, '이') : hero.name, age: hero.age })}</strong>
              <span className="chips">
                <Chip tone="info">{t(`class.${hero.classId}`)}</Chip>
                <Chip>{t('ui.level', { level: hero.level })}</Chip>
              </span>
            </span>
            <button type="button" className="btn small" onClick={() => onView(hero.id)}>
              {t('family.viewHero')}
            </button>
          </article>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn primary" onClick={onClose}>
          {t('family.welcomeOk')}
        </button>
      </div>
    </Window>
  )
}

function Hall({ save, onClose }: { save: GameState; onClose: () => void }) {
  const { t } = useTranslation()
  const groups = new Map<string, Grave[]>()
  for (const grave of hallOfFame(save)) {
    const house = grave.family ?? grave.name
    groups.set(house, [...(groups.get(house) ?? []), grave])
  }
  return (
    <Window title={t('family.hall')} onClose={onClose} small>
      {groups.size === 0 ? <p className="empty">{t('family.hallEmpty')}</p> : null}
      {[...groups.entries()].map(([house, graves]) => (
        <section key={house}>
          <h3 className="section-title">{house}</h3>
          {graves.map((grave) => (
            <article key={grave.id} className="grave legend">
              <GraveFace grave={grave} />
              <span className="hero-row-body">
                <strong>{grave.name}</strong>
                <span className="chips">
                  <Chip tone="info">{t(`class.${grave.classId}`)}</Chip>
                  <Chip>{t('ui.level', { level: grave.level })}</Chip>
                  {grave.age != null ? <Chip>{t('hero.age', { age: grave.age })}</Chip> : null}
                </span>
                <span className="muted">
                  {grave.clears.length > 0 ? grave.clears.map((id) => t(`dungeon.${id}.name`)).join(', ') : t('family.noClears')}
                </span>
              </span>
            </article>
          ))}
        </section>
      ))}
    </Window>
  )
}

function chancePercent(chance: number): number {
  return Math.round(chance * 1000) / 10
}

function FountainFacts({ save }: { save: GameState }) {
  const { t } = useTranslation()
  const rule = fountainLevel(save.buildings.fountain)
  const next = fountainRules.levels.find((entry) => entry.level === save.buildings.fountain + 1)
  const jackpot = save.fountain.lastJackpot
  return (
    <>
      <p className="muted">
        {t('fountain.now', { seconds: rule.intervalMs / 1000, cap: rule.cap, gold: rule.gold, chance: chancePercent(rule.jackpotChance) })}
      </p>
      {next ? (
        <p className="muted">
          {t('fountain.next', { seconds: next.intervalMs / 1000, cap: next.cap, gold: next.gold, chance: chancePercent(next.jackpotChance) })}
        </p>
      ) : null}
      {jackpot ? (
        <p>{t('fountain.lastJackpot', { year: jackpot.year, season: t(`season.${jackpot.season}`), gold: jackpot.gold })}</p>
      ) : (
        <p className="muted">{t('fountain.noJackpot')}</p>
      )}
    </>
  )
}

export function WishButton({ save, onWish, coins }: { save: GameState; onWish: () => void; coins: { id: number; amount: number; jackpot: boolean }[] }) {
  const { t } = useTranslation()
  const now = useNow(true)
  const rule = fountainLevel(save.buildings.fountain)
  const wishes = fountainWishes(save, now)
  const nextAt = fountainNextAt(save, now)
  const progress = nextAt == null ? 1 : 1 - Math.min(1, Math.max(0, (nextAt - now) / rule.intervalMs))
  const radius = 16
  const circumference = 2 * Math.PI * radius
  return (
    <button type="button" className="wish-button" onClick={onWish} aria-label={t('fountain.wish', { count: wishes })}>
      <svg className="wish-ring" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={radius} />
        <circle cx="20" cy="20" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
      </svg>
      <span className="wish-mark">✦</span>
      {wishes > 0 ? <span className="badge">{wishes}</span> : null}
      {coins.map((coin) => (
        <span key={coin.id} className={coin.jackpot ? 'coin-fly jackpot' : 'coin-fly'}>
          +{coin.amount}
        </span>
      ))}
    </button>
  )
}

export function Alchemy({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  const working = save.alchemy != null
  const now = useNow(working)
  const level = save.buildings.alchemy
  const job = save.alchemy
  const total = job ? Math.max(1, brewTime(save, job.potionId)) : 1
  const left = job ? Math.max(0, job.finishAt - now) : 0
  return (
    <>
      <p className="banner">
        <UiIcon name="alchemy" size={18} />
        {level < 1
          ? t('alchemy.unbuilt')
          : t('alchemy.level', { level })}
        {' · '}
        {job ? t('alchemy.working', { name: t(`potion.${job.potionId}`), time: waitLabel(left) }) : t('alchemy.idle')}
      </p>
      {job ? <Bar value={total - left} max={total} tone="info" /> : null}
      <div className="split wide-right">
        <div>
          <h3 className="section-title">{t('alchemy.brew')}</h3>
          <div className="grid">
            {alchemyRules.potions.map((potion) => {
              const locked = level < potion.alchemyLevel
              return (
                <article key={potion.id} className={locked ? 'card locked' : 'card'}>
                  <strong className="name">{t(`potion.${potion.id}`)}</strong>
                  <p className="muted">{t(`potion.hint.${potion.id}`)}</p>
                  <p className="muted">{t('alchemy.batch', { count: alchemyRules.batch, time: waitLabel(brewTime(save, potion.id)) })}</p>
                  <CostList cost={potion} save={save} />
                  <button
                    type="button"
                    className="btn primary"
                    disabled={locked || working || level < 1 || !affordable(potion, save)}
                    onClick={() => onAction({ type: 'brew', potionId: potion.id, now: gameNow() })}
                  >
                    {locked ? t('alchemy.locked', { level: potion.alchemyLevel }) : t('action.brew')}
                  </button>
                </article>
              )
            })}
          </div>
        </div>
        <div>
          <h3 className="section-title">{t('alchemy.stock')}</h3>
          <ul className="plain">
            {POTION_IDS.map((id) => (
              <li key={id} className="line">
                <span>{t(`potion.${id}`)}</span>
                <Chip>{save.potions[id] ?? 0}</Chip>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

export function Magic({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  const working = save.magic != null
  const now = useNow(working)
  const level = save.buildings.magic
  const job = save.magic
  const total = job ? Math.max(1, enchantTime(save, job.trinketId)) : 1
  const left = job ? Math.max(0, job.finishAt - now) : 0
  return (
    <>
      <p className="banner">
        <UiIcon name="magic" size={18} />
        {level < 1 ? t('magic.unbuilt') : t('magic.level', { level })}
        {' · '}
        {job ? t('magic.working', { name: t(`item.trinket.${job.trinketId}`), time: waitLabel(left) }) : t('magic.idle')}
      </p>
      {job ? <Bar value={total - left} max={total} tone="info" /> : null}
      <h3 className="section-title">{t('magic.craft')}</h3>
      <div className="grid">
        {magicRules.trinkets.map((trinket) => {
          const locked = level < trinket.magicLevel
          const cost = { gold: trinket.gold, crystal: trinket.crystal }
          return (
            <article key={trinket.id} className={locked ? 'card locked' : 'card'}>
              <strong className="name">{t(`item.trinket.${trinket.id}`)}</strong>
              <p className="muted">{t(`trinket.hint.${trinket.id}`)}</p>
              <p className="muted">{waitLabel(enchantTime(save, trinket.id))}</p>
              <CostList cost={cost} save={save} />
              <button
                type="button"
                className="btn primary"
                disabled={locked || working || level < 1 || !affordable(cost, save)}
                onClick={() => onAction({ type: 'enchant', trinketId: trinket.id, now: gameNow() })}
              >
                {locked ? t('magic.locked', { level: trinket.magicLevel }) : t('action.enchant')}
              </button>
            </article>
          )
        })}
      </div>
      <p className="muted">{t('magic.stashHint', { count: save.stash.filter((item) => item.slot === 'trinket').length })}</p>
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
        {POTION_IDS.some((id) => (report.potionsUsed?.[id] ?? 0) > 0) ? (
          <span className="chips">
            {POTION_IDS.filter((id) => (report.potionsUsed?.[id] ?? 0) > 0).map((id) => (
              <Chip key={id}>{t('battle.usedPotion', { potion: t(`potion.${id}`), count: report.potionsUsed?.[id] ?? 0 })}</Chip>
            ))}
          </span>
        ) : null}
        {report.affixes?.length ? (
          <span className="chips">
            {report.affixes.map((id) => (
              <Chip key={id} tone="warn">
                {t(`affix.${id}`)}
              </Chip>
            ))}
          </span>
        ) : null}
        {report.traps ? (
          <span className="chips">
            {report.traps.disarmed > 0 ? <Chip tone="good">{t('battle.trapsDisarmed', { count: report.traps.disarmed })}</Chip> : null}
            {report.traps.sprung > 0 ? <Chip tone="warn">{t('battle.trapsSprung', { count: report.traps.sprung })}</Chip> : null}
          </span>
        ) : null}
        {(() => {
          const interrupted = report.log.filter((entry) => entry.key === 'log.interrupt').length
          const blasted = report.log.filter((entry) => entry.key === 'log.blast').length
          if (interrupted === 0 && blasted === 0) {
            return null
          }
          return (
            <span className="chips">
              {interrupted > 0 ? <Chip tone="good">{t('battle.interrupted', { count: interrupted })}</Chip> : null}
              {blasted > 0 ? <Chip tone="warn">{t('battle.blasted', { count: blasted })}</Chip> : null}
            </span>
          )
        })()}
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
          <h3 className="section-title">{t('debug.previews')}</h3>
          <DungeonPreviewSheet />
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
      {(report.proposals ?? 0) > 0 ? <p>{t('absence.proposals', { count: report.proposals })}</p> : null}
      {(report.births ?? []).length > 0 ? <p>{t('absence.births', { names: (report.births ?? []).join(', ') })}</p> : null}
      {(report.deaths ?? []).length > 0 ? <p>{t('absence.deaths', { names: (report.deaths ?? []).join(', ') })}</p> : null}
      {report.completed.length === 0 && report.visitors.length === 0 && crafted.length === 0 && (report.aged ?? []).length === 0 && (report.proposals ?? 0) === 0 && (report.births ?? []).length === 0 && (report.deaths ?? []).length === 0 ? <p className="muted">{t('absence.quiet')}</p> : null}
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

function DungeonPreviewSheet() {
  const shots = dungeons.map((dungeon) => ({
    id: dungeon.id,
    tier: dungeon.tier,
    boss: dungeon.floors[dungeon.floors.length - 1]?.monsters[0] ?? 'slime',
  }))
  const first = shots[0]
  return (
    <div className="preview-sheet">
      {shots.map((shot) => (
        <img key={shot.id} src={dungeonPreviewUrl(shot.id, shot.tier, shot.boss)} alt="" width={168} height={78} />
      ))}
      {first ? <img src={dungeonPreviewUrl(first.id, first.tier, first.boss, true)} alt="" width={168} height={78} /> : null}
    </div>
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
