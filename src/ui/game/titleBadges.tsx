import { useTranslation } from 'react-i18next'
import { titleRules } from '../../core/titles'
import type { TitleHistory, TitleRecord } from '../../core/types'

export function TitleBadges({ hero }: { hero: TitleHistory }) {
  const { t, i18n } = useTranslation()
  return <>{hero.titles?.map(id => {
    const rule = titleRules.find(rule => rule.id === id)!
    const at = hero.titleDates?.[id]
    return <details className="earned-title" key={id}>
      <summary>{t(`deeds.names.${id}`)}</summary>
      <div>{t(`deeds.keys.${rule.deed}`)} · {rule.threshold.toLocaleString(i18n.language)}</div>
      <div>{t(`deeds.effects.${id}`)}</div>
      {at != null && <small>{t('deeds.date', { date: new Date(at).toLocaleString(i18n.language) })}</small>}
    </details>
  })}</>
}

// Titles inside a list card: plain chips, since the card itself is a button.
export function TitleChips({ hero }: { hero: TitleHistory }) {
  const { t } = useTranslation()
  if (!hero.titles?.length) return null
  return <span className="title-chips">{hero.titles.map(id => <span key={id} className="title-chip" title={t(`deeds.effects.${id}`)}>{t(`deeds.names.${id}`)}</span>)}</span>
}

export function DeedProgress({ hero }: { hero: TitleHistory }) {
  const { t, i18n } = useTranslation()
  return <details className="card deed-progress">
    <summary>{t('deeds.heading')}</summary>
    {(hero.titles?.length ?? 0) >= 3 && <p>{t('deeds.full')}</p>}
    <table><tbody>{titleRules.map(({ id, deed, threshold }) => <tr key={id}>
      <th scope="row">{t(`deeds.keys.${deed}`)}<small>{t(`deeds.names.${id}`)}</small></th>
      <td>{(hero.deeds?.[deed] ?? 0).toLocaleString(i18n.language)} / {threshold.toLocaleString(i18n.language)}</td>
    </tr>)}</tbody></table>
  </details>
}

export function TitleAwards({ awards, names }: { awards?: TitleRecord[]; names: {id: string; name: string}[] }) {
  const { t } = useTranslation()
  return <>{awards?.map(row => <p className="title-award" key={row.heroId + row.title}>
    {t('deeds.awarded', { hero: names.find(h => h.id === row.heroId)?.name ?? row.heroId, title: t(`deeds.names.${row.title}`) })}
  </p>)}</>
}
