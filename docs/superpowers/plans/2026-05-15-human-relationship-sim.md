# 직장 내 인간관계 시뮬레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 발표자가 어드민에서 시나리오 단계를 제어하고 청중이 실시간으로 투표하는 웹앱을 만든다.

**Architecture:** Next.js App Router로 3개 페이지(청중/어드민/결과)를 구성하고, Supabase Realtime으로 session_state 변경을 청중 화면에 즉시 반영한다. 시나리오 데이터는 `lib/scenarios.ts`에서 관리해 DB 없이 콘텐츠를 수정할 수 있다.

**Tech Stack:** Next.js 15, Supabase (Postgres + Realtime), Recharts, Tailwind CSS, Vercel

---

## Task 1: 프로젝트 초기 설정

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `app/layout.tsx`, `.env.local`

- [ ] **Step 1: Next.js 앱 생성**

```bash
cd /Users/jojaeyoung/Desktop/Project/human_relationship
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

- [ ] **Step 2: 의존성 추가 설치**

```bash
npm install @supabase/supabase-js recharts
```

- [ ] **Step 3: .env.local 생성**

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=여기에_Supabase_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_anon_key
NEXT_PUBLIC_ADMIN_PASSWORD=1234
EOF
```

Supabase URL과 anon key는 Task 2 완료 후 채운다.

- [ ] **Step 4: 빌드 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` → Next.js 기본 페이지 뜨면 OK.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: Next.js 프로젝트 초기 설정"
```

---

## Task 2: Supabase 테이블 설정

**Files:**
- Create: `supabase/schema.sql` (참고용)

- [ ] **Step 1: Supabase 프로젝트 생성**

1. https://supabase.com → New Project 생성
2. Project Settings → API → `URL`과 `anon public key` 복사
3. `.env.local`에 붙여넣기

- [ ] **Step 2: 테이블 생성 SQL 실행**

Supabase 대시보드 → SQL Editor에서 아래 SQL 실행:

```sql
-- 세션 상태 테이블 (단일 row)
create table session_state (
  id int primary key default 1,
  current_stage int default 0,
  phase text default 'intro',
  constraint single_row check (id = 1)
);

-- 초기 row 삽입
insert into session_state (id, current_stage, phase) values (1, 0, 'intro');

-- 투표 테이블
create table votes (
  id uuid primary key default gen_random_uuid(),
  stage int not null,
  choice text not null,
  created_at timestamptz default now()
);

-- Realtime 활성화
alter publication supabase_realtime add table session_state;
alter publication supabase_realtime add table votes;

-- RLS 정책 (anon 키로 읽기/쓰기 허용)
alter table session_state enable row level security;
create policy "read session" on session_state for select using (true);
create policy "update session" on session_state for update using (true);

alter table votes enable row level security;
create policy "read votes" on votes for select using (true);
create policy "insert votes" on votes for insert with check (true);
```

- [ ] **Step 3: 테이블 확인**

SQL Editor에서:
```sql
select * from session_state;
```
`{ id: 1, current_stage: 0, phase: 'intro' }` row가 보이면 OK.

- [ ] **Step 4: schema.sql 저장 (참고용)**

```bash
mkdir -p supabase
cat > supabase/schema.sql << 'EOF'
-- 위 SQL 내용 그대로
EOF
```

- [ ] **Step 5: 커밋**

```bash
git add supabase/schema.sql .env.local
git commit -m "feat: Supabase 테이블 스키마 설정"
```

---

## Task 3: 핵심 라이브러리 파일

**Files:**
- Create: `lib/supabase.ts`
- Create: `lib/scenarios.ts`

- [ ] **Step 1: Supabase 클라이언트 생성**

`lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Phase = 'intro' | 'voting' | 'results'

export interface SessionState {
  id: number
  current_stage: number
  phase: Phase
}

export interface Vote {
  id: string
  stage: number
  choice: string
  created_at: string
}
```

- [ ] **Step 2: 시나리오 데이터 파일 생성**

`lib/scenarios.ts`:
```ts
export interface Scenario {
  title: string
  description: string
  choices: string[]
  theory: string
  theoryDetail: string
}

export const scenarios: Scenario[] = [
  {
    title: "Stage 1: 퇴근 직전 상사의 업무 지시",
    description:
      "오후 6시, 퇴근 5분 전. 팀장이 다가와 말한다.\n\"이 보고서 오늘 밤까지 완성해줘. 내일 아침 9시 임원 보고야.\"\n\n당신의 개인 약속이 있고, 이 업무는 사전에 공지되지 않았다.\n어떻게 반응하겠습니까?",
    choices: [
      "A. 알겠습니다, 오늘 밤 완성하겠습니다.",
      "B. 오늘은 어렵습니다. 내일 아침 일찍 출근해서 하겠습니다.",
      "C. 왜 이렇게 갑자기요? 미리 말씀해주셨어야죠.",
    ],
    theory: "나-전달법 (I-Message)",
    theoryDetail:
      "나-전달법은 상대방을 비난하지 않고 자신의 감정과 상황을 전달하는 방식입니다.\n예: '오늘 밤은 제가 선약이 있어서 어렵습니다. 내일 아침 일찍 출근해서 완성하겠습니다.'",
  },
  {
    title: "Stage 2: 동료의 업무 경계 침범",
    description:
      "같은 팀 동료 A가 당신의 담당 클라이언트에게 직접 연락해 업무를 진행했다.\n당신은 뒤늦게 이 사실을 알았다.\n\n어떻게 대응하겠습니까?",
    choices: [
      "A. 그냥 넘어간다. 어차피 일이 됐으니까.",
      "B. A에게 직접 조용히 얘기한다.",
      "C. 팀장에게 보고한다.",
    ],
    theory: "조해리의 창 (Johari Window)",
    theoryDetail:
      "조해리의 창에서 '열린 창'을 넓히는 것이 건강한 소통의 핵심입니다.\n직접 대화를 통해 서로의 업무 영역에 대한 이해를 공유하는 것이 갈등 예방의 첫걸음입니다.",
  },
  {
    title: "Stage 3: 강압적인 회식 분위기",
    description:
      "팀 회식 자리. 팀장이 \"오늘은 다 같이 2차 가야지!\"라고 말한다.\n주변 동료들도 분위기에 맞춰 동의한다.\n당신은 피곤하고 술을 마시고 싶지 않다.\n\n어떻게 하겠습니까?",
    choices: [
      "A. 분위기상 따라간다.",
      "B. \"저는 몸이 좀 안 좋아서 먼저 들어가겠습니다\" 하고 빠진다.",
      "C. \"저는 괜찮습니다\" 하고 명확히 거절한다.",
    ],
    theory: "동조 현상 & 비폭력 대화 (NVC)",
    theoryDetail:
      "집단 압력에 의한 동조(Conformity)는 자신의 의사와 무관하게 행동을 바꾸게 합니다.\n비폭력 대화(NVC)는 관찰-감정-욕구-부탁의 4단계로 자신의 입장을 명확히 전달합니다.",
  },
]
```

- [ ] **Step 3: 시나리오 데이터 확인**

```bash
node -e "const s = require('./lib/scenarios.ts'); console.log(s.scenarios.length)"
```

→ 위 명령이 안 되면 그냥 파일이 저장됐는지 확인만 해도 됨.

- [ ] **Step 4: 커밋**

```bash
git add lib/
git commit -m "feat: Supabase 클라이언트 + 시나리오 데이터 추가"
```

---

## Task 4: 컴포넌트 — ScenarioView, VotingView, ResultsChart

**Files:**
- Create: `components/ScenarioView.tsx`
- Create: `components/VotingView.tsx`
- Create: `components/ResultsChart.tsx`

- [ ] **Step 1: ScenarioView 컴포넌트**

`components/ScenarioView.tsx`:
```tsx
import { Scenario } from '@/lib/scenarios'

export default function ScenarioView({ scenario }: { scenario: Scenario }) {
  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">{scenario.title}</h2>
      <p className="text-gray-600 whitespace-pre-line leading-relaxed text-lg">
        {scenario.description}
      </p>
      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-blue-700 text-sm">
        잠시 후 선택지가 활성화됩니다...
      </div>
    </div>
  )
}
```

- [ ] **Step 2: VotingView 컴포넌트**

`components/VotingView.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Scenario } from '@/lib/scenarios'
import { supabase } from '@/lib/supabase'

interface Props {
  scenario: Scenario
  stage: number
}

export default function VotingView({ scenario, stage }: Props) {
  const votedKey = `voted_stage_${stage}`
  const [voted, setVoted] = useState(() =>
    typeof window !== 'undefined' ? !!localStorage.getItem(votedKey) : false
  )

  async function handleVote(choice: string) {
    if (voted) return
    await supabase.from('votes').insert({ stage, choice })
    localStorage.setItem(votedKey, '1')
    setVoted(true)
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">{scenario.title}</h2>
      <p className="text-gray-600 whitespace-pre-line leading-relaxed">
        {scenario.description}
      </p>
      <div className="space-y-3 mt-6">
        {scenario.choices.map((choice) => (
          <button
            key={choice}
            onClick={() => handleVote(choice)}
            disabled={voted}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              voted
                ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
            }`}
          >
            {choice}
          </button>
        ))}
      </div>
      {voted && (
        <p className="text-center text-green-600 font-medium mt-4">
          투표 완료! 결과를 기다려주세요.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: ResultsChart 컴포넌트**

`components/ResultsChart.tsx`:
```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface ChartData {
  choice: string
  count: number
}

export default function ResultsChart({ data }: { data: ChartData[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

  return (
    <div className="w-full space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 40 }}>
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="choice" width={200} tick={{ fontSize: 13 }} />
          <Tooltip
            formatter={(value: number) =>
              [`${value}표 (${total ? Math.round((value / total) * 100) : 0}%)`, '']
            }
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-center text-gray-500 text-sm">총 {total}명 참여</p>
    </div>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add components/
git commit -m "feat: ScenarioView, VotingView, ResultsChart 컴포넌트 추가"
```

---

## Task 5: 청중 페이지 (`/`)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 청중 페이지 구현**

`app/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase, SessionState } from '@/lib/supabase'
import { scenarios } from '@/lib/scenarios'
import ScenarioView from '@/components/ScenarioView'
import VotingView from '@/components/VotingView'

export default function AudiencePage() {
  const [session, setSession] = useState<SessionState | null>(null)

  useEffect(() => {
    // 초기 상태 로드
    supabase
      .from('session_state')
      .select('*')
      .single()
      .then(({ data }) => setSession(data))

    // Realtime 구독
    const channel = supabase
      .channel('session')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'session_state' },
        (payload) => setSession(payload.new as SessionState)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        연결 중...
      </div>
    )
  }

  const scenario = scenarios[session.current_stage]

  if (!scenario) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-2xl font-bold text-gray-700">발표가 종료되었습니다. 감사합니다!</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      {session.phase === 'intro' && <ScenarioView scenario={scenario} />}
      {session.phase === 'voting' && (
        <VotingView scenario={scenario} stage={session.current_stage} />
      )}
      {session.phase === 'results' && (
        <div className="max-w-xl mx-auto p-6 text-center space-y-4">
          <h2 className="text-2xl font-bold">{scenario.title}</h2>
          <p className="text-gray-600">발표자 화면에서 결과를 확인하세요!</p>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: 동작 확인**

```bash
npm run dev
```

`http://localhost:3000` 접속 → "연결 중..." 후 시나리오 텍스트 표시되면 OK.

Supabase SQL Editor에서 `update session_state set phase = 'voting' where id = 1;` 실행 → 새로고침 없이 선택지 버튼 나타나면 Realtime OK.

- [ ] **Step 3: 커밋**

```bash
git add app/page.tsx
git commit -m "feat: 청중 페이지 구현 (Realtime 연동)"
```

---

## Task 6: 결과 대시보드 페이지 (`/results`)

**Files:**
- Create: `app/results/page.tsx`

- [ ] **Step 1: 결과 페이지 구현**

`app/results/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase, SessionState } from '@/lib/supabase'
import { scenarios } from '@/lib/scenarios'
import ResultsChart from '@/components/ResultsChart'

export default function ResultsPage() {
  const [session, setSession] = useState<SessionState | null>(null)
  const [voteCounts, setVoteCounts] = useState<{ choice: string; count: number }[]>([])

  async function fetchVotes(stage: number, choices: string[]) {
    const { data } = await supabase
      .from('votes')
      .select('choice')
      .eq('stage', stage)

    const counts = choices.map((choice) => ({
      choice,
      count: data?.filter((v) => v.choice === choice).length ?? 0,
    }))
    setVoteCounts(counts)
  }

  useEffect(() => {
    supabase
      .from('session_state')
      .select('*')
      .single()
      .then(({ data }) => {
        if (data) {
          setSession(data)
          fetchVotes(data.current_stage, scenarios[data.current_stage]?.choices ?? [])
        }
      })

    const sessionChannel = supabase
      .channel('results-session')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'session_state' },
        (payload) => {
          const next = payload.new as SessionState
          setSession(next)
          fetchVotes(next.current_stage, scenarios[next.current_stage]?.choices ?? [])
        }
      )
      .subscribe()

    const votesChannel = supabase
      .channel('results-votes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes' },
        () => {
          supabase
            .from('session_state')
            .select('current_stage')
            .single()
            .then(({ data }) => {
              if (data) fetchVotes(data.current_stage, scenarios[data.current_stage]?.choices ?? [])
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(sessionChannel)
      supabase.removeChannel(votesChannel)
    }
  }, [])

  const scenario = session ? scenarios[session.current_stage] : null

  return (
    <main className="min-h-screen bg-white p-8">
      {!scenario ? (
        <p className="text-center text-gray-500">연결 중...</p>
      ) : (
        <div className="max-w-2xl mx-auto space-y-8">
          <h1 className="text-3xl font-bold text-center">{scenario.title}</h1>
          <ResultsChart data={voteCounts} />
          <div className="p-6 bg-blue-50 rounded-xl space-y-2">
            <p className="font-bold text-blue-800 text-lg">{scenario.theory}</p>
            <p className="text-blue-700 whitespace-pre-line">{scenario.theoryDetail}</p>
          </div>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: 동작 확인**

`http://localhost:3000/results` 접속 → 차트와 이론 피드백 표시 확인.

Supabase에서 votes에 테스트 데이터 삽입:
```sql
insert into votes (stage, choice) values
  (0, 'A. 알겠습니다, 오늘 밤 완성하겠습니다.'),
  (0, 'B. 오늘은 어렵습니다. 내일 아침 일찍 출근해서 하겠습니다.'),
  (0, 'B. 오늘은 어렵습니다. 내일 아침 일찍 출근해서 하겠습니다.');
```

차트에 B가 2표로 표시되면 OK.

- [ ] **Step 3: 커밋**

```bash
git add app/results/
git commit -m "feat: 결과 대시보드 페이지 구현"
```

---

## Task 7: 어드민 페이지 (`/admin`)

**Files:**
- Create: `app/admin/page.tsx`

- [ ] **Step 1: 어드민 페이지 구현**

`app/admin/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase, SessionState } from '@/lib/supabase'
import { scenarios } from '@/lib/scenarios'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [session, setSession] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(false)

  function login() {
    if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) setAuthed(true)
    else alert('비밀번호가 틀렸습니다.')
  }

  useEffect(() => {
    if (!authed) return
    supabase.from('session_state').select('*').single().then(({ data }) => setSession(data))
    const ch = supabase
      .channel('admin-session')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'session_state' },
        (payload) => setSession(payload.new as SessionState))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [authed])

  async function updateSession(patch: Partial<SessionState>) {
    setLoading(true)
    await supabase.from('session_state').update(patch).eq('id', 1)
    setLoading(false)
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-bold">발표자 관리 페이지</h1>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="비밀번호"
            className="border rounded px-4 py-2 text-center"
          />
          <button onClick={login} className="block w-full bg-blue-600 text-white py-2 rounded">
            입장
          </button>
        </div>
      </div>
    )
  }

  if (!session) return <p className="p-8 text-center">로딩 중...</p>

  const scenario = scenarios[session.current_stage]
  const isLast = session.current_stage >= scenarios.length - 1

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">발표자 콘솔</h1>

        <div className="bg-white rounded-xl p-6 space-y-2 shadow">
          <p className="text-sm text-gray-500">
            Stage {session.current_stage + 1} / {scenarios.length}
          </p>
          <p className="font-bold text-lg">{scenario?.title ?? '발표 종료'}</p>
          <p className="text-blue-600 font-medium">현재 단계: {session.phase}</p>
        </div>

        <div className="grid gap-3">
          {session.phase === 'intro' && (
            <button
              onClick={() => updateSession({ phase: 'voting' })}
              disabled={loading}
              className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
            >
              투표 시작
            </button>
          )}
          {session.phase === 'voting' && (
            <button
              onClick={() => updateSession({ phase: 'results' })}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
            >
              결과 보기
            </button>
          )}
          {session.phase === 'results' && (
            <button
              onClick={() =>
                updateSession({
                  current_stage: session.current_stage + 1,
                  phase: 'intro',
                })
              }
              disabled={loading || isLast}
              className="w-full bg-purple-600 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
            >
              {isLast ? '마지막 시나리오' : '다음 시나리오 →'}
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 shadow text-sm text-gray-600 space-y-1">
          <p>청중 페이지: <span className="font-mono">/</span></p>
          <p>결과 페이지: <span className="font-mono">/results</span></p>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 동작 확인**

`http://localhost:3000/admin` → 비밀번호(1234) 입력 → 버튼 클릭 시 청중 페이지(`/`) 자동 전환 확인.

전체 플로우 테스트:
1. 탭 3개 오픈: `/`, `/admin`, `/results`
2. 어드민에서 "투표 시작" → 청중 페이지 선택지 활성화 확인
3. 청중 페이지에서 선택 → 결과 페이지 차트 실시간 업데이트 확인
4. "결과 보기" → "다음 시나리오" 반복

- [ ] **Step 3: 커밋**

```bash
git add app/admin/
git commit -m "feat: 발표자 어드민 페이지 구현"
```

---

## Task 8: Vercel 배포

**Files:**
- (없음, Vercel 대시보드에서 설정)

- [ ] **Step 1: GitHub에 push**

```bash
git push -u origin main
```

- [ ] **Step 2: Vercel 프로젝트 연결**

1. https://vercel.com → New Project
2. `joejaeyoung/human-relationship` 레포 import
3. Framework: Next.js (자동 감지)
4. **Environment Variables** 설정:
   - `NEXT_PUBLIC_SUPABASE_URL` = Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key
   - `NEXT_PUBLIC_ADMIN_PASSWORD` = 발표용 비밀번호
5. Deploy 클릭

- [ ] **Step 3: 배포 확인**

배포 완료 후 Vercel 도메인(예: `human-relationship.vercel.app`)에서:
- `/` → 청중 페이지 정상 로드
- `/admin` → 비밀번호 게이트 표시
- `/results` → 결과 대시보드 표시

- [ ] **Step 4: QR 코드 생성**

청중 배포 URL로 QR 코드 생성 (구글에서 "QR 코드 생성기" 검색).
발표 슬라이드에 삽입.

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "chore: Vercel 배포 완료"
git push
```
