import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { affinityScale, bondOf, gatherLeft, gatherPreview, heroBusy, isChild, personalityOf, tavernRules, type GameAction, type GameState } from '../../core'
import { Chip, Portrait, Res, useNow, waitLabel } from './kit'

export function Tavern({ save, onAction }: { save: GameState; onAction: (action: GameAction) => void }) {
  const { t, i18n } = useTranslation()
  const [selected, setSelected] = useState<string[]>([])
  const now = useNow(save.expeditions.length > 0 || save.scout != null || save.drills.length > 0)
  const level = save.buildings.tavern
  const left = gatherLeft(save)
  const adults = save.roster.filter((hero) => !isChild(hero)).map((hero) => ({ hero, busy: heroBusy(save, hero.id) }))
  const active = selected.filter((id) => adults.some(({ hero, busy }) => hero.id === id && !busy && hero.condition !== 'dead'))
  const preview = gatherPreview(save, active)
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 })
  if (level < 1) return <p className="banner">{t('result.noTavern')}</p>
  return (
    <div className="column">
      <div className="banner">
        <Chip>{t('tavern.left', { left, total: tavernRules.sessionsPerSeason[level - 1] })}</Chip>
        <Res kind="gold" amount={tavernRules.cost} />
      </div>
      <table className="school-effects tavern-effects">
        <thead><tr>{(['level', 'sessions', 'mingle', 'festival'] as const).map((key) => <th scope="col" key={key}>{t(`tavern.${key}`)}</th>)}</tr></thead>
        <tbody>{tavernRules.sessionsPerSeason.map((sessions, index) => (
          <tr key={index} aria-current={index + 1 === level ? 'true' : undefined}>
            <th scope="row">{index + 1}</th><td>{sessions}</td>
            <td>+{(index + 1) * tavernRules.minglePerLevel}</td>
            <td>×{number.format(tavernRules.festivalScale[index]!)}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="muted">{t('tavern.choose', { min: tavernRules.minPeople, max: tavernRules.maxPeople })}</p>
      <div className="hero-list">
        {adults.map(({ hero, busy }) => {
          const checked = active.includes(hero.id)
          const unavailable = busy != null || hero.condition === 'dead'
          const reason = busy ? t(`tavern.busy.${busy.kind}`, { time: waitLabel(busy.until - now) }) : unavailable ? t('condition.dead') : ''
          return <button key={hero.id} type="button" aria-pressed={checked} className={checked ? 'hero-row selected' : 'hero-row'}
            disabled={unavailable || (!checked && active.length >= tavernRules.maxPeople)}
            onClick={() => setSelected(checked ? active.filter((id) => id !== hero.id) : [...active, hero.id])}>
            <Portrait hero={hero} />
            <span className="hero-row-body">
              <strong>{hero.name}</strong>
              <span className="muted">{t(`personality.names.${personalityOf(hero)}`)}</span>
              {reason ? <Chip tone="warn">{reason}</Chip> : null}
            </span>
          </button>
        })}
      </div>
      {preview.length ? <div className="column" aria-live="polite">{preview.map(({ a, b, affinity }) => {
        const first = adults.find(({ hero }) => hero.id === a)!.hero
        const second = adults.find(({ hero }) => hero.id === b)!.hero
        const before = bondOf(save, a, b)
        const fit = affinityScale(first, second)
        return <div className="line" key={`${a}|${b}`}>
          <span>{t('tavern.preview', { a: first.name, b: second.name, before: number.format(before), after: number.format(Math.min(100, before + affinity)) })}</span>
          {fit >= 1.15 ? <Chip tone="good">{t('personality.goodMatch')}</Chip> : null}
          {fit <= 0.85 ? <Chip tone="warn">{t('personality.badMatch')}</Chip> : null}
        </div>
      })}</div> : null}
      <button className="btn primary" type="button" disabled={active.length < tavernRules.minPeople || left === 0 || save.gold < tavernRules.cost}
        onClick={() => onAction({ type: 'gather', heroIds: active })}>
        {t('tavern.gather')} <Res kind="gold" amount={tavernRules.cost} light />
      </button>
      {left === 0 ? <p className="muted">{t('result.tavernFull')}</p> : null}
      {save.gold < tavernRules.cost ? <p className="muted">{t('result.poor')}</p> : null}
    </div>
  )
}
