# 작업 보드

Claude Code, Cursor, GPT(Codex)가 함께 쓰는 작업 목록이다. 작업 하나씩 "전달할 내용"을 담당 도구에 붙여 넣는다. 모든 도구의 공통 규칙은 저장소 루트의 `AGENTS.md`에 있다(Claude Code는 `CLAUDE.md`로, Cursor는 `.cursor/rules/simulation-core.mdc` 사본으로 읽는다).

## 함께 일하는 규칙

**도구별 역할**

| 도구 | 맡기 좋은 일 | 읽는 규칙 |
| --- | --- | --- |
| Claude Code | 코어·세이브·3D를 함께 바꾸는 큰 설계 (단계 2 세대 시스템 등), 흐름·밸런스 조정 | `CLAUDE.md` → `AGENTS.md` |
| Cursor | 범위가 분명한 기능, 그림·소리·연출 | `.cursor/rules/simulation-core.mdc` (`AGENTS.md` 사본) |
| GPT (Codex) | 코드 리뷰, 영어 문구, 테스트 보강, 다른 작업과 파일이 겹치지 않는 작은 기능 | `AGENTS.md` |

**규칙**

1. **작업마다 담당은 하나.** 아래 표의 "담당" 칸에 적힌 도구만 그 작업을 한다.
2. **"건드리는 파일" 칸을 지킨다.** 두 작업의 파일이 겹치면 동시에 진행하지 않는다. `src/core`, `src/data`, 세이브 형식(`SAVE_VERSION`)은 한 번에 한 작업만 건드린다.
3. **동시에 돌릴 때는 폴더를 나눈다.** 같은 폴더에서는 한 번에 한 도구만 작업한다. 둘 이상을 동시에 돌리려면 git worktree로 작업 폴더를 따로 만든다.
   - 만들기: `git worktree add ../HeroTown-gpt -b agent/gpt-15`
   - 끝나면: 그 폴더에서 커밋 → 원래 폴더에서 `git merge agent/gpt-15` → `git worktree remove ../HeroTown-gpt`
4. **시작 전 `git status`.** 내가 만들지 않은 미커밋 변경이 있으면 시작하지 말고 사용자에게 알린다(다른 도구가 작업 중이라는 뜻).
5. **끝낼 때:** `npx tsc --noEmit`, `npm test`, `npm run build` 통과 → 커밋 하나 → 표의 상태를 "완료 (커밋 해시)"로 → 메모 2–3줄.
6. **리뷰는 고치지 않고 적는다.** 다른 도구의 커밋을 리뷰할 때는 코드를 바꾸지 않고 `Docs/reviews/<커밋 해시>.md`에 발견한 점(심각도, 파일:줄, 재현 방법, 제안)을 적는다. 고칠지는 사용자가 정해서 새 작업으로 만든다.
7. **규칙 파일은 `AGENTS.md`만 고친다.** 고친 뒤 `npm run sync:rules`(Cursor 사본 갱신). 사본이 다르면 테스트가 실패한다.

## 모든 작업 공통 (담당 도구에 매번 함께 전달)

```
- AGENTS.md를 따른다. 시작 전에 Docs/tasks.md의 "함께 일하는 규칙"과 이 작업 항목, 관련 GDD 절과 Docs/*.md를 읽는다.
- 시작 전에 git status를 확인한다. 내가 만들지 않은 미커밋 변경이 있으면 멈추고 알린다.
- 이 작업의 "건드리는 파일" 밖은 고치지 않는다. 지시에 없는 리팩터링, 파일 이동, 의존성 추가는 하지 않는다.
- 끝나면 npx tsc --noEmit, npm test, npm run build가 모두 통과해야 한다.
- 화면이 바뀌는 작업은 npm run dev로 띄워 직접 확인한다. 확인하지 못한 부분은 숨기지 말고 적는다.
- 작업 하나 = 커밋 하나. 커밋 메시지는 영어로 무엇을 왜 바꿨는지 적는다.
- 끝나면 Docs/tasks.md의 해당 행 상태를 "완료 (커밋 해시)"로 바꾸고, 결정한 것·남긴 것을 그 작업의 "메모"에 2–3줄 적는다.
```

## 진행 상태

| # | 작업 | 담당 | 건드리는 파일 | 상태 |
| --- | --- | --- | --- | --- |
| 1 | 영어 이름 뒤 한국어 조사 | Cursor | `src/ui/josa.ts` | 완료 (562bf8d) |
| 2 | 시간 가속 디버그 도구 | Cursor | `src/ui/clock.ts`, `App.tsx` | 완료 (09072ee) |
| 3 | three.js 코드 분할 | Cursor | `vite.config.ts`, `App.tsx` | 완료 (185056d) |
| 4 | 폰 화면 폭 점검 | Cursor | `styles.css` | 완료 (5c42085) |
| 5 | 패배 원인 "파티가 아직 약하다" | Cursor | `src/core/dungeon.ts`, `dungeons.json` | 완료 (ed9290d) |
| 6 | 보상형 광고 인터페이스 + 가짜 광고 | Cursor | `src/ui/ads.ts`, `src/core/game.ts` | 완료 (a5dedef) |
| 7 | 피로·부상 효과와 자연 회복 | Cursor | `src/core/*`, `life.json` | 완료 (f418308) |
| 8 | 게임 UI 아이콘·폰트·로고 아트 | Cursor | `src/ui/game/icons.tsx`, `public/` | 완료 (87e8984) |
| 9 | PWA·오프라인 실행·업데이트 알림 | Cursor | `vite.config.ts`, `public/` | 완료 (3c3c45c) |
| 10 | 효과음 (코드 합성) + 음량 설정 | Cursor | `src/ui/sound.ts`, `App.tsx` | 완료 (c657c25) |
| 11 | 해가 바뀌면 나이 먹기 | Cursor | `src/core/game.ts` | 완료 (551fb7e) |
| 12 | GitHub Pages 배포 | Cursor 또는 GPT | `vite.config.ts`, `.github/workflows/` | 완료 (Claude Code, 저장소 AndyLee78/herotown) |
| 13 | 원정 화면 그림·소리 다듬기 | Cursor | `src/ui/voxel/*`, `battleScreens.tsx` | 완료 (03806a1) |
| 14 | 던전 미리보기를 배경 일러스트처럼 | Cursor | `src/ui/voxel/portrait.ts` | 완료 (1dce191) |
| 15 | 영어 문구 다듬기 | GPT | `src/locales/en.json` | 완료 (e6754c1) |
| 16 | 초반 흐름 개편 코드 리뷰 (a1dd951) | GPT | `Docs/reviews/a1dd951.md` (새 파일만) | 완료 (5759763) |
| 17 | 리뷰 a1dd951의 버그 두 개 수정 | GPT | `src/core/game.ts`, `src/core/flow.test.ts` | 완료 (6d79ef3) |
| 18 | 밸런스 도구 리뷰 지적 수정 | GPT | `tools/first-hour.ts`, `tools/tune-curve.ts`, `Docs/dungeons.md` | 완료 (97d091e) |
| 19 | 세대 화면 (가족·관계·청혼·인구·가계도) | Cursor | `src/ui/game/heroScreens.tsx`, `villageScreens.tsx`, `App.tsx`, `styles.css`, `src/locales/*` | 완료 (14395ae) |
| 20 | 세대 3D 연출 (부부·아이·광장) | Cursor | `src/ui/voxel/VillageScene.ts`, `src/ui/VillageView.tsx` | 완료 (dc01bce) |
| 21 | 세대 core 코드 리뷰 (443bde5) | GPT | `Docs/reviews/443bde5.md` (새 파일만) | 완료 (이 커밋) |
| 22 | 세대 시뮬레이터 | GPT | `tools/generations.ts` (새 파일), `package.json` 스크립트 한 줄 | 완료 (이 커밋) |
| 23 | 첫 3시간 시뮬레이터를 여러 시드로 | GPT | `tools/first-hour.ts` | 완료 (이 커밋) |
| 24 | 첫 3시간 시뮬레이터의 플레이어를 사람처럼 | GPT | `tools/first-hour.ts` | 완료 (이 커밋) |
| 25 | 권장 레벨을 여러 파티 구성으로 재기 | GPT | `tools/curve.ts`, `tools/print-curve.ts`, `tools/tune-curve.ts` | 완료 (이 커밋) |
| 26 | 출발 준비의 파티 구성 안내 | Cursor | `src/ui/game/battleScreens.tsx`, `src/locales/*` | 완료 (6bc08f1) |
| 27 | 명예의 전당·묘지·조상 화면 | Cursor | `src/ui/game/heroScreens.tsx`, `villageScreens.tsx`, `App.tsx`, `styles.css`, `src/locales/*` | 완료 (75b80bd) |
| 28 | 집 레벨별 모습·묘지 비석 3D | Cursor | `src/ui/voxel/VillageScene.ts`, `src/ui/voxel/world.ts` | 완료 (9d35253) |
| 29 | 2b core 코드 리뷰 (f7fdf88) | GPT | `Docs/reviews/f7fdf88.md` (새 파일만) | 완료 (이 커밋) |
| 30 | 세대 시뮬레이터 60년 | GPT | `tools/generations.ts` | 완료 (이 커밋) |
| 31 | 행운의 분수 3D | Cursor | `src/ui/voxel/VillageScene.ts`, `world.ts`, `src/ui/VillageView.tsx` | 완료 (e7427eb) |
| 32 | 행운의 분수 화면·소리 | Cursor | `App.tsx`, `villageScreens.tsx`, `heroScreens.tsx`, `sound.ts`, `styles.css`, `src/locales/*` | 완료 (6c7e357) |
| 33 | 분수 core 코드 리뷰 (5322f86) | GPT | `Docs/reviews/5322f86.md` (새 파일만) | 완료 (a666f56) |
| 34 | 분수가 초반 골드에 주는 몫 측정 | GPT | `tools/first-hour.ts` | 완료 (a47f68a) |
| 35 | 독늪 몬스터·던전 그림 | Cursor | `src/ui/voxel/enemies.ts`, `portrait.ts` | 완료 (ad6c4c7) |
| 36 | 상태이상·물약 화면과 연금술 공방 | Cursor | `App.tsx`, `src/ui/game/*.tsx`, `styles.css`, `src/locales/*` | 완료 (c8299cb) |
| 37 | 상태 표시·물약 동작·공방 건물 3D | Cursor | `BattleScene.ts`, `replay.ts`, `world.ts`, `VillageScene.ts` | 완료 (4d4ded2) |
| 38 | 3a core 코드 리뷰 (1918eda) | GPT | `Docs/reviews/1918eda.md` (새 파일만) | 완료 (03d9e42) |
| 39 | 독늪 밸런스 측정 | GPT | `tools/curve.ts`, `print-curve.ts`, `tune-curve.ts`, `first-hour.ts` | 완료 (c6e24d9) |
| 40 | 도적 요새 몬스터·던전 그림 | Cursor | `src/ui/voxel/enemies.ts`, `portrait.ts` | 완료 (c7b4d76) |
| 41 | 마법 공방 화면·장신구 장착·함정/기습 문구 | Cursor | `App.tsx`, `src/ui/game/*.tsx`, `styles.css`, `src/locales/*` | 완료 (8eed6e7) |
| 42 | 함정·기습 연출과 마법 공방 건물 3D | Cursor | `BattleScene.ts`, `replay.ts`, `world.ts`, `VillageScene.ts` | 완료 (7893f0c) |
| 43 | 3b core 코드 리뷰 (1f690a1) | GPT | `Docs/reviews/1f690a1.md` (새 파일만) | 완료 (1c5c70e) |
| 44 | 도적 요새 밸런스 측정 | GPT | `tools/curve.ts`, `print-curve.ts`, `tune-curve.ts`, `first-hour.ts` | 완료 (6d9ffd1) |
| 45 | 마량 성채 몬스터·던전 그림 | Cursor | `src/ui/voxel/enemies.ts`, `portrait.ts` | 완료 (1962d3a) |
| 46 | 광역기 작전·리포트·로그 화면 | Cursor | `App.tsx`, `src/ui/game/*.tsx`, `styles.css`, `src/locales/*` | 완료 (082a21d) |
| 47 | 예고·광역기·끊기·버티기·소환 연출 | Cursor | `BattleScene.ts`, `replay.ts` | 완료 (0115034) |
| 48 | 3c core 코드 리뷰 (7eaca30) | GPT | `Docs/reviews/7eaca30.md` (새 파일만) | 완료 (6999c19) |
| 49 | 마량 성채 밸런스 측정 | GPT | `tools/curve.ts`, `print-curve.ts`, `tune-curve.ts`, `first-hour.ts` | 완료 (0551f9f) |
| 50 | 아이를 영웅·출전 목록에서 빼고 성인식 알림 | Claude Code (사용자 요청으로 직접) | `src/ui/game/*.tsx`, `App.tsx`, `styles.css`, `src/locales/*` | 완료 (다음 커밋) |
| 51 | 용의 둥지 몬스터·던전 그림 | Cursor | `src/ui/voxel/enemies.ts`, `portrait.ts` | 완료 (ac00d51) |
| 52 | 둥지 카드(가려진 어픽스·정찰·정보 구매)와 리포트 | Cursor | `App.tsx`, `src/ui/game/*.tsx`, `styles.css`, `src/locales/*` | 완료 (a63366f) |
| 53 | 정찰 나가는 도적과 어픽스 연출 | Cursor | `BattleScene.ts`, `replay.ts`, `VillageScene.ts` | 완료 (613ee56) |
| 54 | 3d core 코드 리뷰 (f47daff) | GPT | `Docs/reviews/f47daff.md` (새 파일만) | 완료 (abc39ce) |
| 55 | 용의 둥지 밸런스 측정 | GPT | `tools/curve.ts`, `print-curve.ts`, `tune-curve.ts`, `first-hour.ts` | 완료 (4e7351e) |
| 56 | 훈련소 화면과 스킬 고르기 | Cursor | `App.tsx`, `src/ui/game/*.tsx`, `styles.css`, `src/locales/*` | 완료 (5010c29) |
| 57 | 훈련소 건물·스킬 연출 3D | Cursor | `world.ts`, `VillageScene.ts`, `BattleScene.ts`, `replay.ts` | 완료 (b13376f) |
| 58 | 스킬·훈련소 core 코드 리뷰 (8e25753) | GPT | `Docs/reviews/8e25753.md` (새 파일만) | 완료 (226ee9b) |
| 59 | 스킬을 배우는 곡선·시뮬레이터 | GPT | `tools/curve.ts`, `print-curve.ts`, `tune-curve.ts`, `first-hour.ts` | 완료 (52b4cfd) |
| 60 | 길드 화면(의뢰 게시판·레벨·감정) | Cursor | `App.tsx`, `src/ui/game/*.tsx`, `styles.css`, `src/locales/*` | 완료 (7ff969a) |
| 61 | 길드 core 코드 리뷰 (1208be3) | GPT | `Docs/reviews/1208be3.md` (새 파일만) | 완료 (48656ea) |
| 62 | 의뢰 보상·자동 파티 측정 | GPT | `tools/curve.ts`, `print-curve.ts`, `tune-curve.ts`, `first-hour.ts` | 완료 (d48a304) |
| 63 | 사기·감정·축제 화면 | GPT (Cursor 대신) | `App.tsx`, `src/ui/game/*.tsx`, `styles.css`, `src/locales/*` | 완료 (3068fbd) |
| 64 | 사기·축제 core 코드 리뷰 (b9036a0) | GPT | `Docs/reviews/b9036a0.md` (새 파일만) | 완료 (65a731f) |
| 65 | 사기가 진행에 주는 영향 측정 | GPT | `tools/curve.ts`, `print-curve.ts`, `tune-curve.ts`, `first-hour.ts` | 완료 (727df45) |
| 66 | 자동화 화면(대기열·물약 유지·자동 치료·자동 훈련) | GPT (Cursor 대신) | `App.tsx`, `src/ui/game/*.tsx`, `styles.css`, `src/locales/*` | 완료 (4bbfcda) |
| 67 | 자동화 core 코드 리뷰 (a6be730) | GPT | `Docs/reviews/a6be730.md` (새 파일만) | 완료 (f48be69) |
| 68 | 면담·스카우팅 화면 | GPT (Cursor 대신) | `App.tsx`, `src/ui/game/*.tsx`, `styles.css`, `src/locales/*` | 완료 (a7cfe98) |
| 69 | 면담·스카우팅 core 코드 리뷰 (8e1fa30) | GPT | `Docs/reviews/8e1fa30.md` (새 파일만) | 완료 (c5b60da) |
| 70 | 학교 화면 | GPT (Cursor 대신) | `App.tsx`, `src/ui/game/*.tsx`, `styles.css`, `src/locales/*` | 완료 (0b09ec7) |
| 71 | 학교 core 코드 리뷰 (62e7837) | GPT | `Docs/reviews/62e7837.md` (새 파일만) | 완료 (798bfcc) |
| 72 | 집 화면: 방으로 묶어 보기 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (2102e68) |
| 73 | 파티 구성·전투 준비 화면의 영웅 상태와 소속 | GPT | `src/ui/game/battleScreens.tsx`, `src/ui/App.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (c85b59e) |
| 74 | 집·준비 상태 core 코드 리뷰 (7995eb2, b1261a7) | GPT | `Docs/reviews/b1261a7.md` (새 파일만) | 완료 (55e1167) |
| 75 | 시장 건물·떠돌이 상인 3D | Cursor | `src/ui/voxel/*` | 완료 (0397ba8) |
| 76 | 시장 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (3e9cb81) |
| 77 | 시장 core 코드 리뷰 (bb1c2cf) | GPT | `Docs/reviews/bb1c2cf.md` (새 파일만) | 완료 (206cc3b) |
| 78 | 시장 경제 측정 | GPT | `tools/*`, `Docs/market.md`의 측정 절 | 완료 (8b0f1ab) |
| 79 | 성격별 마을 행동·감정 말풍선 3D | Cursor | `src/ui/voxel/*` | 완료 (776b46f) |
| 80 | 성격·감정 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (b16876f) |
| 81 | 성격 core 코드 리뷰 (49c92da) | GPT | `Docs/reviews/49c92da.md` (새 파일만) | 완료 (b9207af) |
| 82 | 성격 영향 측정 | GPT | `tools/*`, `Docs/personality.md`의 측정 절 | 완료 (0559f10) |
| 83 | 선술집 건물·술자리·축제 장식 3D | Cursor | `src/ui/voxel/*` | 완료 (155a38a) |
| 84 | 선술집·유품 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (870201f) |
| 85 | 선술집·유품 core 코드 리뷰 (161d1d1) | GPT | `Docs/reviews/161d1d1.md` (새 파일만) | 완료 (b60c1cb) |
| 86 | 선술집·유품 측정 | GPT | `tools/*`, `Docs/tavern.md`의 측정 절 | 완료 (d1013ec) |
| 87 | 축제 장식 3D | Cursor | `src/ui/voxel/*` | 완료 (5922ec2) |
| 88 | 명예의 전당 건물·석상·진열장 3D | Cursor | `src/ui/voxel/*` | 완료 (813599d) |
| 89 | 명예의 전당 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (24a56ef) |
| 90 | 명예의 전당 core 코드 리뷰 (4c3aec1) | GPT | `Docs/reviews/4c3aec1.md` (새 파일만) | 완료 (3b65093) |
| 91 | 마을 Lv7까지 전체 흐름 점검 | GPT | `tools/*`, `Docs/balance.md`(새 파일) | 완료 (4075ab5) |
| 92 | 상위 레벨 건물·영웅·전설 장비 3D | Cursor | `src/ui/voxel/*` | 완료 (0e3e29d) |
| 93 | 마을 Lv8–10·상위 레벨·전설 장비 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 대체됨 (작업 100–103) |
| 94 | 4a core 코드 리뷰 (d89e486) | GPT | `Docs/reviews/d89e486.md` (새 파일만) | 대체됨 (작업 100–103) |
| 95 | 4a 측정: Lv8–10 도달·후반 재료·전설 장비 | GPT | `tools/*`, `Docs/endgame.md`의 측정 절 | 대체됨 (작업 100–103) |
| 96 | 요일 던전·심연 전투 배경 3D | Cursor | `src/ui/voxel/*`, `src/ui/BattleView.tsx`, `src/ui/ExpeditionPanel.tsx` | 완료 (4ae5c02) |
| 97 | 금고·요일 던전·심연 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (ec16996) |
| 98 | 4a core 코드 리뷰 (b80777c) | GPT | `Docs/reviews/b80777c.md` (새 파일만) | 완료 (82ab2e2) |
| 99 | 4a 측정: 요일 던전 승률·심연 깊이·하루 자원 | GPT | `tools/*`, `Docs/endgame.md`의 측정 절 | 완료 (374866e) |
| 100 | 승격 의식·마을 레벨 8–10 모습 3D | Cursor | `src/ui/voxel/*` | 완료 (3132b54) |
| 101 | 승격·새 자원 비용·마을 Lv10·장비 등급 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (a588af8) |
| 102 | 4b core 코드 리뷰 (d89e486, c89e043) | GPT | `Docs/reviews/c89e043.md` (새 파일만) | 완료 (175703a) |
| 103 | 4b 측정: Lv8–10 도달·자원 흐름 | GPT | `tools/*`, `Docs/endgame.md`의 측정 절 | 완료 (0156f23) |
| 104 | 레이드 보스·마을 침공 장면 3D | Cursor | `src/ui/voxel/*`, `src/ui/BattleView.tsx`, `src/ui/ExpeditionPanel.tsx` | 완료 (8c4c0a7) |
| 105 | 레이드·침공 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (30cc97e) |
| 106 | 4c core 코드 리뷰 (1650b75) | GPT | `Docs/reviews/1650b75.md` (새 파일만) | 완료 (58eea1f) |
| 107 | 4c 측정: Lv9·10 승격·레이드 주기·침공 | GPT | `tools/*`, `Docs/endgame.md`의 측정 절 | 완료 (32d2605) |
| 108 | 기념물·계절 이벤트·번영 3D | Cursor | `src/ui/voxel/*`, `src/ui/BattleView.tsx`, `src/ui/ExpeditionPanel.tsx` | 완료 (7c5a6b9) |
| 109 | 이벤트·기념물·강화 확장·레이드 단계·번영 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (07cc847) |
| 110 | 4d core 코드 리뷰 (1eeb27b) | GPT | `Docs/reviews/1eeb27b.md` (새 파일만) | 완료 (a2712d6) |
| 111 | 4d 측정: Lv10 이후 한 달 | GPT | `tools/*`, `Docs/endgame.md`의 측정 절 | 완료 (4a39b9d) |
| 112 | 정예·강령술사·새 전투 효과 3D | Cursor | `src/ui/voxel/*`, `src/ui/BattleView.tsx`, `src/ui/ExpeditionPanel.tsx` | 완료 (2ca1063) |
| 113 | 스킬 갈래·천부·몬스터 특성 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (ff89a13) |
| 114 | 5a core 코드 리뷰 (318455b) | GPT | `Docs/reviews/318455b.md` (새 파일만) | 완료 (f5f51e0) |
| 115 | 5a 측정: 갈래 조합·천부·몬스터 세기 | GPT | `tools/*`, `Docs/identity.md`의 측정 절 | 완료 (ab7c014) |
| 116 | 무기·방어구 종류 3D | Cursor | `src/ui/voxel/*`, `src/ui/BattleView.tsx`, `src/ui/ExpeditionPanel.tsx` | 완료 (d9e9664) |
| 117 | 무기·방어구 종류·옵션·다시 굴리기 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (67552f8) |
| 118 | 5b core 코드 리뷰 (3ad100c) | GPT | `Docs/reviews/3ad100c.md` (새 파일만) | 완료 (ed66d7e) |
| 119 | 5b 측정: 무기 종류·옵션 세기 | GPT | `tools/*`, `Docs/identity.md`의 측정 절 | 완료 (daf8722) |
| 120 | 고유 장비·드롭 3D | Cursor | `src/ui/voxel/*`, `src/ui/BattleView.tsx`, `src/ui/ExpeditionPanel.tsx` | 완료 (c2806ab) |
| 121 | 드롭·고유 장비·세트·교환 화면 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (d35b6d0) |
| 122 | 5c core 코드 리뷰 (2c287d8) | GPT | `Docs/reviews/2c287d8.md` (새 파일만) | 완료 (9911bb8) |
| 123 | 5c 측정: 드롭 속도·고유 장비·세트 세기 | GPT | `tools/*`, `Docs/identity.md`의 측정 절 | 완료 (44f32fa) |
| 124 | 5d 밸런스 측정 | GPT | `tools/*`, `Docs/identity.md`의 측정 절 | 완료 (92f6b1a) |
| 125 | 5d 수치 조정 | GPT | `src/data/*.json`, `src/core/*.test.ts`, `Docs/identity.md` | 완료 (066e4e3) |
| 126 | 직업 사이 차이 줄이기 | GPT | `src/data/classes.json`, `src/data/*.json`, `src/core/*.test.ts`, `tools/*`, `Docs/identity.md` | 완료 (e062b37) |
| 127 | 정예 처치 드롭 보너스 | GPT | `src/core/dungeon.ts`, `src/core/loot.ts`, `src/core/game.ts`, `src/core/types.ts`, `src/data/loot.json`, `src/core/loot.test.ts`, `Docs/identity.md` | 완료 (b212ded) |
| 128 | 5단계 뒤 초반 흐름 점검 | GPT | `tools/*`, `Docs/balance.md`의 측정 절, 필요하면 `src/data/*.json`·`src/ui/styles.css`·`src/locales/*` | 완료 (42a28ae) |
| 129 | 레벨·경험치 표시, 창고 화면, 재접속 자동 출정 보고 | GPT | `src/ui/App.tsx`, `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*`, 보고에 필요한 만큼 `src/core/game.ts`·`src/core/*.test.ts` | 완료 (a2ffc69) |
| 130 | 파티 자동 편성 | GPT | `src/core/*`(새 함수·행동), `src/ui/game/battleScreens.tsx`, `src/locales/*` | 완료 (c7b2eaf) |
| 131 | 여관 유료 갱신 | GPT | `src/core/game.ts`, `src/data/village.json`, `src/core/*.test.ts`, `src/ui/game/*.tsx`, `src/locales/*` | 완료 (5e422a7) |
| 132 | 결혼하면 2인실 배정(신혼방 없애기) | GPT | `src/core/family.ts`, `src/core/rooms.ts`, `src/data/family.json`, `src/core/*.test.ts`, `src/ui/game/*.tsx`, `src/locales/*`, `Docs/house.md` | 완료 (1f6e55f) |
| 133 | 마을 건물 위치 조정 | Cursor | `src/ui/voxel/*` | 완료 (3d1538e) |
| 134 | 명예의 전당이 여관 뒤에 가려지는 배치 고치기 | Cursor | `src/ui/voxel/*` | 완료 (b8bdbff) |
| 135 | 영웅 카드 경험치 막대에 설명 붙이기 | GPT | `src/ui/game/*.tsx`, `src/ui/styles.css`, `src/locales/*` | 완료 (05fd01b) |
| 136 | 도감·업적 | GPT | `src/core/*`, `src/data/codex.json`(새 파일), `src/core/*.test.ts`, `src/ui/*`, `src/locales/*`, `Docs/codex.md` | 완료 (703461a) |
| 137 | 알림 1단계(웹) | GPT | `src/core/*`(upcomingEvents), PWA 설정(`vite.config.ts`·서비스 워커), `src/ui/*`, `src/locales/*`, `Docs/codex.md` | 완료 (c280ba6) |
| 138 | 축제 장식이 명예의 전당 터와 겹치는 문제 | Cursor | `src/ui/voxel/*` | 완료 (d59a8c3) |
| 139 | 마을 사건 core | GPT | `src/core/*`(새 incidents.ts), `src/data/incidents.json`(새 파일), `src/core/*.test.ts`, `Docs/incidents.md` | 완료 (b8cdb06) |
| 140 | 마을 사건 화면·보고·알림 | GPT | `src/ui/*`, `src/locales/*`, `src/core/*`(upcomingEvents에 사건만) | 완료 (f7cb5e0) |
| 141 | 마을 사건 다듬기: 영웅 없는 마을, 빈 아이콘 | GPT | `src/data/incidents.json`, `src/core/incidents.ts`, `src/core/*.test.ts`, `src/ui/*`, `Docs/incidents.md` | 완료 (8b13897) |
| 142 | 후천적 특성(행적·칭호) core | GPT | `src/core/*`(새 titles.ts), `src/data/titles.json`(새 파일), `src/core/*.test.ts`, `tools/*`, `Docs/deeds.md` | 완료 (c1ed86c) |
| 143 | 후천적 특성 화면·연출·도감 | GPT | `src/ui/*`, `src/locales/*`, 도감 기록에 필요한 만큼 `src/core/codex.ts` | 완료 (1435c70) |
| 144 | 출정하는 영웅이 명예의 전당과 분수 사이에 끼는 문제 | Cursor | `src/ui/voxel/*` | 대기 |

---

## 1. 영어 이름 뒤 한국어 조사

**전달할 내용**

```
src/ui/josa.ts의 josa()는 한글 끝글자만 받침을 판단해서, 영어 이름은 항상 받침이 없는 것으로 처리한다.
영웅 이름은 src/data/names.json의 영어 판타지 이름이라 한국어 화면에서 조사가 자주 틀린다.

할 일:
1. 마지막 글자가 라틴 문자면 한국어로 읽었을 때의 끝소리로 받침을 정한다.
   - 끝이 l, m, n, ng 이면 받침 있음 (Kael→카엘이, Brynn→브린이, Ingrid는 d라서 없음)
   - 끝이 묵음 e이고 그 앞이 l 또는 n이면 받침 있음 (Adele→아델이, Nadine→나딘이)
   - 그 밖의 자음(k, t, d, s, r, h, th, g, f, c, x …)과 모음(a, e, i, o, u, y)은 받침 없음
     (Henrik→헨리크가, Roland→롤런드가, Walter→월터가, Edith→이디스가, Olga→올가가)
   - 위 규칙으로 틀리는 이름은 josa.ts 안의 예외 표로 처리한다 (예: Esme→에즈미가).
2. '은/는', '을/를', '과/와'도 같은 판단을 쓴다. '으로/로'는 지금 필요 없다.
3. josa.test.ts에 위 예시 이름들을 모두 테스트로 넣는다. names.json 전체를 돌려 예외가 필요한 이름을 찾아 표에 넣는다.

완료 기준: 테스트 통과, 여관 화면에서 "Henrik가 여관에 머물고 있다", "Nadine이 여관에 머물고 있다"처럼 나온다.
```

메모: 라틴 이름은 끝소리가 l, m, n, ng이거나 묵음 e 앞이 l, n이면 받침으로 본다. 발음이 모음으로 끝나는 Esme, Selene, Evadne만 예외다. 여관에서 "Henrik가", "Baldwin이"를 확인했다.

---

## 2. 시간 가속 디버그 도구

**전달할 내용**

```
GDD 11.3: "시간 가속(디버그 모드)을 초기에 만든다." 지금은 건설 즉시 완료 버튼만 있다.
건설·치료·자동 출정·계절 주급·방문자 교체를 몇 분 안에 확인할 수 있어야 한다.

할 일:
1. UI에 게임 시계 함수 gameNow()를 만든다. Date.now() + 개발용 오프셋(ms). 오프셋은 개발 모드에서만 쓰고 localStorage에 저장한다.
   src/ui/App.tsx와 그 하위 컴포넌트에서 게임 상태에 넘기는 Date.now()는 모두 gameNow()로 바꾼다.
2. 디버그 탭(개발 모드에서만 보임)에 버튼을 추가한다: "+10분", "+1시간", "+1계절(현실 1일)", "오프셋 초기화".
   누르면 오프셋을 늘리고 바로 { type: 'catchUp', now: gameNow() }를 보낸다.
   한 번에 12시간을 넘기면 core가 12시간으로 자르므로(timeRules.maxOfflineMs), +1계절은 12시간씩 두 번 나눠 보낸다.
3. 디버그 탭에 현재 오프셋을 "시간 +1일 3시간"처럼 보여 준다. 문구는 en/ko 번역 키로 넣는다.
4. core는 건드리지 않는다. 시간은 이미 catchUp의 now로만 들어간다.

완료 기준: 디버그 탭에서 "+1계절"을 누르면 계절이 바뀌고 주급이 나가며 부재 중 보고서가 뜬다. 건설 중인 건물이 "+1시간" 몇 번으로 완성된다. 배포 빌드에는 버튼이 없다.
```

메모: 개발 모드에서만 `gameNow()`가 localStorage 오프셋을 더한다. +1계절은 코어가 12시간으로 자르므로 그 한도씩 두 번 catchUp 한다. 확인: 가을→겨울, 주급 30, 부재 보고서, 여관 증축이 +1시간 두 번에 완공. 배포 미리보기에는 디버그 탭이 없다. 확인 중 골드 100을 넣고 여관을 2레벨로 올렸고, 시계는 +1일 2시간이다.

---

## 3. three.js 코드 분할

**전달할 내용**

```
npm run build가 "Some chunks are larger than 500 kB" 경고를 낸다. three.js가 메인 번들(약 950KB)에 들어 있기 때문이다.

할 일:
1. 3D 코드(src/ui/voxel/*, VillageView, BattleView)를 처음 화면 표시와 분리해서 불러온다.
   React.lazy + Suspense로 VillageView와 BattleView를 나중에 불러오거나, vite 설정에서 three를 별도 청크로 나눈다. 둘 중 단순한 쪽을 고르고 이유를 메모에 적는다.
2. HeroPortrait(초상화)도 three를 쓰므로, 불러오는 동안은 같은 크기의 빈 칸을 보여 준다.
3. 불러오는 동안 마을 자리에 같은 크기의 배경색 상자를 둬서 화면이 튀지 않게 한다.

완료 기준: 빌드 경고가 없어지거나, 메인 청크가 500KB 아래가 된다. npm run dev와 빌드 결과(npx vite preview) 모두에서 마을·초상화·전투 다시 보기가 보인다.
```

메모: 마을·초상화·전투는 React.lazy로 늦춰 불러온다. 불러오는 동안은 같은 크기의 빈 칸을 보여 준다. three 묶음이 569KB라 청크 경고는 남고, 메인 청크는 361KB다. 개발 서버와 배포 미리보기에서 마을 캔버스, 초상화, 전투 다시 보기를 확인했다.

---

## 4. 폰 화면 폭 점검

**전달할 내용**

```
GDD 11.1: 터치에서도 되는 UI(호버에 의존하지 않기, 터치 영역 44px 이상). 지금까지 데스크톱 폭에서만 확인했다.

할 일:
1. 브라우저 개발자 도구로 375×812(폰 세로), 768×1024(태블릿)에서 모든 탭을 확인한다:
   마을 운영, 여관, 영웅, 편성, 결과(3D 전투 포함), 마을, 대장간, 저장, 디버그.
2. 가로 스크롤이 생기거나, 글자가 잘리거나, 버튼이 44px보다 작은 곳을 고친다. src/ui/styles.css 위주로 고치고, 구조 변경이 필요하면 최소로 한다.
3. 마을 3D 화면은 한 손가락 드래그로 이동, 두 손가락으로 확대가 되는지 확인한다(MapControls 기본 동작).
4. 고친 곳과 고치지 못한 곳을 메모에 적는다.

완료 기준: 375px 폭에서 가로 스크롤 없이 모든 탭을 쓸 수 있다.
```

메모: 800px 아래에서는 마을 화면 높이를 70vh로 둬서 탭 창이 200px 남짓으로 줄지 않게 했다. 375px와 768px에서 모든 탭을 열었고 가로 스크롤과 44px 미만 버튼은 없었다. 한 손가락 드래그로 지도가 움직이고, 두 손가락으로는 확대된다. 주급 부족 경고가 떠 있으면 마을 지도가 가려지는 기존 동작은 그대로다.

---

## 5. 패배 원인 "파티가 아직 약하다"

**전달할 내용**

```
지금은 탱커와 힐러를 갖춘 파티가 광산에서 전멸하면 "파티가 전멸했다"만 나온다. GDD 7.3은 패배 리포트가 다음에 할 일을 알려 주라고 한다.
갓 고용한 1레벨 파티는 광산에서 전멸하므로, 이때 "레벨을 올리라"고 알려 줘야 한다.

할 일:
1. src/data/dungeons.json의 각 던전에 recommendedLevel(권장 평균 레벨)을 넣는다.
   값은 시뮬레이션으로 정한다: tools/simulate.ts의 standard 편성을 레벨만 바꿔 돌려서, 승률이 60%를 넘는 가장 낮은 평균 레벨.
   이 측정을 하는 스크립트나 테스트를 남긴다. 레벨이 능력치에 주는 영향은 core에 있는 그대로 쓴다.
2. core의 패배 원인(DefeatReason)에 'tooWeak'를 추가한다. 전멸(wipe) 또는 시간 초과(timeout)이고, 파티 평균 레벨이 recommendedLevel보다 낮으면 'tooWeak'.
   순서는 GDD 7.3과 Docs/combat.md를 따른다: 후퇴 → 탱커 없음 → 힐러 없음 → tooWeak → 시간 초과 → 전멸.
3. 번역: ko "파티가 아직 약하다. 쉬운 던전에서 레벨을 올리자 (권장 Lv {{level}})", en도 같은 뜻으로.
4. 던전 선택 화면에 "권장 Lv N"을 함께 보여 준다.
5. Docs/combat.md, Docs/dungeons.md의 패배 원인 순서와 권장 레벨을 갱신한다.

완료 기준: 테스트에 "1레벨 기본 편성으로 광산 → tooWeak", "권장 레벨 이상 기본 편성으로 광산 → 승리"가 있다. npm run simulate 표의 승률은 바뀌지 않는다(판정만 추가).
```

메모: 레벨은 전투 능력치를 바꾸지 않아 `tools/recommended-level.ts` 측정에서 여섯 던전 모두 1레벨에 승률 60%를 넘는다. 그래서 권장 레벨은 전부 1이고, 1레벨 기본 편성의 광산은 승리라 `tooWeak`가 아니다. `tooWeak`는 전멸·시간 초과이면서 평균 레벨이 권장보다 낮을 때만, 후퇴·탱커 없음·힐러 없음 다음이다. 편성 화면에서 "권장 Lv 1"을 확인했다.

---

## 6. 보상형 광고 인터페이스 + 가짜 광고

**전달할 내용**

```
GDD 10.1(광고 보상)과 11.2(광고 연동). 실제 광고 SDK는 아직 넣지 않는다. 인터페이스와 가짜 광고만 만든다.

할 일:
1. src/ui/ads.ts에 인터페이스를 만든다:
   showRewarded(placement): Promise<'rewarded' | 'skipped' | 'unavailable'>
   기본 구현은 FakeAds: 1초 기다린 뒤 'rewarded'. 나중에 H5 Games Ads / AdMob 구현으로 갈아 끼울 수 있게 한다.
2. 이번에는 광고 위치 세 곳만 만든다:
   - 부재 중 보고서: 이번에 번 골드만큼 한 번 더 받기 (보고서당 1회, 하루 3회)
   - 건설: 남은 시간 30% 또는 30분 중 큰 쪽 단축 (하루 5회)
   - 신전: 치료 중인 영웅 즉시 완료 (하루 3회)
3. 보상과 횟수는 core에서 처리한다. src/data/ads.json에 위치별 하루 횟수와 보상 값을 두고,
   GameState에 날짜별 사용 횟수를 저장한다(SAVE_VERSION을 올리고 migrate 추가).
   reduce에 { type: 'adReward', placement, now } 액션을 추가한다. 횟수를 넘으면 notice로 거절한다.
   하루의 경계는 현실 날짜(로컬 자정)로 한다.
4. UI: 각 위치에 "광고 보고 ○○ (남은 횟수 n/N)" 버튼. 광고 시청 중에는 버튼을 막는다. 'rewarded'일 때만 adReward를 보낸다.
5. 두 번째 죽음(영구 사망)에는 어떤 광고 버튼도 보이지 않는다 (GDD 10.1 원칙 2).
6. 테스트: 하루 횟수 제한, 날짜가 바뀌면 초기화, 보고서당 1회, 각 보상 값.

완료 기준: 개발 서버에서 세 버튼이 동작하고 횟수가 줄어든다. 디버그 시간 가속(작업 2)으로 날짜를 넘기면 횟수가 돌아온다.
```

메모: 가짜 광고는 1초 뒤 `rewarded`. 부재 보고서는 골드를 한 번 더 주고 버튼을 없애며, 건설은 남은 시간의 30%와 30분 중 큰 만큼 당기고, 치료는 가장 빨리 끝나는 치료를 한 단계 끝낸다. 개발 서버에서 세 버튼과 로컬 자정 초기화(공사 4/5 → 5/5)를 확인한 뒤 세이브와 시간 오프셋을 원래대로 되돌렸다. 묘지에는 광고 버튼이 없다.

---

## 7. 피로·부상 효과 (설계 확정 2026-11-22)

지금은 피로와 부상이 전투에 아무 영향이 없고, 부상은 신전(마을 레벨 3)에서만 낫는다. 그래서 GDD 7.1의 "피로·부상으로 로테이션을 만든다"가 동작하지 않는다. 아래 규칙으로 확정했다.

| 상태 | 전투 효과 | 출정 | 자연 회복 |
| --- | --- | --- | --- |
| 피로 50–79 | 공격·속도 −10% | 가능 | 마을에서 시간당 피로 −10, 집 레벨 1 초과분마다 +5 |
| 피로 80+ | 공격·속도 −20% | 직접 출정은 경고 후 가능 | 위와 같음 |
| 부상 | 최대 체력·공격 −15% | 직접 출정은 경고 후 가능 | 1계절(현실 1일)이 지나면 피로 상태로 |
| 중상 | 최대 체력·공격 −40% | 직접 출정은 경고 후 가능, 자동 출정은 정책과 관계없이 제외 | 1계절이 지나면 부상으로 |

- 신전 치료는 지금처럼 빠른 회복 수단으로 남는다.
- 휴식 버튼은 없앤다. 공짜로 바로 피로를 없애면 로테이션이 생기지 않는다. 디버그 탭의 "휴식 네 번"만 남긴다.

**전달할 내용**

```
GDD 7.1(피로·부상으로 로테이션)과 Docs/tasks.md 7번 표대로 피로·부상 효과와 자연 회복을 구현한다.

1. 수치는 src/data/life.json에 추가한다. 코드에 숫자를 쓰지 않는다.
   "fatigue": { "tiredAt": 50, "exhaustedAt": 80, "tiredPenalty": 0.1, "exhaustedPenalty": 0.2,
                "recoverPerHour": 10, "recoverPerHouseLevel": 5 },
   "injury":  { "injuredPenalty": 0.15, "criticalPenalty": 0.4, "recoverMs": 86400000 }
   (recoverMs는 timeRules.seasonMs와 같은 값. data.ts의 검증 함수에도 새 필드를 넣는다.)

2. 전투 효과: src/core/combat.ts의 createHeroUnit에서만 반영한다. 전투 루프(simulateFloor 등)는 바꾸지 않는다.
   - 피로 50 이상: attack과 speed에 (1 − tiredPenalty), 80 이상: (1 − exhaustedPenalty).
   - 부상: maxHp와 attack에 (1 − injuredPenalty), 중상: (1 − criticalPenalty).
   - 피로와 부상 효과는 곱해서 함께 적용한다. speed는 최소 1.

3. 자연 회복: src/core/game.ts의 advance(catchUp)에서 처리한다.
   - 피로: 지난 시간(시간 단위)마다 recoverPerHour + recoverPerHouseLevel × max(0, 집 레벨 − 1)만큼 줄인다. 0이 되고 상태가 'fatigued'면 'healthy'로.
   - 부상·중상: Hero에 recoverAt(ms)을 추가한다. 영웅이 부상 또는 중상이 될 때 recoverAt = 그때 시각 + recoverMs.
     catchUp에서 recoverAt이 지났으면 한 단계 좋아지고(중상→부상→피로), 아직 부상이면 recoverAt을 다시 설정한다.
     출정(depart)에는 now가 없으므로 state.lastTickAt을 그때 시각으로 쓴다. 자동 출정도 같다.
   - 신전 치료가 끝나 한 단계 좋아질 때도 recoverAt을 다시 설정하거나 지운다.
   - Hero에 필드가 생기므로 SAVE_VERSION을 올리고 migrate/normalizeHero에서 부상·중상인 영웅의 recoverAt을 지금 + recoverMs로 채운다.

4. 출정 경고: 직접 출정할 때 파티에 피로 80 이상, 부상, 중상인 영웅이 있으면 notice 'wornParty'로 막고,
   기존 'seenDeath'처럼 "그래도 출정" 버튼(depart confirm: true)으로 진행한다. 두 경고가 겹치면 confirm 한 번으로 통과한다.

5. 자동 출정: autoMembers에서 중상인 영웅은 운영 정책과 관계없이 뺀다. 'safe' 정책은 지금처럼 부상도 뺀다.

6. 휴식 버튼: 영웅 탭의 "휴식" 버튼을 없앤다. 'rest' 액션과 디버그 탭의 "휴식 네 번"은 남긴다.

7. UI: 영웅 목록과 상세에 피로 수치와 효과를 보여 준다. 예: "피로 65 · 공격·속도 −10%", "부상 · 회복까지 14시간".
   여관/편성 화면의 편성 목록에도 경고가 필요한 영웅을 표시한다. 문구는 en/ko 번역 키로.

8. 테스트(src/core/game.test.ts, 새 파일 가능):
   - 상태별 createHeroUnit의 attack/speed/maxHp 감소
   - 시간 경과에 따른 피로 감소(집 레벨 1과 2 비교)와 'fatigued' → 'healthy'
   - 1계절 후 중상 → 부상, 다시 1계절 후 부상 → 피로
   - 경고 notice와 confirm 출정
   - 자동 출정에서 중상 제외(정책 'material', 'fixed'에서도)
   - 예전 세이브(버전 2)를 읽으면 부상 영웅에 recoverAt이 생김

9. npm run simulate 표(GDD 7.6)는 바뀌지 않아야 한다. 시뮬레이션은 건강한 영웅 기준이다.

10. Docs/village.md(휴식 버튼 삭제, 자연 회복), Docs/combat.md(상태별 전투 효과)를 갱신한다.
```

메모: 피로는 지난 시간에 비례해 줄고, 0이 되는 순간 피로 상태가 건강이 된다. 부상 회복은 한 계절이고, 12시간 상한 때문에 계절 하나는 따라잡기 두 번이다. 중상은 자동 출정에서 항상 빠지고, 지친 파티는 확인 한 번으로 출정한다. 영웅 탭의 휴식 버튼은 없앴고 디버그의 휴식 네 번은 남겼다. 목록의 피로는 반올림해서 보여 준다. 시뮬레이션 표는 그대로다.

---

## 8. 게임 UI 아이콘·폰트·로고 아트

Claude Code가 화면을 게임 UI로 바꿨다(전체 화면 3D 마을, 위쪽 자원 HUD, 아래쪽 아이콘 독, 나무 테두리 창). 구조와 동작은 끝났고, 그림 요소만 임시다. 이 작업은 그 그림 요소를 완성한다.

**전달할 내용**

```
게임 UI의 임시 그림 요소를 최종 아트로 바꾼다. 화면 구조, 동작, 클래스 이름은 바꾸지 않는다.

현재 구조 (src/ui/):
- App.tsx: HUD(마을 배지·자원·설정 버튼), 독(아래쪽 6개 버튼), 창(Window), 토스트, 확인 창
- game/kit.tsx: Window, Res(자원 아이콘+숫자), Chip, Bar, Portrait 등 공용 부품
- game/icons.tsx: 자원 아이콘 6종(gold, wood, stone, iron, bone, fame). 지금은 단순한 임시 SVG
- 독과 창 제목 아이콘은 lucide-react(Hammer, Beer, Users, Swords, Anvil, ScrollText, Settings)를 임시로 쓴다
- styles.css: 색 토큰은 :root의 --paper, --wood, --green, --gold 등. 크림색 종이, 나무 테두리, 눌리는 두꺼운 버튼 스타일

그림체 기준: 3D 마을과 같은 "귀여운 복셀/블록" 느낌. 굵은 외곽선, 2–3단 명암, 밝은 파스텔. 
Docs/마을 성장 RPG – 게임 디자인 문서(GDD).md 11.7과 prototypes/voxel3d/index.html을 참고한다.
그림은 모두 코드(인라인 SVG)로 만든다. 외부 이미지 파일이나 AI 생성 이미지는 쓰지 않는다.

할 일:
1. 자원 아이콘 6종을 같은 그림체로 다시 그린다(game/icons.tsx). ResourceIcon의 이름과 24×24 viewBox, props는 그대로 둔다.
   16px, 24px 크기에서 모두 알아볼 수 있어야 한다.
2. 독 아이콘 6종 + 설정 아이콘을 같은 그림체의 SVG로 만든다: 마을 운영(망치·건물), 여관(맥주잔·침대), 영웅(투구 쓴 얼굴), 편성(교차한 검), 대장간(모루), 결과(두루마리), 설정(톱니).
   game/icons.tsx에 UiIcon({ name, size }) 같은 컴포넌트로 추가하고, App.tsx의 lucide 아이콘을 바꾼다. 닫기(X)·뒤로(<)·시계 같은 작은 기능 아이콘은 lucide를 그대로 써도 된다.
3. 한글을 지원하는 둥근 게임 폰트를 고른다(예: Jua, Gowun Dodum 등 OFL 라이선스). public/fonts에 woff2로 넣고 @font-face로 쓴다(외부 CDN 금지, 오프라인에서도 보여야 함). 제목·버튼·숫자에만 쓰고 본문은 지금 폰트를 둬도 된다. 라이선스 파일을 함께 넣는다.
4. 로딩 화면(App.tsx의 .loading)에 "영웅의 마을" 로고를 SVG로 만든다(블록 글자 또는 방패 엠블럼). 같은 로고로 public/favicon.svg와 index.html의 아이콘을 바꾼다.
5. 창 제목줄(.window-head)과 독 배경에 나무 결 느낌을 CSS(그라디언트, 줄무늬)로만 더한다. 이미지 파일은 쓰지 않는다.
6. 375px 폰과 데스크톱에서 모두 확인한다. 글자·아이콘이 잘리지 않아야 한다.

완료 기준: npx tsc --noEmit, npm test, npm run build 통과. 화면 구조와 동작(건물 누르면 창 열림, 독 전환, 토스트, 확인 창)은 그대로. 바꾼 아이콘을 한 화면에 모아 볼 수 있도록 디버그(설정 창 아래쪽)에 아이콘 견본 줄을 추가한다.
```

메모: 아이콘은 24×24 인라인 SVG이고 16px에서도 형태가 남는다. 글꼴은 Jua(OFL)를 한글·라틴만 추려 `public/fonts`에 넣었고 제목·버튼·숫자에만 쓴다. 파비콘은 방패 엠블럼이고, 로딩 화면은 같은 방패 옆에 "영웅의 마을"을 붙인다. 375px과 데스크톱에서 독 글자가 잘리지 않는 것을 확인했다. 견본은 개발 모드 설정 창 맨 아래에 있다.

---

## 9. PWA·오프라인 실행·업데이트 알림

**전달할 내용**

```
GDD 11.1(자체 웹사이트 → 태블릿 → 폰)과 11.5(세이브). 웹으로 첫 공개하기 전에 설치형 웹앱(PWA)으로 만든다.

할 일:
1. vite-plugin-pwa를 개발 의존성으로 추가해 manifest와 service worker를 만든다.
   - 이름 "영웅의 마을", 영어 이름 "Hero Town"은 description에.
   - display: standalone, orientation: any, theme_color와 background_color는 styles.css의 --paper / --sky 값.
   - 아이콘: public/favicon.svg의 방패 엠블럼으로 192·512 PNG, maskable 512 PNG, apple-touch-icon 180 PNG를 만든다.
     PNG는 저장소에 커밋한다(빌드 때마다 만들지 않는다). 만드는 데 쓴 스크립트는 tools/에 남긴다.
2. 앱 셸, JS 청크(three 포함), 폰트를 미리 캐시해서 한 번 연 뒤에는 오프라인에서도 게임이 열리게 한다. 세이브는 이미 IndexedDB라 오프라인에서도 남는다.
3. 새 버전이 배포되면 화면 위쪽 토스트로 "새 버전이 있어요 · 새로고침" 버튼을 보여 주고, 누르면 갱신한다.
   자동 새로고침은 하지 않는다(진행 중인 화면이 날아간다). 문구는 en/ko 번역 키, 스타일은 App.tsx의 기존 .toast.
4. 개발 서버(npm run dev)에서는 service worker가 개발을 방해하지 않게 한다(끄거나 devOptions로 제한).
5. Docs/에 짧은 메모: 캐시 전략, 아이콘 다시 만드는 법.

완료 기준: npm run build 후 npx vite preview로 연 페이지에서
- 크롬 개발자 도구 Application 탭에 manifest 오류가 없고 설치 버튼이 뜬다.
- Network를 Offline으로 바꾸고 새로고침해도 게임이 열리고 세이브가 남아 있다.
- 다시 빌드해 preview를 띄우면 업데이트 토스트가 뜬다.
```

메모: 개발 서버는 service worker를 끄고, 배포 빌드에서만 등록한다. 새 버전은 위쪽 토스트의 새로고침을 눌러야 바뀐다. 아이콘은 `tools/render-pwa-icons.mjs`로 방패 SVG를 PNG 네 장으로 만들어 `public/icons`에 커밋했다. 임베디드 브라우저에는 크롬 설치 버튼이 없어 Application 탭의 설치 아이콘은 확인하지 못했고, manifest·오프라인 새로고침·업데이트 토스트는 preview에서 확인했다.

---

## 10. 효과음 (코드 합성) + 음량 설정

**전달할 내용**

```
게임에 소리가 없다. 오디오 파일 없이 Web Audio API로 짧은 효과음을 합성한다(그래픽과 같은 원칙: 코드로 만들고 외부 에셋을 쓰지 않는다).

할 일:
1. src/ui/sound.ts: AudioContext 하나와 play(name) 함수. 브라우저 자동 재생 정책 때문에 첫 사용자 입력 뒤에 resume한다.
   효과음(각 0.1–0.6초, 귀엽고 가벼운 톤): tap(버튼), open(창 열기), close(창 닫기), coin(골드 획득·고용), build(건설 시작),
   complete(건설·제작 완료), hit(전투 피격), heal(회복), victory(짧은 팡파르), defeat(패배), levelUp(마을 레벨업), notice(토스트).
2. 연결:
   - App.tsx: 창 열기/닫기, 독 버튼, 토스트, 고용(coin), 건설 시작(build), 마을 레벨이 오를 때(levelUp).
   - 부재 중 보고서에 완공·제작 완료가 있으면 complete.
   - voxel/BattleScene.ts: 피격(hit), 회복(heal), 끝(victory/defeat). BattleScene은 콜백으로 소리를 받아서 voxel 코드가 sound.ts를 직접 모르게 한다.
   - 버튼마다 일일이 넣지 말고, .btn 클릭을 App 최상위에서 한 번에 잡아 tap을 낸다.
3. 설정 창(game/villageScreens.tsx의 Settings)에 효과음 음량 슬라이더(0–100)와 음소거 토글. localStorage에 저장, 기본 60.
4. 같은 소리가 한 프레임에 여러 번 겹치면(광역 공격 등) 한 번만 낸다. 4배속 다시 보기에서도 hit 소리 간격에 하한을 둔다.

완료 기준: 설정 창에 개발 모드 전용 "소리 견본" 버튼 줄을 두고 모든 소리를 들어 본다. 음소거하면 아무 소리도 나지 않는다. npx tsc --noEmit, npm test, npm run build 통과.
```

메모: Web Audio로 합성하고 기본 음량은 60, `localStorage` 키 `herotown.sound`에 둔다. 같은 소리는 16ms에 한 번, 피격은 90ms 간격이다. 전투 장면은 `onSound` 콜백만 부른다. 개발 서버 설정 창에서 견본이 소리를 만들고 음소거하면 만들지 않는 것까지 확인했다. 스피커로 직접 듣지는 못했다.

---

## 11. 해가 바뀌면 나이 먹기

**전달할 내용**

```
GDD 5.1(1년 = 4계절)과 5.2(나이대별 변화). 지금은 시간이 흘러도 영웅 나이가 그대로다. core에는 ageUp/withAge와 src/data/ageBands.json이 이미 있다.

할 일:
1. game.ts의 계절 진행(moveCalendar 또는 advance)에서 해가 바뀔 때(겨울 → 봄) 고용한 영웅과 여관 방문자 모두 나이를 1 올린다. hero.ts의 ageUp을 쓴다.
   능력치는 withAge가 나이대(ageBands)로 다시 계산한다. 직접 계산하지 않는다.
2. 해가 여러 번 바뀌면 바뀐 횟수만큼 정확히 나이를 먹는다.
3. 부재 중 보고서(AbsenceReport)에 "나이를 먹은 영웅" 목록(이름, 새 나이)을 추가하고 보고서 창에 한 줄로 보여 준다. 문구는 en/ko.
   AbsenceReport 필드가 늘어나면 normalize에서 예전 보고서의 기본값을 채운다.
4. 3D 외형(ui/voxel/look.ts)은 이미 나이를 읽는다. 나이가 바뀌면 마을의 캐릭터가 다시 만들어지는지만 확인한다.
5. 은퇴·사망·출산은 이번 범위가 아니다(Claude Code 담당). 나이 상한(maxAge)에 닿아도 이번에는 아무 일도 일어나지 않게 둔다.
6. 테스트: 계절 4번이 지나면 나이 +1, 나이대가 바뀌면 능력치가 바뀜, 디버그 "+1계절" 4번과 같은 결과.

완료 기준: 테스트 통과. 디버그 시계로 1년을 넘기면 영웅 상세의 나이와 능력치가 바뀌고 부재 중 보고서에 나온다.
```

메모: 겨울이 봄이 될 때마다 `ageUp`으로 고용 영웅과 방문자가 한 살 먹고, 능력치는 `withAge`가 나이대로 다시 계산한다. 80세는 기존 `clampAge` 때문에 더 늘지 않고 은퇴도 없다. 예전 보고서의 `aged`는 빈 배열로 채운다. 디버그로 1년을 넘기면 2년 봄 보고서에 "Anwen (33)"이 나왔다. 그 영웅은 나이대가 그대로라 능력치는 안 바뀌었고, 나이대 변화는 테스트(49→50)로 확인했다. 마을 모델은 `lookKey`에 나이가 들어 키가 바뀌면 `VillageScene`이 다시 만든다.

---

## 12. GitHub Pages 배포

공개 호스팅은 GitHub Pages로 정했다(2026-11-23). 저장소는 아직 원격이 없다.

**먼저 사용자가 할 일 (Cursor 작업 전)**

1. GitHub에 새 저장소를 만든다(예: `herotown`). 무료 계정에서 Pages를 쓰려면 **공개(Public)** 저장소여야 한다. 비공개로 두려면 유료 플랜이 필요하다.
2. 이 PC에서 원격을 연결하고 올린다:
   `git remote add origin https://github.com/<계정>/herotown.git` → `git push -u origin main`
3. 저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 바꾼다.
4. 주소는 `https://<계정>.github.io/herotown/`가 된다. 저장소 이름을 Cursor에 알려 준다.

**전달할 내용**

```
GitHub Pages(프로젝트 사이트, 주소 https://<계정>.github.io/<저장소 이름>/)로 배포한다. 저장소 이름: <여기에 적기>

할 일:
1. Vite의 base 경로를 배포 경로에 맞춘다. 환경 변수(예: BASE_PATH)로 받아서 기본은 '/', GitHub Actions에서는 '/<저장소 이름>/'.
   npm run dev와 npm run build(로컬)는 지금처럼 '/'에서 동작해야 한다.
2. 경로를 하드코딩한 곳을 모두 base 기준으로 바꾼다: public/의 favicon·폰트, index.html의 아이콘 링크,
   (9번 PWA가 끝났다면) manifest의 start_url·scope·아이콘 경로와 service worker 범위.
   import.meta.env.BASE_URL을 쓴다.
3. .github/workflows/deploy.yml: main에 push하면 npm ci → npx tsc --noEmit → npm test → npm run build → Pages에 올린다.
   공식 액션(actions/checkout, actions/setup-node, actions/configure-pages, actions/upload-pages-artifact, actions/deploy-pages)을 쓰고 Node 버전은 package.json과 맞춘다.
   테스트가 실패하면 배포하지 않는다.
4. 정적 호스팅이라 새로고침 시 404가 날 경로가 있는지 확인한다(지금은 라우터가 없어 단일 페이지라 문제없을 것). 필요하면 404.html을 index.html 복사로 둔다.
5. 세이브 주의: github.io의 같은 계정 사이트들은 출처(origin)를 공유한다. IndexedDB 이름 'herotown'이 다른 프로젝트와 겹치지 않는지만 확인하고, 바꾸지는 않는다(바꾸면 기존 세이브가 사라진다).
6. README.md에 플레이 주소와 배포 방법을 짧게 적는다.
7. prototypes/ 폴더는 배포에 넣지 않는다.

완료 기준: 로컬에서 BASE_PATH=/<저장소 이름>/ npm run build 후 npx vite preview --base /<저장소 이름>/ 로 열어 마을·3D·폰트·아이콘이 모두 보인다.
사용자가 push한 뒤 Actions가 초록색으로 끝나고 Pages 주소에서 게임이 열린다.
```

메모:

---

## 13. 원정 화면 그림·소리 다듬기

Claude Code가 원정 흐름(Docs/expedition.md A–D단계)을 끝냈다: 시간이 걸리는 원정, 전투 창(던전·출발 준비·파티 편성·원정 기록), 메인 화면 진행 패널, 마을 문으로 나가고 들어오는 영웅. 동작과 구조는 끝났고, 그림과 소리를 다듬는 작업이다.

**전달할 내용**

```
Docs/expedition.md의 E·F단계. 원정 화면의 그림과 소리를 다듬는다. 게임 규칙(src/core)과 화면 흐름은 바꾸지 않는다.

관련 파일:
- src/ui/game/battleScreens.tsx: 전투 창. DungeonBoard(던전 탭), Prep(출발 준비), PartyEditor, History
- src/ui/ExpeditionPanel.tsx: 메인 화면 진행 패널
- src/ui/voxel/world.ts: buildTerrain의 "The village gate on the south road" (지금은 기둥 두 개 + 들보의 임시 문)
- src/ui/voxel/enemies.ts: 몬스터 3D 모델 (buildEnemy)
- src/ui/voxel/portrait.ts: 영웅 초상 렌더러

할 일:
1. 몬스터 초상: portrait.ts처럼 몬스터 3D 모델을 찍어 이미지로 캐시하는 monsterPortraitUrl(refId)을 만든다(같은 공유 렌더러 사용).
   던전 탭의 "보스"·"일반 몬스터" 칩 옆에 초상을 넣는다. 보스는 더 크게.
2. 던전 미리보기: 던전 탭 가운데 카드 위쪽에 던전 분위기 그림을 넣는다. BattleScene의 티어 테마(바닥·벽·횃불·수정)와 보스 모델로
   작은 3D 장면을 한 번 렌더해 이미지로 캐시한다(던전마다 1장). 잠긴 던전은 어둡게 + 물음표.
3. 마을 문: 임시 문을 복셀 그림체로 다시 만든다(돌 기둥, 나무 아치, 깃발, 등불). 위치(GATE)와 크기는 그대로(영웅이 지나간다).
   원정 중인 파티 수를 문 옆 표지판에 3D 이름표(makeLabel)로 띄운다. VillageScene에 숫자를 넘기는 최소한의 prop 추가는 허용.
4. 출정 도장: 출발 준비의 출정 버튼을 누르면 도장 찍는 짧은 연출(빨간 도장이 쿵 찍히고 흔들림, 0.4초) 뒤에 창이 닫히게 한다. CSS 애니메이션으로.
   연출 중에는 버튼을 다시 누를 수 없게 한다.
5. 소리(sound.ts에 추가): 출발 나팔(depart), 귀환(return). App.tsx에서 출발 토스트와 귀환 토스트에 맞춰 낸다(귀환은 지금 victory/defeat를 내고 있으니 그 앞에 return을 짧게).
   진행 패널의 3D 전투는 지금 victory/defeat만 낸다. 패널이 펼쳐져 있을 때만 hit 소리를 아주 작게(설정 음량의 30%) 낸다.
6. 진행 패널이 폰 세로 화면에서 마을을 너무 가리지 않는지 보고, 필요하면 접힌 상태를 기본으로 하는 조건을 정한다(예: 높이 700px 미만).

완료 기준: npx tsc --noEmit, npm test, npm run build 통과. 개발 서버에서 출정 → 문으로 나감 → 패널 → 귀환까지 한 번 보고, 375px 폰 화면도 확인한다.
```

메모: 몬스터 초상과 던전 미리보기는 영웅 초상과 같은 오프스크린 렌더러에 캐시한다. 마을 문 위치는 그대로 두고 돌기둥·나무 아치·깃발·등불을 올렸고, 원정 중일 때만 문 옆 표지에 파티 수를 띄운다. 출정 버튼은 0.4초 도장 동안 다시 누를 수 없다. 높이 700px 미만이고 접힘 기록이 없으면 진행 패널은 접힌 채로 시작한다. 개발 서버에서 동굴 출정, 문, 패널, 귀환(패널이 사라짐), 375px 접힌 패널을 봤다. 도장 글자는 버튼이 잠긴 채로 확인했고, 나팔·귀환 소리는 스피커로 듣지 못했다.

---

## 14. 던전 미리보기를 배경 일러스트처럼

전투 창 던전 탭의 미리보기(portrait.ts의 dungeonPreviewUrl)가 "어두운 벽 앞 좁은 바닥에 보스 하나"로만 보여 배경 그림 느낌이 없다(사용자 피드백 2026-11-23). 던전마다 분위기가 다른 작은 3D 디오라마로 바꾼다.

**전달할 내용**

```
src/ui/voxel/portrait.ts의 dungeonPreviewUrl을 "던전 입구 풍경 일러스트"로 다시 만든다. 결과는 지금처럼 한 장 렌더해 이미지로 캐시한다. 게임 규칙과 화면 흐름은 바꾸지 않는다.

지금 문제: 벽 한 줄 + 바닥 한 줄 + 보스뿐이라 보스 사진처럼 보인다. 하늘·원경·근경이 없다.

할 일:
1. 장면 구성(모든 던전 공통): 하늘 그라디언트(위→아래 두 색, 큰 판 하나에 정점 색) → 원경(산·절벽 실루엣, 어둡고 채도 낮게) → 중경(던전 입구 구조물) → 근경(바닥 타일·소품) → 입구 앞에 보스(지금보다 작게, 화면 높이의 40% 정도) → 앞쪽 가장자리에 작은 소품 1–2개로 깊이감.
   카메라는 지금처럼 정사영이지만 약간 위에서 내려다보는 쿼터뷰(마을과 같은 느낌)로, 360×168 비율을 가득 채운다. 빈 배경색이 보이지 않게 한다.
2. 던전마다 입구와 분위기(id로 분기):
   - hill_cave(티어 1): 해질녘 주황 하늘, 풀 덮인 언덕에 어두운 동굴 입구(아치), 나무 2–3그루, 바위.
   - moss_path(티어 1): 숲속 저녁, 이끼 낀 돌길, 키 큰 나무, 반딧불(작은 발광 큐브 몇 개).
   - abandoned_mine(티어 2): 회색 절벽의 갱도 입구, 나무 지지대 틀, 레일과 광차, 등불(주황 발광).
   - deep_shaft(티어 2): 어두운 수직갱 위 비계와 도르래, 밧줄, 노란 수정.
   - barrow(티어 3): 보랏빛 밤하늘과 달(발광), 무덤 비석 여러 개, 죽은 나무, 묘지 입구 돌문.
   - sunken_crypt(티어 3): 물에 잠긴 지하 입구, 반투명 파란 물 바닥, 무너진 기둥, 보라 수정.
3. 조명은 장면마다 따뜻함/차가움이 보이게(태양 색과 반구광 색을 던전별로). 발광 소품(등불·수정·반딧불·달)으로 포인트.
4. 잠긴 던전: 같은 장면을 어둡게(전체 밝기 30%) + 가운데 큰 "?" 블록. 보스는 실루엣(검은색)으로.
5. 캐시 키에 잠김 여부를 넣는다. 렌더 뒤 장면을 모두 dispose한다(지금처럼 공유 렌더러 사용, WebGL 컨텍스트를 늘리지 않음).
6. 모든 박스는 kit.ts의 Builder로 합쳐 그린다(박스마다 메시 금지).
7. 개발 모드 설정 창의 아이콘 견본 줄 아래에 "던전 미리보기 견본"(6개 + 잠김 1개)을 둬서 한눈에 비교할 수 있게 한다.

완료 기준: npx tsc --noEmit, npm test, npm run build 통과. 견본에서 여섯 던전이 서로 다른 풍경으로 보이고, 보스만 덩그러니 있는 느낌이 없다. 375px 폰 화면의 던전 탭에서도 확인한다.
```

메모: 미리보기는 하늘 그라디언트, 먼 능선, 입구, 근경 소품, 화면 높이 40% 정도의 보스를 한 장의 정사영으로 찍는다. 잠긴 던전은 같은 장면을 30% 밝기로 다시 그리고 보스를 검게 한 뒤 가운데에 발광 물음표 블록을 얹는다. 캐시 키에 잠김 여부가 들어간다. 개발 모드 설정 견본에서 여섯 풍경과 잠긴 동굴을 봤고, 375px 던전 탭에서 동굴 풍경과 잠긴 광산의 물음표를 확인했다.

---

## 15. 영어 문구 다듬기 (GPT)

**전달할 내용**

```
게임의 영어 문구(src/locales/en.json)를 자연스러운 게임 영어로 다듬는다. 한국어(ko.json)가 원문이고, 영어는 대부분 직역이라 어색하다.

규칙:
- 이 작업은 src/locales/en.json만 고친다. 키 이름과 키 구조는 절대 바꾸지 않는다(ko.json과 같은 트리를 src/locales/parity.test.ts가 검사한다).
- {{name}}, {{count}} 같은 자리표시자는 이름과 개수를 그대로 둔다.
- 톤: 귀여운 판타지 마을 경영 게임. 짧고 친근하게. 버튼은 동사 하나나 두 단어(예: "Hire", "Set out").
- 같은 개념은 같은 단어로 통일한다(예: expedition / party / hero / retiree / village hall / guild). 고른 용어를 커밋 메시지에 표로 적는다.
- 영어에서 단수·복수가 갈리는 문장은 i18next 복수 키(_one/_other)가 필요하면 쓰지 말고, 메모에 "복수 처리 필요" 목록으로 남긴다(키 구조를 바꾸면 안 되므로).
- 화면 폭: 영어가 한국어보다 길어지면 버튼이 넘칠 수 있다. 버튼·칩 문구는 한국어 길이의 1.5배를 넘기지 않는다.

완료 기준: npm test 통과(특히 parity). 개발 서버를 English로 바꿔 여관·영웅·전투·마을 운영·설정 화면을 한 번씩 보고, 넘치거나 잘리는 문구가 있으면 메모에 적는다.
```

메모:
- 영어 UI에서 여관·영웅·전투·마을 운영·설정을 확인했다. 여관 독의 숫자 배지가 버튼 경계를 넘는 것으로 측정됐다. 확인한 창의 버튼·칩에서는 잘림이 없었다.
- 버튼·칩을 줄였지만 Set out, Heroes, Healthy 등은 한글 대비 글자 수 1.5배를 넘는다. 설정의 sound.depart·sound.return은 두 언어 모두 키가 표시된다.
- 복수 처리 필요 후보: 던전 층 수(battle.floors), 부재 시간(absence.hours), 자동 원정 횟수(absence.auto), 클리어 횟수(hero.clears). 현재는 숫자 레이블이나 시간 단위 기호를 사용한다.

---

## 16. 초반 흐름 개편 코드 리뷰 (GPT)

**전달할 내용**

```
커밋 a1dd951("Rework the early game so it keeps moving")을 리뷰한다. 코드는 고치지 않는다. 결과는 Docs/reviews/a1dd951.md 새 파일 하나에만 쓴다.

볼 것:
- git show a1dd951 로 변경을 보고, AGENTS.md의 규칙(코어 순수성, 데이터 주도, rng, 세이브 마이그레이션, 테스트)을 어긴 곳이 있는지.
- 정확성: 레벨업 성장(dungeon.ts applyReport의 training), 패배 경험치, 티어 1 사망 방지(game.ts settleExpedition), 출정 시 갈 수 없는 영웅 제외(startExpedition), 근접/원거리 기본 열 배치, 예전 세이브의 건물 시작 레벨 올리기(raiseToStart), 신전 치료 한 번에 완치.
- 밸런스 도구(tools/curve.ts, tune-curve.ts, first-hour.ts)가 실제 게임 규칙과 다르게 계산하는 곳이 있는지.
- 놓친 경계 조건: 예전 세이브, 오프라인 12시간 따라잡기, 원정 중 은퇴·해고, 파티가 비었을 때.

형식: 발견한 점마다 심각도(높음/보통/낮음), 파일:줄, 무엇이 잘못되는지, 재현 방법(가능하면 짧은 테스트 코드), 고치는 방법 제안. 문제가 없으면 "확인함" 목록으로 본 것을 적는다.

완료 기준: Docs/reviews/a1dd951.md 한 파일만 추가하는 커밋. 다른 파일은 바꾸지 않는다.
```

메모:
- 광고 치료와 오프라인 귀환 후 회복 문제, 초반 시뮬레이터 집계와 권장 레벨 산정 문제를 Docs/reviews/a1dd951.md에 기록했다.
- npx tsc --noEmit, npm test(97개), npm run build 통과.

---

## 17. 리뷰 a1dd951의 버그 두 개 수정 (GPT)

**전달할 내용**

```
Docs/reviews/a1dd951.md의 "보통" 두 건을 고친다. 이 작업은 src/core/game.ts와 src/core/flow.test.ts만 고친다. 세대 시스템 core 작업이 이 커밋 뒤에 game.ts를 크게 바꾸므로 범위 밖 정리는 하지 않는다.

1. 광고로 신전 치료를 끝내면 중상이 남는다.
   - 일반 치료 완료(finishCare)와 광고 보상(adReward placement 'temple')이 같은 "치료 완료" 함수를 부르게 한다. 결과: 부상·중상 → 피로, treatAt과 recoverAt을 지움.
   - flow.test.ts에 중상 영웅을 광고로 치료하는 테스트를 추가한다(기대 condition 'fatigued').
2. 오프라인 귀환 뒤 지난 시간이 부상 회복에 바로 반영되지 않는다.
   - advance()에서 returnExpeditions로 상태가 바뀐 영웅은, 그 원정의 returnAt부터 effectiveNow까지의 자연 회복을 같은 따라잡기 안에서 적용한다. 원정 중이던 시간은 회복으로 세지 않고, 다른 영웅의 회복을 두 번 세지 않는다.
   - 귀환으로 중상이 된 영웅이, returnAt + lifeRules.injury.recoverMs * 2가 지난 시각에 한 번 catchUp하면 바로 피로까지 회복되는지 확인하는 테스트를 추가한다. 회복이 runAuto보다 먼저 반영돼 자동 출정이 그 영웅을 쓸 수 있는지도 확인한다.

완료 기준: 공통 기준(tsc, test, build) 통과. 세이브 형식(SAVE_VERSION)은 바꾸지 않는다.
```

메모:
- 신전의 시간 완료와 광고 완료가 같은 치료 규칙을 사용한다. 두 경로에서 부상·중상은 피로로 바뀌고 치료·회복 타이머가 지워진다.
- 귀환한 영웅은 귀환 후에만 자연 회복하며 자동 출정 전에 회복을 반영한다. 회귀 테스트 2개를 추가했으며 세이브 버전은 그대로다.

---

## 18. 밸런스 도구 리뷰 지적 수정 (GPT)

**전달할 내용**

```
Docs/reviews/a1dd951.md의 "낮음" 두 건을 고친다. tools/first-hour.ts, tools/tune-curve.ts, Docs/dungeons.md만 고친다. 게임 코드(src/)는 건드리지 않는다.

1. first-hour.ts: 던전 선택에 보유 영웅 전체 평균 대신 실제로 출정할 후보(선택한 프리셋에서 canDeploy이고 다치지 않은 영웅)의 평균 레벨을 쓴다. 새 귀환은 history 길이 대신 갱신 전후의 가장 최근 기록(finishedAt)을 비교해 찾는다(기록이 10개로 꽉 차도 잡히게).
2. tune-curve.ts: 권장 레벨 승률 기준을 Docs/dungeons.md와 맞춘다. 문서의 "약 80%"가 실제 의도인지 코드의 60%인지 판단해 하나로 통일하고, 기준 값은 파일 위쪽 상수 하나로 둔다. 목표 레벨에서 기준 승률을 못 넘으면 "목표 미달"을 출력한다.

완료 기준: 공통 기준 통과. npx tsx tools/first-hour.ts 180 과 npx tsx tools/tune-curve.ts 결과를 커밋 메시지에 요약한다. dungeons.json 값은 바꾸지 않는다(바꿀 필요가 보이면 메모에 제안만 적는다).
```

메모:
- 출정 후보의 평균과 최근 귀환 시각을 쓰도록 수정했다. 180분 결과 마을 Lv 3·파티 Lv 6.7, 던전 4곳 클리어, 최근 10전 6승이다.
- 기존 조정 기준인 승률 60%를 유지했다. 30표본에서 여섯 목표를 달성했다. 이끼 길·광산·수직갱·묘지의 새 배수 후보는 다른 시드로 재검증한 뒤 적용할지 판단할 수 있다.
- 타입 검사, 테스트 99개, 프로덕션 빌드가 통과했다.

---

## 19. 세대 화면 (Cursor)

설계: `Docs/generations.md`. 세대 core는 443bde5에 들어갔다. 조회 함수와 필드 이름은 그 문서 7절에 있다.

**전달할 내용**

```
Docs/generations.md를 읽고, core에 이미 들어간 세대 규칙을 화면으로 보여준다. core(src/core, src/data)는 고치지 않는다. 필요한 조회 함수가 core에 없으면 멈추고 알린다.

만들 것:
1. 영웅 상세(heroScreens.tsx HeroDetail)에 "가족" 칸: 가문 이름, 배우자, 부모, 자녀(누르면 그 영웅 상세로). familyOf(state, id) 사용.
2. 같은 칸에 "친한 사이" 상위 3명: 이름, 호감도 막대, 단계(친구/연인/부부). topBonds(state, id, 3), bondStage 사용. 임신 중이면 "출산 예정" 칩과 남은 시간(hero.dueAt).
3. 청혼 카드: state.proposals가 있으면 마을 화면 위쪽 GuideCard 근처에 카드(두 영웅 초상, "승낙"/"나중에"/"거절"). 승낙은 acceptProposal, 거절은 declineProposal. 빈 집이 없으면(housingFree(state) === 0) 승낙을 막고 "집을 올리면 신혼집이 생겨요" 안내.
4. 마을 운영(villageScreens.tsx Town)에 "마을 인구" 칩 → 창: 나이대(어린이/견습/청년/…) × 남/여 표, 기혼/미혼 수, 침대 사용. population(state) 사용.
5. 가계도 창: 가문별로 세대를 줄로 그린 단순 트리(부부는 가로선, 자녀는 아래). 영웅 상세의 가문 이름을 누르면 열린다. 초상은 기존 portrait 함수.
6. 알림: 출생·결혼 때 토스트, 부재 보고서(Absence)에 "새 청혼 n건", "태어난 아이: 이름들" 줄.
7. 문구는 ko.json과 en.json에 같은 키로 넣는다(parity 테스트). 영어는 초안이면 된다(나중에 GPT가 다듬음).

확인: npm run dev에서 디버그 시간 가속으로 결혼·출생까지 진행해 각 화면을 본다. 폰 폭(375px)에서도 본다. 확인 못 한 부분은 메모에 적는다.
```

메모: 가문 이름은 아이가 태어나기 전에는 없고, 태어나면 아버지 이름이 된다. 나중에 버튼은 청혼을 지우지 않고 이번 화면에서만 숨긴다. 청혼 카드와 결혼 토스트, 가족 칸, 가계도, 인구 표, 부재 보고서의 출생 줄, 375px 인구 창을 봤다. 출산 예정 칩과 집이 없을 때 승낙이 막히는 문구는 그 상태가 화면에 안 떠서 보지 못했다.

---

## 20. 세대 3D 연출 (Cursor)

**작업 19가 커밋된 뒤에 시작한다.**

**전달할 내용**

```
Docs/generations.md를 읽고 마을 3D에서 가족이 보이게 한다. src/ui/voxel/VillageScene.ts와 src/ui/VillageView.tsx만 고친다. 외형은 core의 genesFor로 이미 부모를 닮으니 캐릭터 모델은 바꾸지 않는다.

1. 부부(spouseId)는 둘 다 마을에 있으면 산책할 때 나란히 걷는다(한 명이 목적지를 정하고 다른 한 명이 옆 자리를 따라감).
2. 14세 미만 아이는 부모 중 한 명 근처를 따라다니고, 가끔 혼자 뛰어다닌다. 크기는 기존 ageLook 그대로.
3. 결혼을 승낙하면 광장에서 두 영웅이 마주 보고 하트·꽃잎 파티클(코드로 만든 복셀). 아이가 태어나면 집 위에 작은 별 반짝임. VillageView가 state 변화(배우자 생김, roster에 parents가 있는 0세 영웅 추가)를 감지해 장면에 이벤트를 넘긴다.
4. 성능: 기존 표시 인원 자동 조절을 지킨다. 파티클은 짧게(2–3초) 끝나고 지오메트리를 해제한다.

확인: npm run dev에서 결혼·출생을 만들어 보고 스크린샷을 메모에 남긴다.
```

메모: 부부 중 id가 앞선 쪽이 길을 고르고 다른 쪽은 옆 자리를 따라간다. 14세 미만은 집에 있는 부모 옆을 따르다가 가끔 혼자 뛴다. 결혼하면 광장에서 마주 보고 하트·꽃잎이 2.6초 오르고, 출생하면 집 위에 별이 같은 시간 반짝인 뒤 지오메트리를 지운다. 화면에서 광장의 하트·꽃잎과 나란히 걷는 부부, 그보다 작은 아이를 봤다. 별은 같은 파티클이라 출생 직후 집 위에서 사라지기 전에 화면을 남기지는 못했다.

---

## 21. 세대 core 코드 리뷰 (GPT)

세대 core 커밋은 **443bde5**다.

**전달할 내용**

```
세대 core 커밋 443bde5를 리뷰한다(git show 443bde5). 코드는 고치지 않고 Docs/reviews/443bde5.md 새 파일 하나에만 쓴다. 형식은 Docs/reviews/README.md를 따른다.

볼 것:
- Docs/generations.md 규칙과 코드가 다른 곳(수치, 조건, 순서).
- AGENTS.md 규칙: 코어 순수성, 데이터 주도(family.json), rng/nonce 사용, 세이브 8 변환, 테스트.
- 경계: 원정 중 청혼·임신·출생, 배우자가 해고·묘지·은퇴, 오프라인 12시간에 계절이 여러 번 바뀔 때, 침대가 꽉 찼을 때, 무희 유전, 같은 영웅이 청혼 두 개에 걸리는 경우, 예전 세이브.
- genesFor가 기존 영웅의 외형을 바꾸지 않는지(look.test.ts와 비교).
```

메모:
- 가족 간 청혼, 출산 침대 예약 누락, 계절 경계 처리 순서, 사망 영웅의 청혼 승낙, 중복 특성 유전 확률을 리뷰에 기록했다.
- 가족 간 구애, 사망 후 승낙, 출산 뒤 6/5 침대 사용을 재현했다. 기존 외형 회귀 테스트와 세이브 8 변환도 확인했다.

---

## 22. 세대 시뮬레이터 (GPT)

세대 core는 443bde5에 들어갔다.

**전달할 내용**

```
tools/generations.ts 새 파일을 만든다. 실제 reduce를 써서 마을을 N년(기본 20년) 돌리고 결과를 표로 출력한다. tools/first-hour.ts의 플레이어 흉내(고용, 치료, 건설, 출정)를 참고하되 그 파일은 고치지 않는다. 청혼은 빈 집이 있으면 바로 승낙한다.

출력: 해마다 인구(어린이/성인/노인), 남녀 수, 부부 수, 누적 출생, 천재 수, 2세대·3세대 영웅 수, 평균 잠재력(1세대 vs 2세대). 마지막에 "첫 결혼까지 걸린 날", "첫 아이 출전까지 걸린 날".
package.json에 "sim:generations": "tsx tools/generations.ts" 한 줄만 추가한다. 다른 파일은 고치지 않는다.

완료 기준: 공통 기준 통과. 출력 요약과 눈에 띄는 밸런스 문제(예: 결혼이 너무 늦다, 인구가 침대를 넘친다)를 메모에 적는다. family.json 값은 바꾸지 않는다.
```

메모:
- 시드 11의 20년 실행에서 첫 결혼 1.00일, 자녀 첫 출정 20.06일, 누적 출생 5명과 천재 1명을 기록했다.
- 2년 차에 침대 10/10에 도달해 20년 차까지 3세대가 태어나지 않았다. 정원 초과는 0명이었다. 천재는 저장 플래그가 없어 유전 수치로 구별할 수 없는 경우 범위로 표시한다.
- tsx가 PATH에 없으면 npx --package tsx -c 파일 실행 환경에서 npm run sim:generations를 실행할 수 있다.

---

## 23. 첫 3시간 시뮬레이터를 여러 시드로 (GPT)

**전달할 내용**

```
tools/first-hour.ts만 고친다. 지금은 시드 11 하나로만 돌아서, 친밀도 보너스 같은 작은 변화에도 결과가 크게 흔들린다(시드 11에서 파티 Lv 6.7 ↔ 10.4). 다른 시드(1–6)로 돌리면 "party Lv 0.0"이 찍히는 시드가 있어, 출정 후보가 없을 때의 집계나 플레이어 흉내가 막히는 곳이 있는 것 같다.

1. 명령줄 인자로 시드 목록을 받는다(예: npx tsx tools/first-hour.ts 180 1,2,3,4,5,6). 기본은 지금처럼 11 하나. 시드가 여럿이면 시드별 한 줄 요약 + 중앙값·최소·최대(파티 레벨, 클리어 던전 수, 최근 10전 승수)를 출력한다.
2. "party Lv 0.0"이 나오는 원인을 찾아 고친다. 시뮬레이터 쪽 문제면 고치고, 게임 규칙 문제(진짜로 막히는 상황)로 보이면 고치지 말고 재현 방법을 메모에 적는다.

완료 기준: 공통 기준 통과. 시드 1–6, 11의 결과 요약을 커밋 메시지와 메모에 적는다.
```

메모:
- 180분 결과(시드 1/2/3/4/5/6/11): 파티 레벨 5.0/4.5/13.0/5.0/4.0/4.0/10.4, 클리어 2/2/6/2/1/1/5, 최근 10전 승수 2/2/10/2/0/0/8.
- 중앙값·최소·최대는 파티 레벨 5.0/4.0/13.0, 클리어 2/1/6, 최근 승수 2/0/10이다. 시드 1·2·6은 180분 종료 시 생존한 편성원이 모두 치료 중이어서 이전 평균이 0.0이었다. 생존자의 레벨과 출정 후보 수를 별도로 표시한다.
- 타입 검사, 도구 타입 검사, 테스트 116개, 프로덕션 빌드를 통과했다.

---

## 24. 첫 3시간 시뮬레이터의 플레이어를 사람처럼 (GPT)

**전달할 내용**

```
tools/first-hour.ts만 고친다. 게임 코드(src/)는 건드리지 않는다. 배경: 커밋 e032dd2 메시지. 지금의 흉내 플레이어는 진 던전을 계속 다시 가서(시드 2: 이끼 길 11연패), 실제 사람보다 훨씬 쉽게 막힌다.

플레이어 규칙을 다음처럼 바꾼다:
1. 같은 던전에서 2연패하면, 최근에 이긴 던전(없으면 hill_cave)으로 내려가 레벨이 1 오를 때까지 그곳을 돈다. 그다음 다시 위로 올라간다.
2. 마을에 살아 있는 탱커(warrior)나 힐러(cleric)가 없으면, 고용 인원 5명 제한을 넘겨서라도(침대가 있으면) 그 직업 방문자를 먼저 고용한다.
3. 골드가 고용비보다 적고 힐러가 없으면, 승리한 적 있는 가장 쉬운 던전으로 간다(골드 모으기).
4. 지금의 "패배 직후 한 단계 낮추기" 규칙은 1번으로 대체한다.

출력: 지금처럼 시드별 한 줄 + 중앙값·최소·최대. "연패 최대 길이"와 "골드가 고용비 아래로 30분 넘게 머문 시드 수"를 추가한다.

완료 기준: 공통 기준 통과. 시드 1–20 결과 요약을 커밋 메시지와 메모에 적는다. 그래도 막히는 시드가 있으면 시드 번호와 막힌 이유(로그 몇 줄)를 메모에 남긴다.
```

메모:
- 180분·시드 1–20 중앙값/최소/최대: 파티 Lv 12.6/9/18, 클리어 6/4/6, 최근 승수 10/5/10, 최장 연패 2/0/3. 고용비 미만 30분 초과는 시드 2(64분)와 11(35.75분)이다.
- 20개 시드 모두 던전 4곳 이상을 클리어했다. 시드 2는 19·31분 이끼 길 전멸 후 동굴 훈련으로 전환해 최종 5곳을 클리어했다. 시드 13은 광산·수직갱 시간 초과 후 4곳, 시드 18은 115·127분 묘실 시간 초과 후 수직갱 훈련을 거쳐 4곳으로 마쳤다.

---

## 25. 권장 레벨을 여러 파티 구성으로 재기 (GPT)

**전달할 내용**

```
tools/curve.ts, tools/print-curve.ts, tools/tune-curve.ts만 고친다. 게임 코드와 src/data는 건드리지 않는다(값을 바꿀 필요가 보이면 제안만 적는다).

배경: 지금 승률 곡선은 고정된 "전형적인 파티" 하나로만 잰다. 실제 게임에서는 첫 방문자에 전사·성직자가 반드시 있고(progression.starterClasses), 나머지는 무작위라서 음유시인 2명 같은 구성이 흔하다. 시드 2의 전사·성직자·마법사·음유시인·음유시인 파티는 곡선상 Lv4 승률 100%인 이끼 길(moss_path)에서 계속 전멸했다.

1. curve.ts에 "게임처럼 만든 파티" 표본을 추가한다: 시드마다 freshState의 첫 방문자 5명(전사·성직자 포함)을 그대로 파티로 쓰고, 기존 partyAtLevel처럼 레벨을 맞춘다. 표본 수는 상수(기본 40).
2. print-curve.ts는 던전 × 레벨마다 중앙값 승률과 하위 25% 승률을 함께 출력한다(예: "90%/55%"). 기존 고정 파티 결과도 옵션으로 남긴다.
3. tune-curve.ts의 판정 기준을 "하위 25% 파티도 권장 레벨에서 기준 승률(지금 60%)을 넘는다"로 바꾸는 옵션을 추가하고, 그 기준으로 던전별 권장 레벨·monsterScale 후보를 표로 출력한다. dungeons.json은 바꾸지 않는다.
4. 구성별로 특히 약한 조합(예: 딜러 부족, 음유시인 2명)이 보이면 메모에 적는다.

완료 기준: 공통 기준 통과. print-curve와 tune-curve 출력 요약을 커밋 메시지와 메모에 적는다.
```

메모:
- 초기 방문자 40개 파티 × 전투 10회로 중앙값/P25를 측정했다. 이끼 길 Lv1은 100%/70%, 광산 Lv2는 100%/0%였다. 음유시인 2명인 시드 2의 이끼 길 승률은 Lv2 40%, Lv4 100%로, 건강한 파티 곡선에서는 Lv4 전멸이 재현되지 않았다.
- P25 조정 후보(동굴·이끼 길·광산·수직갱·묘지·묘실 순)는 3.75/5.40/1.80/2.10/3.05/3.85, 목표 P25는 60/60/90/60/60/60%다. 특히 동굴 배수는 초반 흐름 시뮬레이션으로 따로 검증할 후보로 남겼다.
- 기존 고정 파티 출력과 조정 모드도 실행했다. 프로젝트·도구 타입 검사, 테스트 124개, 프로덕션 빌드 통과.

---

## 26. 출발 준비의 파티 구성 안내 (Cursor)

**지금 시작할 수 있다.** core는 고치지 않는다.

**전달할 내용**

```
src/ui/game/battleScreens.tsx(출발 준비 Prep, 파티 편성 PartyEditor)와 src/locales/ko.json·en.json만 고친다. core(src/core, src/data)는 고치지 않는다.

배경: Docs/dungeons.md. 권장 레벨은 첫 방문자 파티 하위 25% 기준이지만, 음유시인 2명처럼 구성이 나쁜 파티는 권장 레벨에서도 진다. 플레이어가 출발 전에 알 수 있게 한다.

1. 편성된 파티의 역할(classById(classId).role: tank/dps/healer/support)을 세어 경고 칩을 보여준다.
   - 탱커 없음, 힐러 없음: 빨간 칩(지금 패배 이유 noTank/noHealer와 같은 뜻).
   - 딜러(dps)가 1명 이하: 노란 칩 "딜러가 부족해요 — 오래 싸우다 지기 쉬워요".
   - 같은 지원(support) 직업 2명 이상: 노란 칩 "음유시인이 둘이면 효과가 겹쳐요"(직업 이름은 실제 직업으로).
2. 칩은 Prep의 파티 요약 옆과 PartyEditor 위쪽에 보인다. 출발을 막지는 않는다.
3. 파티 평균 레벨이 던전 권장 레벨보다 낮으면 기존 표시를 그대로 두고, 위 경고와 겹치지 않게 배치한다.
4. 문구는 ko/en 같은 키(parity 테스트).

확인: npm run dev에서 일부러 탱커·힐러를 빼거나 음유시인 둘을 넣어 칩을 본다. 375px 폭에서도 본다.
```

메모: 빈 파티에는 역할 칩을 붙이지 않고, 사람이 있으면 탱커·힐러 없음은 빨강, 딜러 1명 이하는 노랑, 같은 지원 직업 2명 이상은 직업 이름으로 노란 칩을 붙인다. 출발은 막지 않고 권장 레벨 줄은 그대로 둔다. 375px에서 음유시인 둘·힐러만 있는 파티의 칩이 카드 안에서 줄바꿈되는 것을 봤다.

---

## 27. 명예의 전당·묘지·조상 화면 (Cursor)

**작업 26과 2b core 커밋 뒤에 시작한다.** 설계: `Docs/generations.md` 9–11절. 조회 함수 이름은 core 커밋 메시지에 적는다.

**전달할 내용**

```
Docs/generations.md의 2b(9–11절)를 읽고 화면으로 보여준다. core는 고치지 않는다. 필요한 조회 함수가 없으면 멈추고 알린다.

1. 영웅 목록 아래 묘지를 다시 꾸민다: 이름·직업·레벨·떠난 해·나이·사인(전투/노환) 아이콘. 전설(legend)은 금테.
2. 명예의 전당 창: hallOfFame(state). 마을 운영 화면에 버튼. 가문별로 묶어 보기, 각 전설의 초상(무덤의 genes로 portrait), 클리어 던전.
3. 가계도(FamilyTree)에 무덤에 있는 조상도 보인다(흐린 초상 + 비석 표시). ancestorsOf 사용.
4. 영웅 상세 가족 칸에 "가문의 전설 n명 · 잠재력 +x" 표시(familyLegends).
5. 자연사 알림: 토스트("○○이(가) ○○세로 세상을 떠났습니다"), 부재 보고서 deaths 줄.
6. 집 3·4레벨이 마을 운영 건설 목록에 자연스럽게 보이는지 확인(데이터만 늘어났으므로 화면이 깨지지 않는지).
7. 문구 ko/en 같은 키.

확인: npm run dev, 디버그 시간 가속과 나이 조작(설정의 디버그)으로 노환 사망을 만들어 본다. 확인 못 한 것은 메모에.
```

메모: 묘지는 이름·직업·레벨·해·나이·사인 아이콘으로 다시 그렸고 전설은 금테다. 명예의 전당은 가문별로 묶고, 가계도의 무덤 조상은 흐린 초상과 비석으로 둔다. 자연사는 토스트와 부재 보고서 줄로 알린다. 집 2레벨에서 3레벨 비용(90/40/20), 집 3레벨에서 4레벨 비용(160/60/40/10)이 마을 운영에 그대로 보였다. 초상은 무덤에 유전자가 있으면 그 얼굴을 쓴다.

---

## 28. 집 레벨별 모습·묘지 비석 3D (Cursor)

**작업 27 뒤에 시작한다.**

**전달할 내용**

```
src/ui/voxel/VillageScene.ts와 src/ui/voxel/world.ts만 고친다.
1. 집 건물이 레벨(1–4)마다 모습이 달라진다: 2레벨 2층, 3레벨 옆채, 4레벨 마당과 울타리. 기존 그리기 방식(merged geometry Builder)을 따른다.
2. 마을 가장자리에 작은 묘지: 무덤 수만큼 비석(최대 12개, 넘으면 오래된 것부터 생략). 전설 무덤은 금빛 비석.
3. 성능: 정적 지오메트리로 합쳐 그리고, 무덤 수가 바뀔 때만 다시 만든다.
확인: 스크린샷을 메모에.
```

메모: 2레벨은 2층, 3레벨은 광장 쪽 옆채, 4레벨은 마당과 울타리다. 비석은 문 옆 풀밭에 최대 12개, 최근 무덤만, 전설은 금색이다. 합쳐 그린 뒤 보이는 무덤이 바뀔 때만 다시 만든다. 장면은 화면이 넘겨 주는 목록만 알 수 있어서 VillageView와 App에 무덤 목록을 넘기는 두 줄을 더했다. 4레벨 집과 흰 비석·금 비석이 마을에 보이는 것을 확인했다.

---

## 29. 2b core 코드 리뷰 (GPT)

**2b core 커밋 뒤에 시작한다.** 해시는 작업 표에 적어 둔다.

**전달할 내용**

```
2b core 커밋을 리뷰한다(해시는 Docs/tasks.md 표의 29번 행). 코드는 고치지 않고 Docs/reviews/<해시>.md 새 파일 하나에만 쓴다. Docs/reviews/README.md 형식.

볼 것: Docs/generations.md 9–11절과 코드의 차이, 자연사 판정 시점(해 바뀜, 원정 중, 은퇴자, 80세), 무덤 정보와 예전 무덤 호환, 전설 판정, 가문 보너스 상한, 사별·건물 자리 비우기, 세이브 9 변환, rng 사용, 오프라인 따라잡기.
```

메모:
- 새해 전 귀환한 영웅의 무덤 연도·나이, 따라잡기 상한 너머의 사별 시각, 첫 전투 사망자의 노환 매장, 미등록 던전 이력 예외를 직접 재현했다.
- 리뷰 보고서에 심각도와 재현·수정 제안을 적었다. 은퇴자 사망과 건물 자리, 전설 상한, 세이브 8 무덤 호환도 확인했다.

---

## 30. 세대 시뮬레이터 60년 (GPT)

**2b core 커밋 뒤에 시작한다.**

**전달할 내용**

```
tools/generations.ts만 고친다. 기본 기간을 60년으로 늘리고(인자로 바꿀 수 있게), 흉내 플레이어가 (1) 50세가 넘은 영웅을 은퇴시키고 (2) 침대가 모자라면 집을 올리고 (3) 청혼은 빈 집이 있으면 승낙하게 한다.

출력에 해마다 사망(노환/전투), 명예의 전당 수, 세대별 인원(1·2·3·4세대), 가문 수, 침대 사용을 더한다. 마지막에 "3세대 첫 출생까지 걸린 날", "가문 보너스를 받은 아이 수".

완료 기준: 공통 기준 통과. 시드 11과 1–5의 요약, 눈에 띄는 밸런스 문제를 메모에 적는다. family.json·village.json 값은 바꾸지 않는다(제안만).
```

메모:
- 60년 시드 11/1/2/3/4/5 순: 누적 출생 18/35/21/19/34/12명, 3세대 첫 출생 57/54/57/124/56/64일, 가문 보너스를 받은 아이 6/8/0/0/12/3명.
- 최종 침대 사용은 9/20, 20/20, 13/20, 19/20, 19/20, 9/15였고 정원 초과는 0명이었다. 시드 3의 첫 결혼은 69일(다른 시드 1일), 시드 1은 60년 말에도 만실이었다. 시드 2·3에서는 전설이 생겨도 보너스를 받은 출생이 없었다.
- 프로젝트·도구 타입 검사, 테스트 131개, 프로덕션 빌드를 통과했다.

---

## 31. 행운의 분수 3D (Cursor)

설계: `Docs/fountain.md`. 분수 core는 5322f86에 들어갔다. 광장 한가운데 임시 대야(world.ts의 fountain 자리)를 진짜 모델로 바꾼다. 조회 함수 이름은 core 커밋 메시지에 있다.

**전달할 내용**

```
Docs/fountain.md를 읽고 마을 광장 한가운데에 행운의 분수를 3D로 만든다. src/ui/voxel/VillageScene.ts, src/ui/voxel/world.ts, src/ui/VillageView.tsx만 고친다. core는 고치지 않는다.

1. 분수 모델: 레벨(state.buildings.fountain, 1–4)마다 모습이 커진다. 1 돌 대야, 2 2단, 3 조각상, 4 금장식. 물은 반투명 파란 복셀, 물줄기는 가볍게 위아래로 움직인다. 기존 merged geometry Builder 방식을 따른다. 광장에 있던 것과 겹치면 옮긴다.
2. 소원이 하나 이상이면(fountainWishes(state, now) > 0) 물 위에 반짝임, 꽉 차면 물 위에 동전 몇 개.
3. 분수를 탭하면 VillageView가 onWish 콜백을 부른다(App이 { type: 'wish', now }를 보냄). 다른 건물 탭(onPickBuilding)과 겹치지 않게 판정한다.
4. 연출: state.fountain.last가 바뀌면(at이 새 값) 동전 3–5개가 분수에서 튀어 오른다. last.jackpot이면 금빛 물줄기와 동전 비(2–3초). 파티클은 끝나면 지오메트리를 해제한다.

확인: npm run dev에서 눌러 보고, 대박은 디버그로(fountain.json의 1레벨 jackpotChance를 잠시 1로 바꿔 보고 되돌림) 확인. 스크린샷을 메모에.
```

메모: 레벨마다 대야가 커지고, 2레벨은 2단, 3레벨은 조각상, 4레벨은 금테다. 물은 가운데가 열린 테두리 위의 반투명 파랑이고 물줄기는 위아래로 움직인다. 소원이 있으면 물 위에 반짝임, 가득 차면 동전이 뜬다. 분수를 누르면 건물 창 대신 소원을 쓰고, 골드는 196에서 198로 올랐다. 대박 확률을 잠깐 1로 두고 금빛 물줄기와 골드 30(198→228)을 본 뒤 확률은 0.02로 되돌렸다. 장면이 소원 수를 받도록 App에서 넘기는 줄을 더했다.

---

## 32. 행운의 분수 화면·소리 (Cursor)

**작업 31 뒤에 시작한다.**

**전달할 내용**

```
Docs/fountain.md를 읽고 분수의 화면 요소를 만든다. src/ui/App.tsx, src/ui/game/villageScreens.tsx, src/ui/game/heroScreens.tsx, src/ui/sound.ts, src/ui/styles.css, src/locales/*만 고친다.

1. 하단 독 옆 작은 분수 버튼: 남은 소원 수 배지, 다음 소원까지 남은 시간 원형 표시(fountainNextAt). 누르면 { type: 'wish', now }.
2. 소원을 쓰면 "+n" 골드 글자가 떠올라 HUD 골드 칸으로 날아간다. 대박이면 큰 금빛 "+n"과 토스트("대박! 분수에서 n골드").
3. 마을 운영 건설 목록에 분수(레벨·다음 레벨에서 바뀌는 점: 간격·최대 소원·한 번 골드·대박 확률). 최근 대박 기록(state.fountain.lastJackpot).
4. 은퇴자 자리 목록에 분수(보너스: 대박 확률 +1%p). heroScreens의 bonusValue 표시도 맞춘다.
5. 소리: 동전 짤랑, 대박 팡파르(기존 코드 합성 방식).
6. 길잡이 단계 'wish' 문구.
7. 문구 ko/en 같은 키.

확인: npm run dev, 375px 폭도. 확인 못 한 부분은 메모에.
```

메모: 독 오른쪽 위에 분수 버튼이 있고, 배지와 원형 시간이 소원을 따라간다. 누르면 "+2"가 버튼에서 떠오르고, 소원이 없으면 "아직 소원이 차지 않았습니다"가 뜬다. 마을 운영 카드에 간격·최대·골드·대박 확률과 최근 대박(1년 가을, 30골드)이 보인다. 은퇴자가 없어 배치 칩은 화면에서 못 봤고, 보너스는 0.01을 1%p로 보여 준다. 대박 토스트와 팡파르 소리는 이번 확인에서 터지지 않았다. 길잡이 문구는 이미 있었다. 효과음 개수 테스트만 16으로 고쳤다.

---

## 33. 분수 core 코드 리뷰 (GPT)

분수 core 커밋은 **5322f86**다.

**전달할 내용**

```
분수 core 커밋을 리뷰한다. 코드는 고치지 않고 Docs/reviews/<해시>.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/fountain.md와 수치·규칙 차이, 충전 계산(최대치, 남은 진행, 레벨이 바뀔 때, 오프라인 12시간 상한, 시계가 뒤로 갈 때), 대박 rng와 nonce, 은퇴자 보너스, 길잡이 단계 삽입과 예전 세이브의 guideStep 밀기, 세이브 10 변환.
```

메모:
- 증축 전 시간에 새 충전 규칙이 소급되는 경우와, 시계가 뒤로 갔다 돌아올 때 같은 시간으로 소원이 다시 차는 경우를 재현했다.
- 충전 상한·진행 보존, 시드와 nonce, 은퇴자 보너스, 길잡이 단계 이동과 세이브 10 변환을 확인했다. 재현 및 수정 제안은 Docs/reviews/5322f86.md에 정리했다.

---

## 34. 분수가 초반 골드에 주는 몫 측정 (GPT)

**분수 core 커밋 뒤에 시작한다.**

**전달할 내용**

```
tools/first-hour.ts만 고친다. 지금은 길잡이 단계 때문에 분수를 한 번만 누르고, 분수 업그레이드는 누르지도 않으면서 사서 골드를 낭비한다(시드 20개 중 고용비 미만 30분 초과가 2→5). 흉내 플레이어에 "분수 누르기" 옵션을 추가한다: 끔 / 소원이 있으면 바로 누름 / 5분마다 확인. 분수 업그레이드도 다른 건물처럼 살 수 있게 한다.

출력: 세 경우마다 시드 1–20 중앙값으로 첫 1시간·3시간 총 골드 수입, 그중 분수 몫(%), 대박 횟수, 던전 첫 클리어 시간. 

완료 기준: 공통 기준 통과. 결과를 커밋 메시지와 메모에. 목표(Docs/fountain.md 1절: 1레벨 분수가 초반 원정 수입의 25–35%)에서 벗어나면 fountain.json 조정 제안을 메모에 적는다(값은 바꾸지 않는다).
```

메모:
- 시드 1–20, 끔/즉시/5분의 1시간 총수입 중앙값은 323.5/678/645.5, 3시간은 812/2056.5/2018골드. 분수 몫은 0/46.8/47.1%와 0/55.3/55.2%, 대박은 0/2/2회와 0/9/8.5회였다.
- 첫 동굴 클리어는 세 정책 모두 1.1분이었다. 3시간 안에 묘실을 클리어한 시드는 11/13/12개였다. 끔은 분수 증축을 건너뛰며 길잡이가 소원 단계에서 멈춘다.
- Lv1 고정 즉시 사용은 첫 1시간 148골드(분당 2.47), 원정 대비 52.6%였다. 25–35% 비율을 우선하면 Lv1 간격 100–105초를 후보로 재측정하되, 분당 2–3골드 목표와는 현재 원정 수입 기준으로 함께 맞추기 어렵다.

---

## 35. 독늪 몬스터·던전 그림 (Cursor)

**지금 시작할 수 있다.** 설계: `Docs/depth.md` 3a. core는 아직 이 id들을 모르지만, 그림은 id만 있으면 된다.

**전달할 내용**

```
Docs/depth.md의 3a를 읽고 독늪 습지의 3D 그림을 만든다. src/ui/voxel/enemies.ts, src/ui/voxel/portrait.ts만 고친다. core와 data는 고치지 않는다.

몬스터 id(곧 monsters.json에 들어간다): venom_toad(독두꺼비), bog_leech(늪거머리), moss_golem(이끼골렘, 크고 단단함), wisp(도깨비불, 떠다니는 작은 불빛, 후열), bog_queen(보스 늪의 여왕, 덩굴 왕관을 쓴 큰 두꺼비 또는 늪 마녀).
던전 id: venom_marsh(독늪 습지, 티어 4).

1. buildEnemy에 다섯 몬스터. 기존 creature 종류(beast/flyer/blob/spider/ghost)를 재사용하거나 필요하면 'golem'·'wisp' 종류를 추가한다. 늪 색(탁한 초록·보라·갈색).
2. dungeonPreviewUrl이 tier 4·venom_marsh를 늪 입구 풍경(물웅덩이, 죽은 나무, 안개)으로 그린다.
3. monsterPortraitUrl이 다섯 몬스터를 그린다.

확인: 개발 화면에 아직 이 던전이 없으므로, 임시로 브라우저 콘솔이나 작은 테스트 페이지 없이 portrait 함수를 직접 불러 그림을 확인하고(예: 기존 portrait 테스트 방식) 스크린샷을 메모에. 임시 코드는 커밋하지 않는다.
```

메모: 독두꺼비·늪거머리·이끼골렘·도깨비불·늪의 여왕을 탁한 초록과 보라로 그렸다. 여왕은 덩굴 왕관을 쓴 큰 두꺼비다. 던전 입구는 죽은 나무, 물웅덩이, 안개, 어두운 아치다. portrait 함수로 다섯 초상과 입구를 화면에 올려 확인했고, 임시 화면은 커밋하지 않았다.

---

## 36. 상태이상·물약 화면과 연금술 공방 (Cursor)

3a core는 1918eda에 들어갔다. 조회 함수와 필드 이름은 그 커밋 메시지에 있다. 전투 로그 키: log.paralyze, log.paralyzed, log.slow, log.silence, log.sweep, log.potion(params.potion). 패배 이유: poisoned, silenced, paralyzed. 몬스터 이름 enemy.venom_toad 등, 던전 dungeon.venom_marsh, 재료 herb, 물약 4종도 문구가 필요하다.

**전달할 내용**

```
Docs/depth.md 3a를 읽고 화면을 만든다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core는 고치지 않는다.

1. 연금술 공방 창: 만들 수 있는 물약(레벨별), 재료·시간, 진행 막대, 창고 재고. 대장간 창 구조를 따른다.
2. 출발 준비(Prep): 이번 출정에 가져갈 물약 수(종류별, 파티당 상한)와 창고 재고. 물약 작전 줄("체력 n% 미만이면 회복 물약").
3. 원정 기록·리포트: 물약을 몇 개 썼는지, 새 패배 이유 4가지 문구와 추천 물약.
4. 진행 패널·전투 로그: 상태이상 로그 키 문구.
5. 새 재료 약초를 HUD·비용 목록에 표시.
6. 문구 ko/en 같은 키.

확인: npm run dev에서 독늪까지 가는 세이브를 만들어(디버그 골드·시간 가속) 물약을 만들고 들고 가 본다. 확인 못 한 부분은 메모에.
```

메모: 공방에서 해독 물약을 만들기 시작했고, 창고와 10분 막대가 보였다. 출발 준비에서 해독 1개를 챙기고 독늪에 나가 승리했다. 던전 카드에 늪의 여왕·독두꺼비·늪거머리·도깨비불·이끼골렘이 나온다. HUD에 약초가 있다. 375px에서 가로 스크롤은 없었다. 그 파티는 피해가 없어 물약 로그가 안 나왔고, 약한 파티 기록에서는 "침묵", "독 피해", "해독 물약을 마심"이 나왔다. 패배 추천 문구는 그 판이 승이라 화면에는 안 떴다.

---

## 37. 상태 표시·물약 동작·연금술 공방 건물 3D (Cursor)

**작업 36 뒤에 시작한다.**

**전달할 내용**

```
src/ui/voxel/BattleScene.ts, src/ui/voxel/replay.ts, src/ui/voxel/world.ts, src/ui/voxel/VillageScene.ts만 고친다.
1. 전투 다시 보기에서 상태 표시: 중독 초록 방울, 마비 노란 번개, 둔화 달팽이 껍데기 아이콘, 침묵 X 말풍선. replay 로그의 상태 키를 따라 켜고 끈다.
2. 물약을 마시는 동작(병을 들고 기울임)과 회복·해제 반짝임.
3. 마을에 연금술 공방 건물(레벨 1–3, 솥과 굴뚝 연기). LOTS에 자리를 잡는다.
확인: 스크린샷을 메모에.
```

메모: 다시 보기에서 중독은 초록 방울, 마비는 노란 번개, 둔화는 껍데기, 침묵은 X 말풍선으로 머리 위에 켜진다. 물약을 마시면 병을 기울이고 반짝인 뒤 해당 상태가 꺼진다. 층이 바뀌면 표시를 지운다. 공방은 초록 지붕, 앞의 솥, 굴뚝 연기다. 2레벨은 약병, 3레벨은 금색 간판이 더해진다. 마을 세이브의 공방은 아직 0레벨이라 빈 터라, 1·3레벨 모델을 따로 그려 확인했다. 병 기울이는 순간은 정지 화면으로 남기지 못했다.

---

## 38. 3a core 코드 리뷰 (GPT)

3a core 커밋은 **1918eda**다.

**전달할 내용**

```
3a core 커밋을 리뷰한다. 코드는 고치지 않고 Docs/reviews/<해시>.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/depth.md 3a와 수치·규칙 차이, 상태이상 4가지의 판정 순서와 상한, 기존 dot를 중독으로 옮길 때 기존 던전 결과가 바뀌지 않았는지(tests/balance.test.ts와 곡선 비교), 물약 창고(출정 때 빼고 귀환 때 돌려줌, 원정 중 창고, 자동 원정), 물약 작전, 연금술 공방 제작, 약초 드롭, 마을 Lv4, 패배 이유 순서, 세이브 11 변환, rng.
```

메모:
- 각성 물약의 마비 해제 불가, 침묵 표적 우선순위, 공방 레벨에 따른 제작 시간 감소 누락, 해독 면역의 즉시 차감을 재현해 Docs/reviews/1918eda.md에 기록했다.
- 부모 커밋과 비교한 기존 던전 승률 24칸 및 시드 전투 24개의 결과·로그가 모두 일치했다. 창고 차감·반납, 약초, 해금 조건, 세이브 11도 검토했다.

---

## 39. 독늪 밸런스 측정 (GPT)

**3a core 커밋 뒤에 시작한다.**

**전달할 내용**

```
tools/curve.ts, tools/print-curve.ts, tools/tune-curve.ts, tools/first-hour.ts만 고친다. 게임 코드와 data는 고치지 않는다(제안만).
1. 곡선 도구에 "물약 지참" 조건(없음 / 해독 2 / 회복 2 + 해독 2 / 힐러 빼고 회복 4 + 해독 1)을 추가하고 독늪 Lv8–14 승률(중앙값/하위 25%)을 출력한다. 참고: Claude가 잰 값은 Docs/depth.md 3a "밸런스 기준"에 있다(해독 4개 기준).
2. first-hour.ts를 6시간까지 돌릴 수 있게 하고, 흉내 플레이어가 연금술 공방을 짓고 독늪 전에 물약을 만들어 들고 가게 한다.
3. Docs/depth.md 3a "밸런스 기준"(해독 4개면 하위 25%도 60% 이상; 물약 값은 반복 보상의 20–30%)과 비교하고, 힐러 없이 회복 물약으로 깨지는지도 메모에 적는다.
```

메모:
- 40파티×10전 Lv11 중앙값/P25(무물약/해독2/회복2+해독2/힐러 제외/해독4)는 40/0, 75/10, 75/0, 0/0, 100/40%였다. 해독4는 24×6에서 P25 67%로 설계 기준을 재현했으나 큰 표본에서는 60% 미달이었다. 배수 1.85의 P25 70%를 재검증 후보로 기록했다.
- 해독4 제조비는 12/44골드(27%). 회복2+해독2는 14/44(32%), 힐러를 뺀 회복4+해독1은 22/44(50%, 배치 구매 기준)이고 Lv8–14 전체에서 승리가 없었다. 힐러 자리는 비운 조건이다.
- 시드 1–20의 6시간 실행에서 공방 20/20, 독늪 67출정, 클리어 8/20(성공 시드 중앙값 297.3분). 프로젝트·도구 타입 검사, 테스트 162개, 프로덕션 빌드 통과.

---

## 40. 도적 요새 몬스터·던전 그림 (Cursor)

**지금 시작할 수 있다.** 3b core는 1f690a1에 들어갔다. 설계: `Docs/depth.md` 3b.

**전달할 내용**

```
Docs/depth.md의 3b를 읽고 도적 요새의 3D 그림을 만든다. src/ui/voxel/enemies.ts, src/ui/voxel/portrait.ts만 고친다. core와 data는 고치지 않는다.

몬스터 id: bandit_thug(도적 졸개, 두건과 몽둥이), crossbowman(석궁병, 후열), cutthroat(암살자, 복면과 쌍단검, 날렵함), bandit_chief(보스 도적 두목, 큰 체구·외투·큰 도끼).
던전 id: bandit_fort(도적 요새, 티어 5).

1. buildEnemy에 네 몬스터. 사람형이면 기존 humanoid 종류를 재사용하거나 필요하면 추가한다. 색은 가죽 갈색·어두운 빨강·회색 천.
2. dungeonPreviewUrl이 bandit_fort를 나무 목책과 망루, 횃불이 있는 요새 입구로 그린다.
3. monsterPortraitUrl이 네 몬스터를 그린다.

확인: 개발 화면에서 도적 요새 카드(디버그로 독늪까지 클리어한 세이브)나 portrait 함수를 직접 불러 확인하고 스크린샷을 메모에. 임시 코드는 커밋하지 않는다.
```

메모: 졸개는 두건·몽둥이, 석궁병은 활·화살통, 암살자는 두건·쌍단검(왼손 단검 추가), 두목은 큰 체구·외투·곡괭이형 도끼다. 요새 입구는 나무 목책·망루·횃불·게이트다. portrait를 직접 불러 네 초상과 입구를 확인했다.

---

## 41. 마법 공방 화면·장신구 장착·함정/기습 문구 (Cursor)

**지금 시작할 수 있다(작업 40과 파일이 겹치지 않는다).** 3b core는 1f690a1. 조회 함수와 필드는 그 커밋 메시지와 `src/core/magic.ts`에 있다.

**전달할 내용**

```
Docs/depth.md 3b를 읽고 화면을 만든다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core는 고치지 않는다.

core에 이미 있는 것:
- 건물 id 'magic'(마을 Lv5), 동작 { type: 'enchant', trinketId, now }, state.magic(진행 중인 작업, finishAt), enchantTime(state, id), magicRules.trinkets(재료·레벨·시간), TRINKET_IDS.
- 장신구는 state.stash의 Gear(slot 'trinket', recipeId 'trinket.<id>')다. 영웅마다 두 개(magicRules.trinketSlots). 셋째를 끼우면 가장 오래된 것이 빠진다. 해제는 { type: 'unequip', heroId, slot: 'trinket', gearId }.
- 새 재료 crystal(마력 수정). 문구 키: building.magic, buildingHint.magic, material.crystal, resource.crystal, item.trinket.<id>, trinket.hint.<id>, defeat.trapped, defeat.ambushed, result.noMagic, result.magicBusy, log.trap, log.trapHit, log.disarm, log.alert, log.ambush, enemy.bandit_*, enemy.crossbowman, enemy.cutthroat, dungeon.bandit_fort.
- 리포트: report.traps = { sprung, disarmed } (함정이 있는 던전만).

1. 마법 공방 창: 만들 수 있는 장신구(공방 레벨별), 골드·마력 수정·시간, 진행 막대. 연금술 공방 창 구조를 따른다. App.tsx의 BUILDING_SCREEN에서 magic을 새 화면으로 바꾼다.
2. 영웅 장비 칸: 장신구 두 칸을 무기·방어구 아래에 보이고, 창고의 장신구를 끼우고 뺀다. 효과 한 줄(trinket.hint).
3. 출발 준비(Prep): 도적 요새를 고르면 "함정: 도적 있음/함정 감지 있음/없음", "기습: 경계 있음/없음"을 한 줄로 보여 준다(파티 영웅의 classId와 heroTrinkets로 판단).
4. 원정 기록·리포트: 함정 해제/발동 횟수, 새 패배 이유 2가지 문구.
5. HUD·비용 목록에 마력 수정.
6. 문구 ko/en 같은 키. 이미 넣은 키는 다듬어도 된다.

확인: npm run dev에서 디버그로 마을 Lv5·공방을 만들고 장신구를 만들어 끼운 뒤 요새에 나가 본다. 확인 못 한 부분은 메모에.
```

메모: 가짜 세이브로 공방 Lv2 화면을 띄워 경계·함정 감지·해독·굳건은 만들 수 있고 고요는 Lv3에 잠긴 것을 확인했다. HUD에 마력 수정이 보인다. 요새의 함정·기습 대비 줄과 장신구 장착은 코어 조회로 맞췄고, 실제 마을 Lv5까지 올려 요새에 나가 보지는 않았다.

---

## 42. 함정·기습 연출과 마법 공방 건물 3D (Cursor)

**작업 41 뒤에 시작한다.**

**전달할 내용**

```
src/ui/voxel/BattleScene.ts, src/ui/voxel/replay.ts, src/ui/voxel/world.ts, src/ui/voxel/VillageScene.ts만 고친다.
1. 전투 다시 보기: log.trap이면 바닥에서 가시가 튀어나오고 log.trapHit 대상의 체력이 그만큼 준다(replay가 이 피해를 반영해야 체력 막대가 맞는다). log.disarm이면 도적이 쭈그려 앉아 손을 움직이고 작은 톱니 아이콘. log.ambush면 공격자가 연기와 함께 후열 대상 옆에 나타났다가 돌아간다. log.alert면 영웅 머리 위 느낌표.
2. 마을에 마법 공방 건물(레벨 1–3, 보라 지붕, 떠다니는 수정). world.ts LOTS의 magic 자리는 임시이므로 어울리게 옮겨도 된다.
확인: 스크린샷을 메모에.
```

메모: 함정이 터지면 가시가 솟고 trapHit가 체력 막대에 반영된다. 해제는 쭈그려 앉아 톱니 아이콘, 경계는 느낌표, 기습은 연기와 함께 후열 옆에 나타났다가 돌아간다. 마법 공방은 신전 동쪽(5.2, -10.2)에 보라 지붕·떠다니는 수정이고, 2레벨은 선반 수정, 3레벨은 금 간판이다. 1·3레벨 모델과 전투 연출을 따로 그려 확인했다.

---

## 43. 3b core 코드 리뷰 (GPT)

3b core 커밋은 **1f690a1**이다.

**전달할 내용**

```
3b core 커밋 1f690a1을 리뷰한다. 코드는 고치지 않고 Docs/reviews/1f690a1.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/depth.md 3b와 수치·규칙 차이, 함정의 판정 순서(누가 해제를 시도하나, 체력 1 하한, 게이지 초기화), 기습이 경계 영웅이 쓰러진 뒤 다음 층에서 어떻게 되는지, 장신구 두 칸 장착·해제(같은 장신구 두 개, 영웅 사망 때 장비 분실과의 관계), 마법 공방 작업의 오프라인 진행, 세이브 11 → 12, 기존 던전 결과가 바뀌지 않았는지(부모 커밋과 시드 전투 비교).
```

메모:
- 원정 도중 장신구를 해제하면 전투 효과는 남고 분실 대상에서는 빠지는 경로와, 장신구가 대장간 강화에 들어가는 경로를 재현했다.
- 기존 일곱 던전의 승률 28칸과 시드 전투 리포트 28개가 부모 커밋과 일치했다. 경계 착용자 사망 뒤 다음 층 기습도 확인했다.

---

## 44. 도적 요새 밸런스 측정 (GPT)

**지금 시작할 수 있다(작업 43과 파일이 겹치지 않는다).**

**전달할 내용**

```
tools/curve.ts, tools/print-curve.ts, tools/tune-curve.ts, tools/first-hour.ts만 고친다. 게임 코드와 data는 고치지 않는다(제안만).
1. 곡선 도구에 요새 조건을 추가한다: 도적 있음/없음 × 장신구(없음 / 경계 / 경계+함정 감지). 장신구는 Gear { slot: 'trinket', recipeId: 'trinket.<id>' }를 영웅 gear에 넣으면 된다. bandit_fort Lv12–17 승률(중앙값/하위 25%)과 패배 이유 분포를 출력한다.
2. 독늪에서 해독의 목걸이(poisonWard) 1–2개가 해독 물약 몇 개 값인지 비교한다.
3. Docs/depth.md 3b "밸런스 기준"과 1차 측정표(Claude)와 비교해 메모에 적는다. 기준을 벗어나면 고칠 수치를 제안한다.
```

메모:
- 40파티×10전 Lv14 중앙값/P25. 도적 없음에서 미착용/경계/경계+감지는 40/20, 100/70, 100/90%. 도적 있음은 90/70, 100/100, 100/100%. 1차 측정의 무도적 미착용 50/10%보다 중앙값이 낮고, 미대비 패배 238회 중 기습은 153회였다.
- 대비 조건의 P25 목표 60%를 충족했다. 미대비 중앙값은 목표 약 60%보다 낮다. 기습 피해 배수 1.4→1.25 실험에서 미대비 50/20%, 도적만 90/80%, 경계+감지 100/90%여서 재측정 후보로 남긴다.
- 독늪 Lv12 P25는 목걸이 1/2개(전사/서로 다른 영웅) 30/50%, 해독 2/3개 20/60%로, 이 수준에서는 목걸이 1–2개가 해독 2–3개 사이였다. Lv11은 P25가 모두 0%. 프로젝트·도구 타입 검사, 테스트 180개, 빌드 통과.

---

## 45. 마량 성채 몬스터·던전 그림 (Cursor)

**지금 시작할 수 있다.** 3c core는 7eaca30에 들어갔다. 설계: `Docs/depth.md` 3c.

**전달할 내용**

```
Docs/depth.md의 3c를 읽고 마량 성채의 3D 그림을 만든다. src/ui/voxel/enemies.ts, src/ui/voxel/portrait.ts만 고친다. core와 data는 고치지 않는다.

몬스터 id: grave_knight(무덤 기사, 녹슨 갑옷·방패, 앞줄), bone_archer(뼈 궁수, 후열), specter(원령, 떠다니는 푸른 혼령, 후열. 티어 3의 wraith와 다르게 보이게), citadel_lord(보스 성채 군주, 큰 체구·뿔 투구·검은 망토·빛나는 눈, 앞줄).
던전 id: haunted_citadel(마량 성채, 티어 6).

1. buildEnemy에 네 몬스터. 기존 언데드 계열 색과 어울리되 성채 쪽은 회청색·녹·보라 빛.
2. dungeonPreviewUrl이 haunted_citadel을 부서진 성벽과 탑, 푸른 불빛이 있는 성채 입구로 그린다.
3. monsterPortraitUrl이 네 몬스터를 그린다.

확인: portrait 함수를 직접 불러 네 초상과 입구를 확인하고 스크린샷을 메모에. 임시 코드는 커밋하지 않는다.
```

메모: 무덤 기사는 녹슨 갑옷·방패·초록 눈, 뼈 궁수는 활과 푸른 눈, 원령은 떠다니는 청록 혼령(보라 망령과 구분), 성채 군주는 뿔 투구·검은 망토·보라 눈이다. 성채 입구는 부서진 탑·성벽·푸른 불빛이다. portrait로 네 초상과 입구를 확인했다.

---

## 46. 광역기 작전·리포트·로그 화면 (Cursor)

**지금 시작할 수 있다(작업 45와 파일이 겹치지 않는다).** 3c core는 7eaca30.

**전달할 내용**

```
Docs/depth.md 3c를 읽고 화면을 만든다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core는 고치지 않는다.

core에 이미 있는 것:
- 작전 필드 tactics.blast: 'interrupt' | 'brace' (없으면 'interrupt'). 기존 { type: 'tactics', tactics, presetId } 동작으로 저장한다.
- 직업 정의 classById(id).interrupt (전사·도적·궁수 true).
- 로그 키: log.charge, log.blast, log.interrupt, log.brace, log.phase(params.phase), log.summon(params.units, params.refs: 쉼표로 이은 id).
- 패배 이유 blasted. 문구 키: defeat.blasted, label.blast, blast.interrupt, blast.brace, blast.hint.<id>, enemy.grave_knight/bone_archer/specter/citadel_lord, dungeon.haunted_citadel.

1. 작전 편집: "광역기 대응: 끊기 / 버티기" 두 버튼과 한 줄 설명(blast.hint).
2. 출발 준비(Prep): 마량 성채를 고르면 "끊을 수 있는 영웅: N명(이름)"과 현재 광역기 작전을 한 줄로 보여 준다. 0명이고 작전이 끊기면 경고 색.
3. 원정 기록·리포트: 끊은 횟수(log.interrupt 수)와 맞은 광역기 수(log.blast 수), 새 패배 이유 문구.
4. 진행 패널·전투 로그: 새 로그 키 문구. 소환으로 나온 적 이름은 refs로 찾는다.
5. 문구 ko/en 같은 키. 이미 넣은 키는 다듬어도 된다.

확인: npm run dev에서 디버그로 요새까지 클리어한 세이브를 만들어 성채에 끊기·버티기로 한 번씩 나가 본다. 확인 못 한 부분은 메모에.
```

메모: 작전에 끊기/버티기 버튼과 설명을 넣었고, 마량 성채 준비 줄에 끊을 영웅 수와 작전을 보여 준다(0명이면 경고). 리포트·기록에 끊기·광역 횟수 칩이 나온다. 로그는 예고·광역·버티기·소환(refs 이름)을 확인했다. App.tsx는 새 화면이 없어 건드리지 않았다. 실제 세이브로 요새까지 클리어해 나가 보지는 않았다.

---

## 47. 예고·광역기·끊기·버티기·소환 연출 (Cursor)

**작업 46 뒤에 시작한다.**

**전달할 내용**

```
src/ui/voxel/BattleScene.ts, src/ui/voxel/replay.ts만 고친다.
1. log.charge: 보스 주위에 모이는 빛과 머리 위 경고 표시. log.blast: 파티 쪽으로 퍼지는 충격파, 맞은 영웅마다 피해 숫자(뒤따르는 log.attack이 피해를 담는다). log.interrupt: 끊은 영웅이 보스에게 달려들거나 쏘고, 빛이 깨진다.
2. log.brace: 영웅이 방패·팔을 들어 웅크린 자세, 광역기가 터지면 풀린다.
3. log.phase: 보스가 붉게 번쩍이고 몸이 조금 커진다. log.summon: params.units의 id(params.refs의 몬스터 종류)로 새 적을 연기와 함께 적 진영 빈자리에 세운다. 이 적들은 층 시작 스냅숏(floors)에 없으므로 replay가 로그에서 추가해야 체력 막대와 공격 대상이 맞는다.
확인: 스크린샷을 메모에.
```

메모: 예고는 보스 주위 빛과 느낌표, 버티기는 방패를 든 자세, 광역기는 충격파와 피해 숫자, 끊기는 달려들거나 쏘아 빛이 깨진다. 페이즈는 붉게 번쩍이며 몸이 조금 커지고, 소환은 로그의 units/refs로 적 진영에 새로 세운다. 페이즈·소환·예고·버티기·광역·끊기 순으로 다시 보기를 돌려 확인했다.

---

## 48. 3c core 코드 리뷰 (GPT)

3c core 커밋은 **7eaca30**이다.

**전달할 내용**

```
3c core 커밋 7eaca30을 리뷰한다. 코드는 고치지 않고 Docs/reviews/7eaca30.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/depth.md 3c와 수치·규칙 차이, 예고 뒤 광역기 시계(blastAt)와 보스 게이지·마비·침묵의 관계, 끊기의 사거리·침묵 조건, 버티기 중 힐러 예외와 버티기가 풀리는 시점(보스가 예고 중에 죽거나 층이 끝날 때 braced가 남는지), 페이즈 두 문턱 동시 통과·소환 유닛 id 충돌·소환 유닛과 replay 스냅숏, 패배 이유 순서, 기존 던전 결과가 바뀌지 않았는지(부모 커밋과 시드 전투 비교).
```

메모:
- 버티기 중 물약 사용, 소환 적 체력의 다시 보기 불일치, 빠른 보스의 조기 광역기, 초과 피해에 따른 패배 사유 누락을 기록했다.
- 부모 커밋과 비교한 기존 여덟 던전 승률 40칸 및 시드 전투 리포트 32개가 모두 일치했다.

---

## 49. 마량 성채 밸런스 측정 (GPT)

**지금 시작할 수 있다(작업 48과 파일이 겹치지 않는다).**

**전달할 내용**

```
tools/curve.ts, tools/print-curve.ts, tools/tune-curve.ts, tools/first-hour.ts만 고친다. 게임 코드와 data는 고치지 않는다(제안만).
1. 곡선 도구에 성채 조건을 추가한다: 끊을 수 있는 영웅 수(탱커 전사만 / 도적·궁수 1명 / 2명 이상) × 작전(끊기 / 버티기). haunted_citadel Lv14–18 승률(중앙값/하위 25%), 패배 이유 분포, 예고 대비 끊은 비율을 출력한다.
2. first-hour.ts를 9시간까지 돌릴 수 있게 하고, 흉내 플레이어가 성채에 갈 때 끊을 영웅이 없으면 버티기 작전을 고르게 한다. 성채 첫 클리어 시각을 출력한다.
3. Docs/depth.md 3c "밸런스 기준"과 1차 측정표(Claude)와 비교해 메모에 적는다. 기준을 벗어나면 고칠 수치(blastPower, braceFactor, chargeTicks, 배수)를 제안한다.
```

메모:
- 40파티×10전 Lv16 중앙값/P25. 전사만 끊을 수 있는 편성은 끊기·버티기 모두 0/0%, 추가 차단자 1명은 100/0%·100/50%, 추가 2명은 100/60%·100/90%. 끊기 성공률은 26/36/65%. 1차 측정(전사만 버티기 100/80%, 도적·궁수 있음 100/100%)보다 낮았다. 전사만 조건은 차단자 0명이 아니다.
- 배수 4.5→3.65와 예고 2→3틱을 함께 적용한 실험에서 전사만 끊기 50/0%, 전사만 버티기 100/70%, 추가 1명 끊기 100/70%였다. 목표에 더 가까워 재검증 후보로 남겼다.
- 시드 1–20의 9시간 실행에서 성채 13/20 클리어, 성공 시드 첫 클리어 중앙값 285.3분. 프로젝트·도구 타입 검사, 테스트 189개, 빌드 통과.

---

## 50. 아이를 영웅·출전 목록에서 빼고 성인식 알림 (Cursor)

**지금 시작할 수 있다.** core는 1115700에 들어갔다.

출전할 수 없는 아이(14살 미만)가 영웅 목록과 출전 대기 목록에 어른 영웅과 섞여 있어서 헷갈린다. 출전 목록에서는 이유 없이 흐릿하게만 나온다. 사용자 결정(2026-11-23)에 따라 **아이는 성인이 될 때까지 두 목록에서 빼고, 가족 화면에서만 보인다. 성인이 되면 "성인식" 알림과 함께 목록에 들어온다.**

**전달할 내용**

```
아이(출전 못 하는 나이)를 영웅 목록과 출전 대기 목록에서 빼고, 성인이 되면 알림을 띄운다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core는 고치지 않는다.

core에 이미 있는 것:
- isChild(hero): 출전할 수 없는 나이면 true(core index에서 export).
- state.comingOfAge: 방금 성인이 된 영웅 id 목록. 플레이 중이든 자리를 비운 사이든 해가 바뀌어 나이를 먹을 때 쌓인다. 알림을 보여 준 뒤 { type: 'seenAdults' }를 보내면 비워진다.
- 아이는 { type: 'add' }로 파티에 넣을 수 없다(core가 거절).
- 아이도 state.roster에 있고 침상을 하나 쓴다.

1. 영웅 목록(heroScreens의 roster 목록): isChild인 영웅을 뺀다. 목록 위나 아래에 "아이 n명은 가족 화면에서 볼 수 있다" 한 줄만 남긴다(0명이면 없음).
2. 출전 대기 목록(battleScreens의 hero-list): isChild인 영웅을 뺀다. 출산을 앞둔 영웅(expecting)처럼 어른인데 지금 못 나가는 영웅은 목록에 두되, 흐리게만 하지 말고 이유 칩을 붙인다("출산 예정", "원정 중", "사망" 등).
3. 아이는 가족 화면에서 보인다. 마을 인구 창(villageScreens의 연령대 표)에 "아이들" 칸을 두고 이름·나이·"출전까지 n년"과 부모를 보여 준다. 누르면 기존 영웅 상세(가계도 포함)가 열린다. 영웅 상세의 가족 줄에서 아이를 눌러도 상세가 열리는 것은 그대로 둔다.
4. 아이 상세에서 "사망한 영웅은 출전할 수 없습니다"(result.dead)가 잘못 나온다. 아이는 "14살이 되면 출전할 수 있다"(나이 기준은 ageBands의 첫 출전 가능 나이), 출산 예정은 "출산 후 출전할 수 있다", 사망은 기존 문구로 나눈다.
5. 성인식 알림: state.comingOfAge가 비어 있지 않으면 창을 띄운다. 예: "○○가 14살이 되어 영웅이 되었다!" 초상, 직업, 능력치 요약, [영웅 보기] 버튼. 닫으면 seenAdults를 보낸다. 여러 명이면 한 창에 모두. 부재 보고(absence)와 겹치면 부재 보고 다음에 띄운다.
6. 침상 표시(town.beds, family.beds)에 "아이 n명 포함"을 붙여, 목록에서 안 보이는 아이가 침상을 쓰고 있다는 것을 알린다.
7. 문구 ko/en 같은 키.

확인: npm run dev에서 디버그로 아이가 있는 세이브(결혼·출생까지 시간 가속)를 만들어 두 목록에서 아이가 빠지고, 인구 창에서 보이고, 해를 넘기면 성인식 창이 뜨는지 본다. 스크린샷을 메모에.
```

메모: 사용자 요청으로 Claude Code가 직접 했다. 영웅 목록·출전 목록에서 아이를 빼고 "아이 n명은 마을 인구 창에서" 한 줄을 남겼다. 출전 목록은 출산 예정·사망 칩을 붙인다. 인구 창에 아이들 칸(나이·출전까지 남은 해·부모, 누르면 상세), 침상 칸에 "아이 n명 포함". 아이 상세는 "14살이 되면 출전할 수 있다", 출산 예정은 "아이를 낳은 뒤". 해가 바뀌어 14살이 되면 성인식 창이 뜨고 [영웅 보기]로 상세가 열린다. 개발 화면에서 13살·5살 아이 세이브로 확인했다.

---

## 51. 용의 둥지 몬스터·던전 그림 (Cursor)

**완료 (ac00d51).** 드레이크·와이번·코볼트·고룡과 화산 동굴 입구. 초상 확인함.

---

## 52. 둥지 카드(가려진 어픽스·정찰·정보 구매)와 리포트 (Cursor)

**완료 (a63366f).** 가려진 둥지·정보 구매·출발 대비 점검·리포트 칩·정찰 중 칩. 정보 구매로 공개·대비 줄 확인. 정찰 타이머 막대는 UI 코드만(코어 시퀀스는 확인).

---

## 53. 정찰 나가는 도적과 어픽스 연출 (Cursor)

**완료 (613ee56).** 혼자 떠나는 정찰은 남쪽 문으로 바로 나감. 층 시작 어픽스 배너·둥지 붉은 빛·불씨 확인.

---

## 54. 3d core 코드 리뷰 (GPT)

3d core 커밋은 **f47daff**이다.

**전달할 내용**

```
3d core 커밋 f47daff를 리뷰한다. 코드는 고치지 않고 Docs/reviews/f47daff.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/depth.md 3d와 수치·규칙 차이, nestSeason의 결정성(같은 계절은 같고, 계절마다 바뀌는지), 정찰의 오프라인 진행과 계절이 바뀌는 순간(정찰 중 계절이 바뀌면 어느 계절이 공개되는지), 원정 귀환 시 공개 조건(sameAffixes), 자동 출정이 둥지에 갈 때의 어픽스, 정찰 중인 도적과 busyHeroIds·출산·사망·은퇴의 관계, 어픽스가 소환 유닛(advancePhases)에도 붙는지, 기존 던전 결과가 바뀌지 않았는지(부모 커밋과 시드 전투 비교), 세이브 12 → 13.
```

메모:
- 지난 계절 원정으로 새 적 구성이 공개되는 경우(시드 31), 정찰 도중 노환 사망 후에도 정보가 공개되는 경우, 잠긴 둥지의 정보 구매를 재현했다. 소환 적의 지속형 어픽스 누락도 기록했다.
- 부모 커밋과 기존 아홉 던전의 시드 전투 리포트 54건이 일치했다. 노환·임신의 부재 처리와 공개 조건에 수정 제안을 남겼다.

---

## 55. 용의 둥지 밸런스 측정 (GPT)

**지금 시작할 수 있다(작업 54와 파일이 겹치지 않는다).**

**전달할 내용**

```
tools/curve.ts, tools/print-curve.ts, tools/tune-curve.ts, tools/first-hour.ts만 고친다. 게임 코드와 data는 고치지 않는다(제안만).
1. 곡선 도구에 둥지 조건을 추가한다: 어픽스 조합 28가지 × (대비 없음 / 그 조합에 대비함). 대비는 Docs/depth.md 3d 표의 대응(장신구·물약·작전)을 갖춘 것이다. runDungeon(..., supplies, { floors, affixes })로 돌린다. dragon_nest Lv18–22 승률(중앙값/하위 25%)을 조합별과 평균으로 출력한다.
2. 특히 매복(ambush)이 대비 없이 0%인 문제를 본다. Docs/depth.md 3d 1차 측정에 적혀 있다. 매복을 남기면서 "대비 없음"이 0이 아니게 하는 수치(nest.json의 ambushPower, 던전 배수, 기습 대상)를 제안한다.
3. first-hour.ts를 12시간까지 돌릴 수 있게 하고, 흉내 플레이어가 둥지 전에 정보를 사서 어픽스에 맞게 장신구·물약·작전을 고르게 한다. 둥지 첫 클리어 시각을 출력한다.
4. Docs/depth.md 3d "밸런스 기준"과 비교해 메모에 적는다.
```

메모:
- 24파티×5전, Lv20의 28쌍 평균 중앙값/P25는 미대비 72/50%, 대비 100/94%였다. 1차 측정 74/44%, 100/81%와 같은 경향으로, 대비 목표는 충족하고 미대비 전체 중앙값은 목표 약 40%보다 높았다.
- 기본 Lv20의 미대비 매복 7쌍 중 6쌍은 중앙값 0%였다. 던전 배수 9.5와 후열 표적을 유지하고 매복 피해만 1.0→0.80으로 낮추면 7쌍 중앙값이 40–100%로 올라갔다. 국소 완화 후보이며 전체 미대비 평균 목표와는 별도로 재검증한다.
- 시드 1–20의 12시간 시뮬레이션에서 둥지 12/20 클리어, 성공 시드 첫 클리어 중앙값 586.8분. 프로젝트·도구 타입 검사, 테스트 205개, 빌드 통과.

---

## 56. 훈련소 화면과 스킬 고르기 (Cursor)

**완료 (5010c29).** 스킬 고르기·잊기, 훈련소 창, 훈련 중 칩, 포인트 배지. 배우기·잊기·훈련 시작 확인.

---

## 57. 훈련소 건물·스킬 연출 3D (Cursor)

**완료 (b13376f).** 모래판·허수아비 훈련소, 훈련 중 타격 동작, volley/weaken/cleanse 연출. drillIds 전달을 위해 App·VillageView도 최소 수정.

---

## 58. 스킬·훈련소 core 코드 리뷰 (GPT)

core 커밋은 **8e25753**이다.

**전달할 내용**

```
커밋 8e25753을 리뷰한다. 코드는 고치지 않고 Docs/reviews/8e25753.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/skills.md와 수치·규칙 차이, createHero가 skillPoints·learned를 다시 계산하는 경로(레벨업, 세이브 불러오기, 아이·방문자 생성, 은퇴·부활), 예전 세이브의 스킬 정리, 스킬 효과가 없는 영웅의 전투가 부모 커밋과 같은지(시드 전투 비교), 방어(guard) 반올림·약화의 난수 사용, 파티 효과 상한, 훈련 경험치의 기준(partyLevel)과 오프라인 완료, 훈련 중 영웅과 출산·노환·원정·은퇴의 관계, 세이브 13 → 14.
```

메모:
- 훈련 중 영웅의 노환·임신 처리, 구버전 저레벨 스킬의 해금 전 재학습, 방어의 적용 범위와 반올림을 리뷰에 기록했다.
- 부모 커밋과 기존 10개 던전의 스킬 효과 없는 시드 전투 전체 리포트 60건이 일치했다.

---

## 59. 스킬을 배우는 곡선·시뮬레이터 (GPT)

**지금 시작할 수 있다(작업 58과 파일이 겹치지 않는다).**

**전달할 내용**

```
tools/curve.ts, tools/print-curve.ts, tools/tune-curve.ts, tools/first-hour.ts만 고친다. 게임 코드와 data는 고치지 않는다(제안만).
1. 곡선 도구에 "스킬 배움" 조건을 넣는다: 레벨에 맞는 개수만큼(Lv3·Lv7) 직업별로 (a) 앞의 두 개 (b) 뒤의 두 개 (c) 직업별 추천 두 개. 각 던전의 권장 레벨에서 스킬 없음/있음을 비교한다. 스킬별 영향도 한 줄씩(그 스킬만 켰을 때).
2. first-hour.ts의 흉내 플레이어가 포인트가 생기면 스킬을 배우고, 훈련소를 지어 새 영웅을 훈련시키게 한다. 3시간·12시간 첫 클리어 시각이 얼마나 빨라졌는지 출력한다.
3. Docs/skills.md "밸런스"의 기준(스킬 두 개 ≈ 레벨 하나)과 비교해 메모에 적는다. 특정 스킬이 지나치게 강하면 고칠 수치를 제안한다.
```

메모:
- 40파티×6전에서 추천 두 스킬은 독늪 Lv12 P25 83%, 요새 Lv14 P25 83%로 둘 다 무스킬 +1레벨과 같았다. 독늪의 뒤 두 스킬은 100%, 정화 단독은 0→83%였다. 정화 후 중독 잔량 50→65% 실험은 정화 단독 P25 50%, 추천 조합 67%로 재검증 후보로 남겼다.
- 시드 20개 중 3시간 내 요새 클리어는 7→10개, 공통 성공 시드 첫 클리어 중앙값 9.1분 단축. 12시간 짝비교는 요새 11.6분, 성채 31.9분, 둥지 16.6분 단축이며 둥지 클리어는 12→14개였다. 훈련소 20/20, 훈련 548회 시작, 스킬 341개 학습.
- 프로젝트·도구 타입 검사, 테스트 218개, 프로덕션 빌드 통과.

---

## 60. 길드 화면(의뢰 게시판·레벨·감정) (Cursor)

**완료 (7ff969a).** 설계: `Docs/guild.md`.

메모:
- 길드 창(BUILDING_SCREEN.guild)·의뢰 게시판·실적 막대, 마을 "의뢰 n/m" 칩, 여관 감정(Lv1 ±15%), 길드 없으면 자동 출정 잠김을 127.0.0.1:5174에서 확인. 납품으로 골드+40·실적 1·토스트 경로 확인.
- 토벌 진행은 원정 승리 시 core가 올리므로 UI만 반영. 반복 의뢰 카드는 계절 의뢰를 다 끝낸 뒤 나타난다.
- tsc·테스트 230·빌드 통과.

---

## 61. 길드 core 코드 리뷰 (GPT)

길드 core 커밋은 **1208be3**이다.

**전달할 내용**

```
길드 core 커밋 1208be3를 리뷰한다. 코드는 고치지 않고 Docs/reviews/1208be3.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/guild.md와 수치·규칙 차이, 의뢰판 생성의 결정성(계절·시드)과 계절이 바뀌는 순간, 길드 레벨이 계절 중에 오를 때, 반복 의뢰가 끝나자마자 새로 걸리는 경로, 토벌 진행이 직접 원정·자동 출정·패배에서 어떻게 세어지는지, 자동 출정 여러 파티(겹치는 영웅, 프리셋 물약, 시드), 자동 출정이 길드를 요구하게 된 뒤 예전 세이브(자동 출정이 켜져 있지만 길드가 없는 경우), 길잡이 순서 변경, 세이브 14 → 15.
```

**메모**

- [리뷰](reviews/1208be3.md)에 다섯 가지를 기록했다. 이전 계절 의뢰 정산, 첫 승리 후 빈 게시판, 자동 프리셋 선택, 짧은 갱신의 시간과 시드, v14 길잡이 보상 순서다.
- 이전 시즌 의뢰가 여름 진입 정산 중 실적 +1과 지정 보상 888골드를 지급하는 사례 등 일곱 가지 검증 조건을 실행했다.

---

## 62. 의뢰 보상·자동 파티 측정 (GPT)

**지금 시작할 수 있다(작업 61과 파일이 겹치지 않는다).**

**전달할 내용**

```
tools/curve.ts, tools/print-curve.ts, tools/tune-curve.ts, tools/first-hour.ts만 고친다. 게임 코드와 data는 고치지 않는다(제안만).
1. first-hour.ts의 흉내 플레이어가 길드 의뢰를 하게 한다: 토벌 의뢰 던전을 우선 고르고, 납품 의뢰는 재료가 있으면 낸다. 동시 출정 슬롯을 다 쓰고, 길드 Lv3부터 자동 파티 2개를 쓴다.
2. 3시간·12시간에서 의뢰가 전체 골드 수입의 몇 %인지, 길드 레벨이 언제 오르는지(의뢰 실적 기준 3/8/16이 적당한지), 첫 클리어 시각이 얼마나 바뀌는지 출력한다.
3. Docs/guild.md와 비교해 의뢰 보상(clearGold 0.6, deliverGold 2, repeatShare 0.3)과 실적 기준이 적당한지 메모에 적고, 고칠 수치를 제안한다.
```

**메모**

- `npx tsx tools/first-hour.ts --guild=compare`로 시드 1–20을 비교했다. 전체 수입 중 의뢰 비중 중앙값은 3시간 15.4%(의뢰 골드 중앙값 811), 12시간 14.3%(3,177)였다. 비교군은 두 시점 모두 의뢰 수입 중앙값 0이었다.
- 실적 3/8/16의 도달 중앙값은 28/66/122분, 길드 Lv1/2/3/4 완공은 15/96/195/341분이며 모두 20/20 시드에서 달성했다. 길드 Lv3 이상에서 2파티 자동 출정 구간 177회, 4파티 동시 출정은 15/20 시드였다. 12시간 기준 짝지은 첫 클리어 중앙값은 독늪 298분, 산적 요새 248분, 유령 성채 126분 느려졌다. 용의 둥지는 5/20 대 12/20으로, 두 조건 모두 성공한 시드는 2개였다.
- `Docs/guild.md`의 `clearGold 0.6`, `deliverGold 2`, `repeatShare 0.3`은 12시간 내 비중이 안정적이므로 유지하고, 실적 3/8/16도 유지한다. Lv3 자동 파티를 3시간 안에 열고 싶다면 Lv3 공사 90→60분을 먼저 비교한다. 이 비교의 길드 운영은 의뢰·증원·길드 건설 우선순위·매시간 20분 오프라인을 함께 적용하므로 첫 클리어 차이는 보상 배율 하나의 효과로 해석할 수 없다.

---

## 63. 사기·감정·축제 화면 (GPT, Cursor 대신)

**지금 시작할 수 있다.** 설계: `Docs/morale.md`. Cursor가 사용량을 다 써서 이번 화면은 GPT가 만든다. 끝나면 Claude Code가 화면을 직접 확인한다.

**전달할 내용**

```
Docs/morale.md를 읽고 화면을 만든다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core는 고치지 않는다. 기존 화면의 구조와 kit.tsx의 Window, Chip, Bar 같은 공용 조각을 그대로 쓴다.

core에 이미 있는 것('../../core'에서 export):
- moraleOf(hero)(0–100, 기본 60), lowMorale(hero), moraleScale(hero), moraleRules(base, high 80, low 30, festival 등).
- 동작 { type: 'festival' }: 계절마다 한 번, 골드 festivalCost(state)(game.ts에서 export). state.festival: { season, kind } | null. 결과 notice: festivalDone, poor.
- 감정은 core가 자동으로 바꾼다: 영구 사망(슬픔), 결혼·출산·성인식·첫 클리어(기쁨), 승리·마을 레벨업(자부심).

1. 영웅 목록·상세·출전 목록: 사기 막대와 상태 칩. 80 이상 "의욕 넘침(공격 +5%)", 30 이하 "실의(공격·속도 −20%, 자동 출정 제외)", 그 사이는 숫자만. 상세에는 "사기는 시간이 지나면 60으로 돌아온다" 안내.
2. 마을 운영 화면: "마을 사기" 칩(어른 영웅 평균)과 [축제 열기] 버튼. 축제 창에 이번 계절 축제 이름(봄 파종제·여름 무술 대회·가을 수확제·겨울 추모제)과 효과, 비용, 이번 계절에 이미 열었는지.
3. 슬픔 알림: 영구 사망 토스트(이미 있음)에 "가족과 친구가 슬퍼한다" 한 줄을 더한다. 사기 30 이하인 영웅이 있으면 영웅 탭 배지.
4. 문구 ko/en 같은 키.

확인: npm run dev에서 디버그 세이브로 축제를 계절마다 열어 보고(디버그의 계절 넘기기), 사기 표시가 바뀌는지 본다. 확인한 내용을 메모에.
```

**메모**

- 영웅 목록·상세·출전 편성에 사기 표시를 추가했다. 마을 요약과 계절별 축제 창, 실의 배지, 묘비 생성 시 슬픔 토스트를 연결했다.
- Vite SSR에서 디버그 계절 넘기기와 동일한 분할 정산으로 네 계절의 이름·비용·개최 상태와 사기 변화를 확인했다. 로컬 브라우저 접속이 시간 초과되어 클릭으로 검증하는 과정은 남아 있다. 타입 검사·테스트 244개·빌드 통과.

---

## 64. 사기·축제 core 코드 리뷰 (GPT)

**작업 63 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **b9036a0**이다.

**전달할 내용**

```
사기·축제 core 커밋 b9036a0를 리뷰한다. 코드는 고치지 않고 Docs/reviews/b9036a0.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/morale.md와 수치·규칙 차이, 슬픔이 일어나는 경로(전사 두 번째 죽음, 노환, 은퇴자, 원정 중 사망, 계절 경계)와 여러 명이 한꺼번에 떠날 때, 기쁨(결혼·출산·성인식·첫 클리어)과 자부심(승리 75 상한, 마을 레벨업)이 빠지거나 두 번 들어가는 경로, 사기 회복이 원정·정찰·훈련 중에도 도는지, 자동 출정 제외, 축제의 계절 판정과 봄 호감도 2배가 끝나는 시점, 세이브 15 → 16, 기존 전투 결과(사기 60 영웅)가 바뀌지 않았는지.
```

**메모**

- [리뷰](reviews/b9036a0.md)에 4건을 기록했다. 정산 간격에 따른 슬픔 편차, 명성 출처에 따른 레벨업 자부심 누락, 은퇴자 감정 제외, 첫 클리어와 승리 보상 적용 방식을 검토했다.
- 세이브 15의 기본 사기와 축제 기록 이관, 사기 60의 전투 결과, 첫 전사와 영구 사망의 구분을 재현했다.

---

## 65. 사기가 진행에 주는 영향 측정 (GPT)

**지금 시작할 수 있다(작업 63과 파일이 겹치지 않는다).**

**전달할 내용**

```
tools/curve.ts, tools/print-curve.ts, tools/tune-curve.ts, tools/first-hour.ts만 고친다. 게임 코드와 data는 고치지 않는다(제안만).
1. first-hour.ts의 흉내 플레이어가 계절마다 축제를 연다(골드가 있으면). 12시간 동안 영웅 사기 분포(80 이상/31–79/30 이하 비율), 실의(30 이하)로 자동 출정에서 빠진 시간, 축제 비용이 골드 수입의 몇 %인지 출력한다.
2. 축제 있음/없음으로 첫 클리어 시각과 파티 레벨을 비교한다.
3. Docs/morale.md와 비교해, 슬픔이 너무 오래가거나 사기 80이 너무 쉽게/어렵게 닿는지 메모에 적고 고칠 수치를 제안한다.
```

**메모**

- `npx tsx tools/first-hour.ts --festival=compare`로 시드 1–20의 첫 12시간(봄)을 비교했다. 성인 영웅 누적 시간의 사기 상/중/하 비율은 축제 없음 69.38/30.62/0.00%, 축제 있음 73.44/26.44/0.12%였다. 사기만으로 자동 출정에서 제외된 시간은 각각 0/1.44 영웅·시간, 실제 구간의 제외는 0/3건이었다. 축제 비용은 총수입 대비 중앙값 0.46%였다.
- 짝지은 첫 클리어 시각은 동굴·숲 0분, 지하묘지 1.94분 단축, 독늪 0.86분 지연이었다. 12시간 파티 레벨 중앙값은 40.50→41.00, 같은 시드의 레벨 차이 중앙값은 0이었다.
- 사기 80 이상이 봄의 대부분을 차지해 `high` 80→85를 우선 비교한다. 기본 사기에서 배우자/부모·자녀를 잃으면 전투 없이 실의가 약 8/4시간 지속된다. 너무 길다면 `driftPerHour` 2.5→3을 별도로 비교한다(약 6시간 40분/3시간 20분). 실의 관측이 적어 슬픔 감소 폭은 유지한다.

---

## 66. 자동화 화면(대기열·물약 유지·자동 치료·자동 훈련) (GPT, Cursor 대신)

**지금 시작할 수 있다.** 설계: `Docs/automation.md`. 끝나면 Claude Code가 화면을 직접 확인한다.

**전달할 내용**

```
Docs/automation.md를 읽고 화면을 만든다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core는 고치지 않는다. 기존 화면의 구조와 kit.tsx의 공용 조각을 그대로 쓴다.

core에 이미 있는 것:
- state.automation: { care, drill, potions: { [potionId]: 유지 수량 }, queues: { smith: recipeId[], alchemy: PotionId[], magic: TrinketId[] } }.
- 공방이 작업 중일 때 { type: 'craft' | 'brew' | 'enchant' }를 보내면 대기열에 들어간다(비용은 그때 낸다). 대기열 칸 = 건물 레벨. 가득 차면 notice 'queueFull'. 대장간 강화는 대기열에 들어가지 않는다(지금처럼 'smithBusy').
- { type: 'dequeue', building: 'smith' | 'alchemy' | 'magic', index }: 취소하고 비용을 돌려받는다.
- { type: 'potionTarget', potionId, count }: 물약 유지 수량(0이면 끔).
- { type: 'automation', care?: boolean, drill?: boolean }: 신전 자동 치료(기본 켬), 훈련소 자동 훈련(기본 끔).

1. 대장간·연금술 공방·마법 공방 창: 지금 작업 아래에 "대기열 n/m" 목록(이름, 예상 시작 시각 또는 순서)과 각 줄의 [취소]. 작업 중이면 만들기 버튼 글자를 "대기열에 넣기"로 바꾼다. 가득 차면 비활성.
2. 연금술 공방 창: 물약마다 "창고에 n개 유지" 숫자 입력(−/+ 버튼)과 지금 재고. 유지 수량이 있고 공방이 비어 있으면 알아서 만든다는 안내.
3. 신전(영웅 상세의 치료 부분 또는 마을 운영의 신전 카드)에 "자동 치료" 스위치. 훈련소 창에 "자동 훈련" 스위치와 "파티보다 1레벨 이상 뒤처진 영웅을 골드를 써서 보낸다. 선택한 파티의 영웅은 보내지 않는다" 안내.
4. 문구 ko/en 같은 키.

확인: npm run dev에서 디버그 세이브로 공방 세 곳에 대기열을 걸고, 시간 넘기기로 차례대로 끝나는지, 취소하면 자원이 돌아오는지 본다. 확인한 내용을 메모에.
```

**메모**

- 세 공방의 대기열·취소, 연금술 재고와 유지 수량, 신전 자동 치료·훈련소 자동 훈련 스위치를 연결했다.
- Vite SSR과 디버그 상태의 리듀서로 대기열 표시·가득 찬 버튼·비용 환불·연속 제작과 12시간 정산을 검증했다. 로컬 브라우저 접속 시간 초과로 클릭 검증은 남았다. 타입 검사, 테스트 252개, 빌드 통과.

---

## 67. 자동화 core 코드 리뷰 (GPT)

**작업 66 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **a6be730**이다.

**전달할 내용**

```
자동화 core 커밋 a6be730를 리뷰한다. 코드는 고치지 않고 Docs/reviews/a6be730.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/automation.md와 규칙 차이, 대기열의 비용 계산과 환불이 직접 주문과 같은지(은퇴자 보너스·공방 레벨·대기 중 레벨업), 대기열 작업이 이전 작업이 끝난 시각에 이어 시작하는지(오프라인 12시간, 계절 경계), 물약 유지가 과하게 만들거나 원정에 들고 간 물약을 어떻게 세는지, 자동 치료와 원정·훈련·정찰·사망의 관계, 자동 훈련이 선택한 파티·자동 파티·바쁜 영웅을 빼는지와 골드가 모자랄 때, 세이브 16 → 17.
```

**메모**

- [리뷰](reviews/a6be730.md)에 공방 업그레이드의 소급 적용, 부재 종료 시 자동 치료 시작, 두 번째 자동 출정 파티와 훈련 충돌, 정찰 중 훈련 소급 시작을 기록했다.
- 계절 경계의 대기열 연결, 골드 부족 시 훈련 보류, 세이브 16 자동화 기본값 이관을 확인했다.

---

## 68. 면담·스카우팅 화면 (GPT, Cursor 대신)

**지금 시작할 수 있다.** 설계: `Docs/scouting.md`. 끝나면 Claude Code가 화면을 직접 확인한다.

**전달할 내용**

```
Docs/scouting.md를 읽고 여관 화면을 고친다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core는 고치지 않는다. 기존 여관 카드 구조와 kit.tsx 공용 조각을 그대로 쓴다.

core에 이미 있는 것('../../core'에서 export):
- knowledge(hero): 0 가림, 1 잠재력·특성 공개, 2 전성기 능력치까지. peakStats(hero): 전성기(27살) 능력치.
- hero.prodigy(숨은 인재), hero.terms(고용에 필요한 마을 레벨, 없으면 조건 없음).
- { type: 'interview', id }: 계절마다 여관 레벨만큼 무료, 그다음은 골드 scoutingRules.interviewGold. interviewsLeft(state), freeInterviews(state). 결과 notice: interviewed, poor.
- 고용 시 마을 레벨이 terms보다 낮으면 notice 'hireTown'.

1. 여관 방문자 카드: knowledge 0이면 잠재력 칩과 특성 칩 자리에 "?"(면담하면 알 수 있다). 1 이상이면 지금처럼 보인다. 2면 능력치 옆에 "전성기 n" 표시.
2. [면담] 버튼: 남은 무료 면담이 있으면 "면담 (무료 n/m)", 없으면 "면담 골드 10". 이미 면담했으면 숨긴다(여관 Lv3 이상이고 knowledge 1이면 "더 깊이 면담" 버튼).
3. 숨은 인재: 면담 후 prodigy면 금색 "숨은 인재!" 칩과 반짝임.
4. 고용 조건: 면담 후 terms가 있으면 "마을 Lv n 필요" 칩, 마을 레벨이 모자라면 고용 버튼 비활성과 안내. 면담 전에 거절되면 'hireTown' 문구가 뜬다.
5. 여관 창 위쪽에 "이번 계절 무료 면담 n/m".
6. 문구 ko/en 같은 키.

확인: npm run dev에서 디버그 세이브로 방문자를 면담해 보고(무료 → 골드), 여관 레벨 3에서 깊은 면담을 해 본다. 확인한 내용을 메모에.
```

**메모**

- 여관 카드에 면담 전 정보 가림, 무료·유료·깊은 면담, 전성기 능력치, 숨은 인재와 고용 조건을 표시했다.
- Vite SSR과 리듀서로 무료→10골드 전환, 깊이 1→2, 숨은 인재 공개 및 고용 거절을 확인했다. 로컬 브라우저 접속 시간 초과로 클릭 검증은 남았다. 타입 검사·테스트 262개·빌드 통과.

---

## 69. 면담·스카우팅 core 코드 리뷰 (GPT)

**작업 68 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **8e1fa30**이다.

**전달할 내용**

```
면담·스카우팅 core 커밋 8e1fa30를 리뷰한다. 코드는 고치지 않고 Docs/reviews/8e1fa30.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/scouting.md와 규칙 차이, 면담 횟수의 계절 판정과 여관 레벨 변화, 깊은 면담, 숨은 인재가 기존 방문자 생성(시드 흐름)을 바꾸지 않는지, 숨은 인재의 능력치 재계산(나이·잠재력·potentials), 고용 조건과 처음 방문자, 방문자가 나이 들거나 떠날 때 필드가 유지되는지(createHero), 고용 후 영웅에 남는 필드, 세이브 17 → 18(예전 방문자를 면담한 것으로 처리).
```

**메모**

- [리뷰](reviews/8e1fa30.md)에 유료 면담의 무료 한도 차감, Lv3 첫 면담의 깊이 적용, 잠재력 100 초과 방문자의 보정 감소, v1 세이브 이관 문제를 기록했다.
- 계절 초기화, v17 기존 방문자의 면담 이관, 방문자 나이 변경·퇴실·고용, 숨은 인재 능력치 재계산을 확인했다.

---

## 70. 학교 화면 (GPT, Cursor 대신)

**지금 시작할 수 있다.** 설계: `Docs/school.md`. 끝나면 Claude Code가 화면을 직접 확인한다.

**전달할 내용**

```
Docs/school.md를 읽고 화면을 만든다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core는 고치지 않는다. 기존 창 구조와 kit.tsx 공용 조각을 그대로 쓴다.

core에 이미 있는 것('../../core'에서 export):
- 건물 id 'school'(마을 Lv4, 레벨 1–3). schoolSeats(state), tuition(state), pupils(state), schoolRules(minAge 5, potentialPerSeason, focusPerSeason, careerSeasons 3).
- hero.school: { focus?: StatKey, career?: ClassId, seasons, carry } (다니는 아이만).
- 동작 { type: 'enroll', heroId, focus: StatKey | null, career: ClassId | null }(다니는 아이에게 다시 보내면 계획만 바뀌고 다닌 계절은 유지), { type: 'unenroll', heroId }. 결과 notice: noSchool, tooYoung, schoolFull, career.
- 아이(isChild)는 영웅 목록에 없고 마을 인구 창의 "아이들" 칸에 있다.

1. 학교 창(App.tsx BUILDING_SCREEN의 school을 새 화면으로): 자리 n/m, 계절마다 수업료(한 명당), 학교 레벨별 효과 표, 다니는 아이 목록(이름·나이·다닌 계절·집중 능력치·진로·"성인식까지 n년").
2. 입학: 5살 이상 아이 목록에서 [입학] → 집중 능력치(6개 + 없음)와 진로(7개 직업 + 그대로, 무희는 여자아이만) 고르기. 다니는 아이는 [계획 바꾸기]와 [그만두기].
3. 진로 안내: "3계절 이상 다니면 성인식 때 이 직업이 된다"와 지금 다닌 계절. 3계절 미만이면 "아직 n계절 더".
4. 마을 인구 창의 아이들 칸과 아이 상세에 학교 정보 한 줄(다니면 집중·진로, 아니면 "학교에 다니지 않는다").
5. 문구 ko/en 같은 키.

확인: npm run dev에서 디버그 세이브로 아이를 입학시키고 계절을 넘겨 수업료·잠재력 변화를 본다. 확인한 내용을 메모에.
```

**메모**

- 학교 창의 정원·수업료·효과 표, 입학·계획 변경·퇴학, 인구 창과 아이 상세의 학교 정보를 연결했다.
- Vite 개발 서버의 SSR과 리듀서로 입학, 계절 경계 수업료 15골드·잠재력 +1, 계획 변경 및 퇴학을 검증했다. 브라우저 클릭 검증은 남았다. 타입 검사·테스트 273개·빌드 통과.

---

## 71. 학교 core 코드 리뷰 (GPT)

**작업 70 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **62e7837**이다.

**전달할 내용**

```
학교 core 커밋 62e7837를 리뷰한다. 코드는 고치지 않고 Docs/reviews/62e7837.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/school.md와 수치·규칙 차이, 수업료 지불 순서와 골드 부족, 계절 경계·오프라인에서 여러 계절이 지날 때, 잠재력 상한과 집중 능력치 소수점 누적, 진로 변경(성별·장비·스킬·직업 바꿈 뒤 createHero), 성인식과 졸업 시점(나이 듦·사망·해고·부모 은퇴), 자리 수와 학교 레벨 변화, 세이브 18 → 19.
```

**메모**

- [리뷰](reviews/62e7837.md)에 진로 변경 졸업의 장비 소실, 집중 과목 사이 소수점 이전, 겨울 경계의 졸업·수업 순서를 기록했다.
- 수업료 부족 시 지불 순서, 잠재력 상한, 은퇴자 할인의 반올림과 v18 세이브 이관을 확인했다.

---

## 72. 집 화면: 방으로 묶어 보기 (GPT, Cursor 대신)

**지금 시작할 수 있다.** 설계: `Docs/house.md`. 끝나면 Claude Code가 화면을 직접 확인한다.

**전달할 내용**

```
Docs/house.md의 "집: 방으로 묶어 보기"를 화면으로 만든다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core는 고치지 않는다. 기존 창 구조와 kit.tsx 공용 조각(Chip, Bar, Portrait 등)을 그대로 쓴다.

core에 이미 있는 것('../../core'에서 export):
- houseRooms(state): { beds, used, free, overflow, coupleHomes, emptyCoupleHomes, rooms: Room[], retirees: Hero[] }
- Room: { kind: 'family' | 'parent' | 'shared', members: Hero[], beds, empty, expecting }
- busyHeroIds(state), isChild(hero), familyOf(state, id)

1. 집 건물을 누르면 지금은 영웅 목록(roster)이 열린다. 새 집 창(App.tsx BUILDING_SCREEN의 house)을 만든다.
2. 위 요약: 침대 used/beds, 방 수(가족방 a · 한부모 b · 2인실 c), 빈 침대, 빈 신혼방 emptyCoupleHomes/coupleHomes. overflow > 0이면 경고 줄.
3. 방 카드 목록: 가족방 → 한부모 방 → 2인실 순. 카드마다 방 이름("가족방: 이름 가족"), 사람마다 초상·이름·나이(아이는 "아이" 표시, 은퇴자는 "은퇴" 표시), expecting이면 "곧 태어날 아기", 2인실의 빈 침대는 빈 칸으로. 원정·정찰·훈련 중(busyHeroIds)이면 작은 표시.
4. 빈 신혼방은 점선 카드 몇 개로("빈 신혼방: 결혼하면 들어온다").
5. 은퇴자(retirees)는 맨 아래 한 줄.
6. 사람을 누르면 기존 영웅/아이 상세를 연다.
7. 문구 ko/en 같은 키. 좁은 화면(375px)에서 카드가 넘치지 않게.

확인: npm run dev에서 부부·아이·싱글이 섞인 세이브로 방 묶음을 본다. 확인한 내용을 메모에.
```

**메모**

- 집 건물에서 집 창을 열고 방·침대·신혼방·은퇴자를 확인할 수 있게 했다. 이름을 누르면 기존 영웅·아이 상세로 이동한다.
- 부부·아이·싱글·은퇴자·정찰 중 영웅이 섞인 상태로 Vite SSR을 검증했다. 브라우저 클릭 및 375px 실측은 남았다.

---

## 73. 파티 구성·전투 준비 화면의 영웅 상태와 소속 (GPT, Cursor 대신)

**작업 72 뒤에 시작한다(같은 도구라 순서대로).** 설계: `Docs/house.md`의 "파티 구성"과 "전투 준비".

**전달할 내용**

```
Docs/house.md의 "파티 구성: 다른 파티에 있는지"와 "전투 준비: 영웅 상태"를 화면으로 만든다. src/ui/game/battleScreens.tsx(준비 탭), 필요하면 src/ui/App.tsx, src/ui/styles.css, src/locales/*만 고친다. core는 고치지 않는다.

core에 이미 있는 것('../../core'에서 export):
- readiness(state, hero): { busy, condition, recoverAt, fatigue, fatigueLevel: 'fresh'|'tired'|'exhausted', morale, moraleLevel: 'low'|'normal'|'high', parties: string[] }
- busy: { kind: 'expedition', until, dungeonId, presetId } | { kind: 'scout', until } | { kind: 'drill', until } | null
- partiesOf(state, heroId): ['p1', 'p2', 'auto'] 같은 목록('auto'는 자동 출정 파티)
- lifeRules.fatigue(tiredAt 50, exhaustedAt 80), moraleRules(low 30, high 85)

1. 준비 탭의 영웅 고르기 목록과 파티 칸의 영웅마다 한 줄 상태: 피로 막대(색: fresh 초록, tired 노랑, exhausted 빨강), 사기 막대(low 빨강, high 금색), 상태 칩(부상·중상과 회복까지 남은 시간, 원정 중 "던전 이름 · 0:25 뒤 귀환", 정찰 중, 훈련 중 남은 시간).
2. 소속 칩: 지금 보고 있는 파티가 아닌 다른 파티(파티 1/2/3, 자동)를 작게 표시.
3. 지금 보낼 수 없는 영웅(busy가 있거나 사망)은 흐리게 보이고 이유를 적는다. 고르는 것 자체는 지금 규칙 그대로 둔다.
4. 남은 시간은 기존 useNow 같은 시계로 갱신.
5. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev에서 한 파티를 원정 보내고 다른 파티 구성에서 그 영웅의 소속·원정 표시를 본다. 피로·사기가 다른 영웅으로 색을 본다. 확인한 내용을 메모에.
```

**메모**

- 준비와 편성 화면에 피로·사기 막대, 회복·귀환·정찰·훈련 시간, 다른 파티와 자동 소속을 추가했다. 치료 중에는 치료 종료 시각을 표시한다.
- 실제 리듀서 출정 상태를 두 화면에 렌더링해 귀환·소속·피로와 사기 색상 클래스를 확인했다. 브라우저 클릭 및 375px 실측은 남았다. 타입 검사·테스트 282개·빌드 통과.

---

## 74. 집·준비 상태 core 코드 리뷰 (GPT)

**작업 73 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **7995eb2**와 **b1261a7**이다.

**전달할 내용**

```
core 커밋 7995eb2(자동 출정 사이 휴식, 피로한 영웅 제외)와 b1261a7(houseRooms, readiness, partiesOf)를 리뷰한다. 코드는 고치지 않고 Docs/reviews/b1261a7.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/house.md와 차이, 오프라인 자동 출정의 휴식량(피로 회복 속도 × 출정 시간)과 집 레벨 보너스, 피로한 영웅이 빠져 파티가 비는 경우, houseRooms의 침대 합계가 bedsTaken과 맞는지(은퇴자·임신·사망·아이), 부부 한쪽만 은퇴했을 때, 한부모와 고아, partiesOf의 자동 파티(policy fixed가 아닐 때).
VillageScene/BattleScene의 연출은 화면 작업이라 리뷰 대상이 아니다.
```

**메모**

- [리뷰](reviews/b1261a7.md)에 피로 이중 회복, 전사자의 방 정원과 신혼방 불일치, 2인실 성별 혼합, 자동 소속과 실제 파티 불일치, 치료 종료 시각 누락을 기록했다.
- 전원 피로 시 자동 출정 보류, 은퇴 배우자·임신·고아의 방 배정을 확인했다.

- Claude Code가 리뷰 다섯 가지를 모두 고쳤다(e5a73ed). 자동 출정 사이 휴식은 출정으로 쌓인 피로만 덜어 주고, 방에 전사자를 넣고 2인실 남녀를 나누고, 'auto' 소속은 실제 자동 출정 편성을 따르고, treatAt을 더했다.
- Claude Code가 127.0.0.1에서 집 화면과 준비 화면을 확인했다(부부·아이·임신, 한부모, 싱글, 부상·전사, 은퇴자, 원정·훈련 중 영웅이 섞인 세이브, 375px 포함). 집 화면에 부상·중상·전사 칩을 더했다.

---

## 75. 시장 건물·떠돌이 상인 3D (Cursor)

**완료 (0397ba8).** 설계: `Docs/market.md`.

메모:
- LOTS.market을 (10.8, −3.2)로 옮겨 여관 앞마당·길드·분수와 띄웠다. Lv1 줄무늬 노점, Lv2 추가 노점·간판, Lv3 지붕·깃발.
- 상인 마차+당나귀+모자/배낭 인물을 한 번 만들어 재사용. 첫 로드는 주차, 이후 false↔true면 남문 입·퇴장. 영웅이 가끔 시장 앞을 들른다.
- 5176에서 Lv1–3·상인 주차를 확인. 입·퇴장 연출은 장면이 살아 있는 동안 merchant 플래그가 바뀔 때 동작(화면 작업 76 뒤 재확인 권장). tsc·테스트 296·빌드 통과.

---

## 76. 시장 화면 (GPT)

**지금 시작할 수 있다. 작업 75(Cursor)와 함께 돌릴 수 있다.** 설계: `Docs/market.md`. 끝나면 Claude Code가 화면을 직접 확인한다.

**전달할 내용**

```
Docs/market.md를 읽고 시장 화면을 만든다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core와 src/ui/voxel/*은 고치지 않는다. 기존 창 구조와 kit.tsx 공용 조각(Chip, Bar, Res, Portrait 등)을 그대로 쓴다.

core에 이미 있는 것('../../core'에서 export):
- 건물 id 'market'(마을 Lv3, 레벨 1–3). App.tsx BUILDING_SCREEN의 market은 지금 'town'을 연다.
- MARKET_MATERIALS, marketRules, buyQuote(state, material, n), sellQuote(state, material, n), pressureOf(state, material), seasonDeal(state) → { cheap, wanted }, gearValue(gear), potionValue(potionId), merchantHere(state) → { arriveAt, leaveAt, offers } | null.
- 상인 물건 offer: { id, kind: 'material', material, amount, price, sold } | { id, kind: 'gear', gear, price, sold } | { id, kind: 'potion', potionId, count, price, sold }.
- 동작 { type: 'trade', material, amount }(양수 사기, 음수 팔기, 한 번에 최대 100), { type: 'sellGear', gearId }(창고 장비만), { type: 'sellPotion', potionId, count }, { type: 'buyOffer', offerId }.
- 결과 notice: noMarket, poor, noMaterial, missing, noMerchant, soldOut(문구는 locales의 result.*에 이미 있다).

1. 시장 창(App.tsx BUILDING_SCREEN의 market을 새 화면으로). 탭이나 접는 칸으로 "재료", "팔기", "떠돌이 상인"을 나눈다.
2. 재료: 여섯 재료마다 보유량, 지금 사는 값·파는 값(1개 기준), 시세 표시(오름·내림 화살표와 %), 수량 고르기(1·10·50 또는 +/−)와 [사기 n골드] [팔기 n골드] 버튼. 값은 buyQuote/sellQuote로 고른 수량 전체를 계산해 보인다. 골드·재료가 모자라면 비활성.
3. 계절 특가: 맨 위에 "이번 계절: 나무 30% 할인, 수정 50% 비싸게 삼" 같은 줄. 해당 재료 줄에 칩.
4. 팔기: 창고 장비 목록(이름·등급·강화·판매가 gearValue)과 [팔기], 물약 보유량과 판매가 potionValue, 수량과 [팔기]. 팔기 전에 확인 한 번(장비는 되돌릴 수 없다).
5. 떠돌이 상인: 있으면 "n시간 m분 뒤 떠남"과 물건 카드(장비는 능력치 요약, 재료 묶음, 물약 묶음, 값, [사기], 팔렸으면 "팔림"). 없으면 "다음 방문까지" 대신 "상인이 오면 알려 준다"(정확한 시각은 보이지 않는다).
6. 상인이 와 있으면 마을 화면 건물 칩이나 하단 메뉴에 작은 표시(선택).
7. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev에서 디버그 세이브(시장 Lv1, 골드·재료 넉넉히)로 사고팔기와 시세 변화, 특가, 장비·물약 판매, 상인 구매를 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

- 재료 거래·특가, 장비와 물약의 판매 확인, 떠돌이 상인과 방문 알림을 연결했다.
- 개발 서버 렌더링과 리듀서에서 재료·시세·특가, 장비·물약 판매와 상인 구매를 확인했다. 브라우저 클릭과 375px 실측은 남았다. 타입 검사·테스트 296개·빌드 통과.

---

## 77. 시장 core 코드 리뷰 (GPT)

**작업 76 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **bb1c2cf**다.

**전달할 내용**

```
시장 core 커밋 bb1c2cf를 리뷰한다. 코드는 고치지 않고 Docs/reviews/bb1c2cf.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/market.md와 수치·규칙 차이, 사고 되팔기로 골드를 만들 수 있는 길(특가 재료 포함, 시세 하한·상한, 반올림, 수량 0·음수·소수·100 초과), 시세가 시간에 따라 돌아오는 계산(lastTickAt 기준, 오프라인), 상인 도착·떠남·건너뛰기(advance 조각 경계, 시장을 나중에 지었을 때 nextMerchantAt), 상인 물건 생성(대장간 레벨별 장비, 희귀 옵션, 같은 id 중복), 장비 판매(입은 장비·기본 장비·장신구), 물약 판매와 자동 물약 유지, 은퇴자 보너스, 세이브 19 → 20.
```

**메모**

- [리뷰](reviews/bb1c2cf.md)에 즉시 왕복 이익, 물약 배치 가격, 완공 전으로 소급하는 상인 일정, 비유한 수량 미검증을 기록했다.
- 수정 50개 왕복 +2골드, 회복 물약 한 배치 판매의 현금 +8골드, v19 시장 초기화를 재현했다.

---

## 78. 시장 경제 측정 (GPT)

**작업 77 뒤에 시작한다.**

**전달할 내용**

```
시장이 진행과 골드 흐름에 주는 영향을 측정한다. tools/에 새 스크립트를 만들거나 tools/first-hour.ts를 넓힌다. core는 고치지 않는다. 결과는 Docs/market.md 끝에 "측정 (날짜)" 절로 적는다.

1. 시장 없이 / 시장 Lv1로 마을 Lv3–5 구간을 시뮬레이션한다(남는 재료를 팔고 모자란 재료를 사는 단순한 플레이어). 건물 건설·제작에 걸리는 시간이 얼마나 줄어드는지.
2. 사고 되팔기·특가로 골드를 버는 전략이 손해인지 확인(시세 상한·하한 근처 포함).
3. 떠돌이 상인 장비가 대장간 진행을 너무 앞당기는지(Lv3 마을에서 희귀 장비를 살 수 있는 시점).
4. 숫자를 바꿀 제안이 있으면 market.json 키와 값으로 적는다(고치지는 않는다).
```

**메모**

- 시드 20개에서 시장 Lv1 이용 시 대장간 Lv3까지 중앙값 37.8분, 희귀 장비 제작까지 38.8분 단축됐다. 151,200건의 즉시 왕복 거래와 계절 경계 특가를 비교했다.
- [시장 측정](market.md#측정-2026-11-25)에 거래·상인 결과와 `deal.demand` 0.5→0.35 제안을 기록했다. 코어와 데이터는 수정하지 않았다.
- Claude Code가 리뷰 네 가지를 고쳤다(13fffab): 팔 때 값을 먼저 내리고 파는 값 상한 90%로 왕복 이익 차단, 물약을 병 단위로 계산, 시장이 열릴 때 첫 상인, 숫자가 아닌 수량 무시.
- Claude Code가 127.0.0.1에서 시장 화면·3D를 확인했다. 사고팔기와 시세 변화, 장비·물약 판매, 상인 구매, 375px. 상인 물건이 겹치던 것(같은 검 두 자루)을 서로 다른 물건으로 바꾸고, 물약 판매 수량을 보유량에 맞추고, 시장 앞을 가리던 나무를 옮겼다.

---

## 79. 성격별 마을 행동·감정 말풍선 3D (Cursor)

**완료 (776b46f).** 설계: `Docs/personality.md`.

메모:
- 쉬는 중 성격 배회: 사교적 무리, 외톨이 가장자리, 야망가 훈련소/남문, 온화함 아이·은퇴자, 다혈질 빠른 걸음·잦은 목표 변경, 겁 많은 마음 건물 앞·느린 걸음. 분수 회피 유지.
- 사기 ±8 이상이면 공용 말풍선(하트/구름, 최대 4개·약 2초). 사기 ≤30이면 고개 숙임·느린 걸음.
- 5176에서 성격 6종 로스터 배회 확인. 말풍선은 세이브 사기 급변으로 경로 확인(수명이 짧아 스크린샷은 놓치기 쉬움). tsc·테스트 311·빌드 통과.

---

## 80. 성격·감정 화면 (GPT)

**지금 시작할 수 있다. 작업 79(Cursor)와 함께 돌릴 수 있다.** 설계: `Docs/personality.md`. 끝나면 Claude Code가 화면을 직접 확인한다.

**전달할 내용**

```
Docs/personality.md를 읽고 성격과 새 감정을 화면에 보인다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core와 src/ui/voxel/*은 고치지 않는다. 기존 창 구조와 kit.tsx 공용 조각을 그대로 쓴다.

core에 이미 있는 것('../../core'에서 export):
- PERSONALITY_IDS, personalityOf(hero), emotionScale(hero, 'grief' | 'joy' | 'pride' | 'anxiety' | 'resentment'), affinityScale(a, b), partyFit(hero, others), partyBonus(state, ids)(음수일 수 있다), personalityRules(emotion·pairs 표, anxiety·resentment 수치).
- hero.personality, hero.losses(연패 수), hero.benched(친구가 떠나는 걸 지켜본 횟수, 3이면 서운함).

1. 성격 이름과 한 줄 설명(ko/en). 문서의 표 문구를 쓴다.
2. 영웅 상세: 성격 칩과 설명, "잘 느끼는 감정"(배수가 1.2 이상인 감정)과 "덤덤한 감정"(0.8 이하). 연패 중이면 "연패 n번 · 불안", 남겨짐이 1 이상이면 "친구들이 떠나는 걸 n번 지켜봄".
3. 영웅 상세의 친한 사람 목록(topBonds)에 궁합 표시: affinityScale이 1.15 이상이면 "잘 맞음", 0.85 이하면 "안 맞음".
4. 파티 편집(battleScreens): 영웅을 고를 때 지금 파티와의 궁합 칩(partyFit 합이 양수면 "궁합 +n%", 음수면 "충돌 −n%"). 파티 칸에는 partyBonus가 음수인 영웅에게 경고 칩.
5. 방문자(여관)·아이 상세에도 성격 칩. 아이는 부모에게서 물려받았는지는 보이지 않아도 된다.
6. 사기가 크게 바뀐 사건 알림 문구에 원인 추가(선택): "연패로 불안해한다", "친구들만 떠나 서운해한다".
7. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev에서 성격이 섞인 디버그 세이브로 상세·파티 편집·여관을 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

- 영웅·아이·여관의 성격, 영웅의 감정·연패·남겨짐, 친한 사람과 파티 편집의 궁합 및 충돌 표시를 추가했다.
- Vite 개발 서버 렌더링으로 각 표시를 확인했다. 브라우저 클릭과 375px 실측은 남았다. 타입 검사·테스트 311개·빌드 통과.

---

## 81. 성격 core 코드 리뷰 (GPT)

**작업 80 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **49c92da**다.

**전달할 내용**

```
성격 core 커밋 49c92da를 리뷰한다. 코드는 고치지 않고 Docs/reviews/49c92da.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/personality.md와 수치·규칙 차이, 성격 결정이 기존 무작위 흐름(방문자·아이·전투)을 바꾸지 않는지, 이전 세이브와 은퇴자·방문자·아이의 성격, 유전 확률, 감정 배수가 빠진 사기 변화 경로, cheer 상한과 배수의 순서, 음수 파티 보너스가 전투·자동 출정에 주는 영향(공격력 하한), 불안 연패 계산(자동 출정 포함, 사망·중상, 후퇴), 가족 중상 불안의 대상, 서운함 계산(원정 출발 시점의 바쁜 영웅, 친구 기준, 남겨짐 초기화), 결혼 기쁨.
```

**메모**

- [리뷰](reviews/49c92da.md)에 추모제 대상 판정, 궁합의 치유량 반영, 은퇴 가족의 중상 불안 제외, 저피로 영웅의 서운함 제외를 기록했다.
- 감정 배수의 자부심 상한, 연패·남겨짐 초기화, 기존 세이브의 성격 이관을 검증했다.

---

## 82. 성격 영향 측정 (GPT)

**작업 81 뒤에 시작한다.**

**전달할 내용**

```
성격이 진행에 주는 영향을 측정한다. tools/에 새 스크립트를 만들거나 기존 시뮬레이터를 넓힌다. core는 고치지 않는다. 결과는 Docs/personality.md 끝에 "측정 (날짜)" 절로 적는다.

1. 같은 시드에서 성격 분포별로 첫 결혼까지 걸리는 시간(잘 맞는 짝 대 안 맞는 짝).
2. 패배가 잦은 구간에서 불안이 사기를 얼마나 떨어뜨리는지, 사기 30 이하로 자동 출정에서 빠지는 일이 얼마나 생기는지.
3. 서운함이 일반적인 플레이(파티 하나를 주로 보내는 플레이어)에서 얼마나 자주 생기는지. 너무 잦으면 benchedTrips·loss 조정안을 적는다.
4. 파티 궁합 보정이 전투 승률에 주는 차이(최대 +5%와 −6%).
5. 숫자를 바꿀 제안이 있으면 personality.json 키와 값으로 적는다(고치지는 않는다).
```

**메모**

- [성격 측정](personality.md#측정-2026-11-25)에 짝지은 첫 결혼 48시간 차이, 겁 많은 마음의 3연패 실의, 궁합 ±보정 승률을 기록했다.
- 한 친구를 30회 연속 남긴 경우 서운함이 10회, `resentment.benchedTrips` 5·`resentment.loss` 8 비교에서는 6회였다. 이 설정을 플레이테스트 제안으로 남겼다.
- Claude Code가 리뷰 네 가지를 고치고 측정 제안을 반영했다(c3d2a87). 추모제 대상은 축제 전 사기로 정하고, 성격 궁합은 공격에만 넣고, 은퇴한 가족도 불안을 느끼고, 서운함은 가벼운 피로를 센다. anxiety.loss 8, resentment 5번·8.
- Claude Code가 127.0.0.1에서 영웅 상세(성격·감정·연패), 친한 사이 궁합, 파티 편집의 궁합·충돌 칩, 축제 뒤 마을 말풍선을 확인했다.

---

## 83. 선술집 건물·술자리·축제 장식 3D (Cursor)

**지금 시작할 수 있다. 작업 84(GPT)와 파일이 겹치지 않아 함께 돌릴 수 있다(같은 폴더에서 동시에 돌리려면 git worktree로 나눈다).** 설계: `Docs/tavern.md`. 끝나면 Claude Code가 화면을 직접 확인한다.

**전달할 내용**

```
Docs/tavern.md를 읽고 선술집의 3D를 만든다. src/ui/voxel/*만 고친다. core, App.tsx, 화면(src/ui/game/*)은 고치지 않는다.

이미 있는 것:
- 건물 id 'tavern'(마을 Lv2, 레벨 1–3). world.ts LOTS에 자리 표시용 tavern: { x: -4.6, z: -6.4, w: 3, d: 2.6 }가 있다(광장 북서쪽, 회관과 신전 사이). 지금은 기본 집 모양이다.
- VillageScene.update(props)에 tavernRound: { heroIds, at } | null(가장 최근 술자리)이 이미 들어온다. at이 바뀌면 새 술자리다. App·VillageView는 연결되어 있다.
- 축제는 props로 아직 오지 않는다. 축제 장식이 필요하면 다른 방법 대신 이 작업 메모에 "festival prop 필요"라고 적는다(Claude Code가 연결한다).

1. 자리 확인: 카메라는 남동쪽(16,16,16)에서 본다. 회관·신전·연금술 공방·광장 걷는 길과 겹치거나 가리지 않는지 보고, 필요하면 LOTS.tavern 좌표만 옮긴다.
2. world.ts drawBuilding에 선술집 모델: Lv1 작은 목조 주점(나무 간판에 잔 그림, 문 옆 통), Lv2 2층과 바깥 탁자 하나, Lv3 넓은 테라스와 줄 등불. 건설 중 비계는 기존 규칙 그대로.
3. 술자리: tavernRound.at이 바뀌면 heroIds의 영웅들이 선술집 앞 탁자로 걸어가 둘러앉고(또는 서서) 잔을 들어 건배하는 동작을 몇 초 보인 뒤 원래 하던 일로 돌아간다. 원정·훈련 중인 영웅은 건너뛴다. 이미 지난 술자리로 페이지를 열면 아무것도 하지 않는다.
4. 앞마당: 선술집 앞에 작은 광장(돌바닥 몇 칸, 벤치). 영웅 몇 명이 가끔 들러 앉는다(성격 사교적이면 더 자주).
5. 성능: 기존 Builder로 합친 메시, 탁자·잔은 한 번 만들어 재사용.

확인: npm run dev에서 디버그 세이브로 선술집 Lv1–3, 술자리 장면을 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**
- 완료 155a38a. LOTS.tavern을 (-4.4, -5.9, 3.2×2.8)로 살짝 옮겨 회관·신전·연금술과 띄우고 광장 쪽으로 앞마당을 열었다. Lv1 목조 주점(잔 간판·통·돌바닥·벤치), Lv2 2층+바깥 탁자, Lv3 테라스+줄등. `tavernRound.at` 변경 시 탁자·잔 재사용 건배(원정·훈련 스킵, 페이지 첫 로드의 옛 술자리는 재생 안 함). 사교 성격은 앞마당에 더 자주 들른다. 축제 장식용 festival prop은 아직 안 넘어와서 **festival prop 필요**(Claude Code가 연결). 5177에서 Lv1–3·건배 장면 확인. tsc·test·build 통과.

---

## 84. 선술집·유품 화면 (GPT)

**지금 시작할 수 있다. 작업 83(Cursor)과 함께 돌릴 수 있다.** 설계: `Docs/tavern.md`. 끝나면 Claude Code가 화면을 직접 확인한다.

**전달할 내용**

```
Docs/tavern.md를 읽고 선술집과 유품을 화면에 보인다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core와 src/ui/voxel/*은 고치지 않는다. 기존 창 구조와 kit.tsx 공용 조각을 그대로 쓴다.

core에 이미 있는 것('../../core'에서 export):
- 건물 id 'tavern'(마을 Lv2, 레벨 1–3). App.tsx BUILDING_SCREEN의 tavern은 지금 'town'을 연다.
- tavernRules(sessionsPerSeason, minPeople 2, maxPeople 3, cost, affinity, joy, fatigue, minglePerLevel, festivalScale, heirloom.bonus/maxGenerations/comfort), gatherLeft(state), gatherPreview(state, heroIds) → [{ a, b, affinity }], festivalScale(state), affinityScale(a, b).
- 동작 { type: 'gather', heroIds }(술자리), { type: 'bequeath', retireeId, gearId, toId }(toId가 null이면 창고). 결과 notice: noTavern, tavernFull, gatherSize, busyHero, poor, notHeir, missing(문구는 locales의 result.*에 이미 있다).
- gear.heirloom: { ownerId, ownerName, family?, generations, comforted? }. heirloomBonus(state, hero, gear)(그 영웅이 끼면 오르는 비율), isHeir(state, heroId, ownerId).

1. 선술집 창(App.tsx BUILDING_SCREEN의 tavern을 새 화면으로): 이번 계절 남은 술자리 n/m, 비용, 레벨별 효과 표(술자리 수·평소 교류·축제 배수).
2. 술자리 만들기: 어른 영웅 목록에서 2–3명 고르기(바쁜 영웅은 흐리게, 이유). 고르면 짝마다 오를 호감도 미리보기(gatherPreview, 지금 호감도 → 오른 뒤), 잘 맞음/안 맞음 칩. [술자리 열기 n골드].
3. 축제 창(기존): 선술집이 있으면 "선술집이 주최: 효과 ×1.3" 한 줄.
4. 유품 표시: 장비 이름 앞에 "○○ 가문의"(family, 없으면 ownerName) 유품 표시와 대 수(1–3대). 영웅 상세·창고·장비 고르기에서 그 영웅이 끼면 오르는 비율(heirloomBonus > 0이면 "자손 보너스 +9%").
5. 은퇴자 상세: 지닌 장비마다 [물려주기] → 자손(isHeir) 목록에서 고르기, 또는 [창고에 두기]. 자손이 없으면 안내.
6. 유품을 처음 낀 자손의 사기 회복은 기존 사기 변화 표시를 따른다(별도 문구 선택).
7. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev에서 디버그 세이브(선술집 Lv1, 은퇴한 할아버지와 손자, 성격이 섞인 영웅)로 술자리·물려주기·유품 착용을 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

- 선술집 인원 선택·쌍별 호감 미리보기, 축제 배수, 유품 이름·대 수·자손 보너스 및 은퇴자의 물려주기를 연결했다.
- Vite 렌더링과 리듀서로 술자리 횟수·비용, 직접 계승 및 창고 후 착용을 확인했다. 브라우저 클릭과 375px 실측은 남았다. 타입 검사·테스트 326개·빌드 통과.

---

## 85. 선술집·유품 core 코드 리뷰 (GPT)

**작업 84 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **161d1d1**과 **f1dd9ef**다.

**전달할 내용**

```
선술집·유품 core 커밋 161d1d1, f1dd9ef를 리뷰한다. 코드는 고치지 않고 Docs/reviews/161d1d1.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/tavern.md와 수치·규칙 차이, 술자리 제한(계절 경계, 같은 영웅 중복, 아이·사망·바쁜 영웅, 은퇴자), 호감도 상한과 성격 배수, 평소 교류와 축제 배수가 들어가는 경로, 유품이 되는 경로(전투 영구 사망·자연사·은퇴자 자연사·해고·은퇴자 물려주기)와 빠진 경로, 자손 판정(3대, 무덤의 부모 정보, 은퇴자), 대 수 증가 규칙, 자손 보너스가 전투에 들어가는 경로(수동·자동), 슬픔 위로 1회 제한, 장비 정규화와 세이브 20 → 21.
```

**메모**

- [리뷰](reviews/161d1d1.md)에 직접 계승의 장신구 슬롯 초과, 위로 이력 초기화, 연속 술자리의 동일 식별자를 기록했다.
- 같은 정산 시각의 술자리 두 번, 장신구 세 개 착용, 구버전 선술집 초기화를 재현했다.

---

## 86. 선술집·유품 측정 (GPT)

**작업 85 뒤에 시작한다.**

**전달할 내용**

```
선술집과 유품이 진행에 주는 영향을 측정한다. tools/에 새 스크립트를 만들거나 기존 시뮬레이터를 넓힌다. core는 고치지 않는다. 결과는 Docs/tavern.md 끝에 "측정 (날짜)" 절로 적는다.

1. 술자리를 계절마다 다 쓰는 플레이어와 안 쓰는 플레이어의 첫 결혼·첫 아이 시점(잘 맞는 짝, 안 맞는 짝).
2. 선술집 레벨별 평소 교류와 축제 배수가 사기·호감도에 주는 차이.
3. 유품 보너스(6/9/12%)가 전투 승률에 주는 차이, 대 수가 3까지 가는 데 걸리는 대략적인 세대 시간.
4. 술자리 비용과 피로가 원정 흐름을 방해하는지.
5. 숫자를 바꿀 제안이 있으면 tavern.json 키와 값으로 적는다(고치지는 않는다).
```

**메모**

- [측정](tavern.md#측정-2026-11-25)에 안 맞는 짝의 첫 결혼 12시간 단축, 첫 출산의 짝지은 중앙값 0시간, 레벨별 교류·축제·피로를 기록했다.
- 유품 보너스와 승률, 예시 계보의 3대 약 164일, 골드 부담 완화 후보 `cost` 15→12를 기록했다.
- Claude Code가 리뷰 세 가지를 고치고 측정 제안을 반영했다. 물려주기 슬롯 규칙과 쓰러진 자손, 위로 기록 유지, 술자리 시각 구분, 비용 12. 마을 장면에 festival prop을 연결했다(작업 87).

---

## 87. 축제 장식 3D (Cursor)

**지금 시작할 수 있다.** 작업 83 메모의 "festival prop 필요"를 Claude Code가 연결했다.

**전달할 내용**

```
작업 83에 이어 축제 장식을 만든다. src/ui/voxel/*만 고친다.

이미 있는 것: VillageScene.update(props)의 festival: 'spring' | 'summer' | 'autumn' | 'winter' | null(이번 계절에 연 축제 종류, 없으면 null). App·VillageView는 연결되어 있다.

1. festival이 null이 아니면 그 계절 동안 선술집 앞마당과 광장에 장식을 둔다. 봄 파종제(꽃줄·꽃바구니), 여름 무술 대회(깃발·작은 과녁), 가을 수확제(곡식 다발·호박·과일 수레), 겨울 추모제(등불·촛불). 선술집이 없으면 광장에만.
2. 축제를 막 연 순간(null → 값) 광장에 작은 폭죽·꽃가루 터짐(기존 burst 재사용 가능).
3. 계절이 바뀌어 null이 되면 장식을 걷는다.
4. 성능: Builder로 합친 메시를 계절마다 한 번 만든다.

확인: npm run dev에서 계절마다 축제를 열어 장식을 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**
- 완료 5922ec2. `buildFestivalDecor`로 계절마다 합친 메시 하나(봄 꽃줄·바구니, 여름 깃발·과녁, 가을 곡식·호박·수레, 겨울 등불·촛불). 선술집이 있으면 앞마당에도, 없으면 광장만. null→값일 때만 꽃가루 폭죽, 계절이 바뀌면 걷음. 첫 로드의 기존 축제는 장식만. 5178에서 봄·여름 축제 개회와 계절 넘기기 후 장식 제거 확인. 가을·겨울 메시는 강제 sync로 생성 확인. tsc·test·build 통과.

---

## 88. 명예의 전당 건물·석상·진열장 3D (Cursor)

**지금 시작할 수 있다. 작업 89(GPT)와 파일이 겹치지 않아 함께 돌릴 수 있다(같은 폴더에서 동시에 돌리려면 git worktree로 나눈다).** 설계: `Docs/legends.md`. 끝나면 Claude Code가 화면을 직접 확인한다.

**전달할 내용**

```
Docs/legends.md를 읽고 명예의 전당의 3D를 만든다. src/ui/voxel/*만 고친다. core, App.tsx, 화면(src/ui/game/*)은 고치지 않는다.

이미 있는 것:
- 건물 id 'legends'(마을 Lv5, 레벨 1–3). world.ts LOTS에 자리 표시용 legends: { x: 12.3, z: -9.8, w: 3, d: 2.6 }가 있다(여관 동쪽, 나무 (12,-11.5)·(13,-12.5) 근처). 지금은 기본 집 모양이다.
- VillageScene.update(props)에 legends: { id, name, classId, gender?, genes? }[](무덤의 전설과 은퇴한 전설)와 shrine: { id, slot, grade }[](전시된 유품)이 이미 들어온다. App·VillageView는 연결되어 있다.

1. 자리 확인: 카메라는 남동쪽(16,16,16)에서 본다. 여관·여관 앞마당·나무·밭과 겹치거나 다른 건물을 가리지 않는지 보고, 필요하면 LOTS.legends 좌표나 그 근처 나무만 옮긴다. 더 나은 빈자리가 있으면 옮겨도 된다(선술집은 광장 동쪽 (7.3, −2.1)으로 옮겨졌다).
2. world.ts drawBuilding에 명예의 전당 모델: Lv1 흰 돌 기둥의 작은 신전풍 전당, Lv2 계단과 깃발, Lv3 금빛 지붕 장식과 화로.
3. 석상: 전당 앞에 legends의 처음 몇 명(레벨에 따라 2/4/6명)을 돌색 석상으로 세운다. 기존 캐릭터 빌더(buildCharacter)를 genes·classId로 만들고 회색·대리석 재질로 칠한다. 전설이 늘면 석상이 늘어난다.
4. 진열장: shrine 수만큼 전당 안팎의 받침대에 작게 빛나는 무기·갑옷·장신구 모형(slot별 모양, grade별 색).
5. 성능: 석상은 legends가 바뀔 때만 다시 만든다.

확인: npm run dev에서 전설 무덤과 은퇴 전설, 전시 유품이 있는 디버그 세이브로 Lv1–3을 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**
- 완료 813599d. LOTS.legends (12.6, −9.4), 근처 나무를 동남으로 옮김. Lv1 흰 돌 기둥 전당, Lv2 계단·깃발, Lv3 금 지붕 장식·화로. 전설 2/4/6명을 대리석 석상으로(유전자·직업 기반, legends 변경 시에만 재생성). shrine 유품은 받침대 위 빛나는 무기/갑옷/장신구. 5179에서 Lv3·석상 6·진열 3 확인. tsc·test·build 통과.

---

## 89. 명예의 전당 화면 (GPT)

**지금 시작할 수 있다. 작업 88(Cursor)과 함께 돌릴 수 있다.** 설계: `Docs/legends.md`. 끝나면 Claude Code가 화면을 직접 확인한다.

**전달할 내용**

```
Docs/legends.md를 읽고 명예의 전당을 화면에 보인다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core와 src/ui/voxel/*은 고치지 않는다. 기존 창 구조와 kit.tsx 공용 조각을 그대로 쓴다.

core에 이미 있는 것('../../core'에서 export):
- 건물 id 'legends'(마을 Lv5, 레벨 1–3). App.tsx BUILDING_SCREEN의 legends는 지금 'town'을 연다. 마을 화면에 이미 "명예의 전당" 목록 버튼(hallOfFame 무덤 목록)이 있다.
- hallOfFame(state)(무덤의 전설), livingLegends(state)(은퇴한 전설, 전당이 있을 때), isLegendId, legendBonus(state, family), familyLegends(state, family), blessing(state, hero), shrineSlots(state), shrineMorale(state), legendsRules, state.shrine({ gear, honoured } | null).
- 동작 { type: 'enshrine', gearId }(창고의 유품만), { type: 'unshrine', gearId }. 결과 notice noLegends, shrineFull, missing(문구는 locales의 result.*에 이미 있다).

1. 명예의 전당 창(App.tsx BUILDING_SCREEN의 legends를 새 화면으로): 레벨별 효과 표(문서의 표), 전설 목록(무덤과 살아 있는 전설을 함께, "살아 있는 전설" 칩, 직업·레벨·클리어·가문), 가문별 묶음과 그 가문 아이의 잠재력 보너스.
2. 유품 전시: 전시 칸 n/m, 전시된 유품(이름 앞 "○○ 가문의", 대 수)과 [꺼내기], 창고 유품 목록과 [전시하기]. "처음 전시하면 명성 +5", "전시 하나마다 사기 기준 +1" 안내.
3. 기존 마을 화면의 명예의 전당 목록 버튼은 전당이 있으면 새 창을 연다(없으면 지금 목록 그대로).
4. 영웅 상세와 파티 편집: blessing > 0이면 "조상의 가호 +n%" 칩.
5. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev에서 디버그 세이브(전설 무덤, 은퇴 전설, 그 자손, 창고 유품)로 전당 창·전시·가호 칩을 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

- 전당 버튼과 건물 연결, 가문별 전설·유품 전시 및 회수, 영웅 상세와 파티의 가호를 추가했다.
- Vite 렌더링(3D 초상 대체)과 리듀서에서 전설 묶음, 최초 명성 +5, 전시·회수와 가호를 확인했다. 브라우저 클릭과 375px 실측은 남았다. 타입 검사·테스트 335개·빌드 통과.

---

## 90. 명예의 전당 core 코드 리뷰 (GPT)

**작업 89 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **4c3aec1**과 **d7369af**, 장면 연결은 **99207cc**다.

**전달할 내용**

```
명예의 전당 core 커밋 4c3aec1(테스트 수정 d7369af)을 리뷰한다. 코드는 고치지 않고 Docs/reviews/4c3aec1.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/legends.md와 수치·규칙 차이, 살아 있는 전설의 판정과 가문 이름(family 없는 영웅), 가문 보너스 계산(전당 레벨 0과 1 이상, 상한), 조상의 가호의 대상(3대, 은퇴·무덤 조상, 자기 자신)과 수동·자동 전투 경로, 전시(유품만, 명성 1회, 칸 수, 전당 레벨이 낮아지는 경우는 없지만 칸보다 많을 때), 꺼내기, 사기 기준 상승이 회복·자동 출정 판정에 주는 영향, 세이브 21 → 22.
```

**메모**

- [리뷰](reviews/4c3aec1.md)에 가져온 전시품 검증 누락과 동명이인 가문 보너스 공유를 기록했다.
- 정원 초과·중복 ID·전당 Lv0 회복 효과, 가호 담당 보너스, v21 초기화를 재현했다.

---

## 91. 마을 Lv7까지 전체 흐름 점검 (GPT)

**작업 90 뒤에 시작한다.**

**전달할 내용**

```
지금 게임 전체를 처음부터 마을 Lv7까지 시뮬레이션해 흐름을 점검한다. tools/에 새 스크립트를 만들거나 tools/first-hour.ts·market-economy.ts 등을 넓힌다. core는 고치지 않는다. 결과는 Docs/balance.md 새 파일에 적는다.

흉내 플레이어: 첫 시간에는 자주 수동 원정, 이후 자동 출정과 공방 대기열, 시장에서 모자란 재료 사기, 선술집 술자리, 축제, 학교·훈련, 은퇴·결혼은 받아들임. 오프라인(밤 8시간)도 하루 한 번 넣는다. 시드 20개 이상.

1. 마을 Lv2–7 도달 시간, 건물별 첫 건설·최고 레벨 시간, 던전 티어별 첫 클리어 시간(중앙값·최소·최대).
2. 막히는 구간: 골드·재료·명성 중 무엇이 오래 모자라는지, 플레이어가 할 일이 없는(기다리기만 하는) 구간의 길이.
3. 너무 쉬운 구간: 한꺼번에 많이 열리거나 자원이 넘치는 구간.
4. 세대: 첫 결혼·첫 아이·첫 성인식·첫 은퇴·첫 전설 시점.
5. 사기·피로·부상으로 원정이 멈추는 시간 비율.
6. 숫자를 바꿀 제안은 파일(json)·키·값과 기대 효과로 적는다(고치지는 않는다). 우선순위를 매긴다.
```

**메모**

- [밸런스 결과](balance.md)에 20시드 × 32일, 하루 8시간 오프라인 조건을 기록했다. 모두 Lv7과 티어 7에 도달했고 중앙값은 2.77시간과 4.66시간이었다.
- Lv7 이전 건설 재료 부족 41.42%, 돌·나무의 반복 부족, 세대 도달과 원정 상태를 집계했다. Lv7 명성, 시장 첫 건설 돌 비용, 전당 첫 건설 골드의 조정 후보를 기록했다.
- Claude Code가 리뷰 첫 번째(불러온 전시품 검사·전당 없을 때 사기)를 고쳤다(7abfc6e). 두 번째(가문 없는 동명이인 전설)는 가문 이름 체계 문제라 따로 남긴다.
- Claude Code가 127.0.0.1에서 전당 창(가문별 보너스, 살아 있는 전설 칩, 전시 1/4·명성 +5·사기 기준 +1)과 석상을 확인했다. 시장 때 옮긴 나무 (13.8, −6)가 전당 앞을 가려 (14, 4.5)로 옮겼다.

---

## 92. 상위 레벨 건물·영웅·전설 장비 3D (Cursor)

**지금 시작할 수 있다. 작업 93(GPT)과 파일이 겹치지 않아 함께 돌릴 수 있다(같은 폴더에서 동시에 돌리려면 git worktree로 나눈다).** 설계: `Docs/endgame.md` 4a.

**전달할 내용**

```
Docs/endgame.md의 4a를 읽고 3D를 맞춘다. src/ui/voxel/*만 고친다. core, App.tsx, 화면(src/ui/game/*)은 고치지 않는다.

이미 있는 것:
- 건물 새 레벨: 집 5·6, 길드 5, 대장간 4·5, 연금술 4, 마법 공방 4, 훈련소 4, 여관 3, 시장 4, 선술집 4, 학교 4, 명예의 전당 4. VillageScene은 buildings 레벨을 그대로 받는다.
- 장비 등급에 'epic'(영웅)·'legend'(전설)이 더해졌다. 레시피 epic.blade, epic.mail, legend.blade, legend.mail.

1. world.ts drawBuilding의 각 건물이 새 레벨에서 한 단계 더 커지거나 꾸며지게 한다(지금 최고 레벨 모습에서 이어지게). 집은 Lv5 별채·Lv6 3층, 대장간 Lv4 큰 화로·Lv5 금빛 모루, 나머지는 장식·깃발·불빛 정도로 충분하다. 다른 건물을 가리지 않게 크기를 지킨다(카메라는 남동쪽).
2. 영웅·전설 장비: 전투 화면(BattleScene)과 초상·마을 캐릭터에서 무기·갑옷 색과 빛(영웅 보라, 전설 금빛, 은은한 빛 파티클)이 보이게 한다. 기존 등급 표현이 있으면 그 규칙을 따른다.
3. 성능: 빛 효과는 영웅·전설 장비에만, 공용 재질을 재사용한다.

확인: npm run dev에서 디버그 세이브(마을 Lv10, 상위 레벨 건물, 전설 장비 착용 파티)로 마을과 전투를 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

집 Lv5 별채·Lv6 3층, 대장간 큰 화로·금 모루, 학교 전용 메시, 나머지 건물 Lv4/5 깃발·불빛. 영웅/전설은 마을·초상에서 `gearAuraOf`로 보라/금빛 무기·트림·파티클(공용 glow 재질). ReplayHero에 gear가 없어 전투 리플레이 오라는 아직 안 붙음. tsc·test·build 통과. 디버그 Lv10 세이브로 마을을 눈으로 확인하지는 못함(기존 세이브 보호).

---

## 93. 마을 Lv8–10·상위 레벨·전설 장비 화면 (GPT)

**지금 시작할 수 있다. 작업 92(Cursor)와 함께 돌릴 수 있다.** 설계: `Docs/endgame.md` 4a.

**전달할 내용**

```
Docs/endgame.md의 4a를 화면에 반영한다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core와 src/ui/voxel/*은 고치지 않는다.

core에 이미 있는 것:
- villageRules.levels 8–10(명성 520/820/1250, 건물 최대 Lv 5/5/6).
- 건물 레벨 항목에 town?(필요한 마을 레벨)과 bone?·herb?·crystal?(선택) 비용. 마을 레벨이 모자라면 build 결과 notice 'locked', 재료가 모자라면 'resources'.
- GearGrade에 'epic'·'legend'. 대장간 레시피 epic.blade, epic.mail(smithLevel 4), legend.blade, legend.mail(smithLevel 5), 레시피에 bone?·crystal? 비용.
- 각 건물의 새 레벨 효과는 기존 효과 계산 그대로(레벨 표가 길어졌을 뿐).

1. 마을 레벨 표시와 다음 레벨 명성이 Lv10까지 이어지게. Lv10이면 "최고 레벨".
2. 마을 운영의 건물 카드: 다음 레벨에 town이 있고 마을 레벨이 모자라면 "마을 LvN에 열림"으로 보이고 버튼을 막는다. 비용에 뼈·약초·수정이 있으면 기존 Res 표시로 함께 보인다.
3. 각 건물 창의 레벨별 효과 표(시장·선술집·학교·명예의 전당 등)에 새 레벨 행이 나오는지 확인하고, 하드코딩된 표가 있으면 데이터에서 읽게 바꾼다.
4. 장비 등급 이름·색: 영웅(보라), 전설(금색) ko/en. 장비 목록·창고·시장·상인·유품 표시 모두.
5. 대장간 창: Lv4·5 레시피가 보이고, 뼈·수정 비용이 보인다.
6. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev에서 디버그 세이브(명성 1300, 재료 넉넉히, 건물들 최고 레벨 직전)로 건설·제작을 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

---

## 94. 4a core 코드 리뷰 (GPT)

**작업 93 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **d89e486**이다.

**전달할 내용**

```
4a core 커밋 d89e486을 리뷰한다. 코드는 고치지 않고 Docs/reviews/d89e486.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/endgame.md와 수치 차이, 건설의 town 확인과 maxBuildingLevel 확인 순서, 뼈·약초·수정 비용이 빠진 경로(건설·제작·대기열·강화·광고로 건설 끝내기), 레벨 표를 늘린 건물마다 효과 계산이 새 레벨을 실제로 읽는지(Math.min 고정, 선형 계산, 표 길이 검사), 길드 Lv5 실적, 영웅·전설 장비의 정규화·옵션·판매가·상인 물건(대장간 Lv3이면 영웅 장비가 상인에게 나오는지), 명성이 270–339인 기존 세이브가 Lv6으로 내려가는 영향(이미 지은 건물·해금된 기능).
```

**메모**

---

## 95. 4a 측정: Lv8–10 도달·후반 재료·전설 장비 (GPT)

**작업 94 뒤에 시작한다.**

**전달할 내용**

```
4a가 후반 흐름에 주는 영향을 측정한다. 작업 91의 tools/village-balance.ts를 넓힌다. core는 고치지 않는다. 결과는 Docs/endgame.md 끝에 "측정 (날짜)" 절로 적는다.

1. 마을 Lv8·9·10 도달 시간(시드 20개 이상, 32일 이상). 목표는 Lv8 2–3일, Lv9 약 1주, Lv10 약 2주.
2. 새 건물 레벨이 뼈·약초·수정 재고를 얼마나 쓰는지, "100개 넘는 재료 3종" 비율과 "소원만 가능" 비율이 얼마나 줄었는지(작업 91과 비교).
3. 영웅·전설 장비가 티어 6–7 승률과 첫 클리어 시점에 주는 차이.
4. 숫자를 바꿀 제안이 있으면 파일·키·값으로 적는다(고치지는 않는다). 특히 levels 8–10의 fame.
```

**메모**

---

## 96. 요일 던전·심연 전투 배경 3D (Cursor)

**작업 92 뒤에 시작한다(같은 도구라 순서대로). 작업 97(GPT)과는 파일이 겹치지 않아 함께 돌릴 수 있다.** 설계: `Docs/endgame.md` 4a.

**전달할 내용**

```
Docs/endgame.md의 4a를 읽고 새 던전의 전투 배경을 만든다. src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx만 고친다. core, App.tsx, src/ui/game/*는 고치지 않는다.

이미 있는 것:
- 특수 던전: trial_flame_1–3, trial_frost_1–3, trial_light_1–3(요일 던전, DungeonDef.special 'weekday', element), abyss(끝없는 던전, special 'endless'). dungeonById(id)로 찾는다. 원정에 abyssFrom(시작 층)이 있다.
- BattleScene은 지금 tier로 배경 테마를 고른다. BattleView·ExpeditionPanel이 dungeonById(...).tier를 넘긴다.

1. BattleScene이 던전 id(또는 special·element·깊이)를 받아 배경을 고르게 한다. 기존 tier 경로는 그대로 둔다.
2. 요일 던전: 화염(용암 바닥·불꽃 기둥·붉은 빛), 서리(얼음 바닥·고드름·푸른 빛), 빛(대리석·빛 기둥·금빛). 난이도가 높을수록 장식이 짙어진다.
3. 심연: 어두운 보라 바닥, 떠다니는 파편. 깊이(abyssFrom)가 깊을수록 더 어둡고 붉은 빛이 섞인다. 층 번호를 화면 구석에 작게.
4. 성능: 테마 재질은 기존처럼 한 번 만든다.

확인: npm run dev에서 디버그 세이브(마을 Lv7, 강한 파티)로 요일 던전과 심연 리플레이를 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

BattleScene이 special·element·difficulty·abyssFrom을 받아 flame/frost/light/abyss 테마를 고른다(기존 tier·둥지 유지). 심연은 깊이에 따라 붉게 어두워지고 떠다니는 파편·층 라벨을 붙인다. BattleView·ExpeditionPanel이 dungeonById와 trip.abyssFrom을 넘긴다. tsc·test·build·battleTheme 단위 테스트 통과. 디버그 세이브로 요일/심연 리플레이는 브라우저에서 직접 보지 못함.

---

## 97. 금고·요일 던전·심연 화면 (GPT)

**지금 시작할 수 있다. 작업 96(Cursor)과 함께 돌릴 수 있다.** 설계: `Docs/endgame.md` 4a.

**전달할 내용**

```
Docs/endgame.md의 4a를 화면에 보인다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core, src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx는 고치지 않는다.

core에 이미 있는 것('../../core'에서 export):
- specialDungeons(요일 던전 9개 trial_<element>_<1-3>, 끝없는 던전 abyss), DungeonDef.special('weekday' | 'endless'), element('flame' | 'frost' | 'light'), difficulty(1–3). 일반 dungeons 목록에는 없다.
- state.vault({ flame, frost, light, abyss }), state.trials({ date, used } | null), state.abyss({ best, checkpoint }).
- ESSENCES, todayElement(now)('flame' | 'frost' | 'light' | 'choice'), trialsLeft(state, now), specialBlock(state, id, now)(null | 'lockedDungeon' | 'trialDay' | 'trialsUsed'), abyssFloors(from)(층별 몬스터와 scale), abyssShards(floor, best), endgameRules.
- 원정은 기존대로 { type: 'dungeon', id }로 고르고 { type: 'depart', ... }로 보낸다. 결과 notice trialDay, trialsUsed(문구는 locales result.*에 있다).

1. 상단 자원 줄 또는 마을 운영에 금고: 화염·서리·빛 정수와 심연석(아이콘과 수). 0이면 숨겨도 된다.
2. 전투 > 던전 목록에 "특수 던전" 묶음: 오늘의 요일 던전(오늘 정수, 남은 횟수 n/3, 난이도 3단계와 권장 레벨·보상 정수 수, 일요일은 세 정수 모두), 끝없는 던전(최고 층, 체크포인트, 다음 5층의 몬스터 미리보기, 처음 깨는 층의 심연석). 잠겨 있으면 "마을 LvN에 열림".
3. 던전 이름·설명 ko/en: 화염의 시련(초급·중급·상급) 등, 심연.
4. 원정 결과·전투 기록에 얻은 정수·심연석과 새 최고 층을 보인다(core의 history 기록에 없으면 금고 차이로 보인다).
5. 자동 출정 던전 고르기에서 특수 던전은 보이지 않거나 고를 수 없다고 보인다.
6. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev에서 디버그 세이브(마을 Lv7, 강한 파티)로 요일 던전 3번과 심연 진행을 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

금고, 특수 던전 선택, 정산·기록 표시를 추가했다. Lv7 강한 파티로 시련 3회와 심연 5층 정산을 실행해 각 정수 4개, 심연석 11개와 체크포인트·저장 이력을 확인했다. 브라우저 375px 실기 검증은 미완료다.

---

## 98. 4a core 코드 리뷰 (GPT)

**작업 97 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **b80777c**다.

**전달할 내용**

```
4a core 커밋 b80777c를 리뷰한다. 코드는 고치지 않고 Docs/reviews/b80777c.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/endgame.md 4a와 차이, 특수 던전을 일반 사다리에서 뺀 영향(dungeons를 쓰는 모든 곳: 해금, 의뢰, 자동, 둥지, 전설 판정, 기록·UI), 요일 계산(기기 시간대, 날짜가 바뀌는 순간, 오프라인 귀환), 하루 횟수(출발 시 소모, 실패 출발 시 소모되지 않는지), 심연 층 생성(같은 층 같은 몬스터, 보스 순환, scale 적용 경로), 심연 보상(최고 기록 갱신 순서, 체크포인트, 명성 10층마다, 중간 패배·후퇴), 금고 정규화, 세이브 22 → 23, 원정 기록(history)에 특수 던전 보상이 남는지.
```

**메모**

날짜 역행 시 횟수 복구, 기록의 정산 정보 누락, 피로 상태 출정, 세이브 정규화 문제를 재현해 `Docs/reviews/b80777c.md`에 기록했다.

---

## 99. 4a 측정: 요일 던전 승률·심연 깊이·하루 자원 (GPT)

**작업 98 뒤에 시작한다.**

**전달할 내용**

```
4a의 난이도와 수입을 측정한다. tools/에 새 스크립트를 만들거나 tools/village-balance.ts를 넓힌다. core는 고치지 않는다. 결과는 Docs/endgame.md 끝에 "4a 측정 (날짜)" 절로 적는다.

1. 요일 던전 난이도 1–3의 승률을 파티 평균 레벨별로(권장 12·15·18 근처). 마을 Lv6에 도달한 실제 파티로 첫 시도 승률.
2. 심연: 레벨·장비별로 체크포인트가 얼마나 깊이 가는지, 하루(16시간 확인) 동안 얻는 심연석과 명성.
3. 하루 자원 수입: 정수(요일 3번)와 심연석을 매일 하는 플레이어 기준으로. 4b에서 쓸 비용을 정하는 바탕이므로 일·주 단위로 적는다.
4. 숫자를 바꿀 제안이 있으면 endgame.json·dungeons.json 키와 값으로 적는다(고치지는 않는다).
```

**메모**

시드 20개로 요일 시련 승률, 심연 깊이·명성, 일·주 수입을 측정해 `Docs/endgame.md`에 기록했다. tsc·테스트 354개·빌드 통과.

---

## 100. 승격 의식·마을 레벨 8–10 모습 3D (Cursor)

**지금 시작할 수 있다. 작업 101(GPT)과 파일이 겹치지 않아 함께 돌릴 수 있다(같은 폴더에서 동시에 돌리려면 git worktree로 나눈다).** 설계: `Docs/endgame.md` 4b.

**전달할 내용**

```
Docs/endgame.md의 4b를 읽고 승격을 마을에서 보이게 한다. src/ui/voxel/*만 고친다. core, App.tsx, 화면(src/ui/game/*)은 고치지 않는다.

이미 있는 것: VillageScene.update(props)에 townLevel(승격을 반영한 마을 레벨, 1–10)이 들어온다. App·VillageView는 연결되어 있다.

1. 승격 장면: townLevel이 7 → 8, 8 → 9, 9 → 10으로 오르는 순간(페이지 첫 로드 제외) 광장에 영웅들이 모이고 회관 위로 빛 기둥·깃발이 오르며 폭죽이 터진다(기존 burst·꽃가루 재사용 가능). 몇 초 뒤 원래대로.
2. 마을 레벨 모습: Lv8 회관에 큰 깃발, Lv9 마을 둘레 낮은 성벽(입구는 열어 둠)이나 등불 길, Lv10 회관 첨탑·금빛 장식. 다른 건물을 가리지 않게.
3. 성능: 장식은 레벨이 바뀔 때만 다시 만든다.

확인: npm run dev에서 디버그 세이브(승격 직전)로 승격 장면과 Lv8–10 모습을 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

Lv8 회관 깃발, Lv9 낮은 성벽(남쪽 문 열림)+등불 길, Lv10 첨탑·금빛. 첫 로드는 장식만, 7→8·8→9·9→10에서만 광장 집합·빛 기둥·폭죽(~5초). 장식은 townLevel 변경 시에만 다시 만듦. tsc·test·build 통과. 디버그 승격 직전 세이브로 장면은 눈으로 확인하지 못함.

---

## 101. 승격·새 자원 비용·마을 Lv10·장비 등급 화면 (GPT)

**지금 시작할 수 있다. 작업 100(Cursor)과 함께 돌릴 수 있다.** 설계: `Docs/endgame.md` 4b와 그 아래 "틀" 절. 보류했던 작업 93의 내용을 포함한다.

**전달할 내용**

```
Docs/endgame.md의 4b와 "틀" 절을 화면에 반영한다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core와 src/ui/voxel/*은 고치지 않는다.

core에 이미 있는 것('../../core'에서 export):
- townLevelOf(state)(승격까지 반영한 마을 레벨, UI는 이미 이것을 쓴다), townLevel(fame)(명성만), PROMOTION_FREE(7), state.promoted.
- 동작 { type: 'promote' }. endgameRules.promotions: [{ level, abyssBest, offering: { flame, frost, light, abyss } }]. 결과 notice promoteFame, promoteDeed, promoteOffering, promoteMax(문구는 locales result.*에 있다).
- 건물 레벨 항목: town?(필요한 마을 레벨), bone?·herb?·crystal?, flame?·frost?·light?·abyss?(금고에서 뺀다). build 결과 'locked', 'resources'.
- GearGrade 'epic'·'legend'. 레시피 epic.blade·epic.mail(smithLevel 4)·legend.blade·legend.mail(smithLevel 5)에 bone·crystal과 flame·frost·light·abyss 비용.
- state.vault, state.abyss.best.

1. 승격 창(마을 운영 또는 회관): 다음 승격 레벨, 명성(현재/필요), 업적(심연 최고 층/필요), 바치는 것(화염·서리·빛·심연석, 현재/필요)과 [승격] 버튼. 조건마다 충족 표시. Lv7 미만이면 숨기고, Lv10이면 "최고 레벨".
2. 마을 레벨·명성 표시가 Lv10까지 이어지게. 명성은 넘었지만 승격 전이면 "승격 의식을 기다리는 중" 칩.
3. 건물 카드: 다음 레벨에 town이 있고 마을 레벨이 모자라면 "마을 LvN에 열림"으로 막는다. 비용에 뼈·약초·수정·정수·심연석이 있으면 함께 보인다(모자란 것은 빨강).
4. 각 건물 창의 레벨별 효과 표에 새 레벨 행이 나오는지 확인하고, 하드코딩된 표가 있으면 데이터에서 읽게 바꾼다.
5. 장비 등급 이름·색: 영웅(보라), 전설(금색) ko/en. 장비 목록·창고·시장·상인·유품 표시 모두.
6. 대장간 창: Lv4·5 레시피와 모든 비용(정수·심연석 포함).
7. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev에서 디버그 세이브(명성 1300, 심연 40층, 금고 넉넉히, 건물 최고 레벨 직전)로 승격 3번, 상위 건설, 전설 제작을 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

승격 조건, 건물·대장간 비용, 영웅·전설 등급을 화면에 반영했다. 명성 1300·심연 40층 상태에서 Lv8–10 승격, 대장간 Lv5 건설과 전설 갑옷 제작을 확인했다. 브라우저 기동이 시간 초과되어 375px 실기 검증은 미완료다.

---

## 102. 4b core 코드 리뷰 (GPT)

**작업 101 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **d89e486**(틀)과 **c89e043**(승격·새 자원 비용)이다.

**전달할 내용**

```
4b core 커밋 d89e486과 c89e043을 리뷰한다. 코드는 고치지 않고 Docs/reviews/c89e043.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/endgame.md 4b·틀과 차이, townLevel(fame)과 townLevelOf(state)가 섞인 곳(마을 레벨에 따른 모든 효과: 방문자 잠재력, 건물 최대 레벨, 해금, 축제 비용, 특수 던전, UI), 승격 조건 순서와 금고 차감, 승격 시 사기 상승, 건설 town 확인과 maxBuildingLevel 순서, 금고 비용이 빠진 경로(건설·제작·대장간 대기열·강화·광고로 건설 끝내기), 레벨 표를 늘린 건물마다 새 레벨이 실제로 쓰이는지, 길드 Lv5 실적, 영웅·전설 장비의 정규화·옵션·판매가·상인 물건, 명성이 270–339인 기존 세이브가 Lv6으로 내려가는 영향, 세이브 23 → 24.
```

**메모**

대장간 대기열 금고 미차감·취소 환불 누락, Lv4·5 강화 확률, 상인 판매와 건설 검사 순서를 `Docs/reviews/c89e043.md`에 기록했다.

---

## 103. 4b 측정: Lv8–10 도달·자원 흐름 (GPT)

**작업 102 뒤에 시작한다.**

**전달할 내용**

```
4b가 후반 흐름에 주는 영향을 측정한다. tools/village-balance.ts와 tools/endgame-4a.ts를 넓힌다. core는 고치지 않는다. 결과는 Docs/endgame.md 끝에 "4b 측정 (날짜)" 절로 적는다.

흉내 플레이어: 작업 91의 플레이어에 요일 던전 3번(가능한 가장 높은 난이도), 심연(쉴 때마다), 승격(조건이 되면 바로), 상위 건물·영웅·전설 장비(자원이 되면)를 더한다.

1. 마을 Lv8·9·10 도달 시간(시드 20개 이상, 32일 이상). 목표는 Lv8 2–3일, Lv9 약 1주, Lv10 약 2주. 어떤 조건(명성·심연 깊이·바치는 것)이 가장 오래 막는지.
2. 금고 자원(화염·서리·빛·심연석)의 수입과 지출, 남는 양. 너무 쌓이거나 모자라는 자원.
3. "소원만 가능" 비율과 "100개 넘는 재료 3종" 비율이 작업 91보다 얼마나 줄었는지.
4. 숫자를 바꿀 제안이 있으면 파일·키·값으로 적는다(고치지는 않는다). 특히 promotions와 levels 8–10의 fame.
```

**메모**

20시드 × 32일 기준 Lv8 20/20(2.03일), Lv9 15/20(7.01일), Lv10 0/20이었다. 금고 수지와 작업 91 비교, 공물 조정 실험을 `Docs/endgame.md`에 기록했다. 타입 검사·테스트 364개·빌드 통과.

---

## 104. 레이드 보스·마을 침공 장면 3D (Cursor)

**지금 시작할 수 있다. 작업 105(GPT)와 파일이 겹치지 않아 함께 돌릴 수 있다(같은 폴더에서 동시에 돌리려면 git worktree로 나눈다).** 설계: `Docs/endgame.md` 4c.

**전달할 내용**

```
Docs/endgame.md의 4c를 읽고 레이드와 침공을 보이게 한다. src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx만 고친다. core, App.tsx, src/ui/game/*는 고치지 않는다.

이미 있는 것:
- 특수 던전 raid(special 'raid'), invasion(special 'invasion'). BattleScene의 special 타입에 둘이 더해졌다(지금은 tier 배경으로 보인다). 원정 trip.raid = { week, start, left, max }(보스 체력 시작·끝·최대). 레이드 보스는 report의 둘째 층 적 중 boss.
- VillageScene.update(props)에 invasion: { warned, at, last: { at, won } | null } | null이 들어온다. App·VillageView는 연결되어 있다.

1. 레이드 전투 배경: 보스마다(고룡: 용암 동굴·날개 그림자, 리치 왕: 얼어붙은 왕좌의 방, 거신: 무너진 성채) 다르게. 둘째 층에서 화면 위에 큰 보스 체력 막대(trip.raid의 start → left로 줄어들고, max 기준). 리플레이에서는 report로 계산.
2. 침공 예고: warned가 true인 동안 마을 남쪽 입구 너머에 적 진영의 깃발·모닥불과 붉은 하늘빛, 경고 표시.
3. 침공 장면: 마을을 볼 때 at이 지나 last.at이 바뀌면(새 결과) 입구로 적이 몰려오고 영웅들이 맞서는 짧은 장면(몇 초). won이면 적이 물러나고 꽃가루, 아니면 연기와 부서진 상자.
4. 성능: 장면 오브젝트는 한 번 만들어 보였다 숨긴다.

확인: npm run dev에서 디버그 세이브로 레이드 리플레이, 침공 예고, 침공 결과(승·패)를 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

레이드 보스별 배경(wyrm 용암·날개 그림자, lich 얼음 왕좌, titan 무너진 성채)과 2층 보스 체력 막대(trip.raid 또는 report). 침공 예고 시 남쪽 진영·붉은 하늘, 결과 시 입구 교전·승패 여파(한 번 만들어 보였다 숨김). tsc·test·build 통과. 디버그 세이브로 레이드/침공은 눈으로 확인하지 못함.

---

## 105. 레이드·침공 화면 (GPT)

**지금 시작할 수 있다. 작업 104(Cursor)와 함께 돌릴 수 있다.** 설계: `Docs/endgame.md` 4c.

**전달할 내용**

```
Docs/endgame.md의 4c를 화면에 보인다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core, src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx는 고치지 않는다.

core에 이미 있는 것('../../core'에서 export):
- 금고에 scale(용비늘)·crown(리치의 왕관)·core(거신의 핵)·valor(용맹 훈장).
- 레이드: 특수 던전 'raid'. raidWeek(now), raidBoss(week)({ id, boss, minions, scale, hpScale, spoil }), currentRaid(state, now)({ week, bossId, hp, max, killed }), state.raidKills, endgameRules.raid. 원정 trip.raid = { week, start, left, max }. 결과 notice raidDone.
- 침공: state.invasion({ nextAt, defenders, count, wins, last: { at, won, waves, lost? } } | null), warned(state, now), 동작 { type: 'defend', presetIds }(최대 3), endgameRules.invasion. 결과 notice noInvasion.
- 승격 조건에 raidKills(Lv9), invasionWins(Lv10)이 endgameRules.promotions에 더해졌다(state.invasion.wins로 센다).

1. 특수 던전 묶음에 레이드: 이번 주 보스 이름·약점 힌트(부하 구성)·남은 체력 막대(hp/max, 처음엔 가득)·전리품, "월요일에 바뀜"과 남은 시간, 쓰러뜨렸으면 "이번 주 처치". 파티를 보낼 때 이번 원정이 줄일 체력은 귀환 때 들어온다는 안내.
2. 침공: 마을 운영(또는 회관)에 다음 침공까지 남은 시간, 예고 중이면 강조, 방어 파티 고르기(프리셋 최대 3, 지금 마을에 있는 인원 표시), 정하지 않으면 "마을에 있는 강한 영웅 다섯이 막는다" 안내. 지난 결과(승리: 얻은 훈장, 패배: 잃은 골드·재료).
3. 승격 창에 레이드 처치·침공 방어 조건 줄.
4. 금고 표시와 비용 표시에 새 자원 4종 이름·아이콘(ko/en).
5. 침공 예고가 시작되면 화면 알림(토스트) 한 번.
6. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev에서 디버그 세이브(마을 Lv9, 강한 파티 여럿)로 레이드 여러 번, 침공 예고·방어·결과를 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

디버그 상태로 레이드 귀환 후 체력 변화, 침공 예고·승패·훈장을 확인했다. Chrome 375px에서 두 창의 가로 넘침이 없고 방어 프리셋 3개가 선택됐다. 침공 결과는 저장된 골드 손실과 재료 차감률을 표시한다.

---

## 106. 4c core 코드 리뷰 (GPT)

**작업 105 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **1650b75**다.

**전달할 내용**

```
4c core 커밋 1650b75를 리뷰한다. 코드는 고치지 않고 Docs/reviews/1650b75.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/endgame.md 4c와 차이, 전투 엔진의 RaidPool(보스 찾기, 체력 시작·끝, 페이즈와 소환, 시간 초과·후퇴·전멸의 기록), 레이드 주 계산(시간대, 월요일 경계, 주가 바뀐 뒤 귀환한 파티), 동시에 보낸 파티의 피해 합산, 처치 보상 중복, 레이드 진행 중 세이브, 침공 예약(Lv9 도달 시점, 승격으로 Lv9가 된 경우), 오프라인 중 여러 침공, 방어 파티 선택(바쁜 영웅, 중복 영웅이 여러 프리셋에 있을 때), 방어 결과 적용(피로·부상, 죽지 않음), 손실 계산, 승격 조건, 금고 새 키와 비용·환불, 세이브 24 → 25.
```

**메모**

주간 교대 뒤 이전 레이드 보상, 침공 중복 방어·귀환 순서, 구버전 대기열 환불을 재현했다. 재료 손실 이력 누락까지 `Docs/reviews/1650b75.md`에 기록했다.

---

## 107. 4c 측정: Lv9·10 승격·레이드 주기·침공 (GPT)

**작업 106 뒤에 시작한다.**

**전달할 내용**

```
4c를 포함한 후반 흐름을 측정한다. tools/endgame-4a.ts --4b 흐름에 레이드(가능할 때마다 주력 파티)와 침공 방어(파티 셋 지정)를 더한다. tools/raid-probe.ts도 참고한다. core는 고치지 않는다. 결과는 Docs/endgame.md 끝에 "4c 측정 (날짜)" 절로 적는다.

1. 마을 Lv8·9·10 도달 시간(시드 20개 이상, 32일 이상). 목표 Lv9 약 1주, Lv10 약 2주.
2. 레이드: 주마다 처치까지 걸린 날짜·출정 수, 보스별 차이, 전리품 수입.
3. 침공: 회차별 승률, 패배 때 잃은 양, 용맹 훈장 수입.
4. 금고 자원(정수·심연석·전리품·훈장) 수입·지출·잔액.
5. 숫자를 바꿀 제안이 있으면 endgame.json 등의 키와 값으로 적는다(고치지는 않는다).
```

**메모**

20개 시드 × 32일에서 Lv9 11.01일, Lv10 25.02일이 중앙값이었다. 레이드 100회 처치, 침공 120회 방어와 금고 흐름을 기록했다. 타입 검사, 테스트 376개, 프로덕션 빌드 통과.

---

## 108. 기념물·계절 이벤트·번영 3D (Cursor)

**지금 시작할 수 있다. 작업 109(GPT)와 파일이 겹치지 않아 함께 돌릴 수 있다(같은 폴더에서 동시에 돌리려면 git worktree로 나눈다).** 설계: `Docs/endgame.md` 4d.

**전달할 내용**

```
Docs/endgame.md의 4d를 읽고 3D를 만든다. src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx만 고친다. core, App.tsx, src/ui/game/*는 고치지 않는다.

이미 있는 것:
- VillageScene.update(props)에 monuments: { statue?, lighthouse?, walls?, arch? }(단계 0–3)와 prosperity(번영 등급 0–30)가 들어온다. App·VillageView는 연결되어 있다.
- 특수 던전 event_spring·event_summer·event_autumn·event_winter(special 'event', season). BattleScene special 타입에 'event'가 더해졌다(지금은 tier 배경).

1. 기념물 넷을 마을에 세운다. 자리가 없으면 마을 가장자리·성벽 근처에서 다른 건물을 가리지 않는 곳을 찾는다(카메라는 남동쪽). 단계마다 커지고 꾸며진다.
   - 영웅의 상: 광장 근처 받침대 위 영웅 석상(단계마다 크기·금빛).
   - 대등대: 마을 가장자리의 탑, 꼭대기 불빛(단계마다 높아지고 빛이 돈다).
   - 성벽과 망루: Lv9 성벽에 망루를 더한다(단계마다 망루 수·깃발).
   - 개선문: 남쪽 입구의 아치(단계마다 장식·금빛).
2. 번영 등급: 등급이 오를수록 길에 등불·깃발·꽃이 조금씩 늘어난다(과하지 않게, 10·20·30에서 눈에 띄는 변화).
3. 계절 이벤트 전투 배경: 봄(꽃잎·풀빛), 여름(축제 등불·모닥불), 가을(낙엽·호박), 겨울(눈·얼음).
4. 성능: 기념물은 단계가 바뀔 때만 다시 만든다.

확인: npm run dev에서 디버그 세이브(마을 Lv10, 기념물 단계 섞어서, 번영 10·20)로 마을과 이벤트 리플레이를 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

기념물 넷(광장 석상·동쪽 등대·성벽 망루·남쪽 개선문)은 단계 변경 시에만 다시 만들고, 등대 빛은 회전. 번영은 10/20/30에서 길 등불·깃발·꽃. 계절 이벤트 전투 배경 spring/summer/autumn/winter. tsc·test·build 통과. 디버그 세이브로 마을·이벤트 리플레이는 눈으로 확인하지 못함.

---

## 109. 이벤트·기념물·강화 확장·레이드 단계·번영 화면 (GPT)

**지금 시작할 수 있다. 작업 108(Cursor)과 함께 돌릴 수 있다.** 설계: `Docs/endgame.md` 4d.

**전달할 내용**

```
Docs/endgame.md의 4d를 화면에 보인다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core, src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx는 고치지 않는다.

core에 이미 있는 것('../../core'에서 export):
- 금고에 token(이벤트 증표). 이벤트: eventDungeonId(state), eventRunsLeft(state), eventShop(state)([{ id, cost, stock, left, vault?, materials?, potions?, gear?, gold? }]), 동작 { type: 'buyEvent', itemId }, 특수 던전 event_<계절>. notice eventSeason, eventUsed, soldOut, poor.
- 기념물: monumentStage(state, id), monumentCost(id, stage), 효과 statueXp·lighthousePotential·lighthouseOffers·wallsCut·archBonus, 동작 { type: 'raiseMonument', id }(id: statue | lighthouse | walls | arch). notice locked, maxLevel, resources. endgameRules.monuments.
- 강화: enhanceLimit(gear)(영웅·전설 10, 나머지 3), enhanceCostFor(gear)(정수·심연석 포함), smithRules.lateEnhance.chance. 옵션: 동작 { type: 'setOption', gearId, option }, smithRules.optionValor.
- 레이드: currentRaid(state, now).tier(1–3), endgameRules.raid.tiers([{ grow, spoils }]).
- 번영: prosperityRank(state), nextRankFame(state), rankOffering(rank), prosperityBonus(state), rewardBonus(state), 동작 { type: 'prosper' }(notice locked, promoteFame, promoteOffering, promoteMax).

1. 특수 던전 묶음에 계절 이벤트: 이번 계절 던전, 남은 횟수 n/6, 승리 보상 증표. 이벤트 상점(물건, 가격, 남은 수, [사기]).
2. 기념물 창(마을 운영 또는 회관): 넷의 현재 단계·효과(지금·다음), 다음 단계 비용(모자란 것 빨강)과 [세우기]. Lv9 미만이면 "마을 Lv9에 열림".
3. 대장간 강화: 영웅·전설 장비는 +10까지, +3 넘으면 성공률(late chance)과 정수·심연석 비용을 보인다. 창고 장비에 [옵션 바꾸기](희귀 이상, 용맹 훈장 8).
4. 레이드 창에 단계(1/2/3)와 단계별 전리품, 처치 후 "2단계가 열렸다".
5. 번영 창(마을 Lv10이면 승격 창 자리에): 현재 등급과 보너스, 다음 등급의 명성과 바칠 것, [번영].
6. 금고 표시에 이벤트 증표.
7. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev에서 디버그 세이브(마을 Lv10, 금고 넉넉히)로 이벤트 상점, 기념물 세 단계, +4 강화, 옵션 바꾸기, 레이드 2단계, 번영 1등급을 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

375px Chrome에서 이벤트 상품 구매, 기념물 1–3단계, 번영 1등급, 레이드 2단계 표시, 옵션 변경, +4 강화 주문과 창 가로 폭을 확인했다. +4 강화 완료는 디버그 상태를 시간 정산해 검증했다.

---

## 110. 4d core 코드 리뷰 (GPT)

**작업 109 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **1eeb27b**다.

**전달할 내용**

```
4d core 커밋 1eeb27b를 리뷰한다. 코드는 고치지 않고 Docs/reviews/1eeb27b.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/endgame.md 4d와 차이, 이벤트(계절 경계, 횟수 소모 시점, 증표, 상점 재고와 계절, 장비 지급 id 중복), 기념물(비용 차감, 단계 상한, 효과가 실제로 들어가는 경로: 원정·자동·훈련 경험치, 방문자 잠재력 두 곳, 상인 물건, 침공 세기·손실, 골드·명성), 강화 확장(한도, 비용, 성공률 표 인덱스, 정규화, 대기열), 옵션 재설정, 레이드 단계(단계별 세기·전리품, 같은 주, 처치 수), 번영(명성 계단, 공물, 상한, 보상 배율이 겹치는 곳), 세이브 25 → 26.
```

**메모**

레이드 이전 단계 귀환 피해, 구버전 처치 상태, 소수 강화 정규화, 기념물 경험치 기록 차이를 `Docs/reviews/1eeb27b.md`에 기록했다.

---

## 111. 4d 측정: Lv10 이후 한 달 (GPT)

**작업 110 뒤에 시작한다.**

**전달할 내용**

```
마을 Lv10 이후 한 달의 흐름을 측정한다. tools/endgame-4a.ts --4c 흐름에 이벤트 던전(계절마다 6번)과 상점, 기념물(자원이 되면 세우기), 강화 확장, 레이드 단계, 번영을 더한다. core는 고치지 않는다. 결과는 Docs/endgame.md 끝에 "4d 측정 (날짜)" 절로 적는다.

1. Lv10 도달 뒤 30일 동안: 기념물 단계, 번영 등급, 강화 단계(장비별 기대 비용과 실제 소모)의 진행.
2. 금고 자원 아홉 가지와 일반 재료의 수입·지출·잔액. 여전히 쌓이는 자원과 모자라는 자원.
3. "소원만 가능" 비율과 "100개 넘는 재료 3종" 비율이 작업 91·103보다 얼마나 줄었는지.
4. 레이드 단계별 처치 비율, 이벤트 상점에서 실제로 사는 물건.
5. 숫자를 바꿀 제안이 있으면 파일·키·값으로 적는다(고치지는 않는다).
```

**메모**

20시드의 Lv10 이후 30일을 측정했다. 기념물·번영 중앙값은 1, 영웅 장비 강화 중앙값은 +5, 레이드 3단계 처치율은 46.75%였다. 타입 검사·테스트 391개·빌드 통과.

---

## 112. 정예·강령술사·새 전투 효과 3D (Cursor)

**지금 시작할 수 있다. 작업 113(GPT)과 파일이 겹치지 않아 함께 돌릴 수 있다(같은 폴더에서 동시에 돌리려면 git worktree로 나눈다).** 설계: `Docs/identity.md` 5a.

**전달할 내용**

```
Docs/identity.md의 5a(특히 "몬스터"와 "구현 메모")를 읽고 전투 3D를 만든다. src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx만 고친다. core, App.tsx, src/ui/game/*, src/locales/*는 고치지 않는다.

이미 있는 것:
- 리플레이 유닛(ReplayUnit)에 elite?: true. 4티어 이상 던전의 일반 몬스터가 10%로 정예가 된다(체력 ×1.6, 특성 하나 더).
- 새 몬스터 necromancer(강령술사, 언데드, 뒷줄, 원거리, 동료를 회복). 가라앉은 지하묘지 2층.
- 몬스터 데이터에 kind(beast/undead/human/construct/dragon/spirit)와 traits(armor/evasive/nodot/fireproof/healer/thorns/purge).
- 새 전투 로그: log.miss(빗나감), log.crit(치명타, 바로 뒤에 log.attack), log.burn(화상 피해), log.thorns(가시 반사), log.counter(반격, 바로 뒤에 반격 log.attack), log.twin(한 번 더), log.enrage(보스 분노), log.purge(보스가 약화를 지움), log.revive(성직자가 쓰러진 동료를 일으킴), log.undying(체력 1로 버팀), log.guardian(파티 전원이 일어남). 몬스터가 동료를 회복하면 log.heal(actor가 몬스터).
- log.attack 등 피해 로그의 params.absorbed: 보호막이 막은 양.

1. 정예 몬스터: 조금 더 크게, 붉은 테두리나 빛 같은 눈에 띄는 표시(과하지 않게).
2. 강령술사 복셀 모델(지팡이, 두건, 녹색 빛).
3. 전투 효과:
   - 빗나감: 맞는 쪽이 옆으로 비키고 "빗나감" 대신 작은 휙 효과.
   - 치명타: 큰 숫자, 짧은 화면 흔들림.
   - 화상: 주황 불꽃 입자(중독의 초록과 구분).
   - 가시·반격: 맞은 쪽에서 때린 쪽으로 짧은 반격 모션.
   - 보호막: 막은 양이 있으면 영웅 둘레에 푸른 막이 번쩍.
   - 부활·불굴·수호천사: 빛 기둥(부활), 무릎 꿇었다 일어남(불굴), 파티 전체 금빛(수호천사).
   - 분노: 보스가 붉게 빛나며 커짐. 약화 해제: 보스 둘레에 흰 빛.
   - 몬스터 회복: 대상에게 초록 빛.
4. 성능: 효과는 기존 입자 풀을 재사용한다.

확인: npm run dev에서 디버그 세이브(Lv25 영웅, 지하묘지·도적 요새·용의 둥지)로 리플레이를 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

정예는 살짝 크게+발밑 붉은 빛, 강령술사는 두건·지팡이·녹색 빛. 리플레이에 miss/crit(큰 숫자·화면 흔들림)/burn/thorns·counter 반격/보호막 푸른 번쩍/부활 빛 기둥·불굴 기립·수호천사 금빛/분노 커짐·약화 해제 흰 빛/몬스터 회복 초록. 기존 burst 입자 재사용. tsc·test·build 통과. 디버그 세이브 리플레이는 눈으로 확인하지 못함.

---

## 113. 스킬 갈래·천부·몬스터 특성 화면 (GPT)

**지금 시작할 수 있다. 작업 112(Cursor)와 함께 돌릴 수 있다.** 설계: `Docs/identity.md` 5a.

**전달할 내용**

```
Docs/identity.md의 5a를 화면에 보인다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core, src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx는 고치지 않는다.

core에 이미 있는 것('../../core'에서 export):
- classById(id).skills: 10개. 첫 스킬은 기본기, 나머지는 branch(0–2)와 tier(1–3), effect, when?({ personality?, moraleAbove?, moraleBelow?, withClass?, bonded?, bonus }). classById(id).branches: [{ id(예: 'warrior.bulwark'), mastery }].
- canLearn(hero, id), canForget(hero, id), skillPrerequisite(classId, id), masteries(hero), suitedBranches(personality), heroSkillEffects(hero, { allies?, bonded? }), trainingRules.pickLevels([3, 7, 11, 15, 20, 25]).
- Hero.gift?: GiftId(undying, vanguard, twinStrike, farsight, ironBody, healingHands, dragonBlood, marksman, lucky, tactician, lateBloomer, heroBlood, guardian, songbird). giftEffect(gift).
- 몬스터: monsterById(id).kind, .traits(armor, evasive, nodot, fireproof, healer, thorns, purge). 3티어 이상 보스는 분노, 모든 보스는 기절·감속에 강하다.
- 리플레이 유닛 elite?: true.
- 새 효과 키(SkillEffect): hp, crit, critDamage, pierce, lifesteal, execute, bossDamage, counter, dodge, stun, slow, burn, shield, firstStrike, lastStand, revive, partySpeed, partyCrit, enemyMiss, holy, partyHoly, aoePower, weakenPower, burnPower, partyFirstStrike, fatigueCut, selfFatigueCut, healTaken, dotGuard, twinStrike, lucky, trapGuard, steadfast, alert, farsight, undying, vanguard, guardian.
- 새 전투 로그 키: log.miss, log.crit, log.burn, log.thorns, log.counter, log.twin, log.enrage, log.purge, log.revive, log.undying, log.guardian, 그리고 params.absorbed.

1. 스킬 화면을 갈래 셋으로 나눈다(좁은 화면에서는 세로로 쌓기). 갈래 이름, 1→2→3 단계, 잠김(앞 단계 필요)·배움·배울 수 있음, 숙련 효과(다 배우면 켜짐). 성격과 맞는 갈래에 "잘 맞음 +20%" 표시. 조건부 효과는 "조건: …"으로 보인다.
2. 남은 선택 안내: "Lv3·7·11·15·20·25에 하나씩, 아홉 중 여섯". 훈련소 다시 고르기는 canForget인 스킬에만 버튼.
3. 스킬 이름: 기존 스킬 이름은 그대로 두고, 새 스킬·갈래·숙련 이름을 ko/en에 더한다(Docs/identity.md 표의 이름을 쓴다). 새 효과 키마다 설명 문구.
4. 천부: 영웅 카드·상세·방문자 카드·아이에 금빛 표시와 이름, 눌러서 설명. 천부 14종 이름·설명 ko/en.
5. 던전 정보의 몬스터 목록에 종류와 특성 아이콘(툴팁으로 설명). 보스에는 "분노"·"제어에 강함". 원정 기록·리플레이 목록에서 정예 몬스터에 "정예" 표시.
6. 전투 로그 문구 ko/en(새 로그 키, 보호막이 막은 양).
7. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev에서 디버그 세이브(Lv25 영웅 직업별, 천부 있는 영웅, 방문자)로 스킬 갈래 배우기·숙련·다시 고르기, 천부 표시, 몬스터 특성, 전투 로그를 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

7직업의 배우기·숙련·잊기와 보호막 로그를 검증했다. Chrome 375px에서 전사의 스킬 조작, 천부 설명, 강령술사와 보스 특성 및 창 너비를 확인했다. 상태 기록과 함께 아이 목록의 천부 버튼 중첩과 둥지 특성 배치를 정리했다.

---

## 114. 5a core 코드 리뷰 (GPT)

**작업 113 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **318455b**다.

**전달할 내용**

```
5a core 커밋 318455b를 리뷰한다. 코드는 고치지 않고 Docs/reviews/318455b.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/identity.md 5a와 차이, 갈래 순서(배우기·잊기·세이브 정규화), 숙련, 성격 궁합 배율이 붙는 곳, 조건부 효과(언제 판정하는지, 파티 정보가 빠지는 경로: 자동 출정·침공·레이드·심연·훈련 등), 천부(방문자·아이·신동·세이브 27, 영웅의 핏줄이 두 번 붙는 경로가 없는지, 늦깎이 경험치), 전투(새 rng 굴림이 기존 전투를 바꾸는지, 회피·치명·방어구·관통 순서, 보호막과 불굴·부활·수호천사가 겹칠 때, 정예와 소환, 분노·약화 해제, 몬스터 기절 처리), 피로·골드 보정, 파티 효과 상한.
```

**메모**

수호천사 중복 부활과 저장의 레벨별 선택 상한 누락을 재현했다. 침공의 유대 조건, 장갑·관통, 골드·피로 조건과 행운아 재료 보상 차이도 리뷰에 기록했다.

---

## 115. 5a 측정: 갈래 조합·천부·몬스터 세기 (GPT)

**작업 114 뒤에 시작한다.**

**전달할 내용**

```
Docs/identity.md 5a의 "세기 조정"을 측정한다. core는 고치지 않는다. 결과는 Docs/identity.md 끝에 "5a 측정 (날짜)" 절로 적는다.

1. 직업마다 갈래 조합(한 갈래 몰기 ×3, 두 갈래 숙련, 고르게)을 Lv11·15·20·25에서 일반 던전(티어 3–7)과 특수 던전(시련·심연·레이드·침공)에 돌린다. 하위 25% 승률과 중앙값.
2. 같은 직업 안에서 가장 센 조합과 가장 약한 조합의 차이를 "레벨 몇 차이"로 바꿔 적는다(목표: 2 이하). 던전마다 1등 조합이 무엇인지.
3. 성격 궁합 +20%가 있을 때와 없을 때 차이.
4. 천부별 효과 크기(같은 영웅에 천부만 바꿔서).
5. 권장 레벨에서, 그 레벨의 스킬 수를 배운 파티의 하위 25% 승률(목표 약 80%). 티어별로 몬스터 체력·공격 배율을 얼마로 하면 맞는지(첫 추정 3–4티어 ×1.1, 5티어 ×1.2, 6–7티어 ×1.3).
6. 분노가 레이드(단계별 처치까지 걸리는 시도 수)와 심연 진행에 주는 영향. 정예가 4티어 이상 승률에 주는 영향.
7. 숫자를 바꿀 제안은 파일·키·값으로 적는다(고치지는 않는다).
```

**메모**

6개 파티와 전투 시드 3개를 조합별로 비교했다. 최대 환산 차이는 궁수 1.30레벨이었다. 승률·천부·정예·분노 및 스케일 후보를 `Docs/identity.md`에 기록했다. 타입 검사·테스트 413개·빌드 통과.

---

## 116. 무기·방어구 종류 3D (Cursor)

**지금 시작할 수 있다. 작업 117(GPT)과 파일이 겹치지 않아 함께 돌릴 수 있다(같은 폴더에서 동시에 돌리려면 git worktree로 나눈다).** 설계: `Docs/identity.md` 5b.

**전달할 내용**

```
Docs/identity.md의 5b를 읽고 영웅 복셀 모델에 무기·방어구 종류를 보인다. src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx만 고친다. core, App.tsx, src/ui/game/*, src/locales/*는 고치지 않는다.

이미 있는 것('../core' 또는 '../../core'에서 export):
- Gear.type?: WeaponType(sword, axe, shieldsword, dagger, bow, crossbow, staff, tome, scepter, lute, drum, fan) | ArmorType(plate, leather, robe). 없으면 그 직업의 기본 모습(지금 character.ts의 weapon)을 그대로 쓴다.
- Gear.options?: { id, value }[] (모습에는 쓰지 않아도 된다).

1. 무기 모델: 지금 없는 것을 더한다. 도끼, 방패검(한손검 + 작은 방패), 석궁, 마도서(손에 든 책), 홀, 북, 부채. 손에 맞게 크기를 맞춘다.
2. 방어구 모습: 판금(어깨 판·두꺼운 몸통, 금속색), 가죽(갈색 조끼), 로브(긴 옷자락). 종류 없는 방어구와 방어구 없음은 지금 모습 그대로.
3. 마을(VillageScene)과 전투(BattleScene)·원정 화면 모두에서 영웅이 낀 무기·방어구 종류가 보인다. 영웅의 gear를 찾는 길은 지금 gearAuraOf가 쓰는 길을 따른다.
4. 성능: 모델은 종류별로 한 번 만들고 재사용한다.

확인: npm run dev에서 디버그 세이브의 영웅에게 종류별 무기·방어구를 끼워(세이브를 고쳐도 된다) 마을과 리플레이에서 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

`gearStyleOf`로 착용 무기·방어구 type을 읽고 없으면 직업 기본. 무기 추가: 도끼·방패검(+왼손 방패)·석궁·마도서·홀·북. 방어구: 판금(어깨·두꺼운 몸통)·가죽 조끼·로브 자락. VillageScene·portrait·원정 LiveFight에 반영. BattleView는 선택 `gearByHero`(기록 화면은 아직 안 넘김 → 직업 기본). 종류 변경 시에만 모델 재생성. tsc·test·build 통과. 디버그 세이브로 마을·리플레이는 눈으로 확인하지 못함.

---

## 117. 무기·방어구 종류·옵션·다시 굴리기 화면 (GPT)

**지금 시작할 수 있다. 작업 116(Cursor)과 함께 돌릴 수 있다.** 설계: `Docs/identity.md` 5b.

**전달할 내용**

```
Docs/identity.md의 5b를 화면에 보인다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core, src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx는 고치지 않는다.

core에 이미 있는 것('../../core'에서 export):
- Gear.type?: GearType, Gear.options?: { id: GearOptionId, value }[]. 옵션 id: power, guard(고정 수치), hp, crit, speed, heal, blastGuard, dotGuard, bossDamage, holy, xp, lucky(비율, 0.05 = 5%).
- smithRules.weaponTypes([{ id, classes, effect }]), smithRules.armorTypes([{ id, effect }]), smithRules.optionCount, smithRules.optionPool, smithRules.optionValor(다시 굴리기 용맹 훈장 수).
- weaponTypes(classId?), armorTypes(), canWield(classId, gear), gearEffect(gear), optionRange(id, grade), splitOrder(order), recipeById(id).
- 행동: { type: 'craft', recipeId, gearType?, now }(대기열 항목은 'iron.mail@leather' 꼴, splitOrder로 읽는다), { type: 'reroll', gearId, index }. 예전 setOption은 없어졌다.
- 알림 'wrongClass'(문구는 이미 있다).
- 이미 넣어 둔 임시 처리: itemLabel이 옵션 이름을 괄호에 늘어놓고, 대장간 후반 강화 칸에 옵션마다 다시 굴리기 버튼이 있다. ko/en의 option.* 12개, result.wrongClass 문구가 있다. 이것들은 고쳐도 된다.

1. 대장간 제작: 무기·방어구 레시피를 누르면 종류를 고른다(무기는 직업별로 묶어 보인다. 예: "전사: 검·도끼·방패검"). 종류마다 효과 한 줄. "종류 없음(균형)"도 고를 수 있다. 대기열 목록은 splitOrder로 "철 도끼"처럼 보인다.
2. 장비 이름: 종류가 있으면 "등급 재료 + 종류 이름"(예: 철 도끼, 강철 판금, 화염 석궁). 종류 이름 ko/en(검, 도끼, 방패검, 단검, 활, 석궁, 지팡이, 마도서, 홀, 류트, 북, 부채, 판금, 가죽, 로브).
3. 옵션 보기: 장비 줄 아래에 옵션을 한 줄씩("치명 +3.2%", "공격 +3"). 고정 수치는 정수, 비율은 소수 한 자리 %. 범위의 최댓값에 가까우면 강조(optionRange).
4. 다시 굴리기: 창고 장비에서 옵션 하나를 골라 용맹 훈장으로 다시 굴린다. 결과를 바로 보인다. 끼고 있는 장비에는 "먼저 빼야 한다"는 안내.
5. 영웅 상세 무기 칸: 교체 목록에서 그 직업이 못 쓰는 무기는 흐리게 하고 "전사만"처럼 쓸 수 있는 직업을 보인다(누르지 못하게).
6. 영웅 상세·파티 준비에 장비 효과 합계 한 줄(예: "장비: 공격 +15%, 치명 +6%, 경험치 +5%").
7. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev(127.0.0.1)에서 디버그 세이브로 종류를 골라 제작·대기열, 옵션 보기, 다시 굴리기, 못 쓰는 무기 표시를 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

375px Chrome에서 철 도끼 제작, 철 가죽 대기열, 옵션 다시 굴리기, 전사의 활 장착 제한을 확인했다. 코어 정산에서 제작과 대기열의 선택 종류가 그대로 완성됐다.

---

## 118. 5b core 코드 리뷰 (GPT)

**작업 117 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **3ad100c**다.

**전달할 내용**

```
5b core 커밋 3ad100c를 리뷰한다. 코드는 고치지 않고 Docs/reviews/3ad100c.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/identity.md 5b와 차이, 옵션 굴림(등급별 개수, 겹침, 범위, 같은 시드), 예전 option 세이브 변환과 값 제한, 장비 효과가 붙는 곳(heroSkillEffects를 쓰는 모든 길: 전투·원정 정산·경험치·피로, 아이·은퇴자·유품), 무기 종류 제한(장착·유품·자동 장착이 있는지), 대장간 주문('@type')이 대기열·환불·자동 제작·예전 세이브에서 맞는지, 다시 굴리기(시드, 훈장, 끼고 있는 장비), 상인·행사 장비 시드, 세이브 28, 광역기 피해 감소 상한, 경험치 옵션이 훈련·축제 경험치에도 붙는 것이 맞는지.
```

**메모**

구버전 진행 중 장비 옵션 유실과 장착·옵션 정규화 누락을 재현했다. 광역기 저항과 여름 축제 경험치 적용 범위를 포함해 리뷰에 5건을 남겼다.

---

## 119. 5b 측정: 무기 종류·옵션 세기 (GPT)

**작업 118 뒤에 시작한다.**

**전달할 내용**

```
Docs/identity.md 5b의 숫자를 측정한다. core는 고치지 않는다. 결과는 Docs/identity.md 끝에 "5b 측정 (날짜)" 절로 적는다.

1. 직업마다 무기 종류별(같은 등급·옵션 없음) 승률을 Lv11·15·20·25 파티로 티어 3–7 던전과 시련·심연·레이드에 돌린다. 하위 25% 승률과 중앙값. 가장 센 종류와 균형 무기의 차이를 "레벨 몇 차이"로(목표: 1 이하).
2. 방어구 종류별 같은 측정.
3. 옵션: 같은 등급에서 옵션 최상(그 직업에 가장 좋은 조합·최댓값)과 최하의 차이를 레벨로(목표: 전설 3옵션 기준 2 이하).
4. 경험치·전리품 옵션이 한 달(4d 측정과 같은 조건) 동안 레벨·골드에 주는 차이.
5. 숫자를 바꿀 제안은 파일·키·값으로 적는다(고치지는 않는다).
```

**메모**

최대 레벨 차이는 무기 0.14, 방어구 0.57, 전설 3옵션 0.40이었다. Lv10 도달 3시드의 30일 비교에서 경험치 옵션은 평균 +6.13레벨이었다. 타입 검사·테스트 432개·빌드 통과.

---

## 120. 고유 장비·드롭 3D (Cursor)

**지금 시작할 수 있다. 작업 121(GPT)과 파일이 겹치지 않아 함께 돌릴 수 있다(같은 폴더에서 동시에 돌리려면 git worktree로 나눈다).** 설계: `Docs/identity.md` 5c.

**전달할 내용**

```
Docs/identity.md의 5c를 읽고 고유 장비를 복셀로 보인다. src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx만 고친다. core, App.tsx, src/ui/game/*, src/locales/*는 고치지 않는다.

이미 있는 것('../core'에서 export):
- Gear.unique?: string(고유 장비 id 12개, src/data/loot.json). 고유 무기·방어구는 종류(type)가 없다. lootRules.uniques[].set: dragonslayer, gravekeeper, windwalker, choir.
- GameState.loot: { gearId, source, at }[] (최근 얻은 장비).

1. 고유 무기 4개(무덤지기 칼날, 두목의 쌍날, 용잡이, 망자의 홀)와 방어구 4개(이끼 망토, 성채의 성의, 용비늘 갑옷, 리치의 수의)에 모습을 준다. 기본 모습에 색과 장식(용비늘, 해골, 이끼, 금테 등)을 더하는 정도면 된다.
2. 세트 3개를 낀 영웅에게 세트 색의 은은한 빛(용사냥꾼 붉은빛, 묘지기 녹빛, 바람걸음 하늘빛, 성가대 금빛).
3. 원정에서 돌아온 결과(ExpeditionPanel)에서 이번에 얻은 장비가 있으면 상자가 열리는 짧은 연출. 이번 원정의 장비는 loot 중 at이 그 원정 정산 시각인 것으로 찾는다.
4. 성능: 모델은 한 번 만들어 재사용.

확인: npm run dev(127.0.0.1)에서 세이브를 고쳐 고유 장비·세트를 끼우고 마을·리플레이에서 본다. 드롭 연출은 첫 클리어로 본다. tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

고유 무기 4(무덤지기 칼날·쌍날·용잡이·망자의 홀)·방어구 4(이끼 망토·성채 성의·용비늘·리치 수의) 장식. 세트 3개면 용사냥꾼 붉/묘지기 녹/바람걸음 하늘/성가대 금 빛. 원정 `back`+승리 시 상자 열림(loot source·시각 매칭, 없으면 드롭 가능 던전 예상). 마을·초상은 gearStyleOf로 자동 반영. tsc·test·build 통과. 디버그 세이브로 마을·드롭은 눈으로 확인하지 못함.

---

## 121. 드롭·고유 장비·세트·교환 화면 (GPT)

**지금 시작할 수 있다. 작업 120(Cursor)과 함께 돌릴 수 있다.** 설계: `Docs/identity.md` 5c.

**전달할 내용**

```
Docs/identity.md의 5c를 화면에 보인다. src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. core, src/ui/voxel/*, src/ui/BattleView.tsx, src/ui/ExpeditionPanel.tsx는 고치지 않는다.

core에 이미 있는 것('../../core'에서 export):
- Gear.unique?: string. lootRules(src/data/loot.json): dropChance, autoDropScale, grades(티어별 등급 확률), uniqueChance, raidUniqueChance, uniques[{ id, dungeon? | raid?, slot, base?, grade, set, effect, cost, value }], sets[{ id, two, three }].
- uniqueById(id), uniqueGear(def, id), canExchange(def, cleared), exchangeCost(def), setBonuses(gear) (from core/loot, core/gear), gearEffect(gear).
- GameState.loot: { gearId, source(던전 id 또는 'raid.<보스 id>'), at }[] 최근 20개.
- 행동: { type: 'exchange', uniqueId }(알림 locked·resources·missing), { type: 'seenLoot' }(loot 비우기).
- 이미 넣은 것: ko/en의 unique.*(12개 이름), gearSet.*(4개 이름). itemLabel이 고유 장비 이름을 쓴다.

1. 새 장비 알림: loot가 있으면 마을 화면에 "새 장비 n개" 배지. 누르면 목록(이름·등급·얻은 곳)과 "확인"(seenLoot). 원정 결과 화면에도 그 원정에서 얻은 장비 줄.
2. 고유 장비 표시: 이름을 금빛·보라빛 등 등급색과 다른 "고유" 색으로. 효과 한 줄, 세트 이름과 세트 효과(2개·3개, 지금 낀 개수에 따라 켜짐/꺼짐). 다시 굴리기 버튼은 없다.
3. 던전 정보: "첫 클리어 보상: 장비 1개(등급 범위)", "보스 고유 장비: 이름(4%)". 레이드 화면에 보스별 고유 장비 둘과 단계별 확률.
4. 교환: 대장간(또는 용맹 훈장을 쓰는 곳)에 "고유 장비 교환" 칸. 12개 목록, 비용, 잠김 이유("○○ 클리어 필요"), 가진 개수.
5. 영웅 상세 장비 효과 합계에 세트 효과를 포함하고, 세트 진행("용사냥꾼 2/3")을 보인다.
6. 문구 ko/en 같은 키. 좁은 화면(375px)에서 넘치지 않게.

확인: npm run dev(127.0.0.1)에서 첫 클리어 드롭, 교환, 세트 2·3개 효과를 본다(세이브를 고쳐도 된다). tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

375px Chrome에서 첫 클리어 지급 장비, 교환, 세트 2·3개 효과를 확인했다. 타입 검사·테스트 451개·빌드를 통과했다.
원정 식별이 모호한 동시 정산의 드롭은 마을 알림에서 확인할 수 있다. 원정 결과에는 해당 원정에 배정할 수 있는 장비를 기록한다.

---

## 122. 5c core 코드 리뷰 (GPT)

**작업 121 뒤에 시작한다(같은 도구라 순서대로).** core 커밋은 **2c287d8**이다.

**전달할 내용**

```
5c core 커밋 2c287d8을 리뷰한다. 코드는 고치지 않고 Docs/reviews/2c287d8.md 새 파일 하나에만 쓴다(Docs/reviews/README.md 형식).
볼 것: Docs/identity.md 5c와 차이, 드롭이 붙는 길(손 출정·자동 출정·침공·특수 던전·레이드, 첫 클리어 판정 순서), 시드(craftNonce를 드롭·제작·다시 굴리기·교환이 같이 쓰는 것, 같은 상태에서 같은 결과), 행운 배율, 등급 표와 레시피 고르기(희귀 방어구 없음), 고유 장비(바탕 레시피 수치·강화·판매가·정규화·장신구 고유 장비와 trinketOf), 세트(같은 고유 둘, 장신구 두 칸), 교환(비용·잠김·훈장 부족), loot 목록(20개, 세이브 29, seenLoot), 레이드 고유 장비 확률과 단계.
```

**메모**

원정 드롭 식별, 고유 장비 정규화, 고유 장신구 효과 중복, 정예 드롭률 연결에 관한 리뷰 4건을 남겼다.
첫 클리어 장비 판매와 세이브 정규화, 같은 고유 장신구 두 개 장착을 재현했다.

---

## 123. 5c 측정: 드롭 속도·고유 장비·세트 세기 (GPT)

**작업 122 뒤에 시작한다.**

**전달할 내용**

```
Docs/identity.md 5c의 숫자를 측정한다. core는 고치지 않는다. 결과는 Docs/identity.md 끝에 "5c 측정 (날짜)" 절로 적는다.

1. 4d 측정과 같은 조건으로 Lv10 이후 30일: 얻은 장비 수(등급별), 고유 장비 수, 교환으로 산 수, 대장간 제작과 비교.
2. 고유 장비 하나가 주는 세기(같은 등급 일반 장비 옵션 평균과 비교, 레벨 차이로).
3. 세트 2개·3개 효과의 세기(레벨 차이). 목표: 3세트가 전설 3옵션 최상 조합보다 1레벨 이상 세지 않게.
4. 레이드 고유 장비를 모으는 데 걸리는 주 수(단계별 처치 가정).
5. 숫자를 바꿀 제안은 파일·키·값으로 적는다(고치지는 않는다).
```

**메모**

Lv10 도달 4시드의 30일 평균은 던전 장비 387.5개, 교환 5.75개였다. 네 세트 모두 전설 최상 3옵션 대비 우위가 1레벨 미만이었다.
레이드 고유 6종 수집 중앙값은 단계별 51·19·10주였다. 측정 재현 명령과 수치 제안을 `Docs/identity.md`에 기록했다.

---

## 124. 5d 밸런스 측정 (GPT)

**지금 시작할 수 있다.** 설계: `Docs/identity.md` 5d와 5a·5b·5c의 측정 절. 지금까지의 측정 도구(`tools/gear-5b*.ts`, `tools/loot-5c*.ts`, 5a 측정 도구)를 다시 써도 된다.

**전달할 내용**

```
Docs/identity.md 5d를 측정한다. core와 src/data는 고치지 않는다. 결과는 Docs/identity.md 끝에 "5d 측정 (날짜)" 절로 적는다. 명령·시드·조건을 함께 적어 다시 돌릴 수 있게 한다.

지금 게임 전체(5a 스킬 갈래·천부, 5b 무기·방어구 종류·옵션, 5c 드롭·고유 장비·세트)를 켠 상태로 잰다.

1. 직업 × 갈래 조합(숙련 0·1·2)별 승률: Lv11·15·20·25, 일반 던전 티어 3–7과 시련·심연·레이드·침공. 하위 25%·중앙값. 한 조합이 같은 직업의 다른 조합보다 레벨 +2 이상 세면 표시.
2. 직업끼리: 같은 레벨·같은 장비 수준에서 직업 하나를 바꾼 파티의 승률 차이(레벨로). 가장 센 직업과 가장 약한 직업.
3. 천부 14종 효과 크기(천부 없는 같은 영웅과 비교, 레벨로).
4. 장비 기대 성능: 등급별로 일반 드롭(옵션 평균)·옵션 최상·최하·고유 장비·세트 3개를 레벨 차이로 한 표.
5. 권장 레벨에서 "그 레벨에 맞게 스킬과 드롭 장비를 갖춘 파티"의 하위 25% 승률(목표 약 80%), 던전별.
6. 4d와 같은 조건으로 Lv10 이후 30일: 레벨 증가, 골드, 얻은 장비(등급별), 고유 장비 수. 경험치 옵션 유무 비교(5b에서 30일 +6레벨이 나왔다).
7. 정예 몬스터가 4티어 이상 승률에 주는 영향, 그리고 정예 처치에 드롭 보너스를 준다면 얼마가 알맞은지(지금은 없다).
8. 숫자를 바꿀 제안을 파일·키·지금 값·제안 값·이유로 표 하나에 모은다. 목표: 갈래 조합 차이 2레벨 이하, 직업 차이 2레벨 이하, 천부 하나 1.5레벨 이하, 권장 레벨 하위 25% 승률 75–85%.

확인: tsc·test·build 통과. 측정 시간이 길면 표본 크기를 적는다. 확인한 내용을 메모에.
```

**메모**

갈래 배분과 천부·장비·권장 레벨·정예·월간 성장 비교를 재현할 도구와 조건을 기록했다. 성직자 갈래 격차 2.160레벨, 직업 교체 격차 3.000레벨이었다.
권장 레벨의 드롭 장비 파티에서 일반 던전 P25가 모두 100%였다. 관측된 목표 후보와 방문자 가드 결과를 함께 기록했다.

---

## 125. 5d 수치 조정 (GPT)

**작업 124 뒤에 시작한다.**

**전달할 내용**

```
작업 124의 "5d 측정"의 제안 표를 src/data/*.json에 반영한다. 데이터 숫자만 바꾸고 src/core/*.ts의 코드는 고치지 않는다(코드를 바꿔야 하는 제안은 적용하지 말고 Docs/identity.md에 "코드 필요"로 남긴다).

1. 제안 하나씩 바꾸고, 바꾼 뒤 124의 해당 측정을 다시 돌려 목표에 들어오는지 확인한다. 목표를 넘으면 값을 되돌리거나 줄인다.
2. 깨지는 테스트가 있으면 이유를 확인한다. 밸런스 가드 테스트(src/core/prototype.test.ts 등)는 기준을 낮추지 말고 숫자를 맞춘다. 다른 테스트는 바뀐 숫자에 맞춰 기대값만 고친다.
3. Docs/identity.md 끝에 "5d 조정 (날짜)" 절: 바꾼 파일·키·이전 값·새 값·다시 잰 결과. 적용하지 않은 제안과 이유.
4. 세이브 형식은 바꾸지 않는다.

확인: tsc·test·build 통과. npm run dev(127.0.0.1:5175, 사용자의 localhost:5174 세이브는 건드리지 않는다)에서 원정 한 번과 대장간 화면이 오류 없이 뜨는지. 확인한 내용을 메모에.
```

**메모**

성직자 갈래 격차는 1.876레벨, 같은 Lv10 시작 저장에서 XP 옵션의 30일 이득은 평균 +3.20레벨로 줄었다. 정예 드롭은 코드 필요로 기록했다.
타입 검사·테스트 455개·빌드 통과. 5175 사용 중으로 격리한 5176 Chrome에서 대장간과 동굴 원정 승리를 확인했다.

---

## 126. 직업 사이 차이 줄이기 (GPT)

**지금 시작할 수 있다.** 배경: `Docs/identity.md`의 "5d 측정"과 "5d 조정". 직업 교체 차이가 2.786레벨(도적 10.714, 성직자 13.500)로 목표 2레벨을 넘는다.

**전달할 내용**

```
직업 사이의 차이를 2레벨 이하로 줄인다. 데이터 숫자만 바꾼다(src/data/*.json). src/core/*.ts의 코드는 고치지 않는다. 세이브 형식은 바꾸지 않는다.

1. 5d 측정의 직업 교체 측정을 다시 돌려 지금 값을 확인한다(명령·시드·표본을 적는다).
2. 가장 느린 직업(성직자 등)을 조금 올리고, 필요하면 가장 빠른 직업(도적 등)을 조금 내린다. 한 번에 한두 값만 바꾸고 다시 잰다. 후보 예: classes.json의 기본 수치(hpBase, attackScale, healScale 등)나 갈래 스킬 효과값.
3. 다른 목표를 깨지 않는지 함께 본다: 같은 직업 안 갈래 조합 차이 2레벨 이하, 권장 레벨 하위 25% 승률 75–85%, 밸런스 가드 테스트(src/core/prototype.test.ts 등)는 기준을 낮추지 않고 통과.
4. 2레벨 이하로 못 맞추면 가장 가까운 값에서 멈추고 이유를 적는다.
5. Docs/identity.md 끝에 "직업 차이 조정 (날짜)" 절: 바꾼 파일·키·이전 값·새 값·다시 잰 결과.

확인: tsc·test·build 통과. 테스트는 바뀐 숫자에 맞춰 기대값만 고친다. 사용자의 localhost:5174 세이브는 건드리지 않는다. 확인한 내용을 메모에.
```

**메모**

성직자 공격·치유 계수를 조정해 직업 격차를 2.786 → 2.000레벨로 줄였다. 직업 내 갈래 최대 격차는 1.667레벨이다.
일반 던전 권장 레벨 P25는 조정 전후 100%였고 기존 밸런스 가드를 통과했다.

---

## 127. 정예 처치 드롭 보너스 (GPT)

**지금 시작할 수 있다. 126과 함께 돌려도 된다(파일이 겹치지 않는다. 같은 폴더에서 동시에 돌리려면 git worktree로 나눈다).** 배경: `Docs/identity.md` 5a "정예 몬스터"(5c에서 정예는 장비를 조금 더 잘 떨어뜨린다), 5c 리뷰에서 미룬 항목. 5d 측정 7번에 알맞은 배율 제안이 있으면 그 값을 쓴다.

**전달할 내용**

```
정예 몬스터를 쓰러뜨린 원정이 장비를 조금 더 잘 떨어뜨리게 한다. 고칠 파일: src/core/dungeon.ts, src/core/loot.ts, src/core/game.ts, src/core/types.ts, src/data/loot.json, src/core/loot.test.ts, Docs/identity.md. UI·3D 파일은 고치지 않는다.

1. 원정 보고서(DungeonReport)에 쓰러뜨린 정예 수를 남긴다(예: elites?: number, 0이면 생략). 정예는 combat의 BattleUnit.elite로 알 수 있다.
2. src/data/loot.json에 정예 하나당 드롭 확률 배율(예: eliteDropBonus)과 상한을 더한다. 일반 장비 드롭에만 붙이고, 첫 클리어 확정·고유 장비 확률·자동 출정 배율 규칙은 지금처럼 둔다(값은 5d 측정 7번 제안을 따르고, 없으면 정예 하나당 +20%, 상한 +60%).
3. grantVictoryRewards → dungeonLoot에 정예 수를 넘겨 반복 승리 확률에 곱한다.
4. 예전 보고서(elites 없음)는 0으로 읽는다. 세이브 버전은 올리지 않는다(선택 필드).
5. 테스트: 정예 수에 따라 확률이 오르고 상한에서 멈추는지, 정예가 없으면 지금과 같은지, 같은 시드는 같은 결과인지. 기존 테스트는 그대로 통과해야 한다.
6. Docs/identity.md 5c "던전 드롭"에 규칙 한 줄, 5c 리뷰 반영 절의 "정예 드롭 보너스는 넣지 않는다"를 고친다.

확인: tsc·test·build 통과. 사용자의 localhost:5174 세이브는 건드리지 않는다. 확인한 내용을 메모에.
```

**메모**

정예를 처치한 수동 반복 승리의 일반 장비 기본 확률을 10% → 12%로 올렸다. 상한, 고유 장비 시드, 자동·첫 클리어, 귀환 정산과 예전 보고서를 테스트했다.
타입 검사·테스트 458개·프로덕션 빌드를 통과했다.

---

## 128. 5단계 뒤 초반 흐름 점검 (GPT)

**지금 시작할 수 있다.** 배경: 5단계(스킬 갈래·천부·무기 종류·옵션·드롭·고유 장비·성직자 수치 조정·정예 보너스)가 들어간 뒤, 새로 시작한 사람의 처음 몇 시간이 예전처럼 매끄러운지 다시 본다. 예전 기준은 GDD 13.1 "초반 흐름"·"초반 피로 완화"와 `Docs/fatigue.md`, 도구는 `tools/first-hour.ts`.

**전달할 내용**

```
새 게임의 처음 3시간(필요하면 첫날 전체)을 다시 점검한다. 세이브 형식과 src/core/*.ts의 코드는 고치지 않는다.

1. tools/first-hour.ts를 지금 게임에 맞게 고쳐 돌린다(첫 클리어 드롭, 스킬 선택 Lv3·7, 천부가 있는 방문자 포함). 시드 여러 개(5개 이상). 시간대별로: 마을 레벨, 영웅 수·레벨, 클리어한 던전, 패배 수와 이유, 골드·재료, 얻은 장비(등급별), 피로·부상으로 쉬는 시간.
2. 예전 결과(Docs/balance.md나 tools 출력에 남은 것)와 비교해 달라진 점을 적는다. 특히: 첫 클리어 드롭 때문에 티어 1–3이 너무 쉬워졌는지, 반대로 어딘가에서 막히는지(같은 던전 3번 이상 연속 패배), 골드가 남거나 모자라는 구간, 대장간이 쓸모없어지는지.
3. 문제가 있으면 데이터 숫자만으로 고칠 수 있는 것은 src/data/*.json을 고치고 다시 돌린다(밸런스 가드 테스트 기준은 낮추지 않는다). 코드가 필요한 것은 고치지 말고 "코드 필요"로 적는다.
4. 화면 점검: npm run dev(127.0.0.1:5175, 사용자의 localhost:5174 세이브는 건드리지 않는다)에서 새 게임을 시작해 처음 30분을 직접 해 본다. 375px 폭에서 5단계에 들어온 화면(스킬 갈래, 천부, 장비 칸·교체, 종류 고르기, 옵션, 새 장비 알림, 교환)이 넘치거나 겹치는지, 처음 하는 사람이 헷갈릴 문구가 있는지. 고칠 것은 src/ui/styles.css·src/locales/*에서 고친다(App.tsx·src/ui/game/*.tsx는 작게만).
5. 결과는 Docs/balance.md 끝에 "5단계 뒤 초반 흐름 (날짜)" 절로: 명령·시드, 시간대별 표, 예전과 차이, 고친 것(파일·키·이전 값·새 값), 코드가 필요한 제안.

확인: tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

10시드 × 3시간 짝 비교에서 같은 던전 3연패는 없었다. 드롭 장착 시 가라앉은 묘지 첫 클리어는 12.75분 빨랐다. 대장간 제작 시간 후보를 재측정했고 수치는 유지했다.
5175의 격리된 Chrome에서 게임 시간 30분과 375px 장비 화면을 점검했다. 창고·알림 문구를 개선했고 타입 검사·테스트 458개·빌드를 통과했다.

---

## 129–133 배경 (2026-11-27)

사용자가 직접 플레이해 보고 요청한 여덟 가지를 다섯 작업으로 나눴다. GPT 작업 129–132는 같은 파일(game.ts, locales, 화면)을 건드리므로 순서대로 한다. Cursor 작업 133은 `src/ui/voxel/*`만 고쳐서 129와 동시에 할 수 있다. 모든 작업에서 사용자의 localhost:5174 세이브는 건드리지 않고 127.0.0.1:5175(포트가 쓰이고 있으면 5176)에서 확인한다. tsconfig.tsbuildinfo는 빌드 캐시라 무시하고 커밋하지 않는다.

---

## 129. 레벨·경험치 표시, 창고 화면, 재접속 자동 출정 보고 (GPT)

**지금 시작할 수 있다.**

**전달할 내용**

```
사용자 요청 넷을 화면에 넣는다. 화면 파일(src/ui/App.tsx, src/ui/game/*.tsx, src/ui/styles.css, src/locales/*)을 고친다. 4번에 필요한 만큼만 src/core/game.ts의 AbsenceReport를 넓히고 테스트를 더한다. 세이브 형식은 바꾸지 않는다(AbsenceReport는 저장되지 않는 보고라면 그대로, 저장된다면 선택 필드로).

1. 영웅 레벨·경험치: 영웅 카드와 상세에 "Lv n"과 다음 레벨까지 경험치 막대(지금 xp / 필요 xp, 필요 xp는 level × progression.xpPerLevel). 상세에는 숫자도.
2. 전투 대기(파티 준비) 화면: 편성 칸과 영웅 고르기 목록에 레벨이 보이게. 파티 평균 레벨과 던전 권장 레벨을 나란히.
3. 창고 화면: 지금은 영웅 상세·대장간·시장에 흩어져 있다. 창고 전용 화면(마을 운영이나 대장간에서 들어가는 탭 하나)을 만든다. 부위(무기·방어구·장신구)·등급·고유 거르기, 정렬(등급·공격·방어·얻은 순), 장비 줄에 효과·옵션, 누가 끼면 좋은지(쓸 수 있는 직업), 팔기(시장 가격, 시장이 없으면 안내), 끼우기(영웅 고르기 → equip). 375px에서 넘치지 않게.
4. 재접속 보고: 오래 비웠다 돌아오면 나오는 보고(absence)에 자동 출정 정보를 더 보인다. 지금은 autoRuns·autoGold뿐이다. 던전별 횟수·승패, 얻은 재료·경험치, 얻은 장비(loot 중 비운 동안 들어온 것), 다쳐서 빠진 영웅. core에 필요한 집계가 없으면 AbsenceReport에 선택 필드를 더하고 autoRun에서 채운다(테스트 한두 개).

확인: tsc·test·build 통과. 127.0.0.1에서 각 화면을 본다. 확인한 내용을 메모에.
```

**메모**

5175의 375px Chrome에서 영웅 경험치, 준비·편성 레벨, 창고 필터·정렬·장착·판매, 재접속 보고를 확인했다. 창고의 최신순은 기존 저장의 입고 순서를 쓴다.
자동 출정 전적·파티 경험치·재료와 부상으로 제외된 영웅, 비운 동안 새로 얻은 장비를 기록했다. 타입 검사·테스트 459개·빌드를 통과했다.

---

## 130. 파티 자동 편성 (GPT)

**작업 129 뒤에 시작한다.**

**전달할 내용**

```
파티 준비 화면에 "자동 편성" 버튼을 넣는다. 이름이 겹치니 주의: 지금 있는 'autoParty' 행동은 자동 출정 파티를 프리셋에서 복사하는 다른 기능이다. 새 행동은 { type: 'autoFill', presetId } 같은 다른 이름을 쓴다.

1. core에 순수 함수 하나(예: src/core/formation.ts의 autoFormation(state, presetId, dungeonId?)): 갈 수 있는 영웅(원정 중·사망·중상·아이 제외)에서 파티 5명을 고른다. 기본형 탱커1·딜러2·서포트1·힐러1(classById(id).role)을 먼저 채우고, 없으면 레벨 높은 순으로 채운다. 같은 역할 안에서는 레벨, 그다음 피로 낮은 순. 줄은 탱커·근접은 앞, 원거리·힐러·서포트는 뒤(지금 편성 규칙을 따른다). 던전이 주어지면 그 던전 권장 레벨 이상을 우선.
2. 행동 'autoFill': 그 프리셋의 slots를 결과로 바꾼다. 다른 프리셋에 든 영웅을 빼앗지 않는 선택지가 필요하면 옵션으로.
3. 테스트: 역할 채우기, 갈 수 없는 영웅 제외, 같은 상태 같은 결과, 영웅이 5명보다 적을 때.
4. 파티 준비 화면에 버튼 하나와 문구 ko/en.

확인: tsc·test·build 통과. 127.0.0.1에서 버튼을 눌러 본다. 확인한 내용을 메모에.
```

**메모**

역할·레벨·피로로 후보를 고르고 대열 한도에 맞춰 선택한 프리셋을 갱신한다. 테스트에서 제외 조건, 인원 부족, 결정성, 다른 프리셋과 진행 중 원정을 확인했다.
5175의 375px Chrome에서 자동 편성 버튼으로 전열 2명과 후열 3명이 채워짐을 확인했다. 타입 검사·테스트 463개·빌드를 통과했다.

---

## 131. 여관 유료 갱신 (GPT)

**작업 130 뒤에 시작한다.**

**전달할 내용**

```
여관 화면에 "새 손님 부르기"(골드를 내고 방문자를 바로 새로 뽑기)를 넣는다. 지금 'refreshVisitors' 행동은 디버그용 공짜 갱신이라 그대로 두고, 새 행동(예: { type: 'innRefresh' })을 만든다.

1. 비용은 src/data/village.json의 inn 아래에 둔다(예: refreshCost: { base: 30, perTownLevel: 15 }). 마을 레벨이 오를수록 비싸진다. 골드가 모자라면 'poor'.
2. 방문자 뽑기는 refreshVisitors와 같은 방식(visitorNonce를 올리고 generateVisitors). 면담한 방문자도 사라진다는 것을 화면에 한 줄로 알린다.
3. 테스트: 골드 차감, 방문자 바뀜, 골드 부족, 같은 상태 같은 결과.
4. 여관 화면에 버튼(비용 표시)과 문구 ko/en.

확인: tsc·test·build 통과. 127.0.0.1에서 눌러 본다. 확인한 내용을 메모에.
```

**메모**

비용은 30 + 마을 레벨 × 15골드다. 면담한 손님을 포함해 전원을 교체하며, 이미 사용한 무료 면담 횟수는 유지한다.
5175의 한국어 375px Chrome에서 마을 Lv1 비용 45골드, 손님 5명 교체, 잔액 부족 시 버튼 비활성화를 확인했다. 타입 검사·테스트 466개·빌드 통과.

---

## 132. 결혼하면 2인실 배정(신혼방 없애기) (GPT)

**작업 131 뒤에 시작한다.** 지금 규칙: `Docs/house.md`. 부부 집 수가 집 Lv × 2(`family.json`의 couplesPerHouseLevel)로 따로 제한되고, 화면에 "빈 신혼방"이 보인다.

**전달할 내용**

```
신혼방을 따로 두지 않는다. 결혼하면 부부가 2인실 하나를 같이 쓰고, 아이는 그 방에서 함께 살다가 성인이 되면 일반 방으로 나간다. 집의 전체 침대 수(bedsPerLevel) 제한은 그대로다.

1. core: family.ts의 housingFree(부부 집 수 제한)를 없애거나, 결혼 가능 조건을 "침대가 남는지"로 바꾼다(부부는 이미 각자 침대를 쓰고 있으므로 결혼 자체는 침대를 더 쓰지 않는다. 아이가 태어날 때 침대가 하나 더 필요하다면 그 조건은 지금 규칙을 따른다). couplesPerHouseLevel을 쓰는 곳을 모두 찾아 정리한다(family.json 값은 지워도 되고 남겨도 되지만 쓰지 않게).
2. rooms.ts의 방 묶음: 부부 방(부부 + 미성년 아이)을 2인실 하나(아이가 있으면 침대 수만큼)로 보이고, emptyCoupleHomes·"빈 신혼방" 표시를 없앤다. 성인이 된 아이는 일반 2인실로.
3. 예전 세이브에 영향이 없게(세이브 형식 그대로). 결혼·출산 테스트가 바뀐 규칙으로 통과하게 기대값을 고치고, 새 규칙 테스트를 더한다(부부 집 제한 없이 결혼, 침대가 모자라면 막히는 경우가 있다면 그 경우).
4. 집 화면과 청혼 안내 문구 ko/en을 새 규칙에 맞게. Docs/house.md를 고친다.

확인: tsc·test·build 통과. 127.0.0.1에서 결혼·출산이 있는 세이브로 집 화면을 본다. 확인한 내용을 메모에.
```

**메모**

부부 전용 정원을 없애고 기존 침대를 부부 2인실로 묶는다. 미성년 자녀는 함께 지내며 성인이 되면 일반 2인실로 옮긴다. 임신에 필요한 빈 침대는 계속 확인한다.
5175의 375px Chrome에서 침대 5/5 상태의 청혼 승낙과 출산 뒤 집 화면을 확인했다. 타입 검사·테스트 468개·빌드를 통과했다.

---

## 133. 마을 건물 위치 조정 (Cursor)

**지금 시작할 수 있다. 129와 함께 돌릴 수 있다(파일이 겹치지 않는다).**

**전달할 내용**

```
마을 3D에서 건물 배치를 다듬는다. src/ui/voxel/*만 고친다. core, 화면 파일, locales는 고치지 않는다.

1. 명예의 전당이 마을 밖(잔디 가장자리 너머)으로 삐져나간다. 마을 땅 안으로 들인다.
2. 텃밭(장식 텃밭)을 없앤다.
3. 여관을 마을 안쪽으로 조금 옮기고, 비게 된 자리와 길·가로등·나무 같은 장식을 다시 맞춘다.
4. 건물이 서로 겹치거나 길을 막지 않는지, 건설 전 빈 터·공사 중 모습도 같은 자리에서 맞는지, 클릭(건물 고르기) 영역이 따라 옮겨졌는지 본다.
5. 폰(375px 세로)과 PC 화면에서 처음 카메라에 모든 건물이 들어오는지.

확인: npm run dev(127.0.0.1:5175, 사용자의 localhost:5174 세이브는 건드리지 않는다)에서 건물이 많이 지어진 세이브로 본다. tsc·test·build 통과. 확인한 내용을 메모에(전·후 스크린샷이 있으면 좋다).
```

**메모**

명예의 전당을 사원·여관 사이 잔디(`3.2, -10.2`)로 들여 평지 가장자리(|x|,|z|≤12.5) 안에 두었다. 텃밭 장식을 제거하고 여관을 `(7.4, -7.6)`으로 안쪽 이동, `INN_YARD`·우물·피크닉·SE 가로등을 맞췄다. 빈 터·공사·클릭은 `LOTS`를 따르며 `layout.test.ts`로 겹침·평지 안을 검사한다. 타입 검사·테스트 472개·빌드 통과.

---

## 134. 명예의 전당이 여관 뒤에 가려지는 배치 고치기 (Cursor)

**지금 시작할 수 있다. 135와 함께 돌릴 수 있다.** 배경: 작업 133 뒤 Claude Code가 127.0.0.1에서 확인했다(2026-11-27). 명예의 전당은 마을 땅 안으로 들어왔지만, 건물을 다 지으면 여관 바로 뒤에 붙어 대부분 가려진다. 오른쪽에 여관·선술집·시장이 몰려 있어 답답하다.

**전달할 내용**

```
마을 3D 배치를 다시 다듬는다. src/ui/voxel/*만 고친다. core, 화면 파일, locales는 고치지 않는다. 사용자의 localhost:5174 세이브는 건드리지 않고 127.0.0.1:5175(쓰이고 있으면 5176)에서 확인한다. tsconfig.tsbuildinfo는 커밋하지 않는다.

1. 모든 건물을 Lv3 이상으로 지은 세이브에서, 기본 카메라로 명예의 전당이 다른 건물에 가려지지 않고 이름표와 함께 잘 보이게 한다. 왼쪽·위쪽에 남는 땅(학교·훈련소 쪽, 분수 주변)을 쓰는 것도 좋다.
2. 여관·선술집·시장이 오른쪽에 몰리지 않게 간격을 고르게. 건물끼리 겹치지 않고 길을 막지 않게.
3. 빈 터·공사 중 모습, 클릭(건물 고르기) 영역, 이름표가 새 자리를 따라가는지.
4. 폰(375px 세로)과 PC에서 처음 카메라에 모든 건물이 들어오는지.

확인: tsc·test·build 통과. 전·후 스크린샷을 메모에.
```

**메모**

명예의 전당을 광장 서쪽(`-3.0, 3.0`, 훈련소·분수 사이)으로 옮겨 SE 카메라에서 여관과 화면 열이 갈라지게 했다. 여관·선술집·시장 간격을 벌리고, 세로 화면 frustum을 넓혀 375px에서도 이름표가 보이게 했다. 127.0.0.1:5175에서 PC·375px 확인. 타입 검사·테스트 473개·빌드 통과.

---

## 135. 영웅 카드 경험치 막대에 설명 붙이기 (GPT)

**지금 시작할 수 있다. 134와 함께 돌릴 수 있다.** 배경: 작업 129 뒤 Claude Code가 확인했다(2026-11-27). 영웅 목록 카드의 Lv 아래 막대가 경험치라는 표시가 없어 무엇인지 알 수 없다(상세에는 "경험치 0 / 20"이 있다).

**전달할 내용**

```
영웅 목록 카드의 경험치 막대에 무엇인지 보이게 한다. src/ui/game/*.tsx, src/ui/styles.css, src/locales/*만 고친다. 사용자의 localhost:5174 세이브는 건드리지 않는다. tsconfig.tsbuildinfo는 커밋하지 않는다.

1. 막대 옆이나 위에 작은 글씨로 "경험치 n%"(또는 "다음 레벨까지 n%"), 마우스를 올리면 "경험치 xp / 필요 xp" 툴팁. 피로·사기 줄과 같은 꼴로 맞춘다.
2. 다른 곳(파티 준비 칸 등)에 같은 막대가 있으면 같이 맞춘다.
3. 문구 ko/en, 375px에서 넘치지 않게.

확인: tsc·test·build 통과. 127.0.0.1에서 본다. 확인한 내용을 메모에.
```

**메모**

영웅 목록과 여관 카드에 경험치 백분율을 표시하고, 툴팁과 접근성 안내에는 현재·필요 경험치를 표시한다. 영웅 상세는 숫자를 계속 보여 준다.
5176의 격리된 375px Chrome에서 한국어·영어 문구와 가로 폭을 확인했다. 타입 검사·테스트 473개·빌드를 통과했다.

---

## 136. 도감·업적 (GPT)

**지금 시작할 수 있다.** 설계: `Docs/codex.md`의 "도감"과 "업적".

**전달할 내용**

```
Docs/codex.md의 도감과 업적을 만든다. core·데이터·테스트·화면을 모두 한다. 사용자의 localhost:5174 세이브는 건드리지 않고 127.0.0.1:5175(쓰이면 5176)에서 확인한다. tsconfig.tsbuildinfo는 커밋하지 않는다.

1. core: GameState.codex와 GameState.achievements(설계 문서의 모양). 기록하는 곳(원정 정산의 몬스터·정예, dungeonLoot·raidLoot·exchange의 고유 장비, 장착 때 세트 3개, 고용·출생의 천부·직업). 같은 id는 한 번만. 기록 함수는 한 파일(예: src/core/codex.ts)에 모은다.
2. 세이브 버전을 하나 올린다. 예전 세이브는 지금 상태(roster·retirees·graveyard의 천부·직업, stash와 장비의 고유 장비, history 보고서의 적, cleared)에서 채울 수 있는 만큼 채운다. normalize에서 잘못된 id는 버린다.
3. src/data/codex.json: 업적 목록(id, 묶음, 조건 종류와 목표 수, 보상). 조건 종류는 설계 문서 표의 것들. 보상은 작게(5d 측정의 30일 획득량의 5% 안팎) 잡고, 정한 숫자를 Docs/codex.md에 표로 남긴다.
4. 행동 { type: 'claimAchievement', id }: 달성 전 'locked', 이미 받음 'missing', 받으면 보상 지급과 achievements에 추가. 달성 판정 함수(예: achievementProgress(state))는 순수 함수.
5. 테스트: 각 기록 경로, 중복 없음, 예전 세이브 채우기, 업적 판정·받기·보상, 같은 상태 같은 결과.
6. 화면: 마을 운영(또는 새 탭)에 "도감"과 "업적". 도감은 칸별 진행(예: 몬스터 23/41), 아직 못 만난 것은 실루엣·"???"(이름 숨김). 업적은 진행 막대, 받을 수 있는 것 강조, 받기 버튼. 받을 업적이 있으면 메뉴에 배지. 문구 ko/en, 375px.

확인: tsc·test·build 통과. 127.0.0.1에서 도감 채우기·업적 받기를 본다. 확인한 내용을 메모에.
```

**메모**

세이브 v30과 기존 저장 복구, 접촉·획득 기록, 업적 30개의 수동 수령을 추가했다.
5175의 375px Chrome에서 동굴 귀환으로 도감이 채워지고 첫 클리어 보상 15골드가 지급되는 것을 확인했다. 타입 검사·테스트 478개·빌드 통과.

---

## 137. 알림 1단계(웹) (GPT)

**작업 136 뒤에 시작한다.** 설계: `Docs/codex.md`의 "알림". 서버 없는 정적 사이트라 "게임이 열려 있거나 백그라운드에 있는 동안"의 알림만 한다. 완전히 닫힌 상태의 푸시는 하지 않는다.

**전달할 내용**

```
Docs/codex.md "알림"의 1단계를 만든다. 사용자의 localhost:5174 세이브는 건드리지 않는다. tsconfig.tsbuildinfo는 커밋하지 않는다.

1. core 순수 함수 upcomingEvents(state): 앞으로 일어날 일의 { kind, at, refId } 목록. kind: 원정 귀환(expedition), 건설 완료(build), 대장간·연금·마법 공방 완료(workshop), 다음 방문자 도착(visitor), 레이드 새 주(raid). 테스트 몇 개.
2. 설정에 "알림 받기"(기본 꺼짐). 켜면 Notification.requestPermission. 거절되면 안내 한 줄. 설정값은 세이브가 아닌 브라우저 저장(localStorage, try/catch)에 둔다.
3. 켜져 있고 권한이 있으면, 게임이 열려 있는 동안 upcomingEvents의 가장 가까운 시각들에 맞춰 서비스 워커의 showNotification으로 알림을 띄운다(registration.showNotification; 탭이 백그라운드여도). 같은 이벤트(kind+refId+at)는 한 번만. 탭이 보이는 상태(document.visibilityState === 'visible')면 알림 대신 기존 화면 안내만.
4. 알림을 누르면 열린 게임 창으로 포커스(서비스 워커 notificationclick → clients.matchAll → focus, 없으면 openWindow). 지금 PWA 설정(vite-plugin-pwa, workbox)을 확인하고, 필요하면 injectManifest 등으로 알림 처리 코드를 넣는다. 오프라인 캐시·업데이트 알림이 깨지지 않게.
5. 문구 ko/en(원정 귀환: "○○ 파티가 돌아왔다" 수준, 개인정보 없음). 설정 화면 375px.
6. Docs/codex.md 알림 절에 실제 동작(지원 브라우저, iOS는 홈 화면에 설치한 PWA에서만 되는 점 등)을 적는다.

확인: tsc·test·build 통과. 127.0.0.1에서 알림을 켜고 탭을 백그라운드로 둔 채 짧은 원정이 돌아올 때 알림이 오는지, 누르면 게임으로 돌아오는지. 확인한 내용을 메모에.
```

**메모**

5176의 375px Chrome에서 설정을 켜고, 숨겨진 탭에서 원정 귀환 알림 API가 성공한 것과 오프라인 새로고침을 확인했다.
운영체제 알림 클릭은 직접 재현하지 못했다. 서비스 워커 테스트로 기존 창 포커스와 새 창 열기를 확인했고, 타입 검사·테스트 482개·빌드를 통과했다.

---

## 138. 축제 장식이 명예의 전당 터와 겹치는 문제 (Cursor)

**지금 시작할 수 있다.** 배경: 작업 134에서 명예의 전당을 분수 왼쪽으로 옮긴 뒤, 사용자가 플레이 중 발견했다(2026-11-27). 축제(가을) 때 호박·음식 탁자·노란 기둥 같은 장식과 모여든 사람들이 명예의 전당 터(울타리 안)와 그 바로 앞에 놓인다. 장식 자리가 예전 배치를 기준으로 남아 있는 것으로 보인다.

**전달할 내용**

```
축제 장식이 건물 터와 겹치지 않게 한다. src/ui/voxel/*만 고친다. core·화면·locales는 고치지 않는다. 사용자의 localhost:5174 세이브는 건드리지 않고 127.0.0.1:5175(쓰이면 5176)에서 확인한다. tsconfig.tsbuildinfo는 커밋하지 않는다.

1. 봄·여름·가을·겨울 축제 장식(소품, 깃발·기둥, 탁자, 모이는 사람 자리)이 어느 건물 터(빈 터·공사 중·완공 모두)와도 겹치지 않게 한다. 분수 광장 둘레의 비어 있는 땅에 모은다.
2. 앞으로 건물 자리가 또 바뀌어도 겹치지 않도록, 장식 자리를 정할 때 건물 터 목록과 겹치는지 검사하는 방식으로(가능하면 작은 검사 함수 하나와 테스트).
3. 명예의 전당 터 안의 사람(동상 관람객 등)과 축제 사람이 섞이지 않게.

확인: 디버그로 계절을 넘겨 네 축제를 모두 켜 보고, 모든 건물을 지은 세이브와 빈 터 세이브 둘 다에서 본다. tsc·test·build 통과. 전·후 스크린샷을 메모에.
```

**메모**

`onBuildingLot`/`pickClearSpots`로 사계절 축제 소품을 LOTS 밖으로 두고, 광장 산책도 명예의 전당 터를 피하게 했다. `festival.test.ts`가 네 계절 앵커를 검사한다. 127.0.0.1:5175에서 가을 축제를 개최해 확인(빈 터 세이브). 스크린샷은 창이 가려져 저장하지 못했다. 타입 검사·테스트 485개·빌드 통과.

---

## 139. 마을 사건 core (GPT)

**지금 시작할 수 있다.** 설계: `Docs/incidents.md`.

**전달할 내용**

```
Docs/incidents.md의 마을 사건을 core에 만든다. 화면은 140에서 한다. 사용자의 localhost:5174 세이브는 건드리지 않는다. tsconfig.tsbuildinfo는 커밋하지 않는다.

1. src/data/incidents.json: 사건 12개(id, 가중치, 조건, 등장 인물 고르는 규칙, 선택지[id, 비용·필요 조건, 결과 목록(확률 있는 결과 포함), ignore 결과]). 결과 종류는 설계 문서 표의 것만.
2. src/core/incidents.ts: 다음 사건 시각 정하기, 조건 맞는 사건 고르기(최근 5개 제외, 가중치, 시드+incidentNonce), 등장 인물 고르기(원정 중·아이 아닌 성인 등 사건 규칙대로), 결과 적용(gold·materials·vault·fame·morale(feel)·affinity(bonds)·fatigue·xp·visitor·gear(rollDrop)·nothing), 만료 처리(ignore 결과). 모두 순수 함수.
3. advance(시간 흐름)에서: 기다리는 사건이 없고 nextIncidentAt이 지났으면 사건을 만든다. 기다리는 사건이 expiresAt을 지나면 ignore로 닫는다. 비운 시간이 길어도 사건은 한 번에 하나.
4. 행동 { type: 'resolveIncident', choice }: 등장 인물이 사라졌거나 조건이 깨졌으면 "상황이 바뀌었다"로 닫기(결과 없음, 로그에 남김). 선택지 비용이 안 되면 poor/locked.
5. 세이브 버전 하나 올림. incident, incidentNonce, nextIncidentAt, recentIncidents(5), incidentLog(20). normalize에서 잘못된 값 정리, 예전 세이브는 설계 문서대로.
6. 숫자 조정: 사기·골드 크기를 지금 게임 규모(축제 사기, 고용비, 초반 골드)에 맞춰 정하고 Docs/incidents.md 표를 고친다.
7. 테스트: 생기는 주기(계절당 1–2번, 시드 여러 개), 한 번에 하나, 만료, 조건(조건 안 맞는 사건은 안 나옴), 등장 인물이 사라진 경우, 각 결과 종류 적용, 확률 결과의 시드 재현, 세이브 왕복과 예전 세이브.

확인: tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

- 사건 12종의 시드 기반 발생·등장인물·선택지·만료와 효과를 구현하고 세이브 v31, 기존 세이브 이관을 반영했다.
- 시드 12개의 발생 주기, 한 번에 하나 대기, 조건·결과·확률 재현·세이브 왕복 테스트를 추가했다. tsc·테스트 491개·빌드 통과.

---

## 140. 마을 사건 화면·보고·알림 (GPT)

**작업 139 뒤에 시작한다.** 설계: `Docs/incidents.md`의 "화면".

**전달할 내용**

```
139에서 만든 마을 사건을 화면에 보인다. src/ui/*, src/locales/*를 고친다. core는 upcomingEvents에 사건 생김을 더하는 것만 고친다. 사용자의 localhost:5174 세이브는 건드리지 않고 127.0.0.1:5175(쓰이면 5176)에서 확인한다. tsconfig.tsbuildinfo는 커밋하지 않는다.

1. 기다리는 사건이 있으면 마을 화면에 말풍선 배지. 누르면 사건 창: 등장 영웅 얼굴(기존 Portrait), 두세 문장 글, 선택지 2–3개(비용, 대략의 결과 한 줄, 안 되는 선택지는 흐리게와 이유). 고르면 결과 글과 바뀐 수치(골드·사기·호감 등)를 보이고 닫는다.
2. 사건 글 12개와 선택지·결과 글 ko/en. 영웅 이름을 보간. 성격에 따라 대사 한 줄이 달라지면 좋다(선택).
3. 재접속 보고에 "비운 동안 생긴 일": 기다리는 사건 한 줄, 그냥 지나간 사건 한 줄.
4. 알림: upcomingEvents에 다음 사건 시각을 더하고(kind 'incident'), 알림 문구.
5. 375px에서 넘치지 않게.

확인: tsc·test·build 통과. 127.0.0.1에서 세이브의 nextIncidentAt을 당겨 사건을 띄우고, 선택지마다 결과를 본다. 확인한 내용을 메모에.
```

**메모**

- 마을 배지·사건 창·영웅 초상·비용과 선택 불가 사유·결과 수치·재접속 보고·다음 사건 알림을 한영으로 연결했다.
- 127.0.0.1:5175의 격리 Chrome 375px에서 사건 12종과 선택지 26개, 확률 분기와 대기·만료 보고를 확인했다. 알림 일정 테스트 및 tsc·테스트 492개·빌드 통과. OS 알림 수신은 미확인.

---

## 141. 마을 사건 다듬기: 영웅 없는 마을, 빈 아이콘 (GPT)

**지금 시작할 수 있다.** 배경: 139·140 뒤 Claude Code가 127.0.0.1에서 확인했다(2026-11-28). 영웅이 한 명도 없는 새 마을에서 "작은 잔치 제안"(영웅들이 광장에 모여…)이 떴다. 사건 창 제목 왼쪽의 아이콘 칸이 비어 있다.

**전달할 내용**

```
마을 사건 두 가지를 다듬는다. 사용자의 localhost:5174 세이브는 건드리지 않는다. tsconfig.tsbuildinfo는 커밋하지 않는다.

1. 모든 사건에 공통 조건: 마을에 성인 영웅이 최소 2명(원정 중 포함) 있어야 생긴다. 글이 "영웅들이"로 시작하는 사건(festivalIdea, rainyDay 등)은 원정 중이 아닌 성인 영웅이 그만큼 있어야 한다. 조건이 안 맞으면 다음 사건 시각만 미룬다(새로 굴린다). 테스트 하나.
2. 첫 사건이 너무 이르지 않게: 마을의 첫 사건은 첫 영웅 고용 뒤로 한다(이미 그렇다면 테스트로 확인만).
3. 사건 창 제목의 빈 아이콘 칸: 사건 종류에 맞는 아이콘(기존 UiIcon 중에서)을 넣거나 칸을 없앤다.
4. Docs/incidents.md 규칙에 공통 조건 한 줄.

확인: tsc·test·build 통과. 127.0.0.1에서 영웅 없는 새 마을에서 사건이 안 뜨는지, 영웅을 고용한 뒤 사건 창의 아이콘을 본다. 확인한 내용을 메모에.
```

**메모**

- 모든 사건은 살아 있는 성인 영웅 2명부터 발생한다. 비와 작은 잔치 제안은 원정 중이 아닌 성인 2명이 필요하다. 조건을 충족하지 않으면 다음 확인 시각만 미룬다.
- 격리된 Chrome 375px의 127.0.0.1:5176에서 첫 고용 전과 한 명 고용 후에는 배지가 없고, 두 명 고용 후에는 작은 잔치 제안과 마을 아이콘이 표시됨을 확인했다. 타입 검사·테스트 494개·빌드 통과.

---

## 142. 후천적 특성(행적·칭호) core (GPT)

**지금 시작할 수 있다.** 설계: `Docs/deeds.md`.

**전달할 내용**

```
Docs/deeds.md의 행적과 칭호를 core에 만든다. 화면은 143에서 한다. 사용자의 localhost:5174 세이브는 건드리지 않는다. tsconfig.tsbuildinfo는 커밋하지 않는다.

1. src/data/titles.json: 칭호 10개(id, 행적 키, 기준, 효과 SkillEffect). 행적 키 목록.
2. src/core/titles.ts: 원정 보고서에서 영웅별 행적 더하기(전투 기록의 마지막 일격·쓰러짐, 보스·정예·몬스터 종류는 monsterById와 리플레이 유닛으로), 기준을 넘은 칭호 붙이기(최대 3, 정해진 순서), titleLog에 남기기. 순수 함수.
3. 원정 정산(손·자동·침공·레이드·심연)에서 호출. 레이드 처치 참여는 settleRaid의 단계 처치 때.
4. 효과: heroSkillEffects에 칭호 효과를 더한다(gear·gift와 같은 길).
5. 세이브 버전 하나 올림. Hero.deeds, Hero.titles, GameState.titleLog(20). normalize에서 잘못된 키·id 정리, 칭호 3개 넘으면 앞 3개. 예전 세이브는 0부터.
6. 기준 측정: 4d·5d 월간 도구(tools/identity-5d-month.ts 등)를 써서 Lv10 이후 30일 동안 칭호가 언제 몇 명에게 생기는지 잰다. 첫 칭호가 Lv10 무렵 한두 명에게 생기도록 기준을 맞추고 Docs/deeds.md 표를 고친다. 효과가 천부보다 세지 않은지 5d 측정 방식으로 한두 개 확인.
7. 테스트: 행적 세기(마지막 일격, 쓰러짐 뒤 생존, 보스·용·정예), 칭호 붙기·3개 한도·중복 없음, 효과 합계, 자동 출정에서도 셈, 세이브 왕복·예전 세이브.

확인: tsc·test·build 통과. 확인한 내용을 메모에.
```

**메모**

- 수동·자동 원정에서 영웅별 행적 10종과 칭호 최대 3개를 정산하고 세이브 v32에 기록한다. 시드 2에서 Lv10 도달 시 2명, 이후 30일 시점에 9명이 칭호를 보유했다.
- 성자와 치유의 손길의 회복 보너스는 각각 +5%, +10%. 산적 요새 비교에서는 각 96승으로 승률 차이가 없었다. 타입 검사·테스트 496개·빌드 통과.

---

## 143. 후천적 특성 화면·연출·도감 (GPT)

**작업 142 뒤에 시작한다.** 설계: `Docs/deeds.md`의 "화면".

**전달할 내용**

```
142에서 만든 칭호를 화면에 보인다. src/ui/*, src/locales/*를 고친다. 도감 칸을 위해 필요하면 src/core/codex.ts에 칭호 기록을 더한다(세이브는 142의 버전을 쓴다. 더 올려야 하면 하나만). 사용자의 localhost:5174 세이브는 건드리지 않고 127.0.0.1:5175(쓰이면 5176)에서 확인한다. tsconfig.tsbuildinfo는 커밋하지 않는다.

1. 영웅 카드·상세·방문자 카드에 칭호 배지(천부 금빛과 다른 색). 누르면 설명·효과·얻은 때.
2. 영웅 상세에 행적 표: 키마다 지금 값과 다음 칭호까지 진행(이미 3개면 "칭호가 가득 찼다").
3. 칭호를 얻으면: 원정 결과에 한 줄과 짧은 연출(기존 새 장비 알림 연출 정도), 재접속 보고에 한 줄, 알림(upcomingEvents가 아니라 얻은 순간이라 화면 안내만이어도 된다).
4. 명예의 전당·묘지의 영웅 기록에 칭호.
5. 도감에 "칭호" 칸(10개, 못 본 것은 ???).
6. 칭호 이름·설명 ko/en. 375px에서 넘치지 않게.

확인: tsc·test·build 통과. 127.0.0.1에서 세이브의 행적을 기준 직전으로 고쳐 원정 한 번에 칭호가 붙는 것을 본다. 확인한 내용을 메모에.
```

**메모**

- 영웅·방문자·묘지·명예의 전당에 칭호를 표시하고 상세 행적 표, 도감, 획득 알림과 원정·재접속 보고를 연결했다.
- 격리 Chrome 375px(127.0.0.1:5176)에서 승리 2,499회인 영웅이 원정 한 번으로 백전노장을 얻고 재접속 보고, 배지 효과·획득 시각, 행적 표 10행, 도감 1/10에 반영되는 것을 확인했다. 타입 검사·테스트 497개·빌드 통과.

---

## 144. 출정하는 영웅이 명예의 전당과 분수 사이에 끼는 문제 (Cursor)

**지금 시작할 수 있다.** 배경: 사용자가 플레이 중 발견했다(2026-11-28). 작업 134에서 명예의 전당을 분수 왼쪽으로 옮긴 뒤, 던전으로 떠나는 영웅들이 명예의 전당 터(울타리)와 행운의 분수 사이 좁은 틈에 끼어 더 가지 못하고 제자리걸음을 한다(원정 중 화면, 귀환까지 시간이 흐르는데 영웅은 광장에 남아 있음).

**전달할 내용**

```
마을에서 영웅이 걸어 다니는 길(출정·귀환·산책·축제)이 건물 터와 분수 사이에 끼지 않게 한다. src/ui/voxel/*만 고친다. core·화면·locales는 고치지 않는다. 사용자의 localhost:5174 세이브는 건드리지 않고 127.0.0.1:5175(쓰이면 5176)에서 확인한다. tsconfig.tsbuildinfo는 커밋하지 않는다.

1. 원인을 찾는다: 걷는 길(경로점·목표점)이 명예의 전당 터와 분수 사이를 지나가는지, 충돌·회피가 서로 밀어 멈추는지.
2. 고치는 방법은 둘 중 알맞은 것(둘 다도 좋다):
   - 명예의 전당 터를 분수에서 한 칸 이상 떼어 사람이 지나갈 틈(최소 2칸)을 만든다. 134·138의 배치(가려지지 않기, 축제 장식과 겹치지 않기)는 지킨다.
   - 걷는 길을 건물 터·분수를 피해 열린 길로만 잡고, 막히면 다른 길로 돌아가거나 짧게 기다렸다 다시 고른다. 몇 초 넘게 같은 자리에 머물면 다음 경로점으로 넘긴다(끼임 방지).
3. 138에서 만든 "건물 터와 겹치는지 검사"를 걷는 길에도 쓰거나, 길이 건물 터를 지나지 않는지 검사하는 테스트 하나.
4. 확인할 장면: 파티 5명 출정·귀환, 여러 파티 동시 출정, 축제 중 출정, 모든 건물을 지은 세이브와 빈 터 세이브.

확인: tsc·test·build 통과. 출정 장면을 여러 번 보고 끼는 영웅이 없는지. 전·후 스크린샷(또는 짧은 설명)을 메모에.
```

**메모**
