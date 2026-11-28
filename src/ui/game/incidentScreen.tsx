import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UiIcon } from './icons'
import type { GameState } from '../../core/game'
import { incidentChoices, type IncidentLog } from '../../core/incidents'
import { CostList, Portrait, Window } from './kit'

export function IncidentScreen({ save, onResolve, onClose }: {
  save: GameState
  onResolve: (choice: string) => IncidentLog | undefined
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [result, setResult] = useState<IncidentLog>()
  const id = result?.id ?? save.incident?.id
  const actors = (save.incident?.actors ?? []).flatMap((actorId) => {
    const hero = save.roster.find(({ id }) => id === actorId)
    return hero ? [hero] : []
  })
  const names = { first: actors[0]?.name, second: actors[1]?.name }
  const choices = incidentChoices(save)
  const changed = choices[0]?.reason === 'changed'
  const format = new Intl.NumberFormat(i18n.language, { signDisplay: 'always', maximumFractionDigits: 1 })

  return (
    <Window title={id ? t(`incidents.events.${id}.title`) : t('incidents.title')} icon={<UiIcon name="town" />} onClose={onClose} small>
      {result ? (
        <>
          <p role="status">{result.choice === 'changed' || result.choice === 'ignore'
            ? t(`incidents.${result.choice}`)
            : t(`incidents.events.${result.id}.choices.${result.choice}.result${result.branch ?? 0}`)}</p>
          {result.changes?.length ? <ul className="plain column incident-changes">
            {result.changes.map(({ kind, refId, amount }, index) => {
              const label = t(`incidents.change.${kind}`)
              const detail = kind === 'materials' ? t(`material.${refId}`)
                : kind === 'vault' ? t(`vault.${refId}`)
                : kind === 'gear' ? t(`item.${refId}`, { defaultValue: '' })
                : refId
              return <li key={index}>{detail ? `${detail} · ` : ''}{label} <strong>{format.format(amount)}</strong></li>
            })}
          </ul> : <p className="muted">{t('incidents.noChanges')}</p>}
        </>
      ) : changed ? (
        <>
          <p>{t('incidents.changed')}</p>
          <button type="button" className="btn primary" onClick={() => setResult(onResolve(choices[0]!.id))}>{t('incidents.confirm')}</button>
        </>
      ) : id ? (
        <>
          {actors.length > 0 ? <div className="row">{actors.map((hero) => (
            <div className="chip" key={hero.id}><Portrait hero={hero} /><span>{hero.name}</span></div>
          ))}</div> : null}
          <p>{t(`incidents.events.${id}.story`, names)}</p>
          <div className="column">
            {choices.map(({ id: choice, cost, requires, actorCount, reason }) => {
              const key = `incidents.events.${id}.choices.${choice}`
              const lockReason = requires?.building && save.buildings[requires.building] < (requires.level ?? 1)
                ? t('incidents.building', { building: t(`building.${requires.building}`), level: requires.level ?? 1 })
                : (actorCount ?? 0) > actors.length ? t('incidents.actor') : t('incidents.materials')
              return (
                <div className={`card column incident-choice${reason ? ' unavailable' : ''}`} key={choice}>
                  <button className="btn" type="button" disabled={!!reason} onClick={() => setResult(onResolve(choice))}>{t(`${key}.label`, names)}</button>
                  {cost ? <CostList save={save} cost={cost} /> : null}
                  <span>{t(`${key}.hint`)}</span>
                  {reason ? <strong>{reason === 'poor' ? t('incidents.poor') : lockReason}</strong> : null}
                </div>
              )
            })}
          </div>
        </>
      ) : <p role="status">{t('incidents.ignore')}</p>}
      {result || !id ? <div className="actions">
        <button type="button" className="btn primary" onClick={onClose}>{t('action.close')}</button>
      </div> : null}
    </Window>
  )
}
