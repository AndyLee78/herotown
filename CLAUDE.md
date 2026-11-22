# HeroTown

Village-building party RPG with idle auto-expeditions. Design source of truth: `Docs/마을 성장 RPG – 게임 디자인 문서(GDD).md` (Korean). Per-system notes live next to it (`Docs/village.md`, `Docs/dungeons.md`, `Docs/combat.md`, `Docs/classes.md`); update the matching note when a system's behavior changes.

Current stage: stage 1 (MVP) per GDD section 12. Stage 2+ systems (aging curve, marriage, children, alchemy, cloud saves) stay out of scope until their stage.

## Commands

- `npm test` — vitest, all tests must pass
- `npx tsc --noEmit` — typecheck
- `npm run simulate` — prints the balance table (GDD 7.6)
- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build

## Rules

- `src/core` is pure TypeScript. It must not import React, the DOM, `src/ui`, or `src/locales`.
- Balance numbers live in `src/data` JSON. Core code reads those tables and does not hard-code tuning values.
- Every random roll goes through `src/core/rng.ts`. Do not call `Math.random`.
- Player-facing copy uses translation keys in `src/locales/en.json` and `src/locales/ko.json`. Both files keep the same key tree (`src/locales/parity.test.ts` checks this).
- Game changes go through `reduce` in `src/core/game.ts`. Combat stays behind `runDungeon` and is not rewritten for village, time, or save work.
- The clock, offline catch-up, and IndexedDB live outside combat.
- Save format changes bump `SAVE_VERSION` and add a migration in `migrate`.
- Add or update tests with each change; probability systems get seeded simulation tests.
