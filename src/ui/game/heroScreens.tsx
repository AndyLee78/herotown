import { ChevronLeft, Clock } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  STAT_KEYS,
  adRules,
  adsRemaining,
  canDeploy,
  classById,
  lifeRules,
  potentialBand,
  progression,
  statRange,
  visitorCap,
  visitorStay,
  type GameAction,
  type GameState,
  type Hero,
} from '../../core'
import { gameNow } from '../clock'
import { josa } from '../josa'
import {
  Bar,
  Chip,
  Portrait,
  Res,
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

function HeroChips({ hero }: { hero: Hero }) {
  const { t } = useTranslation()
  return (
    <span className="chips">
      <Chip tone="info">{t(`class.${hero.classId}`)}</Chip>
      <Chip>{t('ui.level', { level: hero.level })}</Chip>
      <Chip>{t('hero.age', { age: hero.age })}</Chip>
      <Chip tone={conditionTone(hero)}>{t(`condition.${hero.condition}`)}</Chip>
      {hero.deaths > 0 ? <Chip tone="bad">{t('hero.seenDeath')}</Chip> : null}
    </span>
  )
}

export function Inn({ save, onHire }: { save: GameState; onHire: (id: string) => void }) {
  const { t, i18n } = useTranslation()
  const cap = visitorCap(save.buildings.inn)
  const stay = visitorStay(save.buildings.inn)
  const now = useNow(true)
  const waiting = save.visitors.length < cap
  const nextLeave = save.visitors.reduce((soon, hero) => Math.min(soon, (hero.arrivedAt ?? save.lastTickAt) + stay), Number.POSITIVE_INFINITY)
  const korean = i18n.language.startsWith('ko')
  return (
    <>
      <p className="banner">
        <Clock size={18} />
        {waiting ? t('hint.nextVisitor', { time: waitLabel(save.nextVisitorAt - now) }) : t('hint.innFull', { count: cap, time: waitLabel(nextLeave - now) })}
      </p>
      {save.visitors.length === 0 ? <p className="empty">{t('hint.innEmpty')}</p> : null}
      <div className="grid">
        {save.visitors.map((hero) => (
          <article key={hero.id} className="card hero-card">
            <div className="card-top">
              <Portrait hero={hero} large />
              <div>
                <strong className="name">{hero.name}</strong>
                <span className="chips">
                  <Chip tone="info">{t(`class.${hero.classId}`)}</Chip>
                  <Chip>{t(`gender.${hero.gender}`)}</Chip>
                  <Chip>{t('hero.age', { age: hero.age })}</Chip>
                </span>
                <span className="muted">{korean ? t('hint.inn', { name: josa(hero.name, '이') }) : t('hint.inn', { name: hero.name })}</span>
              </div>
            </div>
            <span className="chips">
              <Chip tone="good">{t(`potential.${potentialBand(hero.potential)}`)}</Chip>
              {hero.traitIds.map((trait) => (
                <Chip key={trait}>{t(`trait.${trait}`)}</Chip>
              ))}
            </span>
            <dl className="stats">
              {STAT_KEYS.map((key) => {
                const range = statRange(hero.stats[key])
                return (
                  <div key={key}>
                    <dt>{t(`stat.${key}`)}</dt>
                    <dd>{t('hero.range', range)}</dd>
                  </div>
                )
              })}
            </dl>
            <div className="card-foot">
              <span className="muted">
                <Clock size={14} /> {t('hint.staying', { time: waitLabel((hero.arrivedAt ?? save.lastTickAt) + stay - now) })}
              </span>
              <button type="button" className="btn primary" onClick={() => onHire(hero.id)} disabled={save.gold < progression.hireCost}>
                {t('ui.hire')} <Res kind="gold" amount={progression.hireCost} light />
              </button>
            </div>
          </article>
        ))}
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
  const selected = save.roster.find((hero) => hero.id === selectedId) ?? null
  return (
    <div className={selected ? 'split has-detail' : 'split'}>
      <div className="list-pane">
        {save.roster.length === 0 ? <p className="empty">{t('hint.emptyRoster')}</p> : null}
        <div className="hero-list">
          {save.roster.map((hero) => (
            <button key={hero.id} type="button" className={hero.id === selectedId ? 'hero-row selected' : 'hero-row'} onClick={() => onSelect(hero.id)}>
              <Portrait hero={hero} />
              <span className="hero-row-body">
                <strong>{hero.name}</strong>
                <HeroChips hero={hero} />
                <span className="fatigue">
                  <Bar value={hero.fatigue} max={100} tone={fatigueTone(hero)} />
                  <span className="muted">{fatigueText(t, hero)}</span>
                </span>
              </span>
              {needsWarning(hero) ? <span className="warn-dot" aria-label={t('hero.warning')} /> : null}
            </button>
          ))}
        </div>
        {save.graveyard.length > 0 ? (
          <>
            <h3 className="section-title">{t('label.graveyard')}</h3>
            <ul className="plain">
              {save.graveyard.map((grave) => (
                <li key={grave.id}>
                  {grave.name} · {t(`class.${grave.classId}`)} · {t('hero.level', { level: grave.level })} · {t('hero.clears', { count: grave.clears.length })}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <div className="detail-pane">
        {selected ? (
          <HeroDetail hero={selected} save={save} onAction={onAction} busy={busy} onWatch={onWatch} onBack={() => onSelect(null)} />
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
  onAction,
  busy,
  onWatch,
  onBack,
}: {
  hero: Hero
  save: GameState
  onAction: Act
  busy: boolean
  onWatch: () => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [confirmDismiss, setConfirmDismiss] = useState(false)
  const waiting = hero.treatAt != null || hero.resurrectAt != null || hero.recoverAt != null
  const now = useNow(waiting)
  const skills = classById(hero.classId).skills
  const careAt = hero.resurrectAt ?? hero.treatAt
  const recovery = recoveryText(t, hero, now)
  return (
    <article className="card detail">
      <button type="button" className="btn small back" onClick={onBack}>
        <ChevronLeft size={16} /> {t('ui.back')}
      </button>
      <div className="card-top">
        <Portrait hero={hero} large />
        <div>
          <strong className="name">{hero.name}</strong>
          <HeroChips hero={hero} />
          <span className="chips">
            {hero.traitIds.map((trait) => (
              <Chip key={trait}>{t(`trait.${trait}`)}</Chip>
            ))}
          </span>
        </div>
      </div>
      <span className="fatigue">
        <Bar value={hero.fatigue} max={100} tone={fatigueTone(hero)} />
        <span className="muted">{fatigueText(t, hero)}</span>
      </span>
      {recovery ? <p className="muted">{recovery}</p> : null}
      {careAt != null ? <p className="banner">{t(hero.resurrectAt != null ? 'hero.reviving' : 'hero.treating', { time: waitLabel(careAt - now) })}</p> : null}

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
      <ul className="plain">
        {skills.map((skill) => (
          <li key={skill.id} className="line">
            <span>{t(`skill.${skill.id}`)}</span>
            {hero.learned.includes(skill.id) ? (
              <Chip tone="good">{t('hero.learned')}</Chip>
            ) : (
              <button type="button" className="btn small" disabled={hero.skillPoints < 1} onClick={() => onAction({ type: 'learn', id: hero.id, skillId: skill.id })}>
                {t('action.learn')}
              </button>
            )}
          </li>
        ))}
      </ul>

      <h3 className="section-title">{t('ui.gear')}</h3>
      {hero.gear.length === 0 ? <p className="muted">{t('hero.noGear')}</p> : null}
      <ul className="plain">
        {hero.gear.map((item) => (
          <li key={item.id} className="line">
            <span>{itemLabel(t, item, hero.classId)}</span>
            <button type="button" className="btn small" onClick={() => onAction({ type: 'unequip', heroId: hero.id, slot: item.slot })}>
              {t('ui.unequip')}
            </button>
          </li>
        ))}
        {save.stash.map((item) => (
          <li key={item.id} className="line">
            <span className="muted">{itemLabel(t, item, hero.classId)}</span>
            <button type="button" className="btn small" onClick={() => onAction({ type: 'equip', heroId: hero.id, gearId: item.id })}>
              {t('ui.equip')}
            </button>
          </li>
        ))}
      </ul>

      <div className="actions">
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
        {confirmDismiss ? (
          <button type="button" className="btn danger" onClick={() => onAction({ type: 'dismiss', id: hero.id })}>
            {t('action.confirmDismiss')}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmDismiss(true)}>
            {t('action.dismiss')}
          </button>
        )}
      </div>
      {canDeploy(hero) ? null : <p className="muted">{t('result.dead')}</p>}
    </article>
  )
}
