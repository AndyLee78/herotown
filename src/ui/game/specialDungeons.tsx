import { useTranslation } from 'react-i18next'
import { ESSENCES, abyssFloors, abyssShards, dungeonById, endgameRules, reduce, specialBlock, specialDungeons, todayElement, trialsLeft, type DungeonReport, type GameAction, type GameState, type VaultKey } from '../../core'
import { Chip, VaultAmount } from './kit'

type SpecialReward = { key: VaultKey; amount: number; best?: number }
type SpecialReport = DungeonReport & { specialReward?: SpecialReward }

export function applyWithVaultHistory(state: GameState, action: GameAction): GameState {
  const next = reduce(state, action)
  if (action.type !== 'catchUp' || next.history === state.history) return next
  const returning = state.expeditions.filter((trip) => !next.expeditions.some(({ id }) => id === trip.id))
    .sort((a, b) => a.returnAt - b.returnAt)
  const annotations = new Map<DungeonReport, SpecialReward>()
  let best = state.abyss.best
  const candidates = next.history.filter((report) => !state.history.includes(report)).reverse()
  for (const trip of returning) {
    const dungeon = specialDungeons.find(({ id }) => id === trip.dungeonId)
    if (!dungeon) continue
    const index = candidates.findIndex((report) => report.finishedAt === trip.returnAt && report.presetId === trip.presetId && report.dungeonId === trip.dungeonId)
    const report = index < 0 ? undefined : candidates.splice(index, 1)[0]
    if (dungeon.special === 'endless') {
      const from = trip.abyssFrom ?? state.abyss.checkpoint
      const reached = from + trip.report.floorsCleared
      let amount = 0
      for (let floor = from + 1; floor <= reached; floor += 1) amount += abyssShards(floor, best)
      if (report) annotations.set(report, { key: 'abyss', amount, ...(reached > best ? { best: reached } : {}) })
      best = Math.max(best, reached)
    } else if (report?.victory && dungeon.element) {
      annotations.set(report, { key: dungeon.element, amount: endgameRules.weekday.essence[(dungeon.difficulty ?? 1) - 1] ?? 0 })
    }
  }
  if (annotations.size === 1 && returning.length === 1) {
    const reward = [...annotations.values()][0]!
    reward.amount = next.vault[reward.key] - state.vault[reward.key]
  }
  // Persist display metadata on the existing history entries. The core save
  // reader preserves report fields, including reports from offline returns.
  const history: SpecialReport[] = next.history.map((report) => annotations.has(report) ? { ...report, specialReward: annotations.get(report) } : report)
  return annotations.size ? { ...next, history } : next
}

export function SpecialRewardChips({ report }: { report: SpecialReport }) {
  const { t } = useTranslation()
  const dungeon = specialDungeons.find(({ id }) => id === report.dungeonId)
  const recorded = report.specialReward
  const reward = recorded ?? (dungeon?.element && report.victory
    ? { key: dungeon.element, amount: endgameRules.weekday.essence[(dungeon.difficulty ?? 1) - 1] ?? 0 } : undefined)
  return <>
    {reward && reward.amount > 0 ? <VaultAmount kind={reward.key} amount={`+${reward.amount}`} /> : null}
    {recorded?.best != null ? <Chip tone="good">{t('special.newBest', { floor: recorded.best })}</Chip> : null}
  </>
}

export function SpecialDungeons({ save, now, onSelect }: { save: GameState; now: number; onSelect: (id: string) => void }) {
  const { t } = useTranslation()
  const element = todayElement(now)
  const allowed = element === 'choice' ? ESSENCES : [element]
  const first = specialDungeons.find((dungeon) => dungeon.element === allowed[0])!
  const weekdayLocked = specialBlock(save, first.id, now) === 'lockedDungeon'
  const abyssLocked = specialBlock(save, 'abyss', now) === 'lockedDungeon'
  const abyss = dungeonById('abyss')
  return <section className="column">
    <h3 className="section-title">{t('special.title')}</h3>
    <div className="card column">
      <strong>{t('special.weekday')}</strong>
      <span>{t('special.today', { element: element === 'choice' ? t('special.choice') : t(`vault.${element}`) })}</span>
      <Chip>{t('special.attempts', { left: trialsLeft(save, now), total: endgameRules.weekday.attemptsPerDay })}</Chip>
      {weekdayLocked ? <p className="muted">{t('special.unlock', { level: endgameRules.weekday.unlockTown })}</p> : null}
      {!weekdayLocked && trialsLeft(save, now) === 0 ? <p className="muted">{t('result.trialsUsed')}</p> : null}
      {specialDungeons.filter((entry) => entry.element && allowed.includes(entry.element)).map((entry) => (
        <button key={entry.id} type="button" className="dungeon special-choice" disabled={specialBlock(save, entry.id, now) != null} onClick={() => onSelect(entry.id)}>
          <span className="dungeon-body">
            <strong>{t(`dungeon.${entry.id}.name`)}</strong>
            <span className="muted">{t('dungeon.recommended', { level: entry.recommendedLevel })}</span>
          </span>
          <VaultAmount kind={entry.element!} amount={`+${endgameRules.weekday.essence[(entry.difficulty ?? 1) - 1]}`} />
        </button>
      ))}
    </div>
    <div className="card column">
      <strong>{t('dungeon.abyss.name')}</strong>
      <p className="muted">{t('dungeon.abyss.hint')}</p>
      {abyssLocked ? <p className="muted">{t('special.unlock', { level: endgameRules.abyss.unlockTown })}</p> : <>
        <span className="chips">
          <Chip>{t('special.best', { floor: save.abyss.best })}</Chip>
          <Chip>{t('special.checkpoint', { floor: save.abyss.checkpoint })}</Chip>
        </span>
        <ul className="plain">{abyssFloors(save.abyss.checkpoint).map(({ monsters }, index) => {
          const floor = save.abyss.checkpoint + index + 1
          return <li key={floor} className="line">
            <span>{t('special.floor', { floor })} · {monsters.map((id) => t(`enemy.${id}`)).join(', ')}</span>
            <VaultAmount kind="abyss" amount={`+${abyssShards(floor, save.abyss.best)}`} />
          </li>
        })}</ul>
        <button type="button" className="btn primary" onClick={() => onSelect(abyss.id)}>{t('battle.prepare')}</button>
      </>}
    </div>
  </section>
}
