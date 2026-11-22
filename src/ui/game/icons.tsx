import type { ReactNode } from 'react'

// Cute block icons: thick outline, two or three tones, readable at 16px.
// ResourceIcon keeps the 24×24 viewBox and the kind names.

const ink = '#5c3b22'

export type ResourceKind = 'gold' | 'wood' | 'stone' | 'iron' | 'bone' | 'fame'
export type UiIconName = 'town' | 'inn' | 'roster' | 'party' | 'smith' | 'result' | 'settings'

export function ResourceIcon({ kind, size = 24 }: { kind: ResourceKind; size?: number }) {
  return (
    <svg className="res-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {SHAPES[kind]}
    </svg>
  )
}

export function UiIcon({ name, size = 24 }: { name: UiIconName; size?: number }) {
  return (
    <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {UI[name]}
    </svg>
  )
}

export const RESOURCE_KINDS: ResourceKind[] = ['gold', 'wood', 'stone', 'iron', 'bone', 'fame']
export const UI_ICONS: UiIconName[] = ['town', 'inn', 'roster', 'party', 'smith', 'result', 'settings']

export function IconSheet() {
  return (
    <div className="icon-sheet">
      {RESOURCE_KINDS.map((kind) => (
        <span key={kind}>
          <ResourceIcon kind={kind} size={24} />
          <ResourceIcon kind={kind} size={16} />
        </span>
      ))}
      {UI_ICONS.map((name) => (
        <span key={name}>
          <UiIcon name={name} size={24} />
          <UiIcon name={name} size={16} />
        </span>
      ))}
    </div>
  )
}

// Shield emblem shared with public/favicon.svg. The wordmark is only on the loading screen.
export function TownLogo() {
  return (
    <svg className="town-logo" viewBox="0 0 340 84" role="img" aria-label="영웅의 마을">
      <Shield x={2} y={4} />
      <text x="88" y="54" fill="#66421f" fontFamily="Jua, Pretendard, sans-serif" fontSize="36">
        영웅의 마을
      </text>
    </svg>
  )
}

function Shield({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M36 2 66 14v22c0 16-12 28-30 34C18 64 6 52 6 36V14Z" fill="#3f8a2c" />
      <path d="M36 6 62 16.5v19c0 14-11 25-26 30.5C21 60.5 10 49.5 10 35.5v-19Z" fill="#62b347" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M36 12 54 20v12c0 8-7 15-18 19-11-4-18-11-18-19V20Z" fill="#8ed56a" />
      <polygon points="22,38 36,26 50,38" fill="#e0584f" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="26" y="38" width="20" height="16" fill="#fff4dc" stroke={ink} strokeWidth="2" />
      <rect x="33" y="44" width="6" height="10" fill="#8a5a32" />
    </g>
  )
}

const SHAPES: Record<ResourceKind, ReactNode> = {
  gold: (
    <>
      <ellipse cx="12" cy="16.2" rx="7.2" ry="3" fill="#c48a12" stroke={ink} strokeWidth="1.5" />
      <ellipse cx="12" cy="14.4" rx="7.2" ry="3" fill="#f4bd3a" stroke={ink} strokeWidth="1.5" />
      <ellipse cx="12" cy="10.2" rx="7.2" ry="3" fill="#c48a12" stroke={ink} strokeWidth="1.5" />
      <ellipse cx="12" cy="8.2" rx="7.2" ry="3" fill="#ffe7a3" stroke={ink} strokeWidth="1.5" />
      <ellipse cx="12" cy="8.2" rx="3" ry="1.2" fill="none" stroke="#c48a12" strokeWidth="1.2" />
    </>
  ),
  wood: (
    <>
      <rect x="3" y="5" width="13" height="5.2" rx="2" fill="#a56b38" stroke={ink} strokeWidth="1.5" />
      <ellipse cx="16" cy="7.6" rx="2.6" ry="2.6" fill="#f0d2a4" stroke={ink} strokeWidth="1.5" />
      <circle cx="16" cy="7.6" r="1" fill="#c4894a" />
      <rect x="5" y="10.4" width="13" height="5.2" rx="2" fill="#c4894a" stroke={ink} strokeWidth="1.5" />
      <ellipse cx="18" cy="13" rx="2.6" ry="2.6" fill="#ffe4bf" stroke={ink} strokeWidth="1.5" />
      <circle cx="18" cy="13" r="1" fill="#a56b38" />
      <rect x="3" y="15.6" width="13" height="4.6" rx="2" fill="#8a552c" stroke={ink} strokeWidth="1.5" />
    </>
  ),
  stone: (
    <>
      <rect x="3" y="12" width="8" height="8" rx="1.4" fill="#8d929a" stroke={ink} strokeWidth="1.5" />
      <rect x="4" y="13" width="4" height="2" fill="#c5c8ce" />
      <rect x="9" y="8" width="9" height="9" rx="1.4" fill="#b7bcc4" stroke={ink} strokeWidth="1.5" />
      <rect x="10.2" y="9.2" width="4.5" height="2.2" fill="#e6e8ec" />
      <rect x="13" y="14" width="8" height="7" rx="1.4" fill="#9aa0a8" stroke={ink} strokeWidth="1.5" />
    </>
  ),
  iron: (
    <>
      <path d="M3 16.5 6.5 9h11L21 16.5Z" fill="#7f97ad" stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.2 10.2h11.6l-1.5-2.4H7.7Z" fill="#d7e6f2" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7 12.4h10" stroke="#f4fbff" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  bone: (
    <g transform="rotate(-28 12 12)">
      <rect x="7" y="10" width="10" height="4" rx="1" fill="#f4efe4" stroke={ink} strokeWidth="1.5" />
      <circle cx="7.2" cy="10" r="2.3" fill="#fffaf3" stroke={ink} strokeWidth="1.5" />
      <circle cx="7.2" cy="14" r="2.3" fill="#e7dfd0" stroke={ink} strokeWidth="1.5" />
      <circle cx="16.8" cy="10" r="2.3" fill="#fffaf3" stroke={ink} strokeWidth="1.5" />
      <circle cx="16.8" cy="14" r="2.3" fill="#e7dfd0" stroke={ink} strokeWidth="1.5" />
    </g>
  ),
  fame: (
    <>
      <path d="m12 2.2 2.4 5.2 5.7.7-4.2 3.9 1.1 5.6L12 15.2 6.9 17.6 8 12 3.8 8.1l5.7-.7Z" fill="#f4bd3a" stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m12 6.2 1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 12.4 9.5 13.8l.6-2.8-2.1-1.9 2.8-.3Z" fill="#fff1b0" />
    </>
  ),
}

const UI: Record<UiIconName, ReactNode> = {
  town: (
    <>
      <polygon points="2.5,13 9,6.5 15.5,13" fill="#e0584f" stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="4" y="12.5" width="10" height="8" rx="1" fill="#fff4dc" stroke={ink} strokeWidth="1.5" />
      <rect x="7.4" y="15.2" width="3.2" height="5.3" fill="#8a5a32" />
      <rect x="13.5" y="3.2" width="8" height="3.2" rx="0.6" fill="#d5dee8" stroke={ink} strokeWidth="1.4" />
      <rect x="16.2" y="5.6" width="2.4" height="9.2" rx="0.5" fill="#c4894a" stroke={ink} strokeWidth="1.4" />
    </>
  ),
  inn: (
    <>
      <rect x="5.5" y="7" width="9" height="12" rx="2" fill="#f6e2a8" stroke={ink} strokeWidth="1.5" />
      <path d="M14.5 9.2h2.2a2.8 2.8 0 0 1 0 5.6H14.5" fill="none" stroke={ink} strokeWidth="1.6" />
      <ellipse cx="10" cy="7" rx="4.6" ry="2.1" fill="#fff" stroke={ink} strokeWidth="1.5" />
      <rect x="7.2" y="11.4" width="5.4" height="2" rx="0.4" fill="#e7b84a" />
    </>
  ),
  roster: (
    <>
      <circle cx="12" cy="13.2" r="6.4" fill="#f3c7a0" stroke={ink} strokeWidth="1.5" />
      <path d="M5.8 12.4a6.4 6.4 0 0 1 12.4 0v1.2H5.8Z" fill="#8f6ad9" stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="10.6" y="3.4" width="2.8" height="3" rx="0.4" fill="#ffe56a" stroke={ink} strokeWidth="1.3" />
      <rect x="8" y="13.2" width="8" height="2.1" rx="0.4" fill="#3b2a1e" />
      <circle cx="9.6" cy="16.6" r="0.7" fill="#5c3b22" />
      <circle cx="14.4" cy="16.6" r="0.7" fill="#5c3b22" />
    </>
  ),
  party: (
    <>
      <g transform="rotate(42 12 12)">
        <rect x="10.9" y="2.4" width="2.2" height="13" rx="0.4" fill="#d7e6f2" stroke={ink} strokeWidth="1.2" />
        <rect x="8.4" y="14" width="7.2" height="2" rx="0.4" fill="#c4894a" stroke={ink} strokeWidth="1.2" />
        <rect x="10.9" y="16" width="2.2" height="3.2" fill="#8a5a32" stroke={ink} strokeWidth="1.2" />
      </g>
      <g transform="rotate(-42 12 12)">
        <rect x="10.9" y="2.4" width="2.2" height="13" rx="0.4" fill="#fff" stroke={ink} strokeWidth="1.2" />
        <rect x="8.4" y="14" width="7.2" height="2" rx="0.4" fill="#e0b47a" stroke={ink} strokeWidth="1.2" />
        <rect x="10.9" y="16" width="2.2" height="3.2" fill="#a56b38" stroke={ink} strokeWidth="1.2" />
      </g>
    </>
  ),
  smith: (
    <>
      <path d="M2.5 9.5h19l-1.6 4.2H4.1Z" fill="#8ea3b8" stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="4" y="9.8" width="9" height="1.5" fill="#e7eef5" />
      <rect x="8" y="13.4" width="8" height="3" fill="#6d8298" stroke={ink} strokeWidth="1.4" />
      <rect x="4.5" y="16.2" width="15" height="3.4" rx="0.8" fill="#b7c6d4" stroke={ink} strokeWidth="1.5" />
    </>
  ),
  result: (
    <>
      <rect x="7" y="3.5" width="10" height="17" rx="1" fill="#fff6df" stroke={ink} strokeWidth="1.5" />
      <rect x="4" y="3.5" width="4.2" height="17" rx="2" fill="#f0d7a4" stroke={ink} strokeWidth="1.5" />
      <rect x="15.8" y="3.5" width="4.2" height="17" rx="2" fill="#e2c48a" stroke={ink} strokeWidth="1.5" />
      <rect x="9" y="7.2" width="6" height="1.4" rx="0.4" fill="#c4a574" />
      <rect x="9" y="10.2" width="6" height="1.4" rx="0.4" fill="#c4a574" />
      <rect x="9" y="13.2" width="4" height="1.4" rx="0.4" fill="#c4a574" />
    </>
  ),
  settings: (
    <>
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <rect
          key={angle}
          x="10.3"
          y="1.5"
          width="3.4"
          height="6.4"
          rx="0.7"
          fill="#f6c453"
          stroke={ink}
          strokeWidth="1.2"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="4.4" fill="#ffe08a" stroke={ink} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.8" fill="#fff8ec" stroke={ink} strokeWidth="1.3" />
    </>
  ),
}
