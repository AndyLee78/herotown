import { Sparkles } from 'lucide-react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { canForget, canLearn, classById, combatRules, masteries, monsterById, personalityOf, personalityRules, skillPrerequisite, suitedBranches, trainingRules, type DungeonReport, type GameAction, type GameState, type Hero, type SkillEffect } from '../../core'
import { Chip, Res } from './kit'

export function GiftBadge({ hero, compact = false }: { hero: Hero; compact?: boolean }) {
  const { t } = useTranslation()
  if (!hero.gift) return null
  const name = t(`gift.${hero.gift}.name`)
  const description = t(`gift.${hero.gift}.description`)
  const label = <><Sparkles size={13} aria-hidden="true" /> {name}</>
  return compact ? <span className="chip warn" title={description}>{label}</span> :
    <details className="gift-details"><summary className="chip warn">{label}</summary><span>{description}</span></details>
}

function describe(effect: SkillEffect | undefined, t: TFunction) {
  return Object.entries(effect ?? {}).filter(([, value]) => value != null && value !== false).map(([key, value]) =>
    // A drawback (berserk's fury lowers guard) reads as a plus, not "−-3%".
    typeof value === 'number' && value < 0 && key === 'guard'
      ? t('identity.effect.guardDrop', { percent: Math.round(-value * 100) })
      : t(`identity.effect.${key}`, { value, percent: typeof value === 'number' ? Math.round(value * 100) : 0 })).join(' · ')
}

export function SkillTree({ hero, save, editable, onAction }: { hero: Hero; save: GameState; editable: boolean; onAction: (action: GameAction) => void }) {
  const { t } = useTranslation()
  const klass = classById(hero.classId)
  const mastered = masteries(hero)
  const suited = suitedBranches(personalityOf(hero))
  const skillName = (id: string) => t(`skill.${id}`, { defaultValue: t(`identity.skill.${id}`) })
  function row(skill: (typeof klass.skills)[number]) {
    const innate = skill.branch == null
    const learned = hero.learned.includes(skill.id)
    const before = skillPrerequisite(hero.classId, skill.id)
    const locked = before != null && !hero.learned.includes(before)
    const when = skill.when
    const effect = describe(skill.effect, t)
    const conditions = when ? [
      when.personality && t(`personality.names.${when.personality}`),
      when.withClass && t('identity.withClass', { name: t(`class.${when.withClass}`) }),
      when.bonded && t('identity.bonded'),
      when.moraleAbove != null && t('identity.moraleAbove', { value: when.moraleAbove }),
      when.moraleBelow != null && t('identity.moraleBelow', { value: when.moraleBelow }),
    ].filter(Boolean).join(' · ') : ''
    return <li key={skill.id} className={locked ? 'skill-row locked' : 'skill-row'}>
      <div className="skill-row-body">
        <strong>{skill.tier ? `${skill.tier}. ` : ''}{skillName(skill.id)}</strong>
        {effect && <span className="muted">{effect}</span>}
        {when && <span className="muted">{t('identity.condition', { condition: conditions, effect: describe(when.bonus, t) })}</span>}
      </div>
      <span className="skill-row-actions">
        {innate ? <Chip tone="info">{t('skill.innate')}</Chip> : learned ? <Chip tone="good">{t('hero.learned')}</Chip> :
          locked ? <Chip>{t('identity.requires', { skill: skillName(before) })}</Chip> :
          <button type="button" className="btn small" disabled={!editable || hero.skillPoints < 1 || !canLearn(hero, skill.id)} onClick={() => onAction({ type: 'learn', id: hero.id, skillId: skill.id })}>{t('action.learn')}</button>}
        {editable && save.buildings.training >= 1 && canForget(hero, skill.id) ? <button type="button" className="btn small" disabled={save.gold < trainingRules.forgetGold} onClick={() => onAction({ type: 'forget', heroId: hero.id, skillId: skill.id })}>
          {t('action.forget')} <Res kind="gold" amount={trainingRules.forgetGold} light />
        </button> : null}
      </span>
    </li>
  }
  return <section className="column">
    <h3 className="section-title">{t('label.skills')} <Chip>{t('hero.points', { count: hero.skillPoints })}</Chip></h3>
    <p className="muted">{t('identity.picks', { levels: trainingRules.pickLevels.map((level) => `Lv${level}`).join(' · '), picks: trainingRules.pickLevels.length, total: klass.skills.length - 1 })}</p>
    <ul className="plain">{klass.skills.filter(({ branch }) => branch == null).map(row)}</ul>
    <div className="skill-branches">{klass.branches.map((branch, index) => <article className="card column" key={branch.id}>
      <strong>{t(`identity.branch.${branch.id}`)}</strong>
      {suited.includes(branch.id) && <Chip tone="good">{t('identity.affinity', { percent: Math.round((personalityRules.affinityScale - 1) * 100) })}</Chip>}
      <ul className="plain">{klass.skills.filter((skill) => skill.branch === index).map(row)}</ul>
      <strong>{t(`identity.mastery.${branch.id}`)}</strong>
      <span>{describe(branch.mastery, t)}</span>
      <Chip tone={mastered.includes(branch.id) ? 'good' : undefined}>{t(mastered.includes(branch.id) ? 'identity.active' : 'identity.completeBranch')}</Chip>
    </article>)}</div>
  </section>
}

export function MonsterIdentity({ id }: { id: string }) {
  const { t } = useTranslation()
  const monster = monsterById(id)
  const tags = [...(monster.traits ?? []), ...(monster.boss ? ['steadfast', ...(monster.tier >= combatRules.enrageTier ? ['enrage'] : [])] : [])]
  return <span className="chips">
    {monster.kind && <span className="chip">{t(`monsterKind.${monster.kind}`)}</span>}
    {tags.map((tag) => <span className="chip monster-trait" key={tag} tabIndex={0} title={t(`monsterTrait.${tag}.description`)} aria-label={t(`monsterTrait.${tag}.description`)}>
      <span aria-hidden="true">{({ armor: '◆', evasive: '↝', nodot: '⊘', fireproof: '♨', healer: '✚', thorns: '✦', purge: '↻', steadfast: '⛨', enrage: '⚡' } as Record<string, string>)[tag]}</span> {t(`monsterTrait.${tag}.name`)}
    </span>)}
  </span>
}

export function EliteMonsters({ report }: { report: DungeonReport }) {
  const { t } = useTranslation()
  const elites = [...new Set(report.floors?.flatMap((floor) => floor.filter((unit) => unit.elite).map((unit) => unit.refId)) ?? [])]
  return elites.length ? <span className="chips">{elites.map((id) => <Chip key={id} tone="warn">{t('identity.elite', { name: t(`enemy.${id}`) })}</Chip>)}</span> : null
}
