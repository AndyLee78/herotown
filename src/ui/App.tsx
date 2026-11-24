import { Clock } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fountainLevel,
  fountainWishes,
  guideStatus,
  exportSave,
  housingFree,
  importSave,
  reduce,
  residents,
  timeRules,
  townLevel,
  villageRules,
  visitorCap,
  visitorStay,
  type AdPlacement,
  type BuildingId,
  type GameAction,
  type GameNotice,
  type GameState,
} from '../core'
import { rewardedAds } from './ads'
import { addGameOffset, gameNow, offsetSteps, resetGameOffset } from './clock'
import { josa } from './josa'
import { BattleHub } from './game/battleScreens'
import { Inn, Roster } from './game/heroScreens'
import { UiIcon, TownLogo, type ResourceKind } from './game/icons'
import { Bar, Portrait, Res, Window, needsWarning, useNow, waitLabel } from './game/kit'
import { Absence, Alchemy, ComingOfAge, ConfirmDepart, Magic, Settings, Smith, Town, Training, WishButton } from './game/villageScreens'
import { loadGame, storeGame } from './storage'
import { registerSW } from 'virtual:pwa-register'
import { isSoundName, play, unlockSound } from './sound'

const ExpeditionPanel = lazy(() => import('./ExpeditionPanel').then((mod) => ({ default: mod.ExpeditionPanel })))
const VillageView = lazy(() => import('./VillageView').then((mod) => ({ default: mod.VillageView })))

type Screen = 'town' | 'inn' | 'roster' | 'battle' | 'smith' | 'alchemy' | 'magic' | 'training' | 'settings'
type Toast = { id: number; text: string }

const DOCK: { screen: Screen; icon: ReactNode }[] = [
  { screen: 'town', icon: <UiIcon name="town" size={26} /> },
  { screen: 'inn', icon: <UiIcon name="inn" size={26} /> },
  { screen: 'roster', icon: <UiIcon name="roster" size={26} /> },
  { screen: 'battle', icon: <UiIcon name="party" size={26} /> },
  { screen: 'smith', icon: <UiIcon name="smith" size={26} /> },
]

// Tapping a building in the village opens the screen that runs it.
const BUILDING_SCREEN: Record<BuildingId, Screen> = {
  hall: 'town',
  inn: 'inn',
  house: 'roster',
  guild: 'battle',
  smith: 'smith',
  temple: 'roster',
  fountain: 'town',
  alchemy: 'alchemy',
  magic: 'magic',
  training: 'training',
}

const CONFIRM_NOTICES = new Set<GameNotice>(['seenDeath', 'wornParty'])

export function App() {
  const { t, i18n } = useTranslation()
  const [save, setSave] = useState<GameState | null>(null)
  const saveRef = useRef<GameState | null>(null)
  saveRef.current = save
  const [screen, setScreen] = useState<Screen | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fileNotice, setFileNotice] = useState<string | null>(null)
  const [adBusy, setAdBusy] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [updateReady, setUpdateReady] = useState(false)
  const updateSw = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)
  const [confirm, setConfirm] = useState<'seenDeath' | 'wornParty' | null>(null)
  const [proposalLater, setProposalLater] = useState<string[]>([])
  const [reportUnseen, setReportUnseen] = useState(false)
  const toastId = useRef(0)
  const coinId = useRef(0)
  const [coins, setCoins] = useState<{ id: number; amount: number; jackpot: boolean }[]>([])
  const pendingPreset = useRef('p1')
  const lastReturn = useRef<number | null>(null)

  useEffect(() => {
    document.title = t('app.title')
    document.documentElement.lang = i18n.language
  }, [i18n.language, t])

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return
    }
    updateSw.current = registerSW({ onNeedRefresh: () => setUpdateReady(true) })
  }, [])

  useEffect(() => {
    const onPointer = () => unlockSound()
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      const button = target.closest('button')
      if (!(button instanceof HTMLButtonElement) || !button.classList.contains('btn')) {
        return
      }
      const named = button.dataset.sound
      play(named && isSoundName(named) ? named : 'tap')
    }
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('click', onClick)
    }
  }, [])

  const heardAbsence = useRef(save?.absence ?? null)
  useEffect(() => {
    const report = save?.absence ?? null
    if (report && report !== heardAbsence.current) {
      play('open')
      if (report.completed.length > 0 || (report.crafted?.length ?? 0) > 0) {
        play('complete')
      }
    }
    heardAbsence.current = report
  }, [save])

  useEffect(() => {
    const now = gameNow()
    let cancel = false
    void loadGame(now).then((loaded) => {
      if (!cancel) {
        setSave(reduce(loaded, { type: 'catchUp', now }))
      }
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (save) {
      void storeGame(save)
    }
  }, [save])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSave((current) => (current ? reduce(current, { type: 'catchUp', now: gameNow() }) : current))
    }, timeRules.tickMs)
    return () => window.clearInterval(timer)
  }, [])

  // Wake up exactly when the next visitor arrives or leaves.
  useEffect(() => {
    if (!save) {
      return
    }
    const stay = visitorStay(save.buildings.inn)
    const dueTimes = save.visitors.map((hero) => (hero.arrivedAt ?? save.lastTickAt) + stay)
    if (save.visitors.length < visitorCap(save.buildings.inn)) {
      dueTimes.push(save.nextVisitorAt)
    }
    if (dueTimes.length === 0) {
      return
    }
    const due = Math.max(Math.min(...dueTimes), save.lastTickAt + 1)
    const timer = window.setTimeout(() => {
      setSave((current) => (current ? reduce(current, { type: 'catchUp', now: gameNow() }) : current))
    }, Math.max(250, due - gameNow() + 40))
    return () => window.clearTimeout(timer)
  }, [save])

  // Wake up when the next expedition comes home, and tell the player.
  useEffect(() => {
    const next = save?.expeditions.reduce((soon, trip) => Math.min(soon, trip.returnAt), Number.POSITIVE_INFINITY)
    if (next == null || !Number.isFinite(next)) {
      return
    }
    const timer = window.setTimeout(() => {
      setSave((current) => (current ? reduce(current, { type: 'catchUp', now: gameNow() }) : current))
    }, Math.max(250, next - gameNow() + 40))
    return () => window.clearTimeout(timer)
  }, [save?.expeditions])

  const latest = save?.history[0]?.finishedAt ?? null
  useEffect(() => {
    if (latest == null) {
      return
    }
    if (lastReturn.current != null && latest > lastReturn.current) {
      const report = saveRef.current?.history[0]
      setReportUnseen(true)
      if (report?.dungeonId) {
        play('return')
        play(report.victory ? 'victory' : 'defeat')
        pushToast(t(report.victory ? 'battle.returnedWin' : 'battle.returnedLose', { dungeon: t(`dungeon.${report.dungeonId}.name`) }))
      }
    }
    lastReturn.current = latest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest])

  const pushToast = (text: string) => {
    play('notice')
    const id = (toastId.current += 1)
    setToasts((list) => [...list.slice(-2), { id, text }])
    window.setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), 3500)
  }

  const apply = (action: GameAction) => {
    const current = saveRef.current
    if (!current) {
      return
    }
    const beforeLevel = townLevel(current.fame).level
    const next = reduce(current, action)
    saveRef.current = next
    setSave(next)
    if (action.type !== 'catchUp' && action.type !== 'wish' && next.gold > current.gold) {
      play('coin')
    }
    if (action.type === 'hire' && next.roster.length > current.roster.length) {
      play('coin')
    }
    if (action.type === 'build' && next.construction && !current.construction) {
      play('build')
    }
    if (townLevel(next.fame).level > beforeLevel) {
      play('levelUp')
    }
    if (next.notice && CONFIRM_NOTICES.has(next.notice)) {
      setConfirm(next.notice as 'seenDeath' | 'wornParty')
      play('open')
    } else if (next.notice) {
      pushToast(t(`result.${next.notice}`))
    }
    if (action.type === 'claimGuide' && next !== current && !guideStatus(next).step) {
      pushToast(t('guide.done'))
    }
    if (action.type === 'depart' && next.expeditions.length > current.expeditions.length) {
      setConfirm(null)
      setScreen(null)
      play('depart')
      pushToast(t('battle.departed', { dungeon: t(`dungeon.${next.dungeonId}.name`) }))
    }
    if (action.type === 'wish' && next.gold > current.gold) {
      const gained = next.gold - current.gold
      const jackpot = next.fountain.last?.jackpot ?? false
      play(jackpot ? 'jackpot' : 'wish')
      const id = (coinId.current += 1)
      setCoins((list) => [...list.slice(-2), { id, amount: gained, jackpot }])
      window.setTimeout(() => setCoins((list) => list.filter((coin) => coin.id !== id)), 900)
      if (jackpot) {
        pushToast(t('fountain.jackpot', { gold: gained }))
      }
    }
    if (action.type === 'acceptProposal') {
      const pair = residents(next)
      const first = pair.find((hero) => hero.id === action.a)
      const second = pair.find((hero) => hero.id === action.b)
      if (first?.spouseId === action.b && second) {
        pushToast(t('family.married', { a: first.name, b: second.name }))
      }
    }
  }

  const birthMark = useRef<string | null>(null)
  const born = save?.absence?.births ?? []
  const bornKey = born.length > 0 ? `${save?.lastTickAt ?? 0}|${born.join(',')}` : ''
  useEffect(() => {
    if (!save) {
      return
    }
    if (birthMark.current === null) {
      birthMark.current = bornKey
      return
    }
    if (bornKey && bornKey !== birthMark.current) {
      pushToast(t('family.born', { names: born.join(', ') }))
    }
    birthMark.current = bornKey
    // The toast follows a new absence report. pushToast changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bornKey])

  const deathMark = useRef<string | null>(null)
  const dead = save?.absence?.deaths ?? []
  const deathKey = dead.length > 0 ? `${save?.lastTickAt ?? 0}|${dead.join(',')}` : ''
  useEffect(() => {
    if (!save) {
      return
    }
    if (deathMark.current === null) {
      deathMark.current = deathKey
      return
    }
    if (deathKey && deathKey !== deathMark.current) {
      const graves = [...save.graveyard].reverse()
      const korean = i18n.language.startsWith('ko')
      for (const name of dead) {
        const age = graves.find((grave) => grave.name === name)?.age
        pushToast(t('family.passed', { name: korean ? josa(name, '이') : name, age: age ?? '?' }))
      }
    }
    deathMark.current = deathKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deathKey])

  const jumpClock = (ms: number) => {
    const base = gameNow()
    addGameOffset(ms)
    setSave((current) => {
      if (!current) {
        return current
      }
      let next = current
      let cursor = base
      for (const step of offsetSteps(ms, timeRules.maxOfflineMs)) {
        cursor += step
        next = reduce(next, { type: 'catchUp', now: cursor })
      }
      return next
    })
  }

  const resetClock = () => {
    resetGameOffset()
    setSave((current) => (current ? reduce(current, { type: 'catchUp', now: gameNow() }) : current))
  }

  const watchAd = (placement: AdPlacement) => {
    if (adBusy) {
      return
    }
    setAdBusy(true)
    void rewardedAds.showRewarded(placement).then((result) => {
      setAdBusy(false)
      if (result === 'rewarded') {
        apply({ type: 'adReward', placement, now: gameNow() })
      }
    })
  }

  // The confirm window re-sends the same preset if the player goes anyway.
  const depart = (presetId: string) => {
    pendingPreset.current = presetId
    apply({ type: 'depart', presetId, now: gameNow() })
  }

  const open = (next: Screen) => {
    setScreen(next)
    play('open')
    if (next === 'battle') {
      setReportUnseen(false)
    }
  }

  if (!save) {
    return (
      <div className="loading">
        <TownLogo />
      </div>
    )
  }

  const buildingLabels = Object.fromEntries(villageRules.buildings.map((building) => [building.id, t(`building.${building.id}`)])) as Record<BuildingId, string>
  // The coming-of-age welcome waits until the absence report is closed.
  const welcoming = save.absence == null && confirm == null && (save.comingOfAge ?? []).length > 0
  const covered = screen != null || save.absence != null || confirm != null || welcoming
  const away = new Set(save.expeditions.flatMap((expedition) => expedition.heroIds))
  if (save.scout) {
    away.add(save.scout.heroId)
  }
  const badges: Partial<Record<Screen, number | boolean>> = {
    inn: save.visitors.length,
    roster: save.roster.some((hero) => needsWarning(hero) || hero.skillPoints > 0),
    battle: reportUnseen || save.expeditions.length > 0,
  }

  return (
    <div className="game">
      <Suspense fallback={<div className="village-canvas" />}>
        <VillageView
          roster={save.roster}
          awayIds={[...away]}
          retirees={save.retirees.map((retiree) => retiree.hero)}
          visitors={save.visitors}
          partyIds={(save.presets.find((preset) => preset.id === save.presetId)?.slots ?? []).map((slot) => slot.id)}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            open('roster')
          }}
          onPickBuilding={(id) => open(BUILDING_SCREEN[id])}
          villageLabel={t('label.village')}
          buildings={save.buildings}
          constructing={save.construction?.id ?? null}
          buildingLabels={buildingLabels}
          expeditions={save.expeditions.length}
          graves={save.graveyard}
          wishes={fountainWishes(save, gameNow())}
          wishCap={fountainLevel(save.buildings.fountain).cap}
          wishAt={save.fountain.last?.at ?? null}
          wishJackpot={save.fountain.last?.jackpot ?? false}
          onWish={() => apply({ type: 'wish', now: gameNow() })}
          active={!covered}
        />
      </Suspense>

      <Hud save={save} onOpen={open} />
      <div className="corner-cards">
        <GuideCard save={save} onOpen={open} onClaim={() => apply({ type: 'claimGuide' })} />
        <ProposalCards
          save={save}
          later={proposalLater}
          onLater={(key) => setProposalLater((keys) => (keys.includes(key) ? keys : [...keys, key]))}
          onAction={apply}
        />
      </div>

      {save.expeditions.length > 0 ? (
        <Suspense fallback={null}>
          <ExpeditionPanel save={save} />
        </Suspense>
      ) : null}

      <WishButton save={save} coins={coins} onWish={() => apply({ type: 'wish', now: gameNow() })} />

      <nav className="dock" aria-label={t('label.village')}>
        {DOCK.map((item) => {
          const badge = badges[item.screen]
          return (
            <button key={item.screen} type="button" aria-pressed={screen === item.screen} onClick={() => { play('tap'); open(item.screen) }}>
              {item.icon}
              <span>{t(`screen.${item.screen}`)}</span>
              {typeof badge === 'number' && badge > 0 ? <span className="badge">{badge}</span> : badge === true ? <span className="badge dot" /> : null}
            </button>
          )
        })}
      </nav>

      {screen ? (
        <Window
          title={t(`screen.${screen}`)}
          icon={
            screen === 'alchemy' ? <UiIcon name="alchemy" size={24} /> : screen === 'magic' ? <UiIcon name="magic" size={24} /> : screen === 'training' ? <UiIcon name="roster" size={24} /> : DOCK.find((item) => item.screen === screen)?.icon ?? <UiIcon name="settings" size={24} />
          }
          onClose={() => { play('close'); setScreen(null) }}
        >
          {screen === 'town' ? (
            <Town save={save} onAction={apply} busy={adBusy} onWatch={() => watchAd('construction')} onAlchemy={() => open('alchemy')} onMagic={() => open('magic')} onTraining={() => open('training')} onSelectHero={(id) => { setSelectedId(id); open('roster') }} />
          ) : null}
          {screen === 'inn' ? <Inn save={save} onHire={(id) => apply({ type: 'hire', id, now: gameNow() })} /> : null}
          {screen === 'roster' ? (
            <Roster save={save} selectedId={selectedId} onSelect={setSelectedId} onAction={apply} busy={adBusy} onWatch={() => watchAd('temple')} />
          ) : null}
          {screen === 'battle' ? <BattleHub save={save} onAction={apply} onDepart={depart} /> : null}
          {screen === 'smith' ? <Smith save={save} onAction={apply} /> : null}
          {screen === 'alchemy' ? <Alchemy save={save} onAction={apply} /> : null}
          {screen === 'magic' ? <Magic save={save} onAction={apply} /> : null}
          {screen === 'training' ? <Training save={save} onAction={apply} /> : null}
          {screen === 'settings' ? (
            <Settings
              save={save}
              notice={fileNotice}
              onLanguage={(lng) => {
                void i18n.changeLanguage(lng)
                localStorage.setItem('locale', lng)
              }}
              onExport={() => downloadSave(exportSave(save))}
              onImport={(text) => {
                try {
                  setSave(importSave(text, gameNow()))
                  setFileNotice(null)
                } catch (error) {
                  setFileNotice(t(`result.${error instanceof Error ? error.message : 'checksum'}`))
                }
              }}
              onAction={apply}
              onJump={jumpClock}
              onResetClock={resetClock}
            />
          ) : null}
        </Window>
      ) : null}

      {save.absence ? <Absence save={save} busy={adBusy} onWatch={() => watchAd('absence')} onClose={() => { play('close'); apply({ type: 'dismissAbsence' }) }} /> : null}
      {welcoming ? (
        <ComingOfAge
          save={save}
          onView={(id) => { apply({ type: 'seenAdults' }); setSelectedId(id); open('roster') }}
          onClose={() => { play('close'); apply({ type: 'seenAdults' }) }}
        />
      ) : null}
      {confirm ? <ConfirmDepart notice={confirm} onCancel={() => { play('close'); setConfirm(null) }} onConfirm={() => apply({ type: 'depart', presetId: pendingPreset.current, confirm: true, now: gameNow() })} /> : null}

      <div className="toasts" aria-live="polite">
        {updateReady ? (
          <div className="toast update">
            <span>{t('app.update')}</span>
            <button type="button" className="btn tiny" onClick={() => void updateSw.current?.(true)}>
              {t('app.reload')}
            </button>
          </div>
        ) : null}
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  )
}

function Hud({ save, onOpen }: { save: GameState; onOpen: (screen: Screen) => void }) {
  const { t } = useTranslation()
  const level = townLevel(save.fame)
  const next = villageRules.levels.find((entry) => entry.level === level.level + 1)
  const now = useNow(save.construction != null)
  return (
    <header className="hud">
      <button type="button" className="town-badge" onClick={() => onOpen('town')}>
        <span className="town-level">{level.level}</span>
        <span className="town-info">
          <strong>{t('app.title')}</strong>
          <span className="muted">{t('app.calendar', { year: save.calendar.year, season: t(`season.${save.calendar.season}`) })}</span>
          <span className="fame">
            <Bar value={save.fame} max={next?.fame ?? save.fame} tone="warn" />
            <Res kind="fame" amount={next ? `${save.fame}/${next.fame}` : save.fame} light />
          </span>
        </span>
      </button>
      <div className="resources">
        <Res kind="gold" amount={save.gold} />
        <Res kind="wood" amount={save.materials.wood} />
        <Res kind="stone" amount={save.materials.stone} />
        <Res kind="iron" amount={save.materials.iron} />
        <Res kind="bone" amount={save.materials.bone} />
        <Res kind="herb" amount={save.materials.herb} />
        <Res kind="crystal" amount={save.materials.crystal} />
        {save.warning ? <span className="res alert">{t('ui.wagesShort')}</span> : null}
        {save.construction ? (
          <button type="button" className="res timer" onClick={() => onOpen('town')}>
            <Clock size={18} />
            {t(`building.${save.construction.id}`)} {waitLabel(save.construction.finishAt - now)}
          </button>
        ) : null}
      </div>
      <button type="button" className="icon-btn" aria-label={t('screen.settings')} onClick={() => onOpen('settings')}>
        <UiIcon name="settings" size={24} />
      </button>
    </header>
  )
}

function downloadSave(contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'herotown-save.json'
  link.click()
  URL.revokeObjectURL(url)
}

// The first-play guide: current goal, progress and reward under the HUD.
// Tapping it opens the screen where the goal is done.
function GuideCard({ save, onOpen, onClaim }: { save: GameState; onOpen: (screen: Screen) => void; onClaim: () => void }) {
  const { t } = useTranslation()
  const status = guideStatus(save)
  const step = status.step
  if (!step) {
    return null
  }
  const rewards = Object.entries(step.reward) as [ResourceKind, number][]
  return (
    <aside className={status.done ? 'guide done' : 'guide'} aria-live="polite">
      <button type="button" className="guide-body" onClick={() => onOpen(step.screen)}>
        <span className="guide-tag">{t('guide.title', { index: status.index + 1, total: status.total })}</span>
        <strong>{t(`guide.step.${step.id}`)}</strong>
        <span className="guide-progress">
          <Bar value={status.current} max={status.target} tone={status.done ? 'good' : 'info'} />
          <span>
            {status.current}/{status.target}
          </span>
        </span>
      </button>
      <span className="guide-reward">
        {rewards.map(([kind, amount]) => (
          <Res key={kind} kind={kind} amount={`+${amount}`} light />
        ))}
        {status.done ? (
          <button type="button" className="btn gold small" onClick={onClaim}>
            {t('guide.claim')}
          </button>
        ) : null}
      </span>
    </aside>
  )
}

function ProposalCards({
  save,
  later,
  onLater,
  onAction,
}: {
  save: GameState
  later: string[]
  onLater: (key: string) => void
  onAction: (action: GameAction) => void
}) {
  const { t } = useTranslation()
  const people = residents(save)
  const free = housingFree(save)
  const open = (save.proposals ?? []).filter((proposal) => !later.includes(`${proposal.a}|${proposal.b}`))
  if (open.length === 0) {
    return null
  }
  return (
    <>
      {open.map((proposal) => {
        const first = people.find((hero) => hero.id === proposal.a)
        const second = people.find((hero) => hero.id === proposal.b)
        if (!first || !second) {
          return null
        }
        const key = `${proposal.a}|${proposal.b}`
        return (
          <aside key={key} className="proposal">
            <strong>{t('family.propose')}</strong>
            <div className="proposal-people">
              <span>
                <Portrait hero={first} />
                {first.name}
              </span>
              <span>
                <Portrait hero={second} />
                {second.name}
              </span>
            </div>
            <p>{t('family.proposeText', { a: first.name, b: second.name })}</p>
            {free === 0 ? <p className="muted">{t('family.needHouse')}</p> : null}
            <div className="actions">
              <button type="button" className="btn primary small" disabled={free === 0} onClick={() => onAction({ type: 'acceptProposal', a: proposal.a, b: proposal.b, now: gameNow() })}>
                {t('family.accept')}
              </button>
              <button type="button" className="btn small" onClick={() => onLater(key)}>
                {t('family.later')}
              </button>
              <button type="button" className="btn small danger" onClick={() => onAction({ type: 'declineProposal', a: proposal.a, b: proposal.b, now: gameNow() })}>
                {t('family.decline')}
              </button>
            </div>
          </aside>
        )
      })}
    </>
  )
}
