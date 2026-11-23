import { Clock } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  guideStatus,
  exportSave,
  importSave,
  reduce,
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
import { Inn, Party, Roster } from './game/heroScreens'
import { UiIcon, TownLogo, type ResourceKind } from './game/icons'
import { Bar, Res, Window, needsWarning, useNow, waitLabel } from './game/kit'
import { Absence, ConfirmDepart, Report, Settings, Smith, Town } from './game/villageScreens'
import { loadGame, storeGame } from './storage'
import { registerSW } from 'virtual:pwa-register'
import { isSoundName, play, unlockSound } from './sound'

const VillageView = lazy(() => import('./VillageView').then((mod) => ({ default: mod.VillageView })))

type Screen = 'town' | 'inn' | 'roster' | 'party' | 'smith' | 'result' | 'settings'
type Toast = { id: number; text: string }

const DOCK: { screen: Screen; icon: ReactNode }[] = [
  { screen: 'town', icon: <UiIcon name="town" size={26} /> },
  { screen: 'inn', icon: <UiIcon name="inn" size={26} /> },
  { screen: 'roster', icon: <UiIcon name="roster" size={26} /> },
  { screen: 'party', icon: <UiIcon name="party" size={26} /> },
  { screen: 'smith', icon: <UiIcon name="smith" size={26} /> },
  { screen: 'result', icon: <UiIcon name="result" size={26} /> },
]

// Tapping a building in the village opens the screen that runs it.
const BUILDING_SCREEN: Record<BuildingId, Screen> = {
  hall: 'town',
  inn: 'inn',
  house: 'roster',
  guild: 'party',
  smith: 'smith',
  temple: 'roster',
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
  const [reportUnseen, setReportUnseen] = useState(false)
  const toastId = useRef(0)

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
    if (action.type !== 'catchUp' && next.gold > current.gold) {
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
    if (action.type === 'depart' && !next.notice) {
      setConfirm(null)
      setReportUnseen(false)
      setScreen('result')
      play('open')
    }
  }

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

  const open = (next: Screen) => {
    setScreen(next)
    play('open')
    if (next === 'result') {
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
  const covered = screen != null || save.absence != null || confirm != null
  const badges: Partial<Record<Screen, number | boolean>> = {
    inn: save.visitors.length,
    roster: save.roster.some(needsWarning),
    result: reportUnseen,
  }

  return (
    <div className="game">
      <Suspense fallback={<div className="village-canvas" />}>
        <VillageView
          roster={save.roster}
          visitors={save.visitors}
          partyIds={save.party.map((slot) => slot.id)}
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
          active={!covered}
        />
      </Suspense>

      <Hud save={save} onOpen={open} />
      <GuideCard save={save} onOpen={open} onClaim={() => apply({ type: 'claimGuide' })} />

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
        <Window title={t(`screen.${screen}`)} icon={DOCK.find((item) => item.screen === screen)?.icon ?? <UiIcon name="settings" size={24} />} onClose={() => { play('close'); setScreen(null) }}>
          {screen === 'town' ? <Town save={save} onAction={apply} busy={adBusy} onWatch={() => watchAd('construction')} /> : null}
          {screen === 'inn' ? <Inn save={save} onHire={(id) => apply({ type: 'hire', id, now: gameNow() })} /> : null}
          {screen === 'roster' ? (
            <Roster save={save} selectedId={selectedId} onSelect={setSelectedId} onAction={apply} busy={adBusy} onWatch={() => watchAd('temple')} />
          ) : null}
          {screen === 'party' ? <Party save={save} onAction={apply} /> : null}
          {screen === 'smith' ? <Smith save={save} onAction={apply} /> : null}
          {screen === 'result' ? <Report report={save.report} /> : null}
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
      {confirm ? <ConfirmDepart notice={confirm} onCancel={() => { play('close'); setConfirm(null) }} onConfirm={() => apply({ type: 'depart', confirm: true })} /> : null}

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
