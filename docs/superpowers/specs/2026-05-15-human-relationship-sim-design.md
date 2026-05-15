# 직장 내 인간관계 역동 시뮬레이션 — 설계 문서

## 개요

인간관계론 수업 발표용 실시간 청중 참여 웹앱.
발표자가 어드민에서 단계를 제어하고, 청중은 각자 기기로 투표, 결과는 실시간 차트로 표시.

## 기술 스택

- **Frontend/Backend**: Next.js (App Router)
- **실시간 DB**: Supabase (Realtime 구독)
- **배포**: Vercel (GitHub 연동)

## 페이지 구성

| 경로 | 대상 | 역할 |
|------|------|------|
| `/` | 청중 | 시나리오 읽기 → 투표 → 결과 대기 |
| `/admin` | 발표자 | 단계 제어 (비밀번호 보호) |
| `/results` | 발표자 화면 | 실시간 차트 + 이론 피드백 |

## 데이터 모델

### Supabase 테이블

**session_state** (단일 row)
- `current_stage`: int — 현재 시나리오 인덱스 (0부터)
- `phase`: text — `'intro'` | `'voting'` | `'results'`

**votes**
- `stage`: int
- `choice`: text (선택지 텍스트)
- `created_at`: timestamp

### 시나리오 데이터 (`lib/scenarios.ts`)

코드 파일로 관리. 시나리오 추가/삭제는 이 파일만 수정.

```ts
export const scenarios = [
  {
    title: string,
    description: string,
    choices: string[],
    theory: string, // 결과 화면에 표시할 이론 피드백
  }
]
```

## 흐름

```
[intro] 시나리오 텍스트 표시 (청중 입력 불가)
  ↓ 발표자: "투표 시작"
[voting] 선택지 활성화, 청중 투표
  ↓ 발표자: "결과 보기"
[results] 차트 + 이론 피드백
  ↓ 발표자: "다음 시나리오" (stage+1, intro로)
[intro] 다음 시나리오... (반복)
```

## 어드민 버튼

- **투표 시작**: phase → `voting`
- **결과 보기**: phase → `results`
- **다음 시나리오**: stage+1, phase → `intro` (마지막 시나리오면 비활성화)
- 비밀번호: 환경변수 `ADMIN_PASSWORD`로 관리

## 중복 투표 방지

`localStorage`에 `voted_stage_N` 플래그 저장. 간단하게.

## Realtime 구독

청중 페이지는 `session_state` 테이블을 Supabase Realtime으로 구독.
발표자가 phase/stage 바꾸면 청중 화면 자동 전환.
