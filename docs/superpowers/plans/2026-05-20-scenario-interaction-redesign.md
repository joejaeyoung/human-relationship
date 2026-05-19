# 시나리오 인터랙션 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 청중이 선택지를 클릭하면 투표와 동시에 해당 [n번 선택시] 응답 텍스트가 인라인으로 표시되도록 VotingView를 변경한다.

**Architecture:** `components/VotingView.tsx` 한 파일만 수정. `votedIndex` state를 추가해 클릭한 선택지 인덱스를 추적하고, 투표 완료 후 round에 따라 `firstChoices[votedIndex].result.prompt` 또는 `outcomes[votedIndex].text`를 표시한다. Supabase 세션 제어, admin 페이지, scenarios.ts 구조, results 페이지 코드는 변경하지 않는다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Tailwind CSS v4

---

## File Map

| 파일 | 역할 | 변경 |
|------|------|------|
| `components/VotingView.tsx` | 청중 투표 + 응답 표시 컴포넌트 | 수정 |
| `lib/scenarios.ts` | 시나리오 데이터 | 내용만 수정 (사용자 직접) |

---

## Task 1: VotingView — votedIndex state 추가 및 handleVote 시그니처 변경

**Files:**
- Modify: `components/VotingView.tsx`

- [ ] **Step 1: `votedIndex` state와 `handleVote` 시그니처 변경**

`components/VotingView.tsx`를 다음과 같이 수정한다:

```tsx
'use client'

import { useState } from 'react'
import { Scenario } from '@/lib/scenarios'
import { supabase } from '@/lib/supabase'

interface Props {
  scenario: Scenario
  stage: number
  round: number
  firstChoiceWinner: number | null
}

export default function VotingView({ scenario, stage, round, firstChoiceWinner }: Props) {
  const votedKey = `voted_stage_${stage}_round_${round}`
  const [voted, setVoted] = useState(() =>
    typeof window !== 'undefined' ? !!localStorage.getItem(votedKey) : false
  )
  const [votedIndex, setVotedIndex] = useState<number | null>(null)

  const secondResult =
    round === 2 && firstChoiceWinner !== null
      ? scenario.firstChoices[firstChoiceWinner].result
      : null

  const choices: string[] =
    round === 1
      ? scenario.firstChoices.map((fc) => fc.text)
      : secondResult?.kind === 'second'
      ? secondResult.choices
      : []

  const image =
    round === 1
      ? scenario.image
      : secondResult?.kind === 'second'
      ? secondResult.image
      : undefined

  function getResponseText(): string {
    if (votedIndex === null) return ''
    if (round === 1) {
      return scenario.firstChoices[votedIndex]?.result.prompt ?? ''
    }
    return secondResult?.outcomes[votedIndex]?.text ?? ''
  }

  async function handleVote(choice: string, index: number) {
    if (voted) return
    await supabase.from('votes').insert({ stage, round, choice })
    localStorage.setItem(votedKey, '1')
    setVoted(true)
    setVotedIndex(index)
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">{scenario.title}</h2>
      {image && (
        <img
          src={image}
          alt={scenario.title}
          className="w-full rounded-xl object-cover max-h-64"
        />
      )}
      <div className="space-y-3 mt-6">
        {choices.map((choice, i) => (
          <button
            key={choice}
            onClick={() => handleVote(choice, i)}
            disabled={voted}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all font-medium text-base ${
              voted
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-blue-400 bg-white text-gray-900 hover:border-blue-600 hover:bg-blue-50 active:bg-blue-100 cursor-pointer shadow-sm'
            }`}
          >
            {choice}
          </button>
        ))}
      </div>
      {voted && votedIndex !== null && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-gray-900 whitespace-pre-line leading-relaxed text-base">
            {getResponseText()}
          </p>
        </div>
      )}
    </div>
  )
}
```

변경 포인트:
- `votedIndex: number | null` state 추가
- `handleVote(choice, index)` — index 파라미터 추가, `setVotedIndex(index)` 호출
- 버튼 `onClick={() => handleVote(choice, i)}` — 인덱스 `i` 전달
- "투표 완료!" 문구 제거
- `voted && votedIndex !== null` 조건으로 응답 텍스트 박스 표시

- [ ] **Step 2: 개발 서버 실행 및 동작 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 후:

1. admin(`/admin`)에서 Stage 1, phase=voting으로 설정
2. 청중 페이지(`/`)에서 선택지 1 클릭
3. **기대 동작:** 버튼 비활성화 + 초록색 박스에 `scenario.firstChoices[0].result.prompt` 텍스트 표시
4. 선택지 2, 3도 각각 별도 브라우저(시크릿 창)에서 테스트 — 각 선택지마다 다른 응답 텍스트가 나와야 함
5. admin에서 round=2로 설정 후 반복 확인 — `secondResult.outcomes[i].text` 표시 여부

- [ ] **Step 3: 새로고침 후 상태 확인**

투표 후 페이지 새로고침:
- **기대 동작:** 버튼 비활성화(`voted=true`, localStorage에서 복원), 응답 텍스트 박스 없음(`votedIndex=null`이므로)
- 이는 정상 — 응답은 클릭 직후에만 표시됨

- [ ] **Step 4: TypeScript 타입 오류 확인**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 5: Commit**

```bash
git add components/VotingView.tsx
git commit -m "feat: 선택지 클릭 시 [n번 선택시] 응답 텍스트 인라인 표시"
```

---

## Task 2: scenarios.ts 내용 업데이트 (수동)

**Files:**
- Modify: `lib/scenarios.ts` (내용만, 사용자 직접 수정)

이 태스크는 코드 구현이 아닌 데이터 업데이트 작업이다.

- [ ] **Step 1: scenario.md → `result.prompt` 필드 업데이트**

`lib/scenarios.ts`에서 각 firstChoice의 `result.prompt`를 `scenario.md`의 `[n번 선택시]` 텍스트로 교체한다.

예시 (Stage 1):
```ts
// firstChoices[0].result.prompt
prompt: '상사: "흠... 핵심 파트라도 오늘 받으면 좋겠네요"\n\n(속마음: \'상사가 완전히 거절은 하지 않았다. 지금 확실히 일정 픽스해서 꼭 약속에 나가야지!\')',

// firstChoices[1].result.prompt (현재는 [1번 선택시]와 동일 — scenario.md의 [2,3번 선택시] 텍스트로 교체)
prompt: '상사: "제대로 할 수 있는 거 맞죠?"\n\n주인공: "아.. 네.."\n\n(속마음: \'하... 결국 약속 나가지도 못하겠네.. 일이나 해야지..\')',

// firstChoices[2].result.prompt
prompt: '상사: "제대로 할 수 있는 거 맞죠?"\n\n주인공: "아.. 네.."\n\n(속마음: \'하... 결국 약속 나가지도 못하겠네.. 일이나 해야지..\')',
```

Stage 2, Stage 3도 동일하게 `scenario.md`의 `[n번 선택시]` 텍스트를 해당 `result.prompt`에 채운다.

- [ ] **Step 2: explain.md → `theory` 필드 업데이트**

각 `firstChoices[i].theory`와 `outcomes[i].theory`를 `explain.md`의 해당 선택지 해설 텍스트로 교체한다.

각 stage의 `theoryDetail`에는 explain.md의 stage별 개요 텍스트(첫 문단)를 넣는다.

- [ ] **Step 3: 개발 서버에서 결과 페이지 확인**

`/results` 에서 results phase일 때 선택지별 해설이 올바르게 표시되는지 확인한다.

- [ ] **Step 4: Commit**

```bash
git add lib/scenarios.ts
git commit -m "content: scenario.md/explain.md 기반으로 scenarios.ts 내용 업데이트"
```
