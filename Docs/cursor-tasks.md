# Cursor 작업 목록

Claude Code와 Cursor를 번갈아 쓰기 위한 작업 목록이다. 작업 하나씩 아래 "전달할 내용"을 Cursor에 그대로 붙여 넣는다. 프로젝트 규칙은 `.cursor/rules/simulation-core.mdc`(= `CLAUDE.md`)에 있다.

## 분담 계획 (2026-11-23)

| 담당 | 작업 | 이유 |
| --- | --- | --- |
| Claude Code | 첫 접속 길잡이 의뢰 | 코어 상태·보상·UI를 함께 설계 |
| Claude Code | 은퇴 → 호감도·결혼·출산·유전 (단계 2) | 코어·세이브·3D 외형(look.ts)을 함께 바꾸는 큰 설계 |
| Cursor | 9 PWA·오프라인, 10 효과음, 11 나이 먹기 | 범위가 분명하고 다른 작업과 파일이 겹치지 않음 |
| 사용자 | GitHub 저장소 만들기·첫 push·Pages 켜기 | 계정이 필요함. 12번 앞의 "먼저 사용자가 할 일" 참고 |

Cursor 작업 9–11은 서로 겹치지 않아 순서 상관없다. 11번은 core/game.ts를 건드리므로 Claude Code가 길잡이 작업을 커밋한 뒤에 넘긴다.

## 모든 작업 공통 (Cursor에게 매번 함께 전달)

```
- 시작 전에 Docs/cursor-tasks.md에서 이 작업 항목을 읽고, 관련 GDD 절과 Docs/*.md를 확인한다.
- 작업이 끝나면 npx tsc --noEmit, npm test, npm run build가 모두 통과해야 한다.
- 화면이 바뀌는 작업은 npm run dev로 띄워 직접 확인한다. 확인하지 못한 부분은 숨기지 말고 적는다.
- 작업 하나 = 커밋 하나. 커밋 메시지는 영어로 무엇을 왜 바꿨는지 적는다.
- 끝나면 Docs/cursor-tasks.md의 해당 항목 상태를 "완료 (커밋 해시)"로 바꾸고, 결정한 것·남긴 것을 "메모"에 2–3줄 적는다.
- 지시에 없는 리팩터링, 파일 이동, 의존성 추가는 하지 않는다.
```

## 진행 순서와 상태

| # | 작업 | 크기 | 상태 |
| --- | --- | --- | --- |
| 1 | 영어 이름 뒤 한국어 조사 | 작음 | 완료 (562bf8d) |
| 2 | 시간 가속 디버그 도구 | 작음 | 완료 (09072ee) |
| 3 | three.js 코드 분할 (빌드 경고 제거) | 작음 | 완료 (185056d) |
| 4 | 폰 화면 폭 점검 | 중간 | 완료 (5c42085) |
| 5 | 패배 원인 "파티가 아직 약하다" 추가 | 중간 | 완료 (ed9290d) |
| 6 | 보상형 광고 인터페이스 + 가짜 광고 | 큼 | 완료 (a5dedef) |
| 7 | 피로·부상 효과와 자연 회복 | 중간 | 완료 (f418308) |
| 8 | 게임 UI 아이콘·폰트·로고 아트 | 중간 | 완료 (87e8984) |
| 9 | PWA·오프라인 실행·업데이트 알림 | 중간 | 완료 (3c3c45c) |
| 10 | 효과음 (코드 합성) + 음량 설정 | 중간 | 완료 (c657c25) |
| 11 | 해가 바뀌면 나이 먹기 | 작음 | 대기 |
| 12 | GitHub Pages 배포 | 작음 | 대기 (사용자가 저장소를 먼저 올려야 함) |

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
GDD 7.1(피로·부상으로 로테이션)과 Docs/cursor-tasks.md 7번 표대로 피로·부상 효과와 자연 회복을 구현한다.

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

메모:

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
