import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { achievementProgress, codexDungeons, codexEntries, type Codex } from '../../core/codex'
import { townLevelOf, type GameAction, type GameState } from '../../core'
import { uniqueById, uniqueGear } from '../../core/loot'
import { Bar, Chip, Res, VaultAmount, itemLabel, vaultKinds } from './kit'

const categories = ['monsters', 'dungeons', 'uniques', 'sets', 'gifts', 'classes'] as const
const groups = ['collection', 'expedition', 'town', 'family'] as const

export function CodexScreen({ save }: { save: GameState }) {
  const { t } = useTranslation()
  const [category, select] = useState<typeof categories[number]>('monsters')
  const found = category === 'dungeons' ? save.cleared : save.codex[category as keyof Codex]
  const entries = category === 'dungeons' ? codexDungeons : codexEntries[category]
  function label(id: string) {
    if (category === 'monsters') return t(`enemy.${id}`)
    if (category === 'dungeons') return t(`dungeon.${id}.name`)
    if (category === 'sets') return t(`gearSet.${id}`)
    if (category === 'gifts') return t(`gift.${id}.name`)
    if (category === 'classes') return t(`class.${id}`)
    return itemLabel(t, uniqueGear(uniqueById(id)!, id), 'warrior')
  }
  return <section className="column">
    <div className="chips" aria-label={t('screen.codex')}>
      {categories.map((kind) => {
        const count = kind === 'dungeons' ? save.cleared.length : save.codex[kind].length
        const total = kind === 'dungeons' ? codexDungeons.length : codexEntries[kind].length
        return <button type="button" className={kind === category ? 'btn small gold' : 'btn small'} key={kind} aria-pressed={kind === category} onClick={() => select(kind)}>
          {t(`codex.kind.${kind}`)} {count}/{total}
        </button>
      })}
    </div>
    <ul className="plain grid">{entries.map((id) => <li className="card column" key={id}>
      {found.includes(id) ? <strong>{label(id)}</strong> : <span className="codex-unknown"><i aria-hidden="true" />{t('codex.unknown')}</span>}
      {category === 'monsters' && save.codex.elites.includes(id) ? <Chip tone="warn">{t('codex.elite')}</Chip> : null}
    </li>)}</ul>
  </section>
}

export function AchievementsScreen({ save, onAction }: { save: GameState; onAction: (action: GameAction) => void }) {
  const { t } = useTranslation()
  const progress = achievementProgress(save, townLevelOf(save).level)
  return <div className="column">{groups.map((group) => <section className="column" key={group}>
    <h3 className="section-title">{t(`codex.group.${group}`)}</h3>
    {progress.filter((entry) => entry.group === group).sort((a, b) => Number(b.ready) - Number(a.ready)).map((entry) => <article className={entry.ready ? 'card column achievement-ready' : 'card column'} key={entry.id}>
      <strong>{t(`codex.goal.${entry.kind}`, { target: entry.target })}</strong>
      <div className="fatigue"><Bar max={entry.target} value={entry.current} />
        <span>{Math.min(entry.current, entry.target)} / {entry.target}</span>
      </div>
      <div className="chips">
        {entry.reward.gold ? <Res kind="gold" amount={entry.reward.gold} /> : null}
        {entry.reward.fame ? <Res kind="fame" amount={entry.reward.fame} /> : null}
        {vaultKinds.map((kind) => {
          const amount = (entry.reward as Partial<Record<string, number>>)[kind]
          return amount ? <VaultAmount key={kind} kind={kind} amount={amount} /> : null
        })}
        {entry.claimed ? <Chip>{t('codex.claimed')}</Chip> : <button type="button" className="btn small gold" disabled={!entry.ready} onClick={() => onAction({ type: 'claimAchievement', id: entry.id })}>{t('guide.claim')}</button>}
      </div>
    </article>)}
  </section>)}</div>
}
