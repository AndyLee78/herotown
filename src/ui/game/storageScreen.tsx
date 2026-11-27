import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { busyHeroIds, canDeploy, classList, gearValue, smithRules, trinketOf, type GameAction, type GameState, type Gear } from '../../core'
import { canWield, gearMods } from '../../core/gear'
import { effectLine, GearOptions } from './gearDetails'
import { Chip, gearNameClass, itemLabel } from './kit'

const slots = ['weapon', 'armor', 'trinket'] as const
const grades = ['common', 'fine', 'rare', 'epic', 'legend'] as const
const sorts = ['recent', 'grade', 'attack', 'defense'] as const
const types = [...smithRules.weaponTypes, ...smithRules.armorTypes]

export function Storage({ save, onAction }: { save: GameState; onAction: (action: GameAction) => void }) {
  const { t } = useTranslation()
  const [slot, setSlot] = useState('all')
  const [grade, setGrade] = useState('all')
  const [kind, setKind] = useState('all')
  const [sort, setSort] = useState<string>('recent')
  const [choice, setChoice] = useState<{ id: string; action: 'equip' | 'sell' }>()
  const busy = busyHeroIds(save)
  const items = [...save.stash].reverse()
    .filter((item) => (slot === 'all' || item.slot === slot) && (grade === 'all' || item.grade === grade)
      && (kind === 'all' || Boolean(item.unique) === (kind === 'unique')))
    .sort((a, b) => {
      if (sort === 'grade') return grades.indexOf(b.grade) - grades.indexOf(a.grade)
      if (sort === 'attack' || sort === 'defense') return gearMods(b)[sort] - gearMods(a)[sort]
      return 0
    })
  function field(label: string, value: string, change: (value: string) => void, options: readonly string[], prefix: string) {
    return <label className="field">{t(label)}
      <select value={value} onChange={(event) => change(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{t(option === 'all' ? 'action.all' : `${prefix}.${option}`)}</option>)}
      </select>
    </label>
  }
  function equip(item: Gear, heroId: string) {
    onAction({ type: 'equip', heroId, gearId: item.id })
    setChoice(undefined)
  }
  return <div className="column">
    <div className="storage-filters">
      {field('storage.slot', slot, setSlot, ['all', ...slots], 'label.slot')}
      {field('storage.grade', grade, setGrade, ['all', ...grades], 'grade')}
      {field('storage.kind', kind, setKind, ['all', 'unique', 'ordinary'], 'storage')}
      {field('storage.sort', sort, setSort, sorts, 'storage')}
    </div>
    {save.buildings.market < 1 ? <p className="muted">{t('result.noMarket')}</p> : null}
    {!items.length ? <p className="muted">{t('storage.empty')}</p> : null}
    <ul className="plain column">{items.map((item) => {
      const name = itemLabel(t, item, 'warrior')
      const value = gearValue(item)
      const allowed = classList.filter(({ id }) => canWield(id, item))
      const eligible = save.roster.filter((hero) => canDeploy(hero) && !busy.has(hero.id) && canWield(hero.classId, item))
      const { attack, defense } = gearMods(item)
      const trinket = trinketOf(item)
      const type = item.type ? types.find(({ id }) => id === item.type) : undefined
      return <li className="card column gear-entry" key={item.id}>
        <div className="chips"><strong className={gearNameClass(item)}>{name}</strong><Chip>{t(`label.slot.${item.slot}`)}</Chip>
          <Chip>{t(`grade.${item.grade}`)}</Chip></div>
        {attack || defense ? <span className="muted">{t('smith.stats', { attack: Number(attack.toFixed(1)), defense: Number(defense.toFixed(1)) })}</span> : null}
        {type ? <span>{effectLine(t, type.effect)}</span> : null}
        {trinket ? <span>{t(`trinket.hint.${trinket}`)}</span> : null}
        <GearOptions item={item} />
        <span className="muted">{allowed.length === classList.length ? t('storage.anyClass') : t('gearDetail.wielders', { classes: allowed.map(({ id }) => t(`class.${id}`)).join(' · ') })}</span>
        <div className="chips">
          <button type="button" className="btn small" onClick={() => setChoice({ id: item.id, action: 'equip' })}>{t('ui.equip')}</button>
          <button type="button" className="btn small" disabled={save.buildings.market < 1 || value <= 0} onClick={() => setChoice({ id: item.id, action: 'sell' })}>{t('market.sellGold', { gold: value })}</button>
        </div>
        {choice?.id === item.id && choice.action === 'equip' ? <div className="column">
          {eligible.length ? <span>{t('storage.selectHero')}</span> : <span className="muted">{t('storage.noHero')}</span>}
          <div className="chips">{eligible.map((hero) => <button key={hero.id} type="button" className="btn small" onClick={() => equip(item, hero.id)}>
            {hero.name} · {t(`class.${hero.classId}`)} · {t('ui.level', { level: hero.level })}
          </button>)}</div>
          <button type="button" className="btn small" onClick={() => setChoice(undefined)}>{t('ui.cancel')}</button>
        </div> : null}
        {choice?.id === item.id && choice.action === 'sell' && save.buildings.market > 0 ? <div className="column">
          <span>{t('market.confirm', { name })}</span>
          <div className="chips"><button type="button" className="btn danger small" onClick={() => { onAction({ type: 'sellGear', gearId: item.id }); setChoice(undefined) }}>{t('market.confirmSale')}</button>
            <button type="button" className="btn small" onClick={() => setChoice(undefined)}>{t('ui.cancel')}</button></div>
        </div> : null}
      </li>
    })}</ul>
  </div>
}
