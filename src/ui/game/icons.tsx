import type { ReactNode } from 'react'

// Placeholder resource icons drawn as simple flat SVG. Cursor task 8 replaces
// them with the final icon set; keep the names and the 24×24 viewBox.

export type ResourceKind = 'gold' | 'wood' | 'stone' | 'iron' | 'bone' | 'fame'

export function ResourceIcon({ kind, size = 24 }: { kind: ResourceKind; size?: number }) {
  return (
    <svg className="res-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {SHAPES[kind]}
    </svg>
  )
}

const SHAPES: Record<ResourceKind, ReactNode> = {
  gold: (
    <>
      <circle cx="12" cy="12" r="9" fill="#f2c14e" stroke="#b8860b" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="#d9a42a" strokeWidth="2" />
    </>
  ),
  wood: (
    <>
      <rect x="3" y="7" width="16" height="10" rx="3" fill="#a8743f" stroke="#6b4423" strokeWidth="2" />
      <ellipse cx="18" cy="12" rx="3" ry="5" fill="#e0b47a" stroke="#6b4423" strokeWidth="2" />
      <circle cx="18" cy="12" r="1.4" fill="#a8743f" />
    </>
  ),
  stone: <path d="M4 16 7 7l6-3 6 4 1 8-6 4H8z" fill="#a3a6ad" stroke="#5f636b" strokeWidth="2" strokeLinejoin="round" />,
  iron: (
    <>
      <path d="M3 16 6 9h12l3 7z" fill="#8ea3b8" stroke="#4d5f73" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 11h8" stroke="#d5e1ec" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  bone: (
    <path
      d="M7 9a2.5 2.5 0 1 0-3 3 2.5 2.5 0 1 0 3 3l10-6a2.5 2.5 0 1 0 3-3 2.5 2.5 0 1 0-3-3z"
      fill="#f4efe2"
      stroke="#9c9480"
      strokeWidth="1.8"
      strokeLinejoin="round"
      transform="rotate(10 12 12)"
    />
  ),
  fame: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1-4.5-4.2 6.1-.8z" fill="#ffd84d" stroke="#c99a12" strokeWidth="1.8" strokeLinejoin="round" />,
}
