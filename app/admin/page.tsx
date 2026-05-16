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
          <p className="text-sm font-semibold text-gray-700">
            Stage {session.current_stage + 1} / {scenarios.length}
          </p>
          <p className="font-bold text-xl text-gray-900">{scenario?.title ?? '발표 종료'}</p>
          <p className="text-blue-700 font-bold text-lg">현재 단계: {session.phase}</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow space-y-2">
          <p className="text-sm font-semibold text-gray-700">시나리오 바로가기</p>
          <div className="grid gap-2">
            {scenarios.map((s, i) => (
              <button
                key={i}
                onClick={() => updateSession({ current_stage: i, phase: 'intro' })}
                disabled={loading}
                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                  session.current_stage === i
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {i + 1}. {s.title}
              </button>
            ))}
          </div>
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
