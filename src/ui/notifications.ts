import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameState } from '../core'
import { upcomingEvents, type UpcomingEvent } from '../core/upcomingEvents'
import { gameNow, subscribeGameClock } from './clock'

const optionKey = 'herotown.notifications'
const deliveredKey = 'herotown.notifications.delivered'

function readEnabled() {
  try { return localStorage.getItem(optionKey) === 'on' } catch { return false }
}

export function useGameNotifications(save: GameState | null) {
  const { t } = useTranslation()
  const supported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator
  const [enabled, setEnabled] = useState(readEnabled)
  const [denied, setDenied] = useState(() => supported && Notification.permission === 'denied')
  const pending = useRef<{ seed: number; events: UpcomingEvent[] } | null>(null)
  const active = useRef(false)
  const delivered = useRef(new Set<string>())
  const preferenceRequest = useRef(0)

  function updateEnabled(next: boolean) {
    active.current = next
    setEnabled(next)
    try { localStorage.setItem(optionKey, next ? 'on' : 'off') } catch { /* Session preference still applies. */ }
  }

  async function toggle(next: boolean) {
    const request = ++preferenceRequest.current
    if (!next) {
      updateEnabled(false)
      return
    }
    if (!supported) return
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (request !== preferenceRequest.current) return
      setDenied(permission !== 'granted')
      updateEnabled(permission === 'granted')
    } catch {
      if (request === preferenceRequest.current) setDenied(true)
    }
  }

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === optionKey || event.key === null) {
        active.current = readEnabled()
        setEnabled(active.current)
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    active.current = enabled
    if (!save || !enabled || !supported || Notification.permission !== 'granted') {
      pending.current = null
      return
    }

    async function notify(event: UpcomingEvent, seed: number) {
      const tag = `herotown:${seed}:${event.kind}:${event.refId}:${event.at}`
      if (delivered.current.has(tag)) return
      delivered.current.add(tag)
      const send = async () => {
        if (!active.current || document.visibilityState !== 'hidden' || Notification.permission !== 'granted') return
        const registration = await navigator.serviceWorker.getRegistration()
        if (!registration?.active || !active.current || document.visibilityState !== 'hidden') return
        let history: string[] = []
        try {
          const saved: unknown = JSON.parse(localStorage.getItem(deliveredKey) ?? '[]')
          if (Array.isArray(saved)) history = saved.filter((key): key is string => typeof key === 'string')
        } catch { /* Use the in-memory keys when storage is unavailable. */ }
        if (history.includes(tag)) return
        await registration.showNotification(t('app.title'), {
          body: t(`notifications.event.${event.kind}`, { building: event.kind === 'build' || event.kind === 'workshop' ? t(`building.${event.refId}`) : '' }),
          tag,
          icon: new URL('icons/icon-192.png', registration.scope).href,
          data: { herotown: true },
        })
        try { localStorage.setItem(deliveredKey, JSON.stringify([...history.slice(-199), tag])) } catch { /* In-memory deduplication remains. */ }
      }
      try {
        if (navigator.locks) await navigator.locks.request(deliveredKey, send)
        else await send()
      } catch { /* System notifications are optional; in-game notices still work. */ }
    }

    let timer: number | undefined
    function check() {
      window.clearTimeout(timer)
      const schedule = pending.current
      if (!schedule) return
      const now = gameNow()
      const due = schedule.events.filter(({ at }) => at <= now)
      schedule.events = schedule.events.filter(({ at }) => at > now)
      if (document.visibilityState === 'hidden') {
        for (const event of due) void notify(event, schedule.seed)
      }
      const next = schedule.events[0]
      if (next) timer = window.setTimeout(check, Math.min(2_147_483_647, Math.max(1, next.at - now)))
    }

    // A catch-up can finish a job before its timer runs in a throttled tab.
    if (pending.current?.seed === save.seed) check()
    pending.current = { seed: save.seed, events: upcomingEvents(save).filter(({ at }) => at > gameNow()) }
    check()
    const unsubscribe = subscribeGameClock(check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
      document.removeEventListener('visibilitychange', check)
    }
  }, [enabled, save, supported, t])

  return { enabled, denied, supported, toggle }
}
