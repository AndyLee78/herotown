import { ChevronLeft, Clock, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import {
  canDeploy,
  classById,
  combatRules,
  dungeonById,
  dungeonUnlocked,
  dungeons,
  expeditionSlots,
  heroPower,
  monsterById,
  villageRules,
  type DungeonReport,
  type GameAction,
  type GameState,
  type Hero,
  type PartyPreset,
  type TargetPriority,
} from '../../core'
import { gameNow } from '../clock'
import { josa } from '../josa'
import { ResourceIcon, type ResourceKind } from './icons'
import { Bar, Chip, Portrait, Res, clampPercent, fatigueTone, needsWarning, useNow, waitLabel } from './kit'
import { Report } from './villageScreens'
import { dungeonPreviewUrl, monsterPortraitUrl } from '../voxel/portrait'

type Act = (action: GameAction) => void
type Tab = 'dungeons' | 'prep' | 'editor' | 'history'
type Role = 'all' | 'tank' | 'dps' | 'healer' | 'support'
type Sort = 'level' | 'power' | 'fatigue'

// The battle window: pick a dungeon, prepare a party preset, edit presets,
// and look back at past expeditions.
export function BattleHub({ save, onAction, onDepart }: { save: GameState; onAction: Act; onDepart: (presetId: string) => void }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('dungeons')
  const [opened, setOpened] = useState<DungeonReport | null>(null)
  const tabs: Tab[] = ['dungeons', 'prep', 'history']
  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item || (item === 'prep' && tab === 'editor')}
            onClick={() => {
              setTab(item)
              setOpened(null)
            }}
          >
            {t(`battle.tab.${item}`)}
          </button>
        ))}
      </div>
      {tab === 'dungeons' ? <DungeonBoard save={save} onAction={onAction} onPrepare={() => setTab('prep')} /> : null}
      {tab === 'prep' ? <Prep save={save} onAction={onAction} onEdit={() => setTab('editor')} onDepart={onDepart} onDungeons={() => setTab('dungeons')} /> : null}
      {tab === 'editor' ? <PartyEditor save={save} onAction={onAction} onBack={() => setTab('prep')} /> : null}
      {tab === 'history' ? (
        opened ? (
          <>
            <button type="button" className="btn small back-link" onClick={() => setOpened(null)}>
              <ChevronLeft size={16} /> {t('battle.backToHistory')}
            </button>
            <Report report={opened} />
          </>
        ) : (
          <History save={save} onOpen={setOpened} />
        )
      ) : null}
    </>
  )
}

function DungeonBoard({ save, onAction, onPrepare }: { save: GameState; onAction: Act; onPrepare: () => void }) {
  const { t } = useTranslation()
  const dungeon = dungeonById(save.dungeonId)
  const open = dungeonUnlocked(save, dungeon.id)
  const drop = villageRules.drops[dungeon.id as keyof typeof villageRules.drops]
  const monsterIds = [...new Set(dungeon.floors.flatMap((floor) => floor.monsters))]
  const bosses = monsterIds.filter((id) => monsterById(id).boss)
  const regulars = monsterIds.filter((id) => !monsterById(id).boss)
  const repeat = villageRules.repeatReward
  const auto = repeat * villageRules.auto.rewardScale
  const material = drop?.material as ResourceKind | undefined
  return (
    <div className="board">
      <div className="board-list">
        {[...dungeons].sort((a, b) => a.tier - b.tier || a.recommendedLevel - b.recommendedLevel).map((entry) => {
          const unlocked = dungeonUnlocked(save, entry.id)
          return (
            <button
              key={entry.id}
              type="button"
              className={save.dungeonId === entry.id ? 'dungeon selected' : 'dungeon'}
              onClick={() => onAction({ type: 'dungeon', id: entry.id })}
            >
              <span className={`tier tier-${entry.tier}`}>{entry.tier}</span>
              <span className="dungeon-body">
                <strong>{unlocked ? t(`dungeon.${entry.id}.name`) : '???'}</strong>
                <span className="muted">{unlocked ? t('dungeon.recommended', { level: entry.recommendedLevel }) : t('battle.lockedHint', { tier: entry.tier - 1 })}</span>
              </span>
              {save.cleared.includes(entry.id) ? <Chip tone="good">{t('dungeon.cleared')}</Chip> : null}
              {!unlocked ? <Lock size={16} /> : null}
            </button>
          )
        })}
      </div>

      <div className="card board-detail">
        <DungeonStill dungeonId={dungeon.id} tier={dungeon.tier} bossId={bosses[0] ?? regulars[0] ?? 'wolf'} locked={!open} />
        {open ? (
          <>
            <div className="card-top">
              <span className={`tier tier-${dungeon.tier} big`}>{dungeon.tier}</span>
              <div>
                <strong className="name">{t(`dungeon.${dungeon.id}.name`)}</strong>
                <span className="chips">
                  <Chip>{t('dungeon.recommended', { level: dungeon.recommendedLevel })}</Chip>
                  <Chip>{t('battle.floors', { count: dungeon.floors.length })}</Chip>
                </span>
              </div>
            </div>
            <p>{t(`dungeon.${dungeon.id}.hint`)}</p>
            <h3 className="section-title">{t('battle.boss')}</h3>
            <span className="chips">
              {bosses.map((id) => (
                <Chip key={id} tone="bad">
                  <MonsterFace refId={id} large />
                  {t(`enemy.${id}`)}
                </Chip>
              ))}
            </span>
            <h3 className="section-title">{t('battle.monsters')}</h3>
            <span className="chips">
              {regulars.map((id) => (
                <Chip key={id}>
                  <MonsterFace refId={id} />
                  {t(`enemy.${id}`)}
                </Chip>
              ))}
            </span>
          </>
        ) : (
          <p className="empty">
            <Lock size={18} /> {t('battle.lockedHint', { tier: dungeon.tier - 1 })}
          </p>
        )}
      </div>

      <div className="card board-rewards">
        <h3 className="section-title">{t('battle.rewards')}</h3>
        {open && drop && material ? (
          <>
            <RewardRow label={t('battle.firstClear')} gold={dungeon.gold} material={material} amount={drop.amount} fame={drop.fame} />
            <RewardRow label={t('battle.repeat')} gold={Math.floor(dungeon.gold * repeat)} material={material} amount={Math.max(1, Math.floor(drop.amount * repeat))} />
            <RewardRow label={t('battle.autoReward')} gold={Math.floor(dungeon.gold * auto)} material={material} amount={Math.max(1, Math.floor(drop.amount * auto))} />
          </>
        ) : (
          <p className="muted">???</p>
        )}
        <button type="button" className="btn primary big" disabled={!open} onClick={onPrepare}>
          {t('battle.prepare')}
        </button>
      </div>
    </div>
  )
}

function DungeonStill({ dungeonId, tier, bossId, locked }: { dungeonId: string; tier: number; bossId: string; locked: boolean }) {
  const src = useMemo(() => dungeonPreviewUrl(dungeonId, tier, bossId, locked), [dungeonId, tier, bossId, locked])
  return (
    <div className="dungeon-preview">
      <img src={src} alt="" />
    </div>
  )
}

function MonsterFace({ refId, large = false }: { refId: string; large?: boolean }) {
  const src = useMemo(() => monsterPortraitUrl(refId), [refId])
  const size = large ? 52 : 32
  return <img className={large ? 'monster-face boss' : 'monster-face'} src={src} alt="" width={size} height={size} />
}

function RewardRow({ label, gold, material, amount, fame }: { label: string; gold: number; material: ResourceKind; amount: number; fame?: number }) {
  return (
    <div className="reward-row">
      <span className="muted">{label}</span>
      <span className="cost">
        <Res kind="gold" amount={gold} light />
        <Res kind={material} amount={amount} light />
        {fame ? <Res kind="fame" amount={fame} light /> : null}
      </span>
    </div>
  )
}

function presetHeroes(save: GameState, preset: PartyPreset): Hero[] {
  return preset.slots.flatMap((slot) => {
    const hero = save.roster.find((entry) => entry.id === slot.id)
    return hero ? [hero] : []
  })
}

type PartyNote = { key: string; tone: 'bad' | 'warn'; text: string }

function partyNotes(heroes: Hero[], t: TFunction, korean: boolean): PartyNote[] {
  if (heroes.length === 0) {
    return []
  }
  const notes: PartyNote[] = []
  const roles = heroes.map((hero) => classById(hero.classId).role)
  if (!roles.includes('tank')) {
    notes.push({ key: 'noTank', tone: 'bad', text: t('battle.warn.noTank') })
  }
  if (!roles.includes('healer')) {
    notes.push({ key: 'noHealer', tone: 'bad', text: t('battle.warn.noHealer') })
  }
  if (roles.filter((role) => role === 'dps').length <= 1) {
    notes.push({ key: 'fewDps', tone: 'warn', text: t('battle.warn.fewDps') })
  }
  const supports = new Map<string, number>()
  for (const hero of heroes) {
    const klass = classById(hero.classId)
    if (klass.role === 'support') {
      supports.set(hero.classId, (supports.get(hero.classId) ?? 0) + 1)
    }
  }
  for (const [classId, count] of supports) {
    if (count >= 2) {
      const name = t(`class.${classId}`)
      notes.push({ key: classId, tone: 'warn', text: t('battle.warn.overlap', { class: korean ? josa(name, '이') : name }) })
    }
  }
  return notes
}

function PartyNotes({ heroes }: { heroes: Hero[] }) {
  const { t, i18n } = useTranslation()
  const notes = partyNotes(heroes, t, i18n.language.startsWith('ko'))
  if (notes.length === 0) {
    return null
  }
  return (
    <span className="chips">
      {notes.map((note) => (
        <Chip key={note.key} tone={note.tone}>
          {note.text}
        </Chip>
      ))}
    </span>
  )
}

function Prep({
  save,
  onAction,
  onEdit,
  onDepart,
  onDungeons,
}: {
  save: GameState
  onAction: Act
  onEdit: () => void
  onDepart: (presetId: string) => void
  onDungeons: () => void
}) {
  const { t, i18n } = useTranslation()
  const korean = i18n.language.startsWith('ko')
  const now = useNow(save.expeditions.length > 0)
  const dungeon = dungeonById(save.dungeonId)
  const slots = expeditionSlots(save.buildings.guild)
  const preset = save.presets.find((entry) => entry.id === save.presetId) ?? save.presets[0]
  if (!preset) {
    return null
  }
  const away = new Set(save.expeditions.flatMap((expedition) => expedition.heroIds))
  const heroes = presetHeroes(save, preset)
  const busy = heroes.some((hero) => away.has(hero.id))
  const full = save.expeditions.length >= slots
  const [stamping, setStamping] = useState(false)
  const blocked = heroes.length === 0 ? t('battle.emptyPreset') : busy ? t('result.busyHero') : full ? t('result.slotsFull') : !dungeonUnlocked(save, dungeon.id) ? t('result.lockedDungeon') : null
  const depart = () => {
    if (stamping || blocked) {
      return
    }
    setStamping(true)
    window.setTimeout(() => {
      onDepart(preset.id)
      setStamping(false)
    }, 400)
  }
  return (
    <div className="column">
      <div className="card prep-head">
        <span className={`tier tier-${dungeon.tier}`}>{dungeon.tier}</span>
        <div className="grow">
          <strong className="name">{t(`dungeon.${dungeon.id}.name`)}</strong>
          <span className="muted">{t('dungeon.recommended', { level: dungeon.recommendedLevel })}</span>
        </div>
        <Chip tone={full ? 'bad' : 'info'}>{t('battle.slots', { used: save.expeditions.length, count: slots })}</Chip>
        <button type="button" className="btn small" onClick={onDungeons}>
          {t('battle.changeDungeon')}
        </button>
      </div>

      <h3 className="section-title">{t('battle.presets')}</h3>
      <div className="preset-list">
        {save.presets.map((entry, index) => {
          const members = presetHeroes(save, entry)
          const trip = save.expeditions.find((expedition) => expedition.presetId === entry.id)
          const power = members.reduce((sum, hero) => sum + heroPower(hero), 0)
          return (
            <button
              key={entry.id}
              type="button"
              className={entry.id === preset.id ? 'preset selected' : 'preset'}
              onClick={() => onAction({ type: 'preset', id: entry.id })}
            >
              <span className="preset-top">
                <strong>{t('battle.preset', { number: index + 1 })}</strong>
                <span className="power">⚔ {power}</span>
              </span>
              <span className="preset-faces">
                {Array.from({ length: combatRules.maxParty }, (_, slot) => {
                  const hero = members[slot]
                  return hero ? <Portrait key={hero.id} hero={hero} /> : <span key={slot} className="portrait empty-face" />
                })}
              </span>
              <span className="chips">
                {trip ? <Chip tone="info">{t('battle.away', { time: waitLabel(trip.returnAt - now) })}</Chip> : null}
                {members.some(needsWarning) ? <Chip tone="bad">{t('hero.warning')}</Chip> : null}
                {members.some((hero) => hero.deaths > 0) ? <Chip tone="bad">{t('hero.seenDeath')}</Chip> : null}
                {members.length === 0 ? <Chip>{t('battle.emptyPreset')}</Chip> : null}
                {partyNotes(members, t, korean).map((note) => (
                  <Chip key={note.key} tone={note.tone}>
                    {note.text}
                  </Chip>
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <button type="button" className="btn" onClick={onEdit}>
        {t('battle.editParty', { number: save.presets.indexOf(preset) + 1 })}
      </button>

      <details className="fold">
        <summary>{t('label.tactics')}</summary>
        <label className="field">
          <span>{t('label.target')}</span>
          <select
            value={preset.tactics.target}
            onChange={(event) => onAction({ type: 'tactics', presetId: preset.id, tactics: { ...preset.tactics, target: event.target.value as TargetPriority } })}
          >
            {(['lowestHp', 'backRow', 'boss'] as const).map((target) => (
              <option key={target} value={target}>
                {t(`target.${target}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('label.healBelow')}</span>
          <input
            type="number"
            min={0}
            max={100}
            value={preset.tactics.healBelow}
            onChange={(event) => onAction({ type: 'tactics', presetId: preset.id, tactics: { ...preset.tactics, healBelow: clampPercent(event.target.value) } })}
          />
        </label>
        <label className="field">
          <span>{t('label.retreatBelow')}</span>
          <input
            type="number"
            min={0}
            max={100}
            value={preset.tactics.retreatBelow}
            onChange={(event) => onAction({ type: 'tactics', presetId: preset.id, tactics: { ...preset.tactics, retreatBelow: clampPercent(event.target.value) } })}
          />
        </label>
      </details>

      <AutoSettings save={save} onAction={onAction} />

      <div className="card supplies">
        <strong>{t('battle.supplies')}</strong>
        <span className="muted">{t('battle.suppliesLater')}</span>
      </div>

      {blocked ? <p className="banner bad">{blocked}</p> : null}
      <div className={stamping ? 'stamp-stage stamping' : 'stamp-stage'}>
        <button type="button" className="btn primary big depart" disabled={blocked != null || stamping} onClick={depart}>
          {t('action.fight')}
        </button>
        {stamping ? <span className="depart-stamp">{t('action.fight')}</span> : null}
      </div>
    </div>
  )
}

function AutoSettings({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  return (
    <details className="fold">
      <summary>
        {t('label.auto')} {save.auto.enabled ? <Chip tone="good">ON</Chip> : <Chip>OFF</Chip>}
      </summary>
      <button type="button" className={save.auto.enabled ? 'btn primary' : 'btn'} onClick={() => onAction({ type: 'auto', enabled: !save.auto.enabled })}>
        {t('action.auto')} {save.auto.enabled ? 'ON' : 'OFF'}
      </button>
      <label className="field">
        <span>{t('label.policy')}</span>
        <select value={save.auto.policy} onChange={(event) => onAction({ type: 'autoPolicy', policy: event.target.value as 'material' | 'safe' | 'fixed' })}>
          {(['safe', 'material', 'fixed'] as const).map((policy) => (
            <option key={policy} value={policy}>
              {t(`policy.${policy}`)}
            </option>
          ))}
        </select>
      </label>
      {save.auto.policy === 'material' ? (
        <label className="field">
          <span>{t('label.material')}</span>
          <select value={save.auto.material} onChange={(event) => onAction({ type: 'autoMaterial', material: event.target.value as 'wood' | 'stone' | 'iron' | 'bone' })}>
            {(['wood', 'stone', 'iron', 'bone'] as const).map((material) => (
              <option key={material} value={material}>
                {t(`material.${material}`)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="field">
          <span>{t('label.autoDungeon')}</span>
          <select value={save.auto.dungeonId} onChange={(event) => onAction({ type: 'autoDungeon', id: event.target.value })}>
            {dungeons
              .filter((entry) => save.cleared.includes(entry.id))
              .map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {t(`dungeon.${entry.id}.name`)}
                </option>
              ))}
          </select>
        </label>
      )}
      <button type="button" className="btn small" onClick={() => onAction({ type: 'autoParty' })}>
        {t('action.autoParty')}
      </button>
      <p className="muted">{t('hint.auto')}</p>
    </details>
  )
}

function PartyEditor({ save, onAction, onBack }: { save: GameState; onAction: Act; onBack: () => void }) {
  const { t } = useTranslation()
  const [role, setRole] = useState<Role>('all')
  const [sort, setSort] = useState<Sort>('power')
  const preset = save.presets.find((entry) => entry.id === save.presetId) ?? save.presets[0]
  if (!preset) {
    return null
  }
  const away = new Set(save.expeditions.flatMap((expedition) => expedition.heroIds))
  const inPreset = new Set(preset.slots.map((slot) => slot.id))
  const full = preset.slots.length >= combatRules.maxParty
  const listed = save.roster
    .filter((hero) => role === 'all' || classById(hero.classId).role === role)
    .map((hero) => ({ hero, power: heroPower(hero) }))
    .sort((a, b) => (sort === 'level' ? b.hero.level - a.hero.level : sort === 'fatigue' ? a.hero.fatigue - b.hero.fatigue : b.power - a.power))
  const rows = (['back', 'front'] as const).map((row) => ({
    row,
    size: row === 'front' ? combatRules.frontRowSize : combatRules.backRowSize,
    slots: preset.slots.filter((slot) => slot.row === row),
  }))
  const members = presetHeroes(save, preset)
  return (
    <div className="column">
      <PartyNotes heroes={members} />
      <div className="split wide-right editor">
      <div className="column">
        <div className="row">
          {(['all', 'tank', 'dps', 'healer', 'support'] as const).map((entry) => (
            <button key={entry} type="button" className={role === entry ? 'btn tiny gold' : 'btn tiny'} onClick={() => setRole(entry)}>
              {t(`battle.role.${entry}`)}
            </button>
          ))}
          <select className="sort" value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label={t('battle.sort')}>
            {(['power', 'level', 'fatigue'] as const).map((entry) => (
              <option key={entry} value={entry}>
                {t(`battle.sortBy.${entry}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="hero-list">
          {listed.map(({ hero, power }) => {
            const chosen = inPreset.has(hero.id)
            const unavailable = away.has(hero.id) || !canDeploy(hero)
            return (
              <button
                key={hero.id}
                type="button"
                className={chosen ? 'hero-row selected' : 'hero-row'}
                disabled={unavailable || (!chosen && full)}
                onClick={() => onAction(chosen ? { type: 'remove', id: hero.id, presetId: preset.id } : { type: 'add', id: hero.id, presetId: preset.id })}
              >
                <Portrait hero={hero} />
                <span className="hero-row-body">
                  <strong>
                    {hero.name} <span className="power">⚔ {power}</span>
                  </strong>
                  <span className="chips">
                    <Chip tone="info">{t(`class.${hero.classId}`)}</Chip>
                    <Chip>{t('ui.level', { level: hero.level })}</Chip>
                    {away.has(hero.id) ? <Chip tone="info">{t('battle.onTrip')}</Chip> : null}
                    {needsWarning(hero) ? <Chip tone="bad">{t(`condition.${hero.condition}`)}</Chip> : null}
                  </span>
                  <span className="fatigue">
                    <Bar value={hero.fatigue} max={100} tone={fatigueTone(hero)} />
                    <span className="muted">{Math.round(hero.fatigue)}</span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="column">
        <h3 className="section-title">{t('battle.preset', { number: save.presets.indexOf(preset) + 1 })}</h3>
        <div className="formation">
          {rows.map(({ row, size, slots }) => (
            <div key={row} className="formation-row">
              <span className="formation-label">{t(`row.${row}`)}</span>
              {Array.from({ length: size }, (_, index) => {
                const slot = slots[index]
                const hero = slot ? save.roster.find((entry) => entry.id === slot.id) : undefined
                if (!slot || !hero) {
                  return (
                    <div key={index} className="slot empty-slot">
                      {t('ui.emptySlot')}
                    </div>
                  )
                }
                return (
                  <div key={slot.id} className="slot">
                    <Portrait hero={hero} />
                    <span className="slot-body">
                      <strong>{hero.name}</strong>
                      <span className="row">
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => onAction({ type: 'row', id: slot.id, row: row === 'front' ? 'back' : 'front', presetId: preset.id })}
                        >
                          {t(row === 'front' ? 'action.back' : 'action.front')}
                        </button>
                        <button type="button" className="btn tiny" onClick={() => onAction({ type: 'remove', id: slot.id, presetId: preset.id })}>
                          {t('action.remove')}
                        </button>
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
          <span className="formation-arrow" aria-hidden="true">
            ➜
          </span>
        </div>
        <button type="button" className="btn primary" onClick={onBack}>
          {t('battle.done')}
        </button>
      </div>
      </div>
    </div>
  )
}

function History({ save, onOpen }: { save: GameState; onOpen: (report: DungeonReport) => void }) {
  const { t } = useTranslation()
  if (save.history.length === 0) {
    return <p className="empty">{t('battle.historyEmpty')}</p>
  }
  const now = gameNow()
  return (
    <div className="history">
      {save.history.map((report, index) => {
        const faces = (report.party ?? []).map((member) => save.roster.find((hero) => hero.id === member.id) ?? null)
        const minutes = report.finishedAt ? Math.max(0, Math.round((now - report.finishedAt) / 60_000)) : null
        return (
          <article key={`${report.finishedAt ?? 0}-${index}`} className={report.victory ? 'card history-card win' : 'card history-card lose'}>
            <div className="card-top">
              <Chip tone={report.victory ? 'good' : 'bad'}>{report.victory ? t('result.victory') : t('result.defeat')}</Chip>
              <strong>{report.dungeonId ? t(`dungeon.${report.dungeonId}.name`) : ''}</strong>
              {minutes != null ? (
                <span className="muted">
                  <Clock size={12} /> {t('battle.ago', { minutes })}
                </span>
              ) : null}
            </div>
            <span className="preset-faces">
              {faces.map((hero, slot) => (hero ? <Portrait key={hero.id} hero={hero} /> : <span key={slot} className="portrait empty-face" />))}
            </span>
            <span className="cost">
              <Res kind="gold" amount={`+${report.gained?.gold ?? report.gold}`} light />
              {Object.entries(report.gained?.materials ?? {}).map(([kind, amount]) => (
                <span key={kind} className="res light">
                  <ResourceIcon kind={kind as ResourceKind} size={18} />+{amount}
                </span>
              ))}
              {report.gained?.fame ? <Res kind="fame" amount={`+${report.gained.fame}`} light /> : null}
              <Chip>{t('result.xp', { xp: report.xp })}</Chip>
            </span>
            <button type="button" className="btn small" onClick={() => onOpen(report)}>
              {t('battle.watch')}
            </button>
          </article>
        )
      })}
    </div>
  )
}
