import { TitleBadges, TitleAwards } from './titleBadges'
import { Lock } from 'lucide-react'
import type { TFunction } from 'i18next'
import { IconSheet, UiIcon } from './icons'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  POTION_IDS,
  PROMOTION_FREE,
  STAT_KEYS,
  adRules,
  alchemyRules,
  brewTime,
  adsRemaining,
  ageBands,
  bedCount,
  busyHeroIds,
  canDeploy,
  classList,
  deployAge,
  isChild,
  nextAge,
  drillGold,
  drillTime,
  drillXp,
  dungeons,
  enchantTime,
  endgameRules,
  enhanceCostFor,
  enhanceLimit,
  expeditionSlots,
  fountainLevel,
  fountainNextAt,
  fountainRules,
  fountainWishes,
  festivalScale,
  guildLevel,
  guildRules,
  hallOfFame,
  familyRules,
  legendBonus,
  legendsRules,
  livingLegends,
  houseRooms,
  magicRules,
  moraleOf,
  moraleRules,
  partyLevel,
  population,
  progression,
  retireeBonus,
  pupils,
  schoolRules,
  schoolSeats,
  seasonKey,
  shrineMorale,
  shrineSlots,
  smithRules,
  timeRules,
  townLevelOf,
  tuition,
  villageRules,
  visitorCap,
  type BuildingId,
  type ClassId,
  type Contract,
  type DungeonReport,
  type GameAction,
  type GameState,
  type Grave,
  type Hero,
  type StatKey,
} from '../../core'
import { festivalCost } from '../../core/game'
import { gameNow, gameOffset, offsetParts, subscribeGameClock } from '../clock'
import { loadSoundPrefs, saveSoundPrefs, SOUND_NAMES } from '../sound'
import { canReplay } from '../voxel/replay'
import { dungeonPreviewUrl } from '../voxel/portrait'
import { GraveFace, bonusValue } from './heroScreens'
import { Bar, Chip, CostList, Portrait, Res, SchoolInfo, VaultAmount, Window, affordable, formatEntry, gearGradeClass, gearNameClass, itemLabel, recipeLabel, useNow, vaultKinds, waitLabel } from './kit'
import { GearOptions, GearTypePicker } from './gearDetails'
import { GearExchange, LootInbox, ReportLoot } from './lootScreens'
import { Storage } from './storageScreen'
import { josa } from '../josa'
import { InvasionCard } from './invasion'
import { EliteMonsters, GiftBadge } from './identity'
import { Monuments, Prosperity } from './lateTown'
import { SpecialRewardChips } from './specialDungeons'
import type { useGameNotifications } from '../notifications'

const BattleView = lazy(() => import('../BattleView').then((mod) => ({ default: mod.BattleView })))

type Act = (action: GameAction) => void
type Workshop = keyof GameState['automation']['queues']

export function House({ save, onSelectHero }: { save: GameState; onSelectHero: (id: string) => void }) {
  const { t } = useTranslation()
  const view = houseRooms(save)
  const kinds = ['family', 'parent', 'shared'] as const
  const groups = kinds.map((kind) => ({ kind, rooms: view.rooms.filter((room) => room.kind === kind) }))
  const busy = busyHeroIds(save)
  const retired = new Set(save.retirees.map(({ hero }) => hero.id))
  const occupant = (hero: Hero) => (
    <button key={hero.id} type="button" className="hero-row house-occupant" onClick={() => onSelectHero(hero.id)}>
      <Portrait hero={hero} />
      <span className="hero-row-body">
        <strong>{hero.name}</strong>
        <span className="chips">
          <Chip>{t('hero.age', { age: hero.age })}</Chip>
          {isChild(hero) ? <Chip>{t('house.child')}</Chip> : null}
          {retired.has(hero.id) ? <Chip>{t('house.retired')}</Chip> : null}
          {busy.has(hero.id) ? <Chip tone="info">{t('house.busy')}</Chip> : null}
          {/* The fallen and the wounded keep their bed (review b1261a7). */}
          {hero.condition === 'dead' || hero.condition === 'injured' || hero.condition === 'critical' ? (
            <Chip tone={hero.condition === 'injured' ? 'warn' : 'bad'}>{t(`condition.${hero.condition}`)}</Chip>
          ) : null}
        </span>
      </span>
    </button>
  )
  return (
    <div className="column">
      <div className="card">
        <div className="chips">
          <Chip>{t('house.beds', { used: view.used, beds: view.beds })}</Chip>
          <Chip>{t('house.free', { count: view.free })}</Chip>
          {groups.map(({ kind, rooms }) => <Chip key={kind}>{t('house.roomCount', { room: t(`house.${kind}`), count: rooms.length })}</Chip>)}
        </div>
        {view.overflow > 0 ? <p className="banner bad">{t('house.overflow', { count: view.overflow })}</p> : null}
      </div>
      <div className="house-rooms">
        {groups.flatMap(({ kind, rooms }) => rooms.map((room, index) => {
          const first = room.members[0]
          return (
            <article key={`${kind}-${index}`} className="card">
              <h3 className="section-title">{kind === 'family' && first
                ? t('house.familyName', { name: first.family ?? first.name })
                : t(`house.${kind}`)}</h3>
              <div className="column">
                {room.members.map(occupant)}
                {room.expecting ? <Chip tone="info">{t('house.expecting')}</Chip> : null}
                {Array.from({ length: room.empty }, (_, bed) => <span className="house-vacancy" key={bed}>{t('house.emptyBed')}</span>)}
              </div>
            </article>
          )
        }))}
      </div>
      {view.retirees.length > 0 ? <section>
        <h3 className="section-title">{t('house.retirees')}</h3>
        <div className="house-rooms">{view.retirees.map(occupant)}</div>
      </section> : null}
    </div>
  )
}

function WorkshopQueue({ save, building, onAction }: { save: GameState; building: Workshop; onAction: Act }) {
  const { t } = useTranslation()
  const queue = save.automation.queues[building]
  const prefix = { smith: 'item', alchemy: 'potion', magic: 'item.trinket' }[building]
  const capacity = save.buildings[building]
  if (capacity === 0) return null
  return (
    <section className="card workshop-queue">
      <h3 className="section-title">{t('automation.queue', { used: queue.length, capacity })}</h3>
      {queue.length > 0 ? (
        <ol className="plain">
          {queue.map((id, index) => (
            <li key={`${id}-${index}`} className="line">
              <span>{t('automation.order', { number: index + 1, name: building === 'smith' ? recipeLabel(t, id) : t(`${prefix}.${id}`) })}</span>
              <button type="button" className="btn small" onClick={() => onAction({ type: 'dequeue', building, index })}>{t('ui.cancel')}</button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

export function Town({
  save,
  onAction,
  busy,
  onWatch,
  onAlchemy,
  onMagic,
  onTraining,
  onSchool,
  onGuild,
  onMarket,
  onTavern,
  onLegends,
  onFestival,
  onSelectHero,
}: {
  save: GameState
  onAction: Act
  busy: boolean
  onWatch: () => void
  onAlchemy: () => void
  onMagic: () => void
  onTraining: () => void
  onSchool: () => void
  onGuild: () => void
  onMarket: () => void
  onTavern: () => void
  onLegends: () => void
  onFestival: () => void
  onSelectHero: (id: string) => void
}) {
  const { t } = useTranslation()
  const [census, setCensus] = useState(false)
  const [hall, setHall] = useState(false)
  const level = townLevelOf(save)
  const people = population(save)
  const kids = save.roster.filter(isChild).sort((a, b) => b.age - a.age)
  const adults = save.roster.filter((hero) => !isChild(hero) && hero.condition !== 'dead')
  const villageMorale = adults.length > 0 ? Math.round(adults.reduce((total, hero) => total + moraleOf(hero), 0) / adults.length) : '—'
  const next = villageRules.levels.find((entry) => entry.level === level.level + 1)
  const now = useNow(save.construction != null || save.invasion != null)
  const total = save.construction ? villageRules.buildings.find((b) => b.id === save.construction?.id)?.levels.find((l) => l.level === save.buildings[save.construction!.id] + 1)?.ms ?? 1 : 1
  return (
    <>
      {Object.values(save.vault).some((amount) => amount > 0) ? (
        <div className="card column">
          <strong>{t('special.vault')}</strong>
          <div className="chips">{vaultKinds.map((kind) => <VaultAmount key={kind} kind={kind} amount={save.vault[kind]} />)}</div>
        </div>
      ) : null}
      <div className="card summary">
        <div>
          <strong className="name">{t('town.level', { level: level.level })}</strong>
          <span className="fame">
            <Res kind="fame" amount={next ? `${save.fame}/${next.fame}` : save.fame} light />
            {next ? <Bar value={save.fame} max={next.fame} tone="warn" /> : null}
          </span>
          {next && next.level > PROMOTION_FREE && save.fame >= next.fame ? <Chip tone="warn">{t('promotion.waiting')}</Chip> : null}
        </div>
        <span className="chips">
          <Chip>
            {t('town.beds', { used: save.roster.length, count: bedCount(save.buildings.house) })}
            {kids.length > 0 ? ` ${t('family.withChildren', { count: kids.length })}` : ''}
          </Chip>
          <button type="button" className="chip" onClick={() => setCensus(true)}>
            {t('family.population')}
          </button>
          <button type="button" className="chip" onClick={() => save.buildings.legends > 0 ? onLegends() : setHall(true)}>
            {t('family.hall')}
          </button>
          <Chip>{t('town.parties', { count: expeditionSlots(save.buildings.guild) })}</Chip>
          <Chip>{t('town.visitors', { count: visitorCap(save.buildings.inn) })}</Chip>
          <Chip>{t('morale.village', { value: villageMorale })}</Chip>
          {save.buildings.guild > 0 ? (
            <Chip tone={save.guild && save.guild.seasonal.length > 0 && save.guild.seasonal.every((c) => c.done) ? 'good' : 'info'}>
              {t('town.contracts', {
                done: save.guild?.seasonal.filter((c) => c.done).length ?? 0,
                count: save.guild?.seasonal.length || guildLevel(save.buildings.guild).contracts,
              })}
            </Chip>
          ) : null}
        </span>
        <button type="button" className="btn gold small" onClick={onFestival}>{t('morale.festival.open')}</button>
      </div>

      {!next ? <Prosperity save={save} onAction={onAction} /> : level.level >= PROMOTION_FREE ? <Promotion save={save} onAction={onAction} /> : null}
      <LootInbox save={save} onAction={onAction} />
      <InvasionCard save={save} now={now} onAction={onAction} />
      <Monuments save={save} onAction={onAction} />

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
          const requiredTown = Math.max(building.unlockLevel, cost?.town ?? 0)
          const locked = level.level < requiredTown
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
                  <Lock size={14} /> {t('town.locked', { level: requiredTown })}
                </p>
              ) : capped ? (
                <p className="muted">{t('town.maxed')}</p>
              ) : null}
              {cost && (locked || !capped) ? <CostList cost={cost} save={save} /> : null}
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
              {id === 'training' && current > 0 ? (
                <button type="button" className="btn" onClick={onTraining}>
                  {t('training.open')}
                </button>
              ) : null}
              {id === 'school' && current > 0 ? (
                <button type="button" className="btn" onClick={onSchool}>{t('school.open')}</button>
              ) : null}
              {id === 'guild' && current > 0 ? (
                <button type="button" className="btn" onClick={onGuild}>
                  {t('guild.open')}
                </button>
              ) : null}
              {id === 'market' && current > 0 ? (
                <button type="button" className="btn" onClick={onMarket}>{t('market.open')}</button>
              ) : null}
              {id === 'tavern' && current > 0 ? (
                <button type="button" className="btn" onClick={onTavern}>{t('tavern.open')}</button>
              ) : null}
              {id === 'temple' && current > 0 ? (
                <label className="toggle">
                  <input type="checkbox" role="switch" checked={save.automation.care} onChange={(event) => onAction({ type: 'automation', care: event.currentTarget.checked })} />
                  {t('automation.care')}
                </label>
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
                      <GiftBadge hero={kid} compact />
                      <span className="chips">
                        <Chip>{t('family.kidAge', { age: kid.age })}</Chip>
                        <Chip tone="info">{t('family.kidYears', { years: yearsUntilGrown(kid.age) })}</Chip>
                      </span>
                      {parentNames(save, kid) ? <span className="muted">{t('family.kidParents', { names: parentNames(save, kid) })}</span> : null}
                      <SchoolInfo hero={kid} />
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

export function School({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<string | null>(null)
  const level = save.buildings.school
  const children = save.roster.filter((hero) => isChild(hero) && hero.age >= schoolRules.minAge && hero.condition !== 'dead')
  const students = pupils(save)
  const available = children.filter((hero) => !hero.school)
  const full = students.length >= schoolSeats(save)
  return (
    <>
      <div className="banner">
        <Chip>{t('school.seats', { used: students.length, total: schoolSeats(save) })}</Chip>
        <span>{t('school.tuition')}</span>
        <Res kind="gold" amount={tuition(save)} />
      </div>
      {level === 0 ? <p className="muted">{t('result.noSchool')}</p> : null}
      <table className="school-effects">
        <thead><tr><th scope="col">{t('school.level')}</th><th scope="col">{t('school.potential')}</th><th scope="col">{t('school.focusGain')}</th></tr></thead>
        <tbody>{schoolRules.potentialPerSeason.map((gain, index) => (
          <tr key={index} aria-current={level === index + 1 ? 'true' : undefined}>
            <th scope="row">{t('ui.level', { level: index + 1 })}</th>
            <td>+{gain}</td><td>+{schoolRules.focusPerSeason[index]}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="muted">{t('school.careerHint', { count: schoolRules.careerSeasons })}</p>
      {([['school.students', students], ['school.eligible', available]] as const).map(([title, kids]) => (
        <section key={title}>
          <h3 className="section-title">{t(title, { age: schoolRules.minAge })}</h3>
          {kids.length === 0 ? <p className="muted">{t('school.empty')}</p> : null}
          <div className="column">{kids.map((hero) => {
            const seasons = hero.school?.seasons ?? 0
            const remaining = schoolRules.careerSeasons - seasons
            const canEdit = level > 0 && (hero.school != null || !full)
            return (
              <article key={hero.id} className="card">
                <div className="card-top">
                  <Portrait hero={hero} />
                  <div>
                    <strong>{hero.name}</strong>
                    <div className="chips">
                      <Chip>{t('hero.age', { age: hero.age })}</Chip>
                      <Chip>{t('family.kidYears', { years: yearsUntilGrown(hero.age) })}</Chip>
                      {hero.school ? <Chip>{t('school.attended', { count: seasons })}</Chip> : null}
                    </div>
                    {hero.school ? <SchoolInfo hero={hero} /> : null}
                  </div>
                </div>
                {hero.school && remaining > 0 ? <p className="muted">{t('school.remaining', { count: remaining })}</p> : null}
                <div className="row">
                  <button type="button" className="btn small" disabled={!canEdit} onClick={() => setEditing(hero.id)}>
                    {t(hero.school ? 'school.edit' : 'school.enroll')}
                  </button>
                  {hero.school ? <button type="button" className="btn small" onClick={() => {
                    onAction({ type: 'unenroll', heroId: hero.id })
                    setEditing(null)
                  }}>{t('school.leave')}</button> : null}
                </div>
                {editing === hero.id && canEdit ? <SchoolPlan key={hero.id} hero={hero} onCancel={() => setEditing(null)} onSave={(focus, career) => {
                  onAction({ type: 'enroll', heroId: hero.id, focus, career })
                  setEditing(null)
                }} /> : null}
              </article>
            )
          })}</div>
        </section>
      ))}
    </>
  )
}

function SchoolPlan({ hero, onSave, onCancel }: { hero: Hero; onSave: (focus: StatKey | null, career: ClassId | null) => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const [focus, setFocus] = useState<StatKey | ''>(hero.school?.focus ?? '')
  const [career, setCareer] = useState<ClassId | ''>(hero.school?.career ?? '')
  return (
    <div className="column">
      <label className="field">{t('school.focus')}
        <select value={focus} onChange={(event) => setFocus(event.target.value as StatKey | '')}>
          <option value="">{t('school.noFocus')}</option>
          {STAT_KEYS.map((stat) => <option key={stat} value={stat}>{t(`stat.${stat}`)}</option>)}
        </select>
      </label>
      <label className="field">{t('school.career')}
        <select value={career} onChange={(event) => setCareer(event.target.value as ClassId | '')}>
          <option value="">{t('school.noCareer')}</option>
          {classList.filter((klass) => !klass.femaleOnly || hero.gender === 'female').map(({ id }) => <option key={id} value={id}>{t(`class.${id}`)}</option>)}
        </select>
      </label>
      <div className="row">
        <button type="button" className="btn primary small" onClick={() => onSave(focus || null, career || null)}>{t('school.save')}</button>
        <button type="button" className="btn small" onClick={onCancel}>{t('ui.cancel')}</button>
      </div>
    </div>
  )
}

export function Festival({ save, onAction, onClose }: { save: GameState; onAction: Act; onClose: () => void }) {
  const { t } = useTranslation()
  const season = save.calendar.season
  const held = save.festival?.season === seasonKey(save.calendar)
  const cost = festivalCost(save)
  const rules = moraleRules.festival
  const scale = festivalScale(save)
  const effect = t(`morale.festival.${season}.effect`, {
    multiplier: Number((rules.bondBoost * scale).toFixed(2)),
    percent: rules.xpShare * 100,
    ...rules.harvest,
    bonus: rules.memorial,
    base: moraleRules.base,
  })
  return (
    <Window title={t(`morale.festival.${season}.name`)} onClose={onClose} small>
      <p>{t('morale.festival.common', { morale: Math.round(rules.morale * scale), fame: rules.fame })}</p>
      {scale > 1 ? <p className="muted">{t('tavern.hosted', { scale })}</p> : null}
      <p>{effect}</p>
      <div className="row">
        <Res kind="gold" amount={cost} />
        <button type="button" className="btn gold" disabled={held || save.gold < cost} onClick={() => onAction({ type: 'festival' })}>
          {t(held ? 'morale.festival.held' : 'morale.festival.open')}
        </button>
      </div>
      {!held && save.gold < cost ? <p className="muted">{t('result.poor')}</p> : null}
    </Window>
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

export function Legends({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  const dead = hallOfFame(save).map((grave) => ({ kind: 'grave' as const, person: grave }))
  const living = livingLegends(save).map((hero) => ({ kind: 'living' as const, person: hero }))
  const groups = new Map<string, Array<(typeof dead)[number] | (typeof living)[number]>>()
  for (const entry of [...dead, ...living]) {
    const family = entry.person.family ?? entry.person.name
    const group = groups.get(family) ?? []
    group.push(entry)
    groups.set(family, group)
  }
  const onDisplay = save.shrine?.gear ?? []
  const slots = shrineSlots(save)
  const stash = save.stash.filter((gear) => gear.heirloom)
  return (
    <div className="column">
      <table className="school-effects legends-effects">
        <thead><tr>{(['level', 'potential', 'cap', 'attack', 'slots'] as const).map((key) => <th scope="col" key={key}>{t(`legends.${key}`)}</th>)}</tr></thead>
        <tbody>{[familyRules.legendPotential, ...legendsRules.legendPotential].map((gain, level) => (
          <tr key={level} aria-current={save.buildings.legends === level ? 'true' : undefined}>
            <th scope="row">{level === 0 ? t('legends.unbuilt') : t('ui.level', { level })}</th>
            <td>+{gain}</td><td>{level === 0 ? familyRules.legendPotentialMax : legendsRules.legendPotentialMax[level - 1]}</td>
            <td>{level === 0 ? '—' : `+${Math.round(100 * legendsRules.blessing[level - 1]!)}%`}</td>
            <td>{level === 0 ? '—' : legendsRules.shrineSlots[level - 1]}</td>
          </tr>
        ))}</tbody>
      </table>
      {groups.size === 0 ? <p className="empty">{t('family.hallEmpty')}</p> : null}
      {[...groups.entries()].map(([family, entries]) => (
        <section key={family}>
          <h3 className="section-title">{family} <Chip tone="good">{t('legends.familyBonus', { bonus: legendBonus(save, family) })}</Chip></h3>
          {entries.map((entry) => {
            const person = entry.person
            return <article key={person.id} className="grave legend">
              {entry.kind === 'living' ? <Portrait hero={entry.person} /> : <GraveFace grave={entry.person} />}
              <span className="hero-row-body">
                <strong>{person.name}</strong>
                <span className="chips">
                  <Chip tone="info">{t(`class.${person.classId}`)}</Chip>
                  <Chip>{t('ui.level', { level: person.level })}</Chip>
                  {entry.kind === 'living' ? <Chip tone="good">{t('legends.living')}</Chip> : null}
                </span>
                <span className="muted">{person.clears.length ? person.clears.map((id) => t(`dungeon.${id}.name`, { defaultValue: id })).join(', ') : t('family.noClears')}</span>
              </span>
            </article>
          })}
        </section>
      ))}
      <section>
        <h3 className="section-title">{t('legends.display', { used: onDisplay.length, slots })}</h3>
        <p className="muted">{t('legends.displayHint', { fame: legendsRules.shrineFame, morale: legendsRules.shrineMorale, current: shrineMorale(save) })}</p>
        {onDisplay.length === 0 ? <p className="muted">{t('legends.noDisplay')}</p> : null}
        <ul className="plain">{onDisplay.map((gear) => <li key={gear.id} className="line">
          <div className="column gear-entry"><span className={gearNameClass(gear)}>{itemLabel(t, gear, 'warrior')}</span><GearOptions item={gear} /></div>
          <button type="button" className="btn small" onClick={() => onAction({ type: 'unshrine', gearId: gear.id })}>{t('legends.withdraw')}</button>
        </li>)}</ul>
        <h3 className="section-title">{t('legends.spare')}</h3>
        {stash.length === 0 ? <p className="muted">{t('legends.noSpare')}</p> : null}
        <ul className="plain">{stash.map((gear) => <li key={gear.id} className="line">
          <div className="column gear-entry"><span className={gearNameClass(gear)}>{itemLabel(t, gear, 'warrior')}</span><GearOptions item={gear} /></div>
          <button type="button" className="btn small" disabled={onDisplay.length >= slots} onClick={() => onAction({ type: 'enshrine', gearId: gear.id })}>{t('legends.place')}</button>
        </li>)}</ul>
      </section>
    </div>
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
                <strong>{grave.name}</strong><TitleBadges hero={grave} />
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
  const queueFull = save.automation.queues.alchemy.length >= level
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
      <WorkshopQueue save={save} building="alchemy" onAction={onAction} />
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
                    disabled={locked || (working && queueFull) || !affordable(potion, save)}
                    onClick={() => onAction({ type: 'brew', potionId: potion.id, now: gameNow() })}
                  >
                    {locked ? t('alchemy.locked', { level: potion.alchemyLevel }) : t(working ? 'automation.enqueue' : 'action.brew')}
                  </button>
                </article>
              )
            })}
          </div>
        </div>
        <div>
          <h3 className="section-title">{t('alchemy.stock')}</h3>
          <p className="muted">{t('automation.stockHint')}</p>
          <ul className="plain">
            {POTION_IDS.map((id) => {
              const name = t(`potion.${id}`)
              const target = save.automation.potions[id] ?? 0
              const setTarget = (count: number) => onAction({ type: 'potionTarget', potionId: id, count })
              return (
                <li key={id} className="column potion-target">
                  <div className="line">
                    <span>{name}</span>
                    <Chip>{t('automation.inStock', { count: save.potions[id] ?? 0 })}</Chip>
                  </div>
                  <div className="row">
                    <label htmlFor={`potion-target-${id}`}>{t('automation.stockTarget')}</label>
                    <button type="button" className="btn tiny" aria-label={t('automation.decrease', { name })} disabled={target === 0} onClick={() => setTarget(target - 1)}>−</button>
                    <input
                      id={`potion-target-${id}`}
                      type="number"
                      min={0}
                      step={1}
                      value={target}
                      aria-label={t('automation.stockTargetFor', { name })}
                      onChange={(event) => {
                        const { value, valueAsNumber } = event.currentTarget
                        if (value === '') setTarget(0)
                        else if (Number.isSafeInteger(valueAsNumber) && valueAsNumber >= 0) setTarget(valueAsNumber)
                      }}
                    />
                    <button type="button" className="btn tiny" aria-label={t('automation.increase', { name })} disabled={target >= Number.MAX_SAFE_INTEGER} onClick={() => setTarget(target + 1)}>+</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </>
  )
}

export function Training({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  const level = save.buildings.training
  const active = save.drills.length > 0
  const now = useNow(active)
  const busy = busyHeroIds(save)
  const total = Math.max(1, drillTime(save))
  const listed = save.roster
    .filter((hero) => !isChild(hero) && hero.condition !== 'dead')
    .map((hero) => ({ hero, xp: drillXp(save, hero), gold: drillGold(hero) }))
    .sort((a, b) => a.hero.level - b.hero.level || a.hero.name.localeCompare(b.hero.name))
  return (
    <>
      <p className="banner">
        <UiIcon name="roster" size={18} />
        {level < 1 ? t('training.unbuilt') : t('training.level', { level })}
        {' · '}
        {t('training.slots', { used: save.drills.length, count: Math.max(1, level) })}
        {' · '}
        {t('training.partyLevel', { level: Math.round(partyLevel(save) * 10) / 10 })}
      </p>
      <p className="muted">{t('training.time', { time: waitLabel(drillTime(save)) })}</p>
      <label className="toggle">
        <input type="checkbox" role="switch" checked={save.automation.drill} onChange={(event) => onAction({ type: 'automation', drill: event.currentTarget.checked })} />
        {t('automation.drill')}
      </label>
      <p className="muted">{t('automation.drillHint')}</p>
      {save.drills.length === 0 ? <p className="muted">{t('training.idle')}</p> : null}
      <div className="column">
        {save.drills.map((drill) => {
          const hero = save.roster.find((entry) => entry.id === drill.heroId)
          const left = Math.max(0, drill.finishAt - now)
          return (
            <div key={drill.heroId} className="card training-job">
              <div className="card-top">
                {hero ? <Portrait hero={hero} /> : null}
                <div className="grow">
                  <strong>{hero?.name ?? drill.heroId}</strong>
                  <span className="muted">{t('training.working', { name: hero?.name ?? drill.heroId, time: waitLabel(left) })}</span>
                </div>
                <Chip>+{drill.xp} XP</Chip>
              </div>
              <Bar value={total - left} max={total} tone="info" />
            </div>
          )
        })}
      </div>
      <h3 className="section-title">{t('training.roster')}</h3>
      <div className="hero-list">
        {listed.map(({ hero, xp, gold }) => {
          const drilling = busy.has(hero.id)
          const levels = Math.round((xp / Math.max(1, hero.level * progression.xpPerLevel)) * 10) / 10
          const canSend =
            level >= 1 &&
            !drilling &&
            canDeploy(hero) &&
            hero.condition !== 'injured' &&
            hero.condition !== 'critical' &&
            save.drills.length < level &&
            save.gold >= gold
          return (
            <div key={hero.id} className="hero-row">
              <Portrait hero={hero} />
              <span className="hero-row-body">
                <strong>
                  {hero.name} · {t('ui.level', { level: hero.level })}
                </strong>
                <span className="chips">
                  <Chip tone="info">{t(`class.${hero.classId}`)}</Chip>
                  {drilling ? <Chip tone="info">{t('hero.drilling')}</Chip> : null}
                </span>
                <span className="muted">{t('training.gain', { xp, levels })}</span>
              </span>
              <button type="button" className="btn primary small" disabled={!canSend} onClick={() => onAction({ type: 'drill', heroId: hero.id, now: gameNow() })}>
                {t('action.drill')} <Res kind="gold" amount={gold} light />
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

function appraisalLabel(share: number, t: TFunction): string {
  if (share <= 0) {
    return t('guild.appraisalExact')
  }
  return t('guild.appraisalRange', { percent: Math.round(share * 100) })
}

function ContractCard({
  save,
  contract,
  repeat,
  onAction,
}: {
  save: GameState
  contract: Contract
  repeat?: boolean
  onAction: Act
}) {
  const { t } = useTranslation()
  const title =
    contract.kind === 'clear'
      ? t('guild.clear', { dungeon: t(`dungeon.${contract.dungeonId}.name`), need: contract.need })
      : t('guild.deliver', { material: t(`material.${contract.material}`), need: contract.need })
  const canDeliver =
    contract.kind === 'deliver' &&
    !contract.done &&
    !!contract.material &&
    save.materials[contract.material] >= contract.need - contract.progress
  return (
    <article className={contract.done ? 'card contract done' : 'card contract'}>
      <div className="card-top">
        <strong className="name">{title}</strong>
        {repeat ? <Chip tone="warn">{t('guild.repeat')}</Chip> : null}
        {contract.done ? <Chip tone="good">{t('guild.done')}</Chip> : null}
      </div>
      {repeat && !contract.done ? <p className="muted">{t('guild.repeatHint')}</p> : null}
      <Bar value={contract.progress} max={contract.need} tone={contract.done ? 'good' : 'info'} />
      <p className="muted">{t('guild.progress', { progress: contract.progress, need: contract.need })}</p>
      <span className="chips">
        <Chip tone="good">
          {t('guild.reward')} <Res kind="gold" amount={contract.gold} light />
        </Chip>
        {contract.fame > 0 ? (
          <Chip tone="warn">
            <Res kind="fame" amount={contract.fame} light />
          </Chip>
        ) : null}
      </span>
      {contract.kind === 'deliver' && !contract.done ? (
        <button type="button" className="btn primary" disabled={!canDeliver} onClick={() => onAction({ type: 'deliver', contractId: contract.id })}>
          {t('action.deliver')}
          {contract.material ? <Res kind={contract.material} amount={contract.need - contract.progress} light /> : null}
        </button>
      ) : null}
    </article>
  )
}

export function Guild({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  const level = save.buildings.guild
  const effects = guildLevel(level)
  const board = save.guild
  const left = Math.max(0, timeRules.seasonMs - save.calendar.intoSeasonMs)
  const record = board?.record ?? 0
  const nextLevel = level >= guildRules.levels.length - 1 ? null : guildLevel(level + 1)
  const seasonalDone = board?.seasonal.every((c) => c.done) ?? false
  return (
    <>
      <p className="banner">
        <UiIcon name="party" size={18} />
        {level < 1 ? t('guild.unbuilt') : t('guild.level', { level })}
      </p>
      {level < 1 ? null : (
        <>
          <h3 className="section-title">{t('guild.effects')}</h3>
          <span className="chips">
            <Chip>{t('guild.expeditions', { count: effects.expeditions })}</Chip>
            <Chip>{t('guild.autoParties', { count: effects.autoParties })}</Chip>
            <Chip>{t('guild.seasonalCount', { count: effects.contracts })}</Chip>
            <Chip>{t('guild.appraisal', { label: appraisalLabel(effects.appraisal, t) })}</Chip>
          </span>
          <div className="card guild-record">
            <strong>{t('guild.record', { count: record })}</strong>
            {nextLevel ? (
              <>
                <p className="muted">{t('guild.recordNext', { have: record, need: nextLevel.record })}</p>
                <Bar value={Math.min(record, nextLevel.record)} max={Math.max(1, nextLevel.record)} tone="warn" />
              </>
            ) : (
              <p className="muted">{t('guild.recordMax')}</p>
            )}
          </div>
          <h3 className="section-title">{t('guild.board')}</h3>
          <p className="muted">{t('guild.seasonLeft', { time: waitLabel(left) })}</p>
          {!board || board.seasonal.length === 0 ? (
            <p className="banner">{t(save.cleared.length === 0 ? 'guild.empty' : 'guild.boardEmpty')}</p>
          ) : (
            <div className="grid">
              {board.seasonal.map((contract) => (
                <ContractCard key={contract.id} save={save} contract={contract} onAction={onAction} />
              ))}
            </div>
          )}
          {seasonalDone && board?.repeat ? (
            <>
              <h3 className="section-title">{t('guild.repeat')}</h3>
              <ContractCard save={save} contract={board.repeat} repeat onAction={onAction} />
            </>
          ) : null}
        </>
      )}
    </>
  )
}

export function Magic({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  const working = save.magic != null
  const now = useNow(working)
  const level = save.buildings.magic
  const queueFull = save.automation.queues.magic.length >= level
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
      <WorkshopQueue save={save} building="magic" onAction={onAction} />
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
                disabled={locked || (working && queueFull) || !affordable(cost, save)}
                onClick={() => onAction({ type: 'enchant', trinketId: trinket.id, now: gameNow() })}
              >
                {locked ? t('magic.locked', { level: trinket.magicLevel }) : t(working ? 'automation.enqueue' : 'action.enchant')}
              </button>
            </article>
          )
        })}
      </div>
      <p className="muted">{t('magic.stashHint', { count: save.stash.filter((item) => item.slot === 'trinket').length })}</p>
    </>
  )
}

function Promotion({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  const promotion = endgameRules.promotions.find(({ level }) => level === save.promoted + 1)
  const required = villageRules.levels.find(({ level }) => level === promotion?.level)
  if (!promotion || !required) return <p className="banner">{t('promotion.max')}</p>
  const enoughFame = save.fame >= required.fame
  const deepEnough = save.abyss.best >= promotion.abyssBest
  const raidKills = 'raidKills' in promotion ? promotion.raidKills : 0
  const invasionWins = 'invasionWins' in promotion ? promotion.invasionWins : 0
  const wins = save.invasion?.wins ?? 0
  const offerings = vaultKinds.flatMap((kind) => {
    const need = (promotion.offering as Partial<GameState['vault']>)[kind] ?? 0
    return need > 0 ? [{ kind, have: save.vault[kind], need }] : []
  })
  const enoughOffering = offerings.every(({ have, need }) => have >= need)
  return (
    <section className="card column">
      <strong>{t('promotion.target', { level: promotion.level })}</strong>
      <div className="chips">
        <Chip tone={enoughFame ? 'good' : 'bad'}>{t('promotion.fame', { have: save.fame, need: required.fame })}</Chip>
        <Chip tone={deepEnough ? 'good' : 'bad'}>{t('promotion.depth', { have: save.abyss.best, need: promotion.abyssBest })}</Chip>
        {raidKills ? <Chip tone={save.raidKills >= raidKills ? 'good' : 'bad'}>{t('promotion.raid', { have: save.raidKills, need: raidKills })}</Chip> : null}
        {invasionWins ? <Chip tone={wins >= invasionWins ? 'good' : 'bad'}>{t('promotion.defense', { have: wins, need: invasionWins })}</Chip> : null}
      </div>
      <strong>{t('promotion.offering')}</strong>
      <div className="chips">
        {offerings.map(({ kind, have, need }) => <Chip key={kind} tone={have >= need ? 'good' : 'bad'}><VaultAmount kind={kind} amount={`${have}/${need}`} /></Chip>)}
      </div>
      <button type="button" className="btn gold" disabled={!enoughFame || !deepEnough || !enoughOffering || save.raidKills < (raidKills ?? 0) || wins < (invasionWins ?? 0)} onClick={() => onAction({ type: 'promote' })}>
        {t('promotion.action')}
      </button>
    </section>
  )
}

export function Smith({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'smith' | 'storage'>('smith')
  const [selected, setSelected] = useState<string | null>(null)
  const working = save.smith != null
  const now = useNow(working)
  const recipes = smithRules.recipes.filter((recipe) => recipe.smithLevel < 99)
  const queueFull = save.automation.queues.smith.length >= save.buildings.smith
  const tabs = <div className="tabs" role="tablist" aria-label={t('screen.smith')}>
    <button type="button" role="tab" aria-selected={tab === 'smith'} onClick={() => setTab('smith')}>{t('screen.smith')}</button>
    <button type="button" role="tab" aria-selected={tab === 'storage'} onClick={() => setTab('storage')}>{t('label.stash')}</button>
  </div>
  if (tab === 'storage') return <>{tabs}<div role="tabpanel" aria-label={t('label.stash')}><Storage save={save} onAction={onAction} /></div></>
  return (
    <>
      {tabs}
      <p className="banner">
        <UiIcon name="smith" size={18} />
        {t('smith.level', { level: save.buildings.smith })} ·{' '}
        {save.smith ? t('smith.working', { name: recipeLabel(t, save.smith.recipeId, save.smith.gearType ?? save.smith.gear?.type), time: waitLabel(save.smith.finishAt - now) }) : t('smith.idle')}
      </p>
      <WorkshopQueue save={save} building="smith" onAction={onAction} />
      <GearExchange save={save} onAction={onAction} />
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
                    <Chip tone="info"><span className={gearGradeClass(recipe.grade)}>{t(`grade.${recipe.grade}`)}</span></Chip>
                    {recipe.element ? <Chip tone="warn">{t(`element.${recipe.element}`)}</Chip> : null}
                  </span>
                  <p className="muted">{t('smith.stats', { attack: recipe.attack, defense: recipe.defense })}</p>
                  <CostList cost={recipe} save={save} />
                  <button
                    type="button"
                    className="btn primary"
                    disabled={locked}
                    aria-expanded={selected === recipe.id}
                    onClick={() => setSelected(selected === recipe.id ? null : recipe.id)}
                  >
                    {locked ? t('smith.locked', { level: recipe.smithLevel }) : t('gearDetail.choose')}
                  </button>
                  {selected === recipe.id && !locked ? <GearTypePicker
                    slot={recipe.slot === 'armor' ? 'armor' : 'weapon'}
                    disabled={(working && queueFull) || !affordable(recipe, save)}
                    queued={working}
                    onCraft={(gearType) => {
                      onAction({ type: 'craft', recipeId: recipe.id, gearType, now: gameNow() })
                      setSelected(null)
                    }}
                  /> : null}
                </article>
              )
            })}
          </div>
        </div>
        <div>
          <h3 className="section-title">{t('label.stash')}</h3>
          {save.stash.length === 0 ? <p className="muted">{t('hint.emptyStash')}</p> : null}
          <ul className="plain">
            {save.stash.map((item) => {
              const cost = enhanceCostFor(item)
              const limit = enhanceLimit(item)
              const canEnhance = item.slot !== 'trinket' && item.enhance < limit
              const lateChance = smithRules.lateEnhance.chance[item.enhance - smithRules.enhanceMax]
              const canChange = !item.unique && (item.options?.length ?? 0) > 0
              return <li key={item.id} className="card column">
                <span className={gearNameClass(item)}>{itemLabel(t, item, 'warrior')}</span>
                {item.slot !== 'trinket' ? <Chip>{t('lateSmith.progress', { current: item.enhance, max: limit })}</Chip> : null}
                {canEnhance ? <>
                  {lateChance != null ? <span>{t('lateSmith.chance', { chance: Math.round(Math.min(1, lateChance + retireeBonus(save, 'smith')) * 100) })}</span> : null}
                  <CostList cost={cost} save={save} />
                  <button type="button" className="btn small" disabled={working || save.buildings.smith < 1 || !affordable(cost, save)}
                    onClick={() => onAction({ type: 'enhance', gearId: item.id, now: gameNow() })}>{t('lateSmith.enhance', { level: item.enhance + 1 })}</button>
                </> : null}
                {canChange ? <div className="column">
                  <VaultAmount kind="valor" amount={smithRules.optionValor} short={save.vault.valor < smithRules.optionValor} />
                  <GearOptions item={item} disabled={save.vault.valor < smithRules.optionValor}
                    onReroll={(index) => onAction({ type: 'reroll', gearId: item.id, index })} />
                </div> : <GearOptions item={item} />}
              </li>
            })}
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
        <TitleAwards awards={report.titlesEarned} names={report.units} />
        <span className="chips"><SpecialRewardChips report={report} /></span>
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
      <EliteMonsters report={report} />
      <ReportLoot report={report} />
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
  notifications,
  notice,
  onLanguage,
  onExport,
  onImport,
  onAction,
  onJump,
  onResetClock,
}: {
  save: GameState
  notifications: ReturnType<typeof useGameNotifications>
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
      <h3 className="section-title">{t('notifications.title')}</h3>
      <label className="field">
        <span>{t('notifications.enable')}</span>
        <input type="checkbox" checked={notifications.enabled} disabled={!notifications.supported} onChange={(event) => void notifications.toggle(event.target.checked)} />
      </label>
      {!notifications.supported ? <p className="muted">{t('notifications.unsupported')}</p>
        : notifications.denied ? <p className="muted">{t('notifications.denied')}</p>
          : <p className="muted">{t('notifications.hint')}</p>}
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
  const incidents = report.incidents
  const hasIncidents = !!(incidents?.pending || incidents?.ignored.length)
  return (
    <Window title={t('absence.title')} onClose={onClose} small>
      <p>{t('absence.hours', { hours: Math.max(1, Math.round(report.elapsedMs / 3_600_000)) })}</p>
      <TitleAwards awards={report.titlesEarned} names={[...save.roster, ...save.retirees.map(r => r.hero), ...save.graveyard]} />
      {report.capped ? <p className="muted">{t('absence.capped')}</p> : null}
      <p className="muted">{t('absence.season', { year: report.year, season: t(`season.${report.season}`) })}</p>
      <div className="reward-line">
        <Res kind="gold" amount={`+${report.goldGained}`} light />
        {(report.wagesPaid ?? 0) > 0 ? <Chip tone="warn">{t('absence.wages', { gold: report.wagesPaid })}</Chip> : null}
      </div>
      {(report.autoRuns ?? 0) > 0 ? <p>{t('absence.auto', { count: report.autoRuns, gold: report.autoGold })}</p> : null}
      {report.autoDetails?.dungeons.map(({ dungeonId, wins, losses, xp, materials }) => <section className="card column" key={dungeonId}>
        <strong>{t(`dungeon.${dungeonId}.name`)}</strong>
        <span>{t('storage.autoRecord', { count: wins + losses, wins, losses, xp })}</span>
        <div className="chips">{(Object.keys(materials) as (keyof GameState['materials'])[]).map((id) => <Res key={id} kind={id} amount={`+${materials[id]}`} />)}</div>
      </section>)}
      {report.autoDetails?.gear.length ? <section className="card column">
        <strong>{t('storage.absenceGear')}</strong>
        <ul className="plain">{report.autoDetails.gear.map((item) => <li key={item.id} className={gearNameClass(item)}>{itemLabel(t, item, 'warrior')} · {t(`grade.${item.grade}`)}</li>)}</ul>
      </section> : null}
      {report.autoDetails?.injured.length ? <p>{t('storage.autoInjured', { names: report.autoDetails.injured.map(({ name }) => name).join(', ') })}</p> : null}
      {report.completed.length > 0 ? <p>{t('absence.completed', { names: report.completed.map((id) => t(`building.${id}`)).join(', ') })}</p> : null}
      {crafted.length > 0 ? <p>{t('absence.crafted', { names: crafted.map((id) => t(`item.${id}`)).join(', ') })}</p> : null}
      {report.visitors.length > 0 ? <p>{t('absence.visitors', { names: report.visitors.join(', ') })}</p> : null}
      {(report.aged ?? []).length > 0 ? (
        <p>{t('absence.aged', { names: (report.aged ?? []).map((hero) => t('absence.agedHero', { name: hero.name, age: hero.age })).join(', ') })}</p>
      ) : null}
      {(report.proposals ?? 0) > 0 ? <p>{t('absence.proposals', { count: report.proposals })}</p> : null}
      {(report.births ?? []).length > 0 ? <p>{t('absence.births', { names: (report.births ?? []).join(', ') })}</p> : null}
      {(report.deaths ?? []).length > 0 ? <p>{t('absence.deaths', { names: (report.deaths ?? []).join(', ') })}</p> : null}
      {hasIncidents ? <section className="card column">
        <strong>{t('incidents.absence.title')}</strong>
        {incidents?.pending ? <span>{t('incidents.absence.pending', { event: t(`incidents.events.${incidents.pending}.title`) })}</span> : null}
        {incidents?.ignored.map((id, index) => <span key={`${id}-${index}`}>{t('incidents.absence.ignored', { event: t(`incidents.events.${id}.title`) })}</span>)}
      </section> : null}
      {!hasIncidents && report.completed.length === 0 && report.visitors.length === 0 && crafted.length === 0 && (report.aged ?? []).length === 0 && (report.proposals ?? 0) === 0 && (report.births ?? []).length === 0 && (report.deaths ?? []).length === 0 && !report.autoRuns && !report.autoDetails?.gear.length && !report.autoDetails?.injured.length ? <p className="muted">{t('absence.quiet')}</p> : null}
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
