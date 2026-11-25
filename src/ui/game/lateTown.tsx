import { useTranslation } from 'react-i18next'
import { archBonus, endgameRules, lighthouseOffers, lighthousePotential, monumentCost, monumentStage, nextRankFame, prosperityBonus, prosperityRank, rankOffering, statueXp, townLevelOf, wallsCut, type GameAction, type GameState, type MonumentId } from '../../core'
import { Chip, CostList, VaultAmount, affordable, vaultKinds } from './kit'

type Props = { save: GameState; onAction: (action: GameAction) => void }

export function Monuments({ save, onAction }: Props) {
  const { t } = useTranslation()
  const rules = endgameRules.monuments
  if (townLevelOf(save).level < rules.unlockTown) return <section className="card column">
    <strong>{t('monument.title')}</strong>
    <span className="muted">{t('special.unlock', { level: rules.unlockTown })}</span>
  </section>
  function effect(state: GameState, id: MonumentId) {
    const percent = (value: number) => Math.round(value * 100)
    switch (id) {
      case 'statue': return t('monument.statueEffect', { value: percent(statueXp(state)) })
      case 'lighthouse': return t('monument.lighthouseEffect', { value: lighthousePotential(state), offers: lighthouseOffers(state) })
      case 'walls': return t('monument.wallsEffect', { value: percent(wallsCut(state)), loss: percent(wallsCut(state) * 2) })
      case 'arch': return t('monument.archEffect', { value: percent(archBonus(state)) })
    }
  }
  return <section className="column">
    <h3 className="section-title">{t('monument.title')}</h3>
    <div className="grid">{rules.list.map((def) => {
      const id = def.id as MonumentId
      const stage = monumentStage(save, id)
      const cost = monumentCost(id, stage + 1)
      const upgraded = { ...save, monuments: { ...save.monuments, [id]: stage + 1 } }
      return <article className="card column" key={id}>
        <strong>{t(`monument.${id}`)}</strong>
        <Chip>{t('monument.stage', { stage, max: def.stages.length })}</Chip>
        <span>{t('monument.current', { effect: effect(save, id) })}</span>
        {cost ? <>
          <span>{t('monument.next', { effect: effect(upgraded, id) })}</span>
          <CostList cost={cost} save={save} />
          <button type="button" className="btn primary" disabled={!affordable(cost, save)} onClick={() => onAction({ type: 'raiseMonument', id })}>{t('monument.raise')}</button>
        </> : null}
      </article>
    })}</div>
  </section>
}

export function Prosperity({ save, onAction }: Props) {
  const { t } = useTranslation()
  const rank = prosperityRank(save)
  const max = endgameRules.prosperity.maxRank
  const fame = nextRankFame(save)
  const offering = rankOffering(rank + 1)
  return <section className="card column">
    <strong>{t('prosperity.rank', { rank, max })}</strong>
    <span>{t('prosperity.bonus', { percent: Math.round(prosperityBonus(save) * 100) })}</span>
    {rank < max ? <>
      <strong>{t('prosperity.next', { rank: rank + 1 })}</strong>
      <Chip tone={save.fame >= fame ? 'good' : 'bad'}>{t('promotion.fame', { have: save.fame, need: fame })}</Chip>
      <div className="chips">{vaultKinds.map((kind) => {
        const need = offering[kind] ?? 0
        return need > 0 ? <Chip key={kind} tone={save.vault[kind] >= need ? 'good' : 'bad'}><VaultAmount kind={kind} amount={`${save.vault[kind]}/${need}`} /></Chip> : null
      })}</div>
      <button type="button" className="btn gold" disabled={save.fame < fame || !affordable(offering, save)} onClick={() => onAction({ type: 'prosper' })}>{t('prosperity.action')}</button>
    </> : <Chip tone="good">{t('prosperity.max')}</Chip>}
  </section>
}
