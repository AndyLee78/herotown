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
| 12 | GitHub Pages 배포 | Cursor 또는 GPT | `vite.config.ts`, `.github/workflows/` | 대기 (사용자가 저장소를 먼저 올려야 함) |
| 13 | 원정 화면 그림·소리 다듬기 | Cursor | `src/ui/voxel/*`, `battleScreens.tsx` | 완료 (03806a1) |
| 14 | 던전 미리보기를 배경 일러스트처럼 | Cursor | `src/ui/voxel/portrait.ts` | 완료 (1dce191) |
| 15 | 영어 문구 다듬기 | GPT | `src/locales/en.json` | 완료 (e6754c1) |
| 16 | 초반 흐름 개편 코드 리뷰 (a1dd951) | GPT | `Docs/reviews/a1dd951.md` (새 파일만) | 완료 (5759763) |
| 17 | 리뷰 a1dd951의 버그 두 개 수정 | GPT | `src/core/game.ts`, `src/core/flow.test.ts` | 완료 (6d79ef3) |
| 18 | 밸런스 도구 리뷰 지적 수정 | GPT | `tools/first-hour.ts`, `tools/tune-curve.ts`, `Docs/dungeons.md` | 완료 (97d091e) |
| 19 | 세대 화면 (가족·관계·청혼·인구·가계도) | Cursor | `src/ui/game/heroScreens.tsx`, `villageScreens.tsx`, `App.tsx`, `styles.css`, `src/locales/*` | 완료 (14395ae) |
| 20 | 세대 3D 연출 (부부·아이·광장) | Cursor | `src/ui/voxel/VillageScene.ts`, `src/ui/VillageView.tsx` | 대기 (19 뒤) |
| 21 | 세대 core 코드 리뷰 (443bde5) | GPT | `Docs/reviews/443bde5.md` (새 파일만) | 대기 (지금 시작 가능) |
| 22 | 세대 시뮬레이터 | GPT | `tools/generations.ts` (새 파일), `package.json` 스크립트 한 줄 | 대기 (지금 시작 가능) |
| 23 | 첫 3시간 시뮬레이터를 여러 시드로 | GPT | `tools/first-hour.ts` | 대기 (22와 따로, 파일 안 겹침) |

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

메모:

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
