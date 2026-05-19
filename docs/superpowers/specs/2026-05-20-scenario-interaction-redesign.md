# 시나리오 인터랙션 재설계

**날짜:** 2026-05-20  
**상태:** 승인됨

## 배경

현재 `/` 페이지는 Supabase phase(intro → voting → results)에 따라 `ScenarioView`와 `VotingView`를 분리해 표시한다. 투표 후에는 "투표 완료! 결과를 기다려주세요."만 보인다.

새 방향: 청중이 선택지를 클릭하면 **투표와 동시에** `[n번 선택시]` 응답 텍스트가 인라인으로 표시된다.
결과 페이지는 이론 해설을 explain.md 기반 내용으로 교체하되 투표 차트는 유지한다.

## 변경하지 않는 것

- Supabase 실시간 세션 제어 (admin이 stage/phase 제어)
- Admin 페이지 (`app/admin/page.tsx`)
- `lib/scenarios.ts` 타입 구조 및 데이터 구조
- `lib/supabase.ts`
- `app/page.tsx` — intro/voting/results phase 분기 로직 그대로

## 변경 파일 및 내용

### 1. `components/VotingView.tsx`

**변경 전:** 투표 후 "투표 완료! 결과를 기다려주세요." 텍스트만 표시.

**변경 후:**
- `votedIndex: number | null` state 추가
- `handleVote(choice: string, index: number)` 로 시그니처 변경 — index를 함께 저장
- 투표 완료 후 해당 선택지의 응답 텍스트 표시:
  - Round 1: `scenario.firstChoices[votedIndex].result.prompt`
  - Round 2: `secondResult.outcomes[votedIndex].text`
- 응답 텍스트는 `whitespace-pre-line`으로 렌더링 (줄바꿈 보존)
- 기존 "투표 완료!" 문구 제거

**데이터 구조 변경 없음.** `result.prompt`는 이미 [n번 선택시] 내용을 담는 용도의 필드.

### 2. `app/results/page.tsx`

**코드 변경 없음.** 현재 구조가 이미 요구사항을 충족한다:
- 투표 차트: 유지
- 이론 개요(파란 박스): 유지 — explain.md의 stage별 이론 개요 텍스트를 `scenario.theoryDetail`에 채우면 됨
- 선택지별 해설 카드: 유지 — round=1이면 firstChoices 전체, round=2이면 outcomes 전체 표시 (이미 "n번째 선택 단위" 표시)

**내용만 업데이트** (사용자가 scenarios.ts에서 직접):
```
[투표 차트]
────────────────────
[이론 개요] ← scenario.theoryDetail (explain.md stage 설명)
[선택지 해설 카드들]
  선택지 1: 텍스트 + 이론 설명
  선택지 2: 텍스트 + 이론 설명
  선택지 3: 텍스트 + 이론 설명
```

### 3. `lib/scenarios.ts` — 내용 업데이트 (사용자 직접)

구조 변경 없음. 사용자가 다음 필드를 직접 수정:
- `firstChoices[i].result.prompt` → scenario.md의 `[n번 선택시]` 텍스트
- `firstChoices[i].theory` → explain.md의 해당 선택지 해설
- `outcomes[i].theory` → explain.md의 두 번째 선택 해설

## 구현 범위 요약

| 파일 | 변경 유형 |
|------|----------|
| `components/VotingView.tsx` | 로직 변경 (votedIndex 추가, 응답 텍스트 표시) |
| `lib/scenarios.ts` | 내용만 수정 (사용자 직접) |

## 플로우 (변경 후)

```
Admin: intro 단계 설정
  → 청중: 시나리오 설명 텍스트 표시 (ScenarioView, 선택지 없음)

Admin: "투표 시작" → voting 단계
  → 청중: 시나리오 텍스트 + 선택지 버튼 표시 (VotingView)
  → 청중이 선택지 클릭
    → Supabase에 투표 저장
    → 클릭한 선택지의 [n번 선택시] 텍스트 인라인 표시
    → 선택지 버튼 비활성화

Admin: "투표 완료" → results 단계 (winner 결정)
  → 청중: "발표자 화면에서 결과를 확인하세요!" (기존과 동일)
  → 발표자(/results): 투표 차트 + 선택지별 이론 해설

Admin: "2차 선택지로 →" → intro round 2
  (이후 동일 플로우)
```
