import { ChevronLeft, Clock, Hourglass, Sparkles, Swords } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  STAT_KEYS,
  adRules,
  affinityScale,
  busyHeroIds,
  adsRemaining,
  ancestorsOf,
  canDeploy,
  classById,
  deployAge,
  isChild,
  familyLegends,
  familyOf,
  emotionScale,
  freeInterviews,
  guildLevel,
  heirloomBonus,
  isHeir,
  interviewsLeft,
  knowledge,
  legendBonus,
  lifeRules,
  maxExtraSkills,
  moraleRules,
  potentialBand,
  personalityOf,
  peakStats,
  progression,
  residents,
  starterSkill,
  statRange,
  scoutingRules,
  topBonds,
  trainingRules,
  visitorCap,
  visitorStay,
  type GameAction,
  type GameState,
  type Gear,
  type Grave,
  type Hero,
  magicRules,
  retirementAdvised,
  retirementRules,
  type SkillEffect,
  trinketOf,
  villageRules,
  type BuildingId,
} from '../../core'
import { gameNow } from '../clock'
import { josa } from '../josa'
import { portraitUrl } from '../voxel/portrait'
import {
  Bar,
  Chip,
  MoraleBar,
  SchoolInfo,
  Portrait,
  Res,
  Window,
  conditionTone,
  fatigueText,
  fatigueTone,
  itemLabel,
  needsWarning,
  recoveryText,
  useNow,
  waitLabel,
} from './kit'

type Act = (action: GameAction) => void

// Stats never go far past 30 in stage 1; bars are scaled to that.
const STAT_SCALE = 30
const emotions = ['grief', 'joy', 'pride', 'anxiety', 'resentment'] as const

function HeroChips({ hero, scouting = false, drilling = false }: { hero: Hero; scouting?: boolean; drilling?: boolean }) {
  const { t } = useTranslation()
  return (
    <span className="chips">
      <Chip tone="info">{t(`class.${hero.classId}`)}</Chip>
      <Chip>{t('ui.level', { level: hero.level })}</Chip>
      <Chip>{t('hero.age', { age: hero.age })}</Chip>
      <Chip tone={conditionTone(hero)}>{t(`condition.${hero.condition}`)}</Chip>
      {scouting ? <Chip tone="info">{t('hero.scouting')}</Chip> : null}
      {drilling ? <Chip tone="info">{t('hero.drilling')}</Chip> : null}
      {hero.deaths > 0 ? <Chip tone="bad">{t('hero.seenDeath')}</Chip> : null}
      {retirementAdvised(hero) ? <Chip tone="warn">{t('retire.advised')}</Chip> : null}
    </span>
  )
}

function describeSkillEffect(effect: SkillEffect | undefined, t: TFunction): string {
  if (!effect) {
    return ''
  }
  if (effect.threat != null) {
    return t('skill.effect.threat', { value: effect.threat })
  }
  if (effect.guard != null) {
    return t('skill.effect.guard', { percent: Math.round(effect.guard * 100) })
  }
  if (effect.attack != null) {
    return t('skill.effect.attack', { percent: Math.round(effect.attack * 100) })
  }
  if (effect.speed != null) {
    return t('skill.effect.speed', { percent: Math.round(effect.speed * 100) })
  }
  if (effect.heal != null) {
    return t('skill.effect.heal', { percent: Math.round(effect.heal * 100) })
  }
  if (effect.bleed != null) {
    return t('skill.effect.bleed', { value: effect.bleed })
  }
  if (effect.weaken != null) {
    return t('skill.effect.weaken', { percent: Math.round(effect.weaken * 100) })
  }
  if (effect.regen != null) {
    return t('skill.effect.regen', { percent: Math.round(effect.regen * 100) })
  }
  if (effect.partyGuard != null) {
    return t('skill.effect.partyGuard', { percent: Math.round(effect.partyGuard * 100) })
  }
  if (effect.partyAttack != null) {
    return t('skill.effect.partyAttack', { percent: Math.round(effect.partyAttack * 100) })
  }
  if (effect.volleyEvery != null) {
    return t('skill.effect.volley', { every: effect.volleyEvery })
  }
  if (effect.cleanse) {
    return t('skill.effect.cleanse')
  }
  return t('skill.innate')
}

export function Inn({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t, i18n } = useTranslation()
  const cap = visitorCap(save.buildings.inn)
  const stay = visitorStay(save.buildings.inn)
  const now = useNow(true)
  const waiting = save.visitors.length < cap
  const nextLeave = save.visitors.reduce((soon, hero) => Math.min(soon, (hero.arrivedAt ?? save.lastTickAt) + stay), Number.POSITIVE_INFINITY)
  const korean = i18n.language.startsWith('ko')
  const free = interviewsLeft(save)
  const total = freeInterviews(save)
  return (
    <>
      <p className="banner">
        <Clock size={18} />
        {waiting ? t('hint.nextVisitor', { time: waitLabel(save.nextVisitorAt - now) }) : t('hint.innFull', { count: cap, time: waitLabel(nextLeave - now) })}
      </p>
      <p className="muted">{t('interview.allowance', { free, total })}</p>
      {save.visitors.length === 0 ? <p className="empty">{t('hint.innEmpty')}</p> : null}
      <div className="grid">
        {save.visitors.map((hero) => {
          const depth = knowledge(hero)
          const deep = depth === 1 && save.buildings.inn >= scoutingRules.deepInnLevel
          const peak = depth >= 2 ? peakStats(hero) : null
          const prodigy = depth > 0 && hero.prodigy
          return (
            <article key={hero.id} className="card hero-card">
              <div className="card-top">
                <Portrait hero={hero} large />
                <div>
                  <strong className="name">{hero.name}</strong>
                  <span className="chips">
                    <Chip tone="info">{t(`class.${hero.classId}`)}</Chip>
                    <Chip>{t(`gender.${hero.gender}`)}</Chip>
                    <Chip>{t('hero.age', { age: hero.age })}</Chip>
                    <Chip>{t(`personality.names.${personalityOf(hero)}`)}</Chip>
                  </span>
                  <span className="muted">{korean ? t('hint.inn', { name: josa(hero.name, '이') }) : t('hint.inn', { name: hero.name })}</span>
                </div>
              </div>
              <span className="chips">
                <Chip tone={depth > 0 ? 'good' : undefined}>{depth > 0 ? t(`potential.${potentialBand(hero.potential)}`) : t('interview.hiddenPotential')}</Chip>
                {depth > 0 ? hero.traitIds.map((trait) => (
                  <Chip key={trait}>{t(`trait.${trait}`)}</Chip>
                )) : <Chip>{t('interview.hiddenTraits')}</Chip>}
                {prodigy ? <span className="prodigy-chip"><Chip tone="warn"><Sparkles size={14} aria-hidden="true" /> {t('interview.prodigy')}</Chip></span> : null}
              </span>
              <dl className="stats">
                {STAT_KEYS.map((key) => {
                  const range = statRange(hero.stats[key], guildLevel(save.buildings.guild).appraisal)
                  return (
                    <div key={key}>
                      <dt>{t(`stat.${key}`)}</dt>
                      <dd>{t('hero.range', range)}{peak ? <small className="muted peak-stat">{t('interview.peak', { value: peak[key] })}</small> : null}</dd>
                    </div>
                  )
                })}
              </dl>
              <p className="muted visitor-stay">
                <Clock size={14} /> {t('hint.staying', { time: waitLabel((hero.arrivedAt ?? save.lastTickAt) + stay - now) })}
              </p>
              <div className="card-foot visitor-foot">
                {(depth === 0 || deep) ? (
                  <button type="button" className="btn" onClick={() => onAction({ type: 'interview', id: hero.id })} disabled={free === 0 && save.gold < scoutingRules.interviewGold}>
                    {t(deep ? 'interview.deep' : 'interview.action')}{' '}
                    {free > 0 ? t('interview.free', { free, total }) : t('interview.paid', { gold: scoutingRules.interviewGold })}
                  </button>
                ) : null}
                <button type="button" className="btn primary" onClick={() => onAction({ type: 'hire', id: hero.id, now: gameNow() })} disabled={save.gold < progression.hireCost}>
                  {t('ui.hire')} <Res kind="gold" amount={progression.hireCost} light />
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

export function Roster({
  save,
  selectedId,
  onSelect,
  onAction,
  busy,
  onWatch,
}: {
  save: GameState
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAction: Act
  busy: boolean
  onWatch: () => void
}) {
  const { t } = useTranslation()
  const [treeHouse, setTreeHouse] = useState<string | null>(null)
  const selected = shownHero(save, selectedId)
  const inRoster = selected != null && save.roster.some((hero) => hero.id === selected.id)
  return (
    <div className={selected ? 'split has-detail' : 'split'}>
      <div className="list-pane">
        {save.roster.length === 0 ? <p className="empty">{t('hint.emptyRoster')}</p> : null}
        <div className="hero-list">
          {save.roster.filter((hero) => !isChild(hero)).map((hero) => (
            <button key={hero.id} type="button" className={hero.id === selectedId ? 'hero-row selected' : 'hero-row'} onClick={() => onSelect(hero.id)}>
              <Portrait hero={hero} />
              <span className="hero-row-body">
                <strong>{hero.name}</strong>
                <HeroChips
                  hero={hero}
                  scouting={save.scout?.heroId === hero.id}
                  drilling={save.drills.some((drill) => drill.heroId === hero.id)}
                />
                <span className="fatigue">
                  <Bar value={hero.fatigue} max={100} tone={fatigueTone(hero)} />
                  <span className="muted">{fatigueText(t, hero)}</span>
                </span>
                <MoraleBar hero={hero} />
              </span>
              {needsWarning(hero) ? <span className="warn-dot" aria-label={t('hero.warning')} /> : null}
            </button>
          ))}
        </div>
        {save.roster.some(isChild) ? <p className="muted">{t('hero.childrenElsewhere', { count: save.roster.filter(isChild).length })}</p> : null}
        {save.retirees.length > 0 ? <Retirees save={save} onAction={onAction} onSelect={onSelect} /> : null}
        {save.graveyard.length > 0 ? (
          <>
            <h3 className="section-title">{t('label.graveyard')}</h3>
            <ul className="plain">
              {save.graveyard.map((grave) => (
                <li key={grave.id} className={grave.legend ? 'grave legend' : 'grave'}>
                  <GraveFace grave={grave} />
                  <span className="hero-row-body">
                    <strong>{grave.family ? `${grave.name} · ${grave.family}` : grave.name}</strong>
                    <span className="chips">
                      <Chip tone="info">{t(`class.${grave.classId}`)}</Chip>
                      <Chip>{t('ui.level', { level: grave.level })}</Chip>
                      {grave.year != null ? <Chip>{t('family.year', { year: grave.year })}</Chip> : null}
                      {grave.age != null ? <Chip>{t('hero.age', { age: grave.age })}</Chip> : null}
                      {grave.cause ? (
                        <Chip tone={grave.cause === 'battle' ? 'bad' : 'warn'}>
                          {grave.cause === 'battle' ? <Swords size={12} /> : <Hourglass size={12} />}
                          {t(`family.cause.${grave.cause}`)}
                        </Chip>
                      ) : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <div className="detail-pane">
        {selected ? (
          <>
            <HeroDetail hero={selected} save={save} inRoster={inRoster} onAction={onAction} busy={busy} onWatch={onWatch} onBack={() => onSelect(null)} onOpenTree={setTreeHouse} onSelect={onSelect} />
            {treeHouse ? <FamilyTree save={save} house={treeHouse} onSelect={onSelect} onClose={() => setTreeHouse(null)} /> : null}
          </>
        ) : (
          <p className="empty">{t('ui.pickHero')}</p>
        )}
      </div>
    </div>
  )
}

function HeroDetail({
  hero,
  save,
  inRoster,
  onAction,
  busy,
  onWatch,
  onBack,
  onOpenTree,
  onSelect,
}: {
  hero: Hero
  save: GameState
  inRoster: boolean
  onAction: Act
  busy: boolean
  onWatch: () => void
  onBack: () => void
  onOpenTree: (house: string) => void
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const [confirmDismiss, setConfirmDismiss] = useState(false)
  const [confirmRetire, setConfirmRetire] = useState(false)
  const waiting = hero.treatAt != null || hero.resurrectAt != null || hero.recoverAt != null || hero.expecting != null
  const now = useNow(waiting)
  const skills = classById(hero.classId).skills
  const careAt = hero.resurrectAt ?? hero.treatAt
  const recovery = recoveryText(t, hero, now)
  const personality = personalityOf(hero)
  const describeEmotions = (strong: boolean) => emotions
    .filter((emotion) => strong ? emotionScale(hero, emotion) >= 1.2 : emotionScale(hero, emotion) <= 0.8)
    .map((emotion) => t(`personality.emotions.${emotion}`)).join(', ')
  const strongEmotions = describeEmotions(true)
  const mildEmotions = describeEmotions(false)
  return (
    <article className="card detail">
      <button type="button" className="btn small back" onClick={onBack}>
        <ChevronLeft size={16} /> {t('ui.back')}
      </button>
      <div className="card-top">
        <Portrait hero={hero} large />
        <div>
          <strong className="name">{hero.family ? `${hero.name} · ${hero.family}` : hero.name}</strong>
          <HeroChips
            hero={hero}
            scouting={save.scout?.heroId === hero.id}
            drilling={save.drills.some((drill) => drill.heroId === hero.id)}
          />
          <span className="chips">
            <Chip tone="info">{t(`personality.names.${personality}`)}</Chip>
            {hero.traitIds.map((trait) => (
              <Chip key={trait}>{t(`trait.${trait}`)}</Chip>
            ))}
          </span>
        </div>
      </div>
      <div className="personality-detail">
        <span>{t(`personality.descriptions.${personality}`)}</span>
        {strongEmotions ? <span className="muted">{t('personality.strong', { emotions: strongEmotions })}</span> : null}
        {mildEmotions ? <span className="muted">{t('personality.mild', { emotions: mildEmotions })}</span> : null}
        {(hero.losses ?? 0) > 0 ? <span className="muted">{t('personality.losses', { count: hero.losses })}</span> : null}
        {(hero.benched ?? 0) > 0 ? <span className="muted">{t('personality.benched', { count: hero.benched })}</span> : null}
      </div>
      <span className="fatigue">
        <Bar value={hero.fatigue} max={100} tone={fatigueTone(hero)} />
        <span className="muted">{fatigueText(t, hero)}</span>
      </span>
      <MoraleBar hero={hero} />
      <p className="muted">{t('morale.recovery', { base: moraleRules.base })}</p>
      {recovery ? <p className="muted">{recovery}</p> : null}
      {careAt != null ? <p className="banner">{t(hero.resurrectAt != null ? 'hero.reviving' : 'hero.treating', { time: waitLabel(careAt - now) })}</p> : null}

      {isChild(hero) ? <p><SchoolInfo hero={hero} /></p> : null}
      <FamilyPanel hero={hero} save={save} now={now} onSelect={onSelect} onOpenTree={onOpenTree} />

      <h3 className="section-title">{t('ui.stats')}</h3>
      <dl className="stat-bars">
        {STAT_KEYS.map((key) => (
          <div key={key}>
            <dt>{t(`stat.${key}`)}</dt>
            <dd>
              <Bar value={hero.stats[key]} max={STAT_SCALE} tone="info" />
              <span>{hero.stats[key]}</span>
            </dd>
          </div>
        ))}
      </dl>

      <h3 className="section-title">
        {t('label.skills')} <Chip>{t('hero.points', { count: hero.skillPoints })}</Chip>
      </h3>
      <p className="muted">
        {t('skill.pickHint', { a: trainingRules.pickLevels[0], b: trainingRules.pickLevels[1] })}
      </p>
      <ul className="plain skill-list">
        {skills.map((skill, index) => {
          const innate = index === 0 || skill.id === starterSkill(hero.classId)
          const learned = hero.learned.includes(skill.id)
          const extras = hero.learned.filter((id) => id !== starterSkill(hero.classId)).length
          const full = extras >= maxExtraSkills()
          const canLearn = !innate && !learned && hero.skillPoints > 0 && !full && inRoster
          const locked = !innate && !learned && full
          const canForget = !innate && learned && save.buildings.training >= 1 && inRoster
          return (
            <li key={skill.id} className={locked ? 'skill-row locked' : 'skill-row'}>
              <div className="skill-row-body">
                <strong>{t(`skill.${skill.id}`)}</strong>
                <span className="muted">{describeSkillEffect(skill.effect, t)}</span>
              </div>
              <span className="skill-row-actions">
                {innate ? <Chip tone="info">{t('skill.innate')}</Chip> : null}
                {learned && !innate ? <Chip tone="good">{t('hero.learned')}</Chip> : null}
                {locked ? <Chip>{t('skill.locked')}</Chip> : null}
                {canLearn ? (
                  <button type="button" className="btn small" onClick={() => onAction({ type: 'learn', id: hero.id, skillId: skill.id })}>
                    {t('action.learn')}
                  </button>
                ) : null}
                {canForget ? (
                  <button type="button" className="btn small" disabled={save.gold < trainingRules.forgetGold} onClick={() => onAction({ type: 'forget', heroId: hero.id, skillId: skill.id })}>
                    {t('action.forget')} <Res kind="gold" amount={trainingRules.forgetGold} light />
                  </button>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>

      <h3 className="section-title">{t('ui.gear')}</h3>
      {save.retirees.some(({ hero: retiree }) => retiree.id === hero.id) ? <Inheritance save={save} hero={hero} onAction={onAction} /> : null}
      {hero.gear.filter((item) => item.slot !== 'trinket').length === 0 ? <p className="muted">{t('hero.noGear')}</p> : null}
      <ul className="plain">
        {hero.gear
          .filter((item) => item.slot !== 'trinket')
          .map((item) => (
            <li key={item.id} className="line">
              <span>{itemLabel(t, item, hero.classId, heirloomBonus(save, hero, item))}</span>
              {inRoster ? (
                <button type="button" className="btn small" onClick={() => onAction({ type: 'unequip', heroId: hero.id, slot: item.slot, gearId: item.id })}>
                  {t('ui.unequip')}
                </button>
              ) : null}
            </li>
          ))}
        {inRoster
          ? save.stash
              .filter((item) => item.slot !== 'trinket')
              .map((item) => (
                <li key={item.id} className="line">
                  <span className="muted">{itemLabel(t, item, hero.classId, heirloomBonus(save, hero, item))}</span>
                  <button type="button" className="btn small" onClick={() => onAction({ type: 'equip', heroId: hero.id, gearId: item.id })}>
                    {t('ui.equip')}
                  </button>
                </li>
              ))
          : null}
      </ul>

      <h3 className="section-title">{t('label.trinkets')}</h3>
      <ul className="plain">
        {Array.from({ length: magicRules.trinketSlots }, (_, slot) => {
          const item = hero.gear.filter((gear) => gear.slot === 'trinket')[slot]
          if (!item) {
            return (
              <li key={`empty-${slot}`} className="line">
                <span className="muted">{t('hero.trinketEmpty')}</span>
              </li>
            )
          }
          const id = trinketOf(item)
          return (
            <li key={item.id} className="line trinket-line">
              <span>
                <strong>{itemLabel(t, item, hero.classId, heirloomBonus(save, hero, item))}</strong>
                {id ? <span className="muted">{t(`trinket.hint.${id}`)}</span> : null}
              </span>
              {inRoster ? (
                <button type="button" className="btn small" onClick={() => onAction({ type: 'unequip', heroId: hero.id, slot: 'trinket', gearId: item.id })}>
                  {t('ui.unequip')}
                </button>
              ) : null}
            </li>
          )
        })}
        {inRoster
          ? save.stash
              .filter((item) => item.slot === 'trinket')
              .map((item) => {
                const id = trinketOf(item)
                return (
                  <li key={item.id} className="line trinket-line">
                    <span>
                      <span className="muted">{itemLabel(t, item, hero.classId, heirloomBonus(save, hero, item))}</span>
                      {id ? <span className="muted">{t(`trinket.hint.${id}`)}</span> : null}
                    </span>
                    <button type="button" className="btn small" onClick={() => onAction({ type: 'equip', heroId: hero.id, gearId: item.id })}>
                      {t('ui.equip')}
                    </button>
                  </li>
                )
              })
          : null}
      </ul>

      {inRoster ? <div className="actions">
        {hero.condition === 'injured' || hero.condition === 'critical' ? (
          <button type="button" className="btn" onClick={() => onAction({ type: 'treat', id: hero.id, now: gameNow() })}>
            {t('action.treat')}
          </button>
        ) : null}
        {hero.treatAt != null && hero.treatAt > gameNow() ? (
          <button type="button" className="btn ad" disabled={busy} onClick={onWatch}>
            {t('action.adTemple', { left: adsRemaining(save, 'temple', gameNow()), cap: adRules.temple.daily })}
          </button>
        ) : null}
        {hero.condition === 'dead' && hero.deaths === 1 ? (
          <button type="button" className="btn gold" disabled={save.gold < lifeRules.reviveCost} onClick={() => onAction({ type: 'revive', id: hero.id, now: gameNow() })}>
            {t('ui.revive')} <Res kind="gold" amount={lifeRules.reviveCost} light />
          </button>
        ) : null}
        {hero.age >= retirementRules.minAge && hero.condition !== 'dead' ? (
          confirmRetire ? (
            <button type="button" className="btn gold" onClick={() => onAction({ type: 'retire', id: hero.id })}>
              {t('retire.confirm', { name: hero.name })}
            </button>
          ) : (
            <button type="button" className={retirementAdvised(hero) ? 'btn gold' : 'btn'} onClick={() => setConfirmRetire(true)}>
              {t('retire.action')}
            </button>
          )
        ) : null}
        {confirmDismiss ? (
          <button type="button" className="btn danger" onClick={() => onAction({ type: 'dismiss', id: hero.id })}>
            {t('action.confirmDismiss')}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmDismiss(true)}>
            {t('action.dismiss')}
          </button>
        )}
      </div> : null}
      {canDeploy(hero) ? null : (
        <p className="muted">{isChild(hero) ? t('hero.growsUp', { age: deployAge() }) : hero.expecting ? t('hero.afterBirth') : t('result.dead')}</p>
      )}
    </article>
  )
}

function shownHero(save: GameState, id: string | null): Hero | null {
  if (!id) {
    return null
  }
  return save.roster.find((hero) => hero.id === id) ?? save.retirees.find((retiree) => retiree.hero.id === id)?.hero ?? null
}

function FamilyPanel({
  hero,
  save,
  now,
  onSelect,
  onOpenTree,
}: {
  hero: Hero
  save: GameState
  now: number
  onSelect: (id: string) => void
  onOpenTree: (house: string) => void
}) {
  const { t } = useTranslation()
  const family = familyOf(save, hero.id)
  const bonds = topBonds(save, hero.id, 3)
  const house = hero.family ?? family.children.find((child) => child.family)?.family ?? null
  return (
    <>
      <h3 className="section-title">{t('family.title')}</h3>
      <p className="line">
        <span className="muted">{t('family.house')}</span>
        {house ? (
          <button type="button" className="btn tiny" onClick={() => onOpenTree(house)}>
            {house}
          </button>
        ) : (
          <span className="muted">{t('family.none')}</span>
        )}
      </p>
      {house ? (
        <p className="muted">{t('family.legends', { count: familyLegends(save, house).length, bonus: legendBonus(save, house) })}</p>
      ) : null}
      <FamilyLine label={t('family.spouse')} people={family.spouse ? [family.spouse] : []} empty={t('family.noSpouse')} onSelect={onSelect} />
      <FamilyLine label={t('family.parents')} people={family.parents} empty={t('family.noParents')} onSelect={onSelect} />
      <FamilyLine label={t('family.children')} people={family.children} empty={t('family.noChildren')} onSelect={onSelect} />
      {hero.expecting ? (
        <p className="chips">
          <Chip tone="info">{t('family.due')}</Chip>
          <span className="muted">{t('family.dueIn', { time: waitLabel(Math.max(0, hero.expecting.dueAt - now)) })}</span>
        </p>
      ) : null}
      <h3 className="section-title">{t('family.bonds')}</h3>
      {bonds.length === 0 ? <p className="muted">{t('family.noBonds')}</p> : null}
      {bonds.map((bond) => {
        const other = shownHero(save, bond.id)
        if (!other) {
          return null
        }
        const fit = affinityScale(hero, other)
        return (
          <button key={bond.id} type="button" className="bond" onClick={() => onSelect(other.id)}>
            <span>{other.family ? `${other.name} · ${other.family}` : other.name}</span>
            <Bar value={bond.affinity} max={100} tone={bond.stage === 'spouse' || bond.stage === 'lover' ? 'good' : 'info'} />
            <span className="chips">
              <Chip>{t(`family.stage.${bond.stage}`)}</Chip>
              {fit >= 1.15 ? <Chip tone="good">{t('personality.goodMatch')}</Chip> : null}
              {fit <= 0.85 ? <Chip tone="warn">{t('personality.badMatch')}</Chip> : null}
            </span>
          </button>
        )
      })}
    </>
  )
}

function FamilyLine({ label, people, empty, onSelect }: { label: string; people: Hero[]; empty: string; onSelect: (id: string) => void }) {
  return (
    <p className="line">
      <span className="muted">{label}</span>
      {people.length === 0 ? <span className="muted">{empty}</span> : null}
      <span className="chips">
        {people.map((person) => (
          <button key={person.id} type="button" className="btn tiny" onClick={() => onSelect(person.id)}>
            {person.family ? `${person.name} · ${person.family}` : person.name}
          </button>
        ))}
      </span>
    </p>
  )
}

type TreeNode = {
  id: string
  name: string
  parents?: [string, string]
  spouseId?: string
  hero?: Hero
  grave?: Grave
}

function FamilyTree({ save, house, onSelect, onClose }: { save: GameState; house: string; onSelect: (id: string) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const members = treeNodes(save, house)
  const rows = generationRows(members)
  return (
    <Window title={t('family.tree', { house })} onClose={onClose} small>
      {rows.length === 0 ? <p className="empty">{t('family.emptyTree')}</p> : null}
      {rows.map((row, index) => (
        <div key={row.map((node) => node.id).join('-')} className={index === 0 ? 'tree-row' : 'tree-row next'}>
          {pairCouples(row).map((group) => (
            <div key={group.map((node) => node.id).join('-')} className={group.length > 1 ? 'tree-couple' : 'tree-one'}>
              {group.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={node.grave ? 'tree-person gone' : 'tree-person'}
                  disabled={node.hero == null}
                  onClick={() => node.hero && onSelect(node.hero.id)}
                >
                  {node.hero ? <Portrait hero={node.hero} /> : node.grave ? <GraveFace grave={node.grave} /> : null}
                  <span>{node.name}</span>
                  {node.grave ? <span className="tree-stone">{t('family.stone')}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      ))}
    </Window>
  )
}

function treeNodes(save: GameState, house: string): TreeNode[] {
  const nodes = new Map<string, TreeNode>()
  const addHero = (hero: Hero) => {
    if (!nodes.has(hero.id)) {
      nodes.set(hero.id, { id: hero.id, name: hero.name, parents: hero.parents, spouseId: hero.spouseId, hero })
    }
  }
  const addGrave = (grave: Grave) => {
    if (!nodes.has(grave.id)) {
      nodes.set(grave.id, { id: grave.id, name: grave.name, parents: grave.parents, spouseId: grave.spouseId, grave })
    }
  }
  for (const hero of houseMembers(residents(save), house)) {
    addHero(hero)
  }
  for (const hero of [...nodes.values()]) {
    if (!hero.hero) {
      continue
    }
    for (const ancestor of ancestorsOf(save, hero.hero.id)) {
      if (ancestor.hero) {
        addHero(ancestor.hero)
      } else if (ancestor.grave) {
        addGrave(ancestor.grave)
      }
    }
  }
  for (const grave of save.graveyard) {
    if (grave.spouseId && nodes.has(grave.spouseId)) {
      addGrave(grave)
    }
  }
  return [...nodes.values()]
}

export function GraveFace({ grave }: { grave: Grave }) {
  const src = useMemo(() => {
    const face = {
      id: grave.id,
      classId: grave.classId,
      gender: grave.gender ?? 'male',
      age: grave.age ?? 30,
      genes: grave.genes,
    }
    return portraitUrl(face)
  }, [grave])
  return (
    <span className="portrait">
      <img className="portrait-img" src={src} alt="" width={64} height={64} />
    </span>
  )
}

function houseMembers(all: Hero[], house: string): Hero[] {
  const named = all.filter((hero) => hero.family === house || (hero.family == null && hero.name === house))
  const ids = new Set(named.map((hero) => hero.id))
  const spouses = all.filter((hero) => hero.spouseId != null && ids.has(hero.spouseId) && !ids.has(hero.id))
  return [...named, ...spouses]
}

function generationRows(members: TreeNode[]): TreeNode[][] {
  const ids = new Set(members.map((hero) => hero.id))
  const rows: TreeNode[][] = []
  const seen = new Set<string>()
  let current = members.filter((hero) => !hero.parents?.some((parent) => ids.has(parent)))
  while (current.length > 0) {
    const row = current.filter((hero) => !seen.has(hero.id))
    if (row.length === 0) {
      break
    }
    for (const hero of row) {
      seen.add(hero.id)
    }
    rows.push(row)
    const parentIds = new Set(row.map((hero) => hero.id))
    current = members.filter((hero) => hero.parents?.some((parent) => parentIds.has(parent)))
  }
  const left = members.filter((hero) => !seen.has(hero.id))
  if (left.length > 0) {
    rows.push(left)
  }
  return rows
}

function pairCouples(row: TreeNode[]): TreeNode[][] {
  const placed = new Set<string>()
  const groups: TreeNode[][] = []
  for (const hero of row) {
    if (placed.has(hero.id)) {
      continue
    }
    const spouse = hero.spouseId ? row.find((other) => other.id === hero.spouseId) : undefined
    placed.add(hero.id)
    if (spouse && !placed.has(spouse.id)) {
      placed.add(spouse.id)
      groups.push([hero, spouse])
    } else {
      groups.push([hero])
    }
  }
  return groups
}

// Retired heroes: who they were, and the building each one runs.
function Inheritance({ save, hero, onAction }: { save: GameState; hero: Hero; onAction: Act }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string | null>(null)
  const heirs = save.roster.filter((entry) => isHeir(save, entry.id, hero.id) && entry.condition !== 'dead')
  const busy = busyHeroIds(save)
  function give(item: Gear, toId: string | null) {
    onAction({ type: 'bequeath', retireeId: hero.id, gearId: item.id, toId })
    setSelected(null)
  }
  const gifts = hero.gear.filter(({ recipeId }) => recipeId !== 'starter')
  if (!gifts.length) return null
  return (
    <div className="column">
      {gifts.map((item) => <div key={item.id} className="card column">
        <div className="line">
          <span>{itemLabel(t, item, hero.classId, heirloomBonus(save, hero, item))}</span>
          <button className="btn small" type="button" aria-expanded={selected === item.id} onClick={() => setSelected(selected === item.id ? null : item.id)}>{t('heirloom.bequeath')}</button>
        </div>
        {selected === item.id ? <div className="row">
          {heirs.length === 0 ? <span className="muted">{t('heirloom.noHeirs')}</span> : null}
          {heirs.map((heir) => <button className="btn small" type="button" key={heir.id} disabled={busy.has(heir.id)}
            onClick={() => give(item, heir.id)}>{heir.name}{busy.has(heir.id) ? ` · ${t('house.busy')}` : ''}</button>)}
          <button className="btn small" type="button" onClick={() => give(item, null)}>{t('heirloom.stash')}</button>
        </div> : null}
      </div>)}
    </div>
  )
}

function Retirees({ save, onAction, onSelect }: { save: GameState; onAction: Act; onSelect: (id: string) => void }) {
  const { t } = useTranslation()
  return (
    <>
      <h3 className="section-title">{t('retire.title')}</h3>
      <p className="muted">{t('retire.hint')}</p>
      <div className="hero-list">
        {save.retirees.map((retiree) => {
          const hero = retiree.hero
          return (
            <div key={hero.id} className="hero-row retiree">
              <Portrait hero={hero} />
              <span className="hero-row-body">
                <button type="button" className="btn tiny" onClick={() => onSelect(hero.id)}>{hero.name}</button>
                <span className="chips">
                  <Chip tone="info">{t(`class.${hero.classId}`)}</Chip>
                  <Chip>{t('hero.age', { age: hero.age })}</Chip>
                  <Chip>{t('ui.level', { level: hero.level })}</Chip>
                  <Chip>{t('retire.since', { year: retiree.retiredYear })}</Chip>
                </span>
                <label className="field">
                  <span>{t('retire.post')}</span>
                  <select
                    value={retiree.building ?? ''}
                    onChange={(event) =>
                      onAction({ type: 'assignRetiree', id: hero.id, building: event.target.value === '' ? null : (event.target.value as BuildingId) })
                    }
                  >
                    <option value="">{t('retire.noPost')}</option>
                    {villageRules.buildings.map((building) => {
                      const id = building.id as BuildingId
                      const taken = save.retirees.find((other) => other.building === id && other.hero.id !== hero.id)
                      return (
                        <option key={id} value={id} disabled={Boolean(taken) || save.buildings[id] < 1}>
                          {t(`building.${id}`)} — {t(`retire.bonus.${id}`, { value: bonusValue(id) })}
                          {taken ? ` (${taken.hero.name})` : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

// Percent for multipliers, plain number for the inn's visitor potential.
export function bonusValue(id: BuildingId): number {
  const value = retirementRules.bonus[id]
  if (id === 'inn') {
    return value
  }
  return Math.round(value * 100)
}
