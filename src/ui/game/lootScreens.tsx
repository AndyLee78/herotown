import { useTranslation } from 'react-i18next'
import { raidBoss, type DungeonReport, type GameAction, type GameState, type Gear } from '../../core'
import { lootRules } from '../../core/data'
import { canExchange, exchangeCost, uniqueGear, type LootEntry } from '../../core/loot'
import { GearOptions } from './gearDetails'
import { Chip, CostList, affordable, gearNameClass, itemLabel } from './kit'

type LootReport = DungeonReport & { foundGear?: Gear[] }

function ownedGear(save: GameState) {
  return [...save.stash, ...save.roster.flatMap(({ gear }) => gear), ...save.retirees.flatMap(({ hero }) => hero.gear),
    ...(save.shrine?.gear ?? []), ...(save.smith?.gear ? [save.smith.gear] : [])]
}

export function attachReportLoot(before: GameState, next: GameState): GameState {
  if (before.history === next.history || !next.loot.length) return next
  const previous = new Set(before.loot.map(({ gearId }) => gearId))
  const loot = next.loot.filter(({ gearId }) => !previous.has(gearId))
  if (!loot.length) return next
  const reports = next.history.filter((report) => !before.history.includes(report))
  const returning = before.expeditions.filter((trip) => !next.expeditions.some(({ id }) => id === trip.id))
  const items = new Map(ownedGear(next).map((item) => [item.id, item]))
  const tagged = new Map<DungeonReport, Gear[]>()
  for (const entry of loot) {
    const isRaid = entry.source.startsWith('raid.')
    if (!isRaid && returning.filter((trip) => trip.dungeonId === entry.source && trip.report.victory).length !== 1) continue
    const matches = reports.filter((report) => {
      if (!isRaid) return report.victory && report.dungeonId === entry.source
      const trip = before.expeditions.find((trip) => trip.dungeonId === 'raid' && trip.returnAt === report.finishedAt && trip.presetId === report.presetId)
      const boss = trip?.raid?.week ? raidBoss(trip.raid.week) : undefined
      const gains = report.gained?.vault as Record<string, number> | undefined
      return report.dungeonId === 'raid' && boss && `raid.${boss.id}` === entry.source && (gains?.[boss.spoil] ?? 0) > 0
    })
    const autoAdvanced = before.auto.nonce !== next.auto.nonce
    const possibleAutoSource = autoAdvanced && !isRaid && (before.auto.policy === 'material' || before.auto.dungeonId === entry.source)
    // The core log has no expedition ID. Only annotate a uniquely attributable drop.
    if (possibleAutoSource || matches.length !== 1) continue
    const item = items.get(entry.gearId)
    const report = matches[0]!
    if (item) tagged.set(report, [...(tagged.get(report) ?? []), item])
  }
  return tagged.size ? { ...next, history: next.history.map((report): LootReport => tagged.has(report) ? { ...report, foundGear: tagged.get(report) } : report) } : next
}

function Item({ item }: { item: Gear }) {
  const { t } = useTranslation()
  return <div className="column gear-entry">
    <strong className={gearNameClass(item)}>{itemLabel(t, item, 'warrior')}</strong>
    <GearOptions item={item} />
  </div>
}

export function ReportLoot({ report }: { report: LootReport }) {
  const { t } = useTranslation()
  return report.foundGear?.length ? <section className="card column">
    <strong>{t('loot.found')}</strong>
    {report.foundGear.map((item) => <Item key={item.id} item={item} />)}
  </section> : null
}

export function LootInbox({ save, onAction }: { save: GameState; onAction: (action: GameAction) => void }) {
  const { t } = useTranslation()
  if (!save.loot.length) return null
  const items = new Map(ownedGear(save).map((item) => [item.id, item]))
  const source = (entry: LootEntry) => entry.source.startsWith('raid.') ? t(`loot.boss.${entry.source.slice(5)}`) : t(`dungeon.${entry.source}.name`)
  return <details className="card fold loot-inbox">
    <summary><Chip tone="warn">{t('loot.new', { count: save.loot.length })}</Chip></summary>
    <ul className="plain">{[...save.loot].reverse().map((entry) => {
      const item = items.get(entry.gearId)
      return <li className="card column" key={entry.gearId}>
        {item ? <Item item={item} /> : <span>{t('loot.unavailable')}</span>}
        <span className="muted">{source(entry)}</span>
      </li>
    })}</ul>
    <button type="button" className="btn small" onClick={() => onAction({ type: 'seenLoot' })}>{t('loot.markSeen')}</button>
  </details>
}

export function GearExchange({ save, onAction }: { save: GameState; onAction: (action: GameAction) => void }) {
  const { t } = useTranslation()
  const owned = ownedGear(save)
  return <details className="card fold">
    <summary>{t('loot.exchange')}</summary>
    <div className="grid">{lootRules.uniques.map((def) => {
      const cost = exchangeCost(def)
      const unlocked = canExchange(def, save.cleared)
      return <article className="card column" key={def.id}>
        <Item item={uniqueGear(def, def.id)} />
        <Chip>{t('loot.owned', { count: owned.filter(({ unique }) => unique === def.id).length })}</Chip>
        <CostList cost={cost} save={save} />
        {!unlocked && 'dungeon' in def ? <span className="muted">{t('loot.locked', { dungeon: t(`dungeon.${def.dungeon}.name`) })}</span> : null}
        <button type="button" className="btn small" disabled={!unlocked || !affordable(cost, save)} onClick={() => onAction({ type: 'exchange', uniqueId: def.id })}>{t('loot.trade')}</button>
      </article>
    })}</div>
  </details>
}

export function DungeonLootHint({ id, tier }: { id: string; tier: number }) {
  const { t } = useTranslation()
  const grades = Object.keys(lootRules.grades[String(tier) as keyof typeof lootRules.grades] ?? {})
  const boss = lootRules.uniques.find((def) => 'dungeon' in def && def.dungeon === id)
  return <div className="column">
    <span>{t('loot.first', { grades: grades.map((grade) => t(`grade.${grade}`)).join(' · ') })}</span>
    {boss ? <span>{t('loot.bossUnique', { name: t(`unique.${boss.id}`), percent: lootRules.uniqueChance * 100 })}</span> : null}
  </div>
}
