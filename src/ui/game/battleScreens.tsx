import { TitleAwards } from './titleBadges'
import { ChevronLeft, Clock, Lock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import {
  POTION_IDS,
  alchemyRules,
  canDeploy,
  isChild,
  classById,
  combatRules,
  dungeonById,
  dungeonUnlocked,
  dungeons,
  expeditionSlots,
  guildLevel,
  heroPower,
  heroTrinkets,
  busyHeroIds,
  currentRaid,
  eventDungeonId,
  eventRunsLeft,
  blessing,
  isNest,
  monsterById,
  nestRevealed,
  nestRules,
  nestSeason,
  partyBonus,
  partyFit,
  readiness,
  specialBlock,
  timeRules,
  villageRules,
  type AffixId,
  type DungeonReport,
  type GameAction,
  type GameState,
  type Hero,
  type PartyPreset,
  type PotionId,
  type Supplies,
  type TargetPriority,
} from '../../core'
import { gameNow } from '../clock'
import { josa } from '../josa'
import { ResourceIcon, type ResourceKind } from './icons'
import { Bar, Chip, Portrait, Res, clampPercent, needsWarning, useNow, waitLabel } from './kit'
import { Report } from './villageScreens'
import { EliteMonsters, MonsterIdentity } from './identity'
import { GearSummary } from './gearDetails'
import { DungeonLootHint } from './lootScreens'
import { RaidCard, SpecialDungeons, SpecialRewardChips } from './specialDungeons'
import { dungeonPreviewUrl, monsterPortraitUrl } from '../voxel/portrait'

type Act = (action: GameAction) => void
type Tab = 'dungeons' | 'prep' | 'editor' | 'history'
type Role = 'all' | 'tank' | 'dps' | 'healer' | 'support'
type Sort = 'level' | 'power' | 'fatigue'

// The battle window: pick a dungeon, prepare a party preset, edit presets,
// and look back at past expeditions.
export type BattleView = 'dungeons' | 'special' | 'raid'

// The window's foot: ordinary dungeons, special dungeons, the weekly raid.
export function BattleViewTabs({ view, onView }: { view: BattleView; onView: (view: BattleView) => void }) {
  const { t } = useTranslation()
  return (
    <div className="foot-tabs" role="tablist">
      {(['dungeons', 'special', 'raid'] as const).map((item) => (
        <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => onView(item)}>
          {t(`battle.view.${item}`)}
        </button>
      ))}
    </div>
  )
}

export function BattleHub({ save, view = 'dungeons', onAction, onDepart }: { save: GameState; view?: BattleView; onAction: Act; onDepart: (presetId: string) => void }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('dungeons')
  const now = useNow(true)
  // A new foot tab always opens on its list.
  useEffect(() => {
    setTab('dungeons')
  }, [view])
  const choose = (id: string) => {
    onAction({ type: 'dungeon', id })
    setTab('prep')
  }
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
            {item === 'dungeons' ? t(`battle.view.${view}`) : t(`battle.tab.${item}`)}
          </button>
        ))}
      </div>
      {tab === 'dungeons' && view === 'dungeons' ? <DungeonBoard save={save} onAction={onAction} onPrepare={() => setTab('prep')} /> : null}
      {tab === 'dungeons' && view === 'special' ? <SpecialDungeons save={save} now={now} onAction={onAction} onSelect={choose} /> : null}
      {tab === 'dungeons' && view === 'raid' ? <RaidCard save={save} now={now} onSelect={choose} /> : null}
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
  const selected = dungeonById(save.dungeonId)
  const dungeon = selected.special ? dungeons[0]! : selected
  const open = dungeonUnlocked(save, dungeon.id)
  const drop = villageRules.drops[dungeon.id as keyof typeof villageRules.drops]
  const season = isNest(dungeon.id) ? nestSeason(save.seed, save.calendar) : null
  const revealed = isNest(dungeon.id) && nestRevealed(save)
  const monsterIds = [...new Set((revealed && season ? season.floors : dungeon.floors).flatMap((floor) => floor.monsters))]
  const bosses = monsterIds.filter((id) => monsterById(id).boss)
  const regulars = monsterIds.filter((id) => !monsterById(id).boss)
  const repeat = villageRules.repeatReward
  const auto = repeat * villageRules.auto.rewardScale
  const material = drop?.material as ResourceKind | undefined
  return (
    <div className="column">
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
            <DungeonLootHint id={dungeon.id} tier={dungeon.tier} />
            {isNest(dungeon.id) ? (
              <NestCard save={save} onAction={onAction} />
            ) : (
              <>
                <h3 className="section-title">{t('battle.boss')}</h3>
                <span className="chips">
                  {bosses.map((id) => (
                    <span className="card monster-profile" key={id}>
                      <span className="chips"><MonsterFace refId={id} large />
                      {t(`enemy.${id}`)}</span>
                      <MonsterIdentity id={id} />
                    </span>
                  ))}
                </span>
                <h3 className="section-title">{t('battle.monsters')}</h3>
                <span className="chips">
                  {regulars.map((id) => (
                    <span className="card monster-profile" key={id}>
                      <span className="chips"><MonsterFace refId={id} />
                      {t(`enemy.${id}`)}</span>
                      <MonsterIdentity id={id} />
                    </span>
                  ))}
                </span>
              </>
            )}
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
        <button type="button" className="btn primary big" disabled={!open} onClick={() => {
          if (selected.special) onAction({ type: 'dungeon', id: dungeon.id })
          onPrepare()
        }}>
          {t('battle.prepare')}
        </button>
      </div>
    </div>
    </div>
  )
}

function NestCard({ save, onAction }: { save: GameState; onAction: Act }) {
  const { t } = useTranslation()
  const now = useNow(true)
  const [picking, setPicking] = useState(false)
  const season = nestSeason(save.seed, save.calendar)
  const known = nestRevealed(save)
  const left = Math.max(0, timeRules.seasonMs - save.calendar.intoSeasonMs)
  const away = new Set(save.expeditions.flatMap((expedition) => expedition.heroIds))
  if (save.scout) {
    away.add(save.scout.heroId)
  }
  const rogues = save.roster.filter(
    (hero) => hero.classId === 'rogue' && canDeploy(hero) && hero.condition !== 'injured' && hero.condition !== 'critical' && !away.has(hero.id),
  )
  return (
    <div className="nest-card">
      <p className="muted">{t('nest.seasonLeft', { time: waitLabel(left) })}</p>
      {known ? (
        <>
          <h3 className="section-title">{t('nest.affixes')}</h3>
          {season.affixes.map((id) => (
            <div key={id} className="nest-affix">
              <Chip tone="warn">{t(`affix.${id}`)}</Chip>
              <span className="muted">{t(`affix.hint.${id}`)}</span>
            </div>
          ))}
          <h3 className="section-title">{t('nest.floors')}</h3>
          {season.floors.map((floor, index) => (
            <div key={index} className="nest-floor">
              <strong>{t('nest.floor', { n: index + 1 })}</strong>
              <span className="chips">
                {floor.monsters.map((id, slot) => (
                  <span className="card monster-profile" key={`${id}-${slot}`}>
                    <span className="chips"><MonsterFace refId={id} /> {t(`enemy.${id}`)}</span>
                    <MonsterIdentity id={id} />
                  </span>
                ))}
              </span>
            </div>
          ))}
        </>
      ) : (
        <>
          <p className="banner">{t('nest.hidden')}</p>
          <h3 className="section-title">{t('nest.floors')}</h3>
          <p className="muted">?</p>
          {save.scout ? (
            <div className="nest-scout">
              <Bar value={Math.max(0, nestRules.scoutMs - (save.scout.finishAt - now))} max={nestRules.scoutMs} tone="info" />
              <span className="muted">{t('nest.scouting', { time: waitLabel(Math.max(0, save.scout.finishAt - now)) })}</span>
            </div>
          ) : picking ? (
            <div className="nest-pick">
              <strong>{t('nest.pickRogue')}</strong>
              {rogues.length === 0 ? <p className="muted">{t('nest.noRogue')}</p> : null}
              {rogues.map((hero) => (
                <button
                  key={hero.id}
                  type="button"
                  className="btn small"
                  onClick={() => {
                    onAction({ type: 'scout', heroId: hero.id, now: gameNow() })
                    setPicking(false)
                  }}
                >
                  <Portrait hero={hero} /> {hero.name}
                </button>
              ))}
              <button type="button" className="btn tiny" onClick={() => setPicking(false)}>
                {t('nest.cancelPick')}
              </button>
            </div>
          ) : (
            <div className="nest-actions">
              <button type="button" className="btn" onClick={() => setPicking(true)}>
                {t('nest.scout')}
              </button>
              <button type="button" className="btn gold" disabled={save.buildings.guild < 1 || save.gold < nestRules.intelGold} onClick={() => onAction({ type: 'buyIntel' })}>
                {t('nest.intelCost', { gold: nestRules.intelGold })}
              </button>
            </div>
          )}
        </>
      )}
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

function HeroStatus({ save, hero, presetId, now }: { save: GameState; hero: Hero; presetId: string; now: number }) {
  const { t } = useTranslation()
  const status = readiness(save, hero)
  const ancestorBonus = blessing(save, hero)
  const { busy, condition } = status
  const recovery = hero.treatAt ?? status.recoverAt
  const injured = condition === 'injured' || condition === 'critical'
  return (
    <span className="prep-status">
      {/* Two small meters on one line: fatigue and morale. */}
      <span className="prep-meters">
        <span className="prep-meter" title={t('prep.fatigue', { value: Math.round(status.fatigue) })}>
          <span className="prep-meter-label">{t('prep.fatigueShort')}</span>
          <Bar value={status.fatigue} max={100} tone={status.fatigueLevel === 'fresh' ? 'good' : status.fatigueLevel === 'tired' ? 'warn' : 'bad'} />
          <b>{Math.round(status.fatigue)}</b>
        </span>
        <span className="prep-meter" title={t('morale.value', { value: Math.floor(status.morale) })}>
          <span className="prep-meter-label">{t('prep.moraleShort')}</span>
          <Bar value={status.morale} max={100} tone={status.moraleLevel === 'low' ? 'bad' : status.moraleLevel === 'high' ? 'warn' : 'info'} />
          <b>{Math.floor(status.morale)}</b>
        </span>
      </span>
      <span className="chips">
        {ancestorBonus > 0 ? <Chip tone="good">{t('legends.blessing', { percent: Math.round(100 * ancestorBonus) })}</Chip> : null}
        {injured || condition === 'dead' ? <Chip tone="bad">{injured && recovery != null
          ? t('prep.recovering', { condition: t(`condition.${condition}`), time: waitLabel(recovery - now) })
          : t(`condition.${condition}`)}</Chip> : null}
        {busy ? <Chip tone="info">{busy.kind === 'expedition'
          ? t('prep.returning', { dungeon: t(`dungeon.${busy.dungeonId}.name`), time: waitLabel(busy.until - now) })
          : t(`prep.${busy.kind}`, { time: waitLabel(busy.until - now) })}</Chip> : null}
        {status.parties.filter((id) => id !== presetId).map((id) => (
          <Chip key={id}>{id === 'auto' ? t('prep.auto') : t('battle.preset', { number: save.presets.findIndex((preset) => preset.id === id) + 1 })}</Chip>
        ))}
      </span>
    </span>
  )
}

export function Prep({
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
  const now = useNow(true)
  const dungeon = dungeonById(save.dungeonId)
  const slots = expeditionSlots(save.buildings.guild)
  const preset = save.presets.find((entry) => entry.id === save.presetId) ?? save.presets[0]
  if (!preset) {
    return null
  }
  const away = busyHeroIds(save)
  const heroes = presetHeroes(save, preset)
  const busy = heroes.some((hero) => away.has(hero.id))
  const full = save.expeditions.length >= slots
  const [stamping, setStamping] = useState(false)
  const eventNotice = dungeon.special === 'event'
    ? dungeon.id !== eventDungeonId(save) ? 'eventSeason' : eventRunsLeft(save) === 0 ? 'eventUsed' : null
    : null
  const special = dungeon.id === 'raid' && currentRaid(save, now).killed ? 'raidDone' : specialBlock(save, dungeon.id, now) ?? eventNotice
  const blocked = special ? t(`result.${special}`) : heroes.length === 0 ? t('battle.emptyPreset') : busy ? t('result.busyHero') : full ? t('result.slotsFull') : !dungeonUnlocked(save, dungeon.id) ? t('result.lockedDungeon') : null
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
          {heroes.length > 0 ? <span className="muted">{t('storage.partyAverage', { level: Number((heroes.reduce((sum, hero) => sum + hero.level, 0) / heroes.length).toFixed(1)) })}</span> : null}
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
      <div className="prep-party">
        {preset.slots.map(({ id }) => {
          const hero = save.roster.find((entry) => entry.id === id)
          return hero ? (
            <div key={id} className={away.has(id) || hero.condition === 'dead' ? 'prep-member prep-unavailable' : 'prep-member'}>
              <Portrait hero={hero} />
              <span className="hero-row-body">
                <strong>{hero.name}</strong>
                <Chip>{t('ui.level', { level: hero.level })}</Chip>
                <HeroStatus save={save} hero={hero} presetId={preset.id} now={now} />
                <GearSummary hero={hero} />
              </span>
            </div>
          ) : null
        })}
      </div>
      <div className="chips">
        <button type="button" className="btn" onClick={onEdit}>
          {t('battle.editParty', { number: save.presets.indexOf(preset) + 1 })}
        </button>
        <button type="button" className="btn" onClick={() => onAction({ type: 'autoFill', presetId: preset.id })}>
          {t('battle.autoFill')}
        </button>
      </div>

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
        <label className="field">
          <span>{t('label.potionBelow')}</span>
          <input
            type="number"
            min={0}
            max={100}
            value={preset.tactics.potionBelow ?? alchemyRules.potionBelow}
            onChange={(event) => onAction({ type: 'tactics', presetId: preset.id, tactics: { ...preset.tactics, potionBelow: clampPercent(event.target.value) } })}
          />
        </label>
        <div className="field">
          <span>{t('label.blast')}</span>
          <span className="blast-pick">
            {(['interrupt', 'brace'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={(preset.tactics.blast ?? 'interrupt') === mode ? 'btn small primary' : 'btn small'}
                onClick={() => onAction({ type: 'tactics', presetId: preset.id, tactics: { ...preset.tactics, blast: mode } })}
              >
                {t(`blast.${mode}`)}
              </button>
            ))}
          </span>
          <p className="muted">{t(`blast.hint.${preset.tactics.blast ?? 'interrupt'}`)}</p>
        </div>
      </details>

      <AutoSettings save={save} onAction={onAction} />

      <SuppliesPicker save={save} preset={preset} onAction={onAction} />
      {dungeon.id === 'raid' ? <RaidCard save={save} now={now} /> : null}

      <FortReady dungeonId={dungeon.id} heroes={heroes} />
      <CitadelReady dungeonId={dungeon.id} heroes={heroes} blast={preset.tactics.blast ?? 'interrupt'} />
      <NestReady
        save={save}
        dungeonId={dungeon.id}
        heroes={heroes}
        supplies={preset.supplies ?? {}}
        blast={preset.tactics.blast ?? 'interrupt'}
      />

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
  const guildBuilt = save.buildings.guild >= 1
  const autoParties = guildLevel(save.buildings.guild).autoParties
  return (
    <details className="fold">
      <summary>
        {t('label.auto')} {save.auto.enabled ? <Chip tone="good">ON</Chip> : <Chip>OFF</Chip>}
        {!guildBuilt ? <Chip tone="warn"><Lock size={12} /></Chip> : null}
      </summary>
      {!guildBuilt ? (
        <p className="banner">{t('guild.autoLocked')}</p>
      ) : (
        <>
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
              <select
                value={save.auto.material}
                onChange={(event) => onAction({ type: 'autoMaterial', material: event.target.value as 'wood' | 'stone' | 'iron' | 'bone' | 'herb' | 'crystal' })}
              >
                {(['wood', 'stone', 'iron', 'bone', 'herb', 'crystal'] as const).map((material) => (
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
          {autoParties >= 2 ? <p className="muted">{t('guild.autoPartiesHint')}</p> : null}
        </>
      )}
    </details>
  )
}

export function PartyEditor({ save, onAction, onBack }: { save: GameState; onAction: Act; onBack: () => void }) {
  const { t } = useTranslation()
  const [role, setRole] = useState<Role>('all')
  const [sort, setSort] = useState<Sort>('power')
  const now = useNow(true)
  const preset = save.presets.find((entry) => entry.id === save.presetId) ?? save.presets[0]
  if (!preset) {
    return null
  }
  const away = busyHeroIds(save)
  const inPreset = new Set(preset.slots.map((slot) => slot.id))
  const full = preset.slots.length >= combatRules.maxParty
  // Children stay off this list until they come of age (Docs/tasks.md 50).
  const listed = save.roster
    .filter((hero) => !isChild(hero))
    .filter((hero) => role === 'all' || classById(hero.classId).role === role)
    .map((hero) => ({ hero, power: heroPower(hero) }))
    .sort((a, b) => (sort === 'level' ? b.hero.level - a.hero.level : sort === 'fatigue' ? a.hero.fatigue - b.hero.fatigue : b.power - a.power))
  const rows = (['back', 'front'] as const).map((row) => ({
    row,
    size: row === 'front' ? combatRules.frontRowSize : combatRules.backRowSize,
    slots: preset.slots.filter((slot) => slot.row === row),
  }))
  const members = presetHeroes(save, preset)
  const bonuses = partyBonus(save, members.map(({ id }) => id))
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
            const fit = Math.round(partyFit(hero, members) * 100)
            return (
              <button
                key={hero.id}
                type="button"
                className={`hero-row${chosen ? ' selected' : ''}${away.has(hero.id) || hero.condition === 'dead' ? ' prep-unavailable' : ''}`}
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
                    {hero.expecting ? <Chip tone="info">{t('battle.expecting')}</Chip> : null}
                    {fit !== 0 ? <Chip tone={fit > 0 ? 'good' : 'bad'}>{t(fit > 0 ? 'personality.fit' : 'personality.clash', { percent: Math.abs(fit) })}</Chip> : null}
                  </span>
                  <HeroStatus save={save} hero={hero} presetId={preset.id} now={now} />
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
                  <div key={slot.id} className={away.has(hero.id) || hero.condition === 'dead' ? 'slot prep-unavailable' : 'slot'}>
                    <Portrait hero={hero} />
                    <span className="slot-body">
                      <strong>{hero.name}</strong>
                      <Chip>{t('ui.level', { level: hero.level })}</Chip>
                      {(bonuses[hero.id] ?? 0) < 0 ? <Chip tone="bad">{t('personality.clash', { percent: Math.round(-100 * bonuses[hero.id]!) })}</Chip> : null}
                      <HeroStatus save={save} hero={hero} presetId={preset.id} now={now} />
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

function SuppliesPicker({ save, preset, onAction }: { save: GameState; preset: PartyPreset; onAction: Act }) {
  const { t } = useTranslation()
  const wanted = preset.supplies ?? {}
  const carried = POTION_IDS.reduce((sum, id) => sum + (wanted[id] ?? 0), 0)
  const setCount = (id: PotionId, next: number) => {
    const others = carried - (wanted[id] ?? 0)
    const count = Math.max(0, Math.min(next, save.potions[id] ?? 0, alchemyRules.potionsPerTrip - others))
    onAction({ type: 'supplies', potionId: id, count, presetId: preset.id })
  }
  return (
    <div className="card supplies">
      <strong>{t('battle.supplies')}</strong>
      <span className="muted">{t('battle.carry', { count: carried, max: alchemyRules.potionsPerTrip })}</span>
      {POTION_IDS.map((id) => (
        <span key={id} className="supply-row">
          <span className="grow">{t(`potion.${id}`)}</span>
          <span className="muted">{t('battle.inStock', { count: save.potions[id] ?? 0 })}</span>
          <button type="button" className="btn tiny" onClick={() => setCount(id, (wanted[id] ?? 0) - 1)}>
            −
          </button>
          <strong>{wanted[id] ?? 0}</strong>
          <button type="button" className="btn tiny" onClick={() => setCount(id, (wanted[id] ?? 0) + 1)}>
            +
          </button>
        </span>
      ))}
    </div>
  )
}

function FortReady({ dungeonId, heroes }: { dungeonId: string; heroes: Hero[] }) {
  const { t } = useTranslation()
  const dungeon = dungeonById(dungeonId)
  const hasTraps = dungeon.floors.some((floor) => (floor.trapChance ?? 0) > 0)
  const hasAmbush = dungeon.floors.some((floor) => floor.monsters.some((id) => monsterById(id)?.ambush))
  if (!hasTraps && !hasAmbush) {
    return null
  }
  const rogue = heroes.some((hero) => hero.classId === 'rogue')
  const sense = heroes.some((hero) => heroTrinkets(hero).has('trapSense'))
  const alert = heroes.some((hero) => heroTrinkets(hero).has('alert'))
  const trapStatus = rogue ? t('battle.trapRogue') : sense ? t('battle.trapSense') : t('battle.trapNone')
  const ambushStatus = alert ? t('battle.ambushAlert') : t('battle.ambushNone')
  return (
    <p className="banner">
      {hasTraps ? t('battle.trapReady', { status: trapStatus }) : null}
      {hasTraps && hasAmbush ? ' · ' : null}
      {hasAmbush ? t('battle.ambushReady', { status: ambushStatus }) : null}
    </p>
  )
}

function CitadelReady({ dungeonId, heroes, blast }: { dungeonId: string; heroes: Hero[]; blast: 'interrupt' | 'brace' }) {
  const { t } = useTranslation()
  if (dungeonId !== 'haunted_citadel') {
    return null
  }
  const ready = heroes.filter((hero) => classById(hero.classId).interrupt)
  const names = ready.map((hero) => hero.name).join(', ')
  const warn = blast === 'interrupt' && ready.length === 0
  return (
    <p className={warn ? 'banner bad' : 'banner'}>
      {t('battle.interrupters', { count: ready.length, names: names || t('battle.interruptersNone') })}
      {' · '}
      {t('battle.blastTactic', { tactic: t(`blast.${blast}`) })}
    </p>
  )
}

function affixReady(
  id: AffixId,
  heroes: Hero[],
  supplies: Supplies,
  blast: 'interrupt' | 'brace',
): boolean {
  const trinkets = (hero: Hero) => heroTrinkets(hero)
  switch (id) {
    case 'venom':
      return (supplies.antidote ?? 0) > 0 || heroes.some((hero) => trinkets(hero).has('poisonWard'))
    case 'traps':
      return heroes.some((hero) => hero.classId === 'rogue') || heroes.some((hero) => trinkets(hero).has('trapSense'))
    case 'ambush':
      return heroes.some((hero) => trinkets(hero).has('alert'))
    case 'charged':
      return blast === 'brace' || heroes.some((hero) => classById(hero.classId).interrupt)
    case 'silence':
      return (supplies.clarity ?? 0) > 0 || heroes.some((hero) => trinkets(hero).has('calm'))
    case 'paralyze':
      return (supplies.tonic ?? 0) > 0 || heroes.some((hero) => trinkets(hero).has('steady'))
    case 'noRest':
      return (supplies.heal ?? 0) > 0
    case 'swift':
      return true
  }
}

function NestReady({
  save,
  dungeonId,
  heroes,
  supplies,
  blast,
}: {
  save: GameState
  dungeonId: string
  heroes: Hero[]
  supplies: Supplies
  blast: 'interrupt' | 'brace'
}) {
  const { t } = useTranslation()
  if (!isNest(dungeonId) || !nestRevealed(save)) {
    return null
  }
  const season = nestSeason(save.seed, save.calendar)
  return (
    <div className="nest-ready">
      {season.affixes.map((id) => {
        const ok = affixReady(id, heroes, supplies, blast)
        return (
          <p key={id} className={ok ? 'banner' : 'banner warn'}>
            <Chip tone={ok ? 'good' : 'warn'}>{t(`affix.${id}`)}</Chip>
            {t(`nest.check.${id}`)}
            <span className="muted"> · {ok ? t('nest.ready') : t('nest.notReady')}</span>
          </p>
        )
      })}
    </div>
  )
}

function affixChips(report: DungeonReport, t: TFunction) {
  if (!report.affixes?.length) {
    return null
  }
  return (
    <>
      {report.affixes.map((id) => (
        <Chip key={id} tone="warn">
          {t(`affix.${id}`)}
        </Chip>
      ))}
    </>
  )
}

function blastChips(report: DungeonReport, t: TFunction) {
  const interrupted = report.log.filter((entry) => entry.key === 'log.interrupt').length
  const blasted = report.log.filter((entry) => entry.key === 'log.blast').length
  if (interrupted === 0 && blasted === 0) {
    return null
  }
  return (
    <>
      {interrupted > 0 ? <Chip tone="good">{t('battle.interrupted', { count: interrupted })}</Chip> : null}
      {blasted > 0 ? <Chip tone="warn">{t('battle.blasted', { count: blasted })}</Chip> : null}
    </>
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
            <TitleAwards awards={report.titlesEarned} names={report.units} />
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
              <SpecialRewardChips report={report} />
              <EliteMonsters report={report} />
              <Chip>{t('result.xp', { xp: report.xp })}</Chip>
              {POTION_IDS.filter((id) => (report.potionsUsed?.[id] ?? 0) > 0).map((id) => (
                <Chip key={id}>{t('battle.usedPotion', { potion: t(`potion.${id}`), count: report.potionsUsed?.[id] ?? 0 })}</Chip>
              ))}
              {affixChips(report, t)}
              {report.traps?.disarmed ? <Chip tone="good">{t('battle.trapsDisarmed', { count: report.traps.disarmed })}</Chip> : null}
              {report.traps?.sprung ? <Chip tone="warn">{t('battle.trapsSprung', { count: report.traps.sprung })}</Chip> : null}
              {blastChips(report, t)}
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
