import { useTranslation } from 'react-i18next'
import { busyHeroIds, canDeploy, endgameRules, warned, type GameAction, type GameState } from '../../core'
import { Chip, Res, VaultAmount, waitLabel } from './kit'

export function InvasionCard({ save, now, onAction }: { save: GameState; now: number; onAction: (action: GameAction) => void }) {
  const { t } = useTranslation()
  const invasion = save.invasion
  if (!invasion) return null
  const rules = endgameRules.invasion
  const warning = warned(save, now)
  const busy = busyHeroIds(save)
  const ready = new Set(save.roster.filter((hero) => canDeploy(hero) && hero.condition !== 'critical' && !busy.has(hero.id)).map(({ id }) => id))
  const selected = invasion.defenders.filter((id) => save.presets.some((preset) => preset.id === id))
  const last = invasion.last
  return <section className={warning ? 'card column invasion-warning' : 'card column'}>
    <strong>{t('invasion.title')}</strong>
    <div className="chips">
      <Chip tone={warning ? 'bad' : 'info'}>{t('invasion.next', { time: waitLabel(invasion.nextAt - now) })}</Chip>
      {warning ? <Chip tone="bad">{t('invasion.warning')}</Chip> : null}
    </div>
    <strong>{t('invasion.defenders', { used: selected.length, max: rules.maxDefenders })}</strong>
    <div className="invasion-parties">
      {save.presets.map((preset, index) => {
        const checked = selected.includes(preset.id)
        const home = preset.slots.filter(({ id }) => ready.has(id)).length
        return <label className="invasion-party" key={preset.id}>
          <input type="checkbox" checked={checked} disabled={!checked && selected.length >= rules.maxDefenders}
            onChange={() => onAction({ type: 'defend', presetIds: checked ? selected.filter((id) => id !== preset.id) : [...selected, preset.id] })} />
          <span>{t('battle.preset', { number: index + 1 })} · {t('invasion.home', { ready: home, total: preset.slots.length })}</span>
        </label>
      })}
    </div>
    {selected.length === 0 ? <span className="muted">{t('invasion.fallback')}</span> : null}
    {last ? <div className="column">
      <div className="chips">
        <Chip tone={last.won ? 'good' : 'bad'}>{t(last.won ? 'invasion.won' : 'invasion.lost', { waves: last.waves, total: rules.waves.length })}</Chip>
        {last.won ? <VaultAmount kind="valor" amount={`+${rules.valor + rules.valorPer * Math.max(0, invasion.count - 1)}`} /> : null}
      </div>
      {last.lost ? <div className="chips">
        <Res kind="gold" amount={`−${last.lost.gold}`} light />
        <span>{t('invasion.materialLoss', { percent: rules.loss * 100 })}</span>
      </div> : null}
    </div> : null}
  </section>
}
