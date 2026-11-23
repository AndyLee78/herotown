# HeroTown

Village-building party RPG with idle auto-expeditions. Design source of truth: `Docs/마을 성장 RPG – 게임 디자인 문서(GDD).md` (Korean). Per-system notes live next to it (`Docs/village.md`, `Docs/dungeons.md`, `Docs/combat.md`, `Docs/classes.md`); update the matching note when a system's behavior changes.

Art direction (GDD 11.7): cute voxel 3D with an isometric orthographic camera, all generated in code with three.js, no image assets. The reference prototype is `prototypes/voxel3d/index.html` (standalone, loads three.js from a CDN, open via `npm run dev` at `/prototypes/voxel3d/index.html`). The game's village renders through `src/ui/voxel/` (`VillageScene.ts` drives it, `world.ts` lays out lots and props, `character.ts` builds heroes, `portrait.ts` renders card portraits, `look.ts` derives appearance from the hero id until genes exist in the core). The result screen replays the battle in 3D: `replay.ts` turns a `DungeonReport` log into steps (pure, tested), `BattleScene.ts` plays them, `enemies.ts` holds one model per monster id. Replays need the `dungeonId`, `party` and `floors` fields plus the `actorId`/`targetId` log params the core writes; when adding a monster to `monsters.json`, add its model to `enemies.ts`. Boxes go through `Builder` in `kit.ts`, which merges them so each moving part is one draw call; keep new art on that path.

The project is developed alternately with Cursor. `Docs/cursor-tasks.md` lists the tasks handed to Cursor and their status; read it (and `git log`) at the start of a session to see what changed. Cursor reads the same rules from `.cursor/rules/simulation-core.mdc`; keep that file in sync when this one changes.

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

## UI

- Game-style shell in `src/ui/App.tsx`: the 3D village fills the screen; `Hud` (town badge, resources, settings) on top, a dock of screens at the bottom, each screen opens in a framed `Window` (bottom sheet on phones). Tapping a building in 3D opens its screen (`BUILDING_SCREEN`).
- Screens live in `src/ui/game/heroScreens.tsx` (inn, heroes, party) and `src/ui/game/villageScreens.tsx` (town, smith, result, settings, absence, depart confirm). Shared parts (`Window`, `Res`, `Chip`, `Bar`, `Portrait`, `CostList`) are in `src/ui/game/kit.tsx`; resource icons in `src/ui/game/icons.tsx`.
- Notices from `reduce` show as toasts; `seenDeath`/`wornParty` show the depart confirm window. Dispatch through `apply` so this keeps working.
- Style tokens are on `:root` in `src/ui/styles.css` (cream paper, wood frame, chunky buttons). Reuse `.btn` (`primary`, `gold`, `danger`, `ad`, `small`, `tiny`), `.card`, `.chip`, `.bar` rather than new one-off styles.
- The first-play guide is a chain of goals in `src/data/guide.json`, evaluated by `src/core/guide.ts` (`guideStatus`, `claimGuide` action) and shown by `GuideCard` in `App.tsx`. New goal types go in `guide.ts` with a test.
- Expeditions take time (`Docs/expedition.md`): `depart` creates an `Expedition` from a party preset and settles it at `returnAt` in catchUp. Battle window: `src/ui/game/battleScreens.tsx`; live panel: `src/ui/ExpeditionPanel.tsx` (seeks the replay to the clock); heroes away walk out through `GATE` in `world.ts` and back in (`VillageScene.syncAway`).
- Retirement: `retire` moves a hero (age ≥ `retirementRules.minAge`) into `state.retirees`; `assignRetiree` posts one retiree per building and `retireeBonus(state, building)` feeds the bonus into build time, visitor potential, fatigue recovery, auto rewards, enhance odds and care time. Numbers in `src/data/retirement.json`.
- Balance tools: `npx vite-node tools/print-curve.ts` (win rate by level per dungeon for ordinary visitors), `tools/tune-curve.ts` (finds each dungeon's `monsterScale` for its target level), `tools/first-hour.ts [minutes]` (plays the opening like a simple player to catch dead ends). Re-run them after changing combat, growth or rewards.
