# 세대 시스템 설계 (단계 2)

GDD 6장(결혼·출산·2세)을 실제 규칙으로 옮긴다. 마을 영웅끼리 친해지고, 결혼하고, 아이를 낳고, 아이는 부모를 닮아 마을이 직접 키운 영웅이 된다. 이번 범위는 **2a: 관계·결혼·출산·유전**이다. 자연사·사기·축제·명예의 전당·재혼은 **2b**로 미룬다(아래 6절).

모든 수치는 `src/data/family.json`에 둔다. 아래 숫자는 초깃값이다.

## 1. 관계 (호감도)

- 영웅 두 명 사이의 호감도 0–100을 `state.bonds`에 쌍으로 저장한다(`{ a, b, affinity }`, a < b). 없으면 0이다.
- **오르는 때**
  - 같은 원정에서 함께 돌아오면 쌍마다 +8(`affinityPerTrip`). 승리하면 +4를 더한다(`affinityWinBonus`).
  - 같은 마을에 사는 것만으로 계절마다 쌍마다 +1(`affinityPerSeason`). 집 레벨마다 +0.5(`affinityPerHouseLevel`).
- **단계**: 친구 40+, 연인 70+. 연인은 둘 다 18세 이상, 이성, 둘 다 미혼이어야 한다. 조건이 안 되면 호감도가 높아도 친구에 머문다.
- **파티 시너지**: 같은 파티에 있는 친구 쌍마다 각자의 공격·회복 +1%, 연인·부부 쌍은 +3%. 영웅 한 명당 최대 +5%. `PartyMember.bonus`로 넘기고 combat.ts의 피로·부상 배율과 같은 곳에서 곱한다.
  - 처음엔 +2%/+5%/최대 10%였으나, 첫 3시간 시뮬레이터(시드 11)에서 파티 Lv 6.7 → 9로 초반 곡선이 크게 빨라져 줄였다. 시드마다 결과 차이가 커서 세대 시뮬레이터(작업 22)로 다시 본다.
- 호감도는 은퇴자와도 유지한다. 해고되거나 묘지로 간 영웅의 쌍은 지운다.

## 2. 청혼과 결혼

- 연인 쌍의 호감도가 85 이상(`proposeAt`)이 되면 계절이 바뀔 때 `proposeChance`(0.5) 확률로 **청혼**이 올라온다. `state.proposals`에 `{ a, b, at }`로 쌓이고, 방치 중에도 사라지지 않는다. 한 영웅은 청혼 하나에만 들어간다.
- 플레이어가 **승낙**하면 부부가 된다. 조건: 부부 수가 집 레벨 × `couplesPerHouseLevel`(1)보다 적을 것("빈 집"). 꽉 차면 승낙 버튼이 막히고 이유를 보여준다.
- **거절**하면 그 쌍의 호감도 −20, 그 쌍은 2계절 동안 다시 청혼하지 않는다(`declineCooldownSeasons`).
- 부부는 `hero.spouseId`로 서로를 가리킨다. 한쪽이 해고·묘지로 사라지면 남은 쪽은 `widowedAt`이 기록되고 1계절 뒤 다시 연애할 수 있다(재혼 규칙의 최소 형태).

## 3. 출산과 성장

- 계절이 바뀔 때 부부마다 `birthChance`(0.35) 확률로 임신한다. 조건: 둘 다 마을(roster)에 있고 원정 중이 아니며 살아 있음, 엄마 45세 이하·아빠 55세 이하(`maxMotherAge`, `maxFatherAge`), 자녀가 `maxChildren`(3)보다 적음, 마을 인원이 침대 수보다 적음.
- 임신하면 엄마에게 `expecting: { dueAt, child }`가 생긴다(dueAt = 지금 + 1계절). 아이는 임신할 때 이미 정해진다(부모가 그사이 떠나도 유전이 맞도록). 임신 중에는 출정할 수 없다(`canDeploy`가 거짓).
- `dueAt`이 지나면 아이가 0세로 태어나 roster에 들어온다. 첫 양육 비용 없음, 14세 전까지 품삯 0(`childWage`).
- **성장 속도**: 14세 전까지는 해가 바뀔 때 `childYearsPerYear`(3)살씩 먹는다(0→3→6→9→12→14). 1년이 4일이므로 약 20일 만에 견습 출전한다. 14세부터는 1년에 1살.
- 학교·훈련소(GDD 6.2-3)는 2b에서 건물로 추가한다.

## 4. 유전

- **성별** 50:50. **이름**은 names.json에서 고르고, **가문**은 아버지의 가문을 따른다. 가문이 없는 첫 세대 부모의 아이는 아버지 이름이 가문 이름이 된다(`hero.family`). 화면에는 "이름 · 가문"으로 보인다.
- **직업**: 부모 중 한쪽 직업(반반). 딸이 아니면 무희를 물려받지 않고 반대쪽 부모 직업을 쓴다. 둘 다 무희면 음유시인.
- **잠재 능력치(potentials)**: 능력치마다 부모 평균 × (1 ± `statSpread` 0.1). `geniusChance`(0.03)이면 전부 ×1.25.
- **잠재력(potential)**: 부모 평균 ± 8. 천재면 +20. 0–100으로 자른다.
- **특성**: 부모 특성마다 30%(`traitInherit`) 유전, 5%(`traitMutation`)로 무작위 특성 하나 추가. 최대 2개.
- **외형 유전자**: 지금 외형은 `look.ts`가 영웅 id로 매번 만든다. 이를 core의 `src/core/genes.ts`로 옮겨 `genesFor(hero)` = `hero.genes ?? id에서 만든 값`으로 한다(뽑는 순서가 같아 기존 영웅은 모습이 안 바뀐다). 아이는 태어날 때 `genes`가 저장된다.
  - 피부·머리색: 부모 색을 0.3–0.7 비율로 섞는다. 눈색: 한쪽 부모. 머리 모양: 한쪽 부모의 모양 번호를 아이 성별 목록에 대응. 수염: 아들이면 아빠 수염 여부를 70% 따른다. 키: 부모 평균 ± 0.02.
- 모든 무작위는 `state.seed`와 nonce로 만든 rng를 쓴다(core 규칙).

## 5. 마을 성비 (GDD 6.4)

- 방문자를 만들 때 마을 roster의 성인 성비가 60:40을 넘으면 부족한 성별 확률을 65%로 올린다(`visitorBalanceAt` 0.6, `visitorBalanceChance` 0.65).

## 6. 2b로 미루는 것

자연사(노년 사망 확률), 사기·감정(6.6), 축제, 명예의 전당과 가문 보너스, 학교·훈련소, 역관계. 2a를 플레이해 보고 넣는다.

## 7. core 변경 요약

- `Hero`: `family?`, `parents?: [엄마, 아빠]`, `spouseId?`, `widowedAt?`, `expecting?: { dueAt, child }`, `genes?`. 규칙 코드는 `src/core/family.ts`, 외형은 `src/core/genes.ts`.
- `GameState`: `bonds`, `proposals`, `familyNonce`. `SAVE_VERSION` 8, 예전 세이브는 빈 목록으로 채운다.
- 액션: `acceptProposal { a, b }`, `declineProposal { a, b }`.
- 알림: 부재 보고서에 `proposals`(새 청혼 수), `births`(이름 목록)를 더한다.
- 조회 함수(화면용, `src/core` index에서 export): `bondOf(state, a, b)`, `bondStage(state, a, b)` → stranger/friend/lover/spouse, `topBonds(state, id, n)`, `familyOf(state, id)`(배우자·부모·자녀), `population(state)`(나이대×성별, 기혼·미혼·임신, 침대), `housingFree(state)`, `coupleCount(state)`, `partyBonus(state, ids)`, `residents(state)`.
- 알림 키: `notice.noHouse`(빈 신혼집 없음).

## 8. 작업 단계와 분담

| 단계 | 내용 | 담당 | 건드리는 파일 |
| --- | --- | --- | --- |
| 0 ✅ | a1dd951 리뷰의 버그 두 개 수정(광고 치료, 오프라인 회복) | GPT (작업 17) | `src/core/game.ts`, `src/core/flow.test.ts` |
| 0′ ✅ | 밸런스 도구 리뷰 지적 수정 | GPT (작업 18) | `tools/first-hour.ts`, `tools/tune-curve.ts`, `Docs/dungeons.md` |
| A ✅ | core: 위 1–5절 전부, genes.ts, 세이브 8, 테스트, `look.ts`를 genes로 연결 | Claude Code | `src/core/*`, `src/data/family.json`, `src/ui/voxel/look.ts` |
| B | 화면: 영웅 상세의 가족·관계, 청혼 카드(승낙/거절), 마을 인구 현황, 가계도, 출생 알림 | Cursor (작업 19) | `src/ui/game/heroScreens.tsx`, `villageScreens.tsx`, `App.tsx`, `styles.css`, `src/locales/*` |
| C | 3D: 부부가 함께 걷기, 아이는 작게 부모 곁에, 결혼·출생 때 광장 연출 | Cursor (작업 20, B 다음) | `src/ui/voxel/VillageScene.ts`, `src/ui/VillageView.tsx` |
| D | A 코드 리뷰 | GPT (작업 21) | `Docs/reviews/<A 해시>.md` |
| E | 세대 시뮬레이터: 마을을 N년 돌려 결혼·출생·인구·천재 수를 표로 | GPT (작업 22) | `tools/generations.ts` (새 파일), `package.json` 스크립트 한 줄 |

- 순서: 0 → A → (B, D, E 동시) → C. 0′은 언제든 같이 돌릴 수 있다.
- B와 C는 같은 Cursor가 하므로 차례로 한다. B가 `src/locales`를 건드리므로 그동안 다른 작업은 문구 파일을 고치지 않는다.
