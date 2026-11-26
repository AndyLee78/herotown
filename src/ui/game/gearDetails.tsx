import { useId, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { classList, smithRules, type Gear, type Hero } from '../../core'
import { armorTypes, gearEffect, heroGearMods, optionRange, weaponTypes } from '../../core/gear'
import { setBonuses } from '../../core/gear'
import { lootRules } from '../../core/data'
import { uniqueById } from '../../core/loot'
import { Chip } from './kit'

const resistances = new Set(['guard', 'blastGuard', 'dotGuard'])

export function effectLine(t: TFunction, effect: ReturnType<typeof gearEffect>) {
  return Object.entries(effect).filter(([, value]) => typeof value === 'number' ? value !== 0 : value === true).map(([key, value]) => {
    if (value === true) return t(`identity.effect.${key}`)
    if (['healTaken', 'shield', 'twinStrike', 'firstStrike'].includes(key)) return t(`identity.effect.${key}`, { percent: Math.round(Number(value) * 100) })
    const amount = Number(value) * 100 * (resistances.has(key) ? -1 : 1)
    return `${t(`gearDetail.effect.${key}`)} ${amount < 0 ? '−' : '+'}${Math.abs(amount).toFixed(1)}%`
  }).join(' · ')
}

export function GearOptions({ item, onReroll, disabled = false }: { item: Gear; onReroll?: (index: number) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  const unique = uniqueById(item.unique)
  if (unique) return <span className="chips"><Chip tone="warn">{t('loot.unique')}</Chip>
    <Chip>{t(`gearSet.${unique.set}`)}</Chip><span>{effectLine(t, unique.effect)}</span>
  </span>
  if (!item.options?.length) return null
  return <ul className="plain gear-options">{item.options.map(({ id, value }, index) => {
    const range = optionRange(id, item.grade)
    const high = range != null && value >= range.min + (range.max - range.min) * 0.8
    const flat = id === 'power' || id === 'guard'
    const amount = flat ? Math.round(value).toString() : `${(value * 100).toFixed(1)}%`
    const label = t(`option.${id}`)
    return <li className="gear-option" key={id}>
      <span className={high ? 'gear-option-high' : undefined}>{label} +{amount}</span>
      {onReroll ? <button type="button" className="btn tiny" disabled={disabled} aria-label={t('gearDetail.rerollOption', { option: label })}
        onClick={() => onReroll(index)}>{t('gearDetail.reroll')}</button> : null}
    </li>
  })}</ul>
}

export function GearSummary({ hero }: { hero: Hero }) {
  const { t } = useTranslation()
  const effect: Record<string, number | boolean> = {}
  for (const part of [...hero.gear.map(gearEffect), ...setBonuses(hero.gear)]) for (const [key, value] of Object.entries(part)) {
    if (typeof value === 'number') effect[key] = Number(effect[key] ?? 0) + value
    if (value === true) effect[key] = true
  }
  const { attack, defense } = heroGearMods(hero)
  const values = [
    attack ? `${t('option.power')} +${Number(attack.toFixed(1))}` : '',
    defense ? `${t('option.guard')} +${Number(defense.toFixed(1))}` : '',
    effectLine(t, effect),
  ].filter(Boolean).join(' · ')
  return values ? <span className="muted gear-summary">{t('gearDetail.summary', { values })}</span> : null
}

export function SetProgress({ hero }: { hero: Hero }) {
  const { t } = useTranslation()
  const worn = new Set(hero.gear.map(({ unique }) => unique))
  return <div className="chips">{lootRules.sets.map((set) => {
    const count = lootRules.uniques.filter(({ id, set: membership }) => membership === set.id && worn.has(id)).length
    if (!count) return null
    return <div className="card column" key={set.id}>
      <strong>{t(`gearSet.${set.id}`)} {count}/3</strong>
      {([2, 3] as const).map((pieces) => <span className={count < pieces ? 'muted' : undefined} key={pieces}>
        {t(count >= pieces ? 'loot.setOn' : 'loot.setOff', { pieces })} · {effectLine(t, pieces === 2 ? set.two : set.three)}
      </span>)}
    </div>
  })}</div>
}

export function Wielders({ item }: { item: Gear }) {
  const { t } = useTranslation()
  const allowed = classList.filter(({ id }) => weaponTypes(id).some((type) => type === item.type))
  return <span className="muted">{t('gearDetail.wielders', { classes: allowed.map(({ id }) => t(`class.${id}`)).join(' · ') })}</span>
}

export function GearTypePicker({ slot, onCraft, disabled, queued }: { slot: 'weapon' | 'armor'; onCraft: (type?: Gear['type']) => void; disabled: boolean; queued: boolean }) {
  const { t } = useTranslation()
  const name = useId()
  const [type, choose] = useState<Gear['type']>()
  const definitions = slot === 'armor' ? smithRules.armorTypes : smithRules.weaponTypes
  const groups = slot === 'armor'
    ? [{ id: 'armor', types: armorTypes() }]
    : classList.map(({ id }) => ({ id, types: weaponTypes(id) }))
  return <fieldset className="gear-type-picker">
    <legend>{t('gearDetail.choose')}</legend>
    <label><input type="radio" name={name} checked={type == null} onChange={() => choose(undefined)} /> {t('gearDetail.balanced')}</label>
    {groups.map((group) => <div key={group.id} className="column">
      {slot === 'weapon' ? <strong>{t(`class.${group.id}`)}</strong> : null}
      {group.types.map((id) => {
        const effect = effectLine(t, definitions.find((entry) => entry.id === id)?.effect ?? {})
        return <button type="button" className="btn small gear-type-option" key={id} aria-pressed={type === id} onClick={() => choose(id)}>
          <strong>{t(`gearDetail.type.${id}`)}</strong>
          <span>{effect || t('gearDetail.even')}</span>
        </button>
      })}
    </div>)}
    <button type="button" className="btn primary" disabled={disabled} onClick={() => onCraft(type)}>{t(queued ? 'automation.enqueue' : 'action.craft')}</button>
  </fieldset>
}
