import type { TFunction } from 'i18next'
import { X } from 'lucide-react'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { lifeRules, lowMorale, moraleOf, moraleRules, type GameState, type Gear, type Hero, type LogEntry } from '../../core'
import { gameNow, subscribeGameClock } from '../clock'
import { ResourceIcon, type ResourceKind } from './icons'

const HeroPortrait = lazy(() => import('../VillageView').then((mod) => ({ default: mod.HeroPortrait })))

export function Portrait({ hero, large = false }: { hero: Hero; large?: boolean }) {
  return (
    <span className={large ? 'portrait large' : 'portrait'}>
      <Suspense fallback={null}>
        <HeroPortrait hero={hero} />
      </Suspense>
    </span>
  )
}

export function MoraleBar({ hero }: { hero: Hero }) {
  const { t } = useTranslation()
  const morale = moraleOf(hero)
  const low = lowMorale(hero)
  const high = morale >= moraleRules.high
  return (
    <span className="morale-meter">
      <span className="fatigue">
        <Bar value={morale} max={100} tone={low ? 'bad' : high ? 'good' : 'info'} />
        <span className="muted">{t('morale.value', { value: Math.floor(morale) })}</span>
      </span>
      {low ? <Chip tone="bad">{t('morale.low', { percent: moraleRules.lowPenalty * 100 })}</Chip> : null}
      {high ? <Chip tone="good">{t('morale.high', { percent: moraleRules.highAttack * 100 })}</Chip> : null}
    </span>
  )
}

// A framed game window: wooden title bar, close button, scrolling body.
export function Window({ title, icon, onClose, children, small = false }: { title: string; icon?: ReactNode; onClose?: () => void; children: ReactNode; small?: boolean }) {
  const { t } = useTranslation()
  useEffect(() => {
    if (!onClose) {
      return
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section className={small ? 'window small' : 'window'} role="dialog" aria-modal="true" aria-label={title}>
        <header className="window-head">
          {icon ? <span className="window-icon">{icon}</span> : null}
          <h2>{title}</h2>
          {onClose ? (
            <button type="button" className="close" onClick={onClose} aria-label={t('action.close')}>
              <X size={22} strokeWidth={3} />
            </button>
          ) : null}
        </header>
        <div className="window-body">{children}</div>
      </section>
    </div>
  )
}

export function Res({ kind, amount, short = false, light = false }: { kind: ResourceKind; amount: number | string; short?: boolean; light?: boolean }) {
  return (
    <span className={['res', light ? 'light' : '', short ? 'short' : ''].filter(Boolean).join(' ')}>
      <ResourceIcon kind={kind} size={light ? 18 : 24} />
      <span>{amount}</span>
    </span>
  )
}

type Cost = { gold: number; wood?: number; stone?: number; iron?: number; bone?: number; herb?: number; crystal?: number }

// Lists the non-zero parts of a cost, marking the ones the player lacks.
export function CostList({ cost, save }: { cost: Cost; save: GameState }) {
  const parts: [ResourceKind, number, number][] = [
    ['gold', cost.gold, save.gold],
    ['wood', cost.wood ?? 0, save.materials.wood],
    ['stone', cost.stone ?? 0, save.materials.stone],
    ['iron', cost.iron ?? 0, save.materials.iron],
    ['bone', cost.bone ?? 0, save.materials.bone],
    ['herb', cost.herb ?? 0, save.materials.herb],
    ['crystal', cost.crystal ?? 0, save.materials.crystal],
  ]
  return (
    <span className="cost">
      {parts
        .filter(([, amount]) => amount > 0)
        .map(([kind, amount, have]) => (
          <Res key={kind} kind={kind} amount={amount} short={have < amount} light />
        ))}
    </span>
  )
}

export function affordable(cost: Cost, save: GameState): boolean {
  return (
    save.gold >= cost.gold &&
    save.materials.wood >= (cost.wood ?? 0) &&
    save.materials.stone >= (cost.stone ?? 0) &&
    save.materials.iron >= (cost.iron ?? 0) &&
    save.materials.bone >= (cost.bone ?? 0) &&
    save.materials.herb >= (cost.herb ?? 0) &&
    save.materials.crystal >= (cost.crystal ?? 0)
  )
}

export function Bar({ value, max, tone = 'good' }: { value: number; max: number; tone?: 'good' | 'warn' | 'bad' | 'info' }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <span className={`bar ${tone}`} role="presentation">
      <span style={{ width: `${ratio * 100}%` }} />
    </span>
  )
}

export function Chip({ children, tone }: { children: ReactNode; tone?: 'good' | 'warn' | 'bad' | 'info' }) {
  return <span className={tone ? `chip ${tone}` : 'chip'}>{children}</span>
}

export function useNow(active: boolean): number {
  const [now, setNow] = useState(gameNow())
  useEffect(() => {
    if (!active) {
      return
    }
    const pull = () => setNow(gameNow())
    const timer = window.setInterval(pull, 1000)
    const unsubscribe = subscribeGameClock(pull)
    return () => {
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [active])
  return now
}

export function waitLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

// Same rule as core: only wounds ask before leaving; fatigue just weakens (Docs/fatigue.md).
export function needsWarning(hero: Hero): boolean {
  return hero.condition === 'injured' || hero.condition === 'critical'
}

export function fatigueTone(hero: Hero): 'good' | 'warn' | 'bad' {
  return hero.fatigue >= lifeRules.fatigue.exhaustedAt ? 'bad' : hero.fatigue >= lifeRules.fatigue.tiredAt ? 'warn' : 'good'
}

export function conditionTone(hero: Hero): 'good' | 'warn' | 'bad' | undefined {
  if (hero.condition === 'healthy') return 'good'
  if (hero.condition === 'fatigued') return 'warn'
  return 'bad'
}

export function fatigueText(t: TFunction, hero: Hero): string {
  const penalty =
    hero.fatigue >= lifeRules.fatigue.exhaustedAt
      ? lifeRules.fatigue.exhaustedPenalty
      : hero.fatigue >= lifeRules.fatigue.tiredAt
        ? lifeRules.fatigue.tiredPenalty
        : 0
  const fatigue = Math.round(hero.fatigue)
  return penalty > 0 ? t('hero.fatigueEffect', { fatigue, percent: Math.round(penalty * 100) }) : t('hero.fatigue', { fatigue })
}

export function recoveryText(t: TFunction, hero: Hero, now: number): string | null {
  if (hero.condition !== 'injured' && hero.condition !== 'critical') {
    return null
  }
  const hours = Math.max(0, Math.ceil(((hero.recoverAt ?? now) - now) / 3_600_000))
  return t('hero.recoverIn', { condition: t(`condition.${hero.condition}`), hours })
}

export function itemLabel(t: TFunction, item: Gear, fallback: Hero['classId']): string {
  const owner = item.id.split('.')[0] ?? fallback
  const classes = ['warrior', 'rogue', 'archer', 'mage', 'cleric', 'bard', 'dancer']
  const classId = classes.includes(owner) ? owner : fallback
  const name = item.recipeId === 'starter' ? t(`gear.${classId}.${item.slot}`) : t(`item.${item.recipeId}`)
  const extra = [
    t(`grade.${item.grade}`),
    item.element ? t(`element.${item.element}`) : '',
    item.option ? t(`option.${item.option}`) : '',
    item.enhance > 0 ? `+${item.enhance}` : '',
  ].filter(Boolean)
  return `${name} (${extra.join(', ')})`
}

export function formatEntry(t: TFunction, entry: LogEntry): string {
  const potion = entry.params.potion
  const refs = entry.params.refs
  const summoned =
    typeof refs === 'string' && refs.length > 0
      ? refs
          .split(',')
          .map((id) => t(`enemy.${id.trim()}`))
          .join(', ')
      : ''
  return t(entry.key, {
    ...entry.params,
    actor: labelFrom(t, entry.params, 'actor'),
    target: labelFrom(t, entry.params, 'target'),
    potion: typeof potion === 'string' ? t(`potion.${potion}`) : potion,
    summoned,
  })
}

function labelFrom(t: TFunction, params: LogEntry['params'], prefix: 'actor' | 'target'): string {
  const name = params[`${prefix}Name`]
  if (typeof name === 'string') {
    return name
  }
  const key = params[`${prefix}Key`]
  if (typeof key === 'string') {
    return t('unit.indexed', { name: t(key), index: params[`${prefix}Index`] })
  }
  return ''
}

export function clampPercent(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
}
