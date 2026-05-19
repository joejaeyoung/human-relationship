'use client'

import { useEffect, useState } from 'react'
import { supabase, SessionState } from '@/lib/supabase'
import { scenarios, Scenario } from '@/lib/scenarios'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [session, setSession] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(false)
  const [phaseJustChanged, setPhaseJustChanged] = useState(false)

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
    setPhaseJustChanged(true)
    const { error } = await supabase.from('session_state').update(patch).eq('id', 1)
    if (error) alert(`업데이트 실패: ${error.message}`)
    setLoading(false)
    setTimeout(() => setPhaseJustChanged(false), 1500)
  }

  async function resetAll() {
    if (!confirm('모든 투표 기록을 삭제하고 처음부터 시작할까요?')) return
    setLoading(true)
    const { error: votesError } = await supabase.from('votes').delete().gte('stage', 0)
    if (votesError) alert(`투표 삭제 실패: ${votesError.message}`)
    const { error: sessionError } = await supabase.from('session_state').update({
      current_stage: 0,
      phase: 'intro',
      round: 1,
      first_choice_winner: null,
      second_choice_winner: null,
    }).eq('id', 1)
    if (sessionError) alert(`초기화 실패: ${sessionError.message}`)
    setLoading(false)
  }

  async function endVoting() {
    if (!session) return
    const scenario = scenarios[session.current_stage]
    if (session.round === 2 && session.first_choice_winner === null) {
      alert('1차 투표 결과가 없습니다. 처음부터 다시 진행해주세요.')
      return
    }
    const choices =
      session.round === 1
        ? scenario.firstChoices.map((fc) => fc.text)
        : getSecondChoices(scenario, session.first_choice_winner!)

    const { data } = await supabase
      .from('votes')
      .select('choice')
      .eq('stage', session.current_stage)
      .eq('round', session.round)

    const counts = choices.map((c, i) => ({
      i,
      count: data?.filter((v) => v.choice === c).length ?? 0,
    }))
    const winner = counts.reduce((a, b) => (b.count > a.count ? b : a)).i

    const patch: Partial<SessionState> = { phase: 'results' }
    if (session.round === 1) patch.first_choice_winner = winner
    else patch.second_choice_winner = winner

    await updateSession(patch)
  }

  function getSecondChoices(scenario: Scenario, firstChoiceWinner: number): string[] {
    const fc = scenario.firstChoices[firstChoiceWinner]
    if (!fc) return []
    return fc.result.kind === 'second' ? fc.result.choices : []
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
  const fcWinner = session.first_choice_winner
  const hasSecondRound =
    fcWinner !== null && scenario?.firstChoices[fcWinner]?.result.kind === 'second'
  const immediateResult =
    fcWinner !== null && scenario?.firstChoices[fcWinner]?.result.kind === 'immediate'
      ? (scenario.firstChoices[fcWinner].result as { kind: 'immediate'; type: string; text: string })
      : null

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">발표자 콘솔</h1>

        <div className="bg-white rounded-xl p-6 space-y-2 shadow">
          <p className="text-sm font-semibold text-gray-700">
            Stage {session.current_stage + 1} / {scenarios.length}
            {scenario && <span className="ml-2 text-blue-600">· {session.round}차 투표</span>}
          </p>
          <p className="font-bold text-xl text-gray-900">{scenario?.title ?? '발표 종료'}</p>
          <p className="text-blue-700 font-bold text-lg">현재 단계: {session.phase}</p>
        </div>

        {/* 시나리오 바로가기 */}
        <div className="bg-white rounded-xl p-4 shadow space-y-2">
          <p className="text-sm font-semibold text-gray-700">시나리오 바로가기</p>
          <div className="grid gap-2">
            {scenarios.map((s, i) => (
              <button
                key={i}
                onClick={() => updateSession({
                  current_stage: i,
                  phase: 'intro',
                  round: 1,
                  first_choice_winner: null,
                  second_choice_winner: null,
                })}
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

        {/* 메인 컨트롤 */}
        <div className="grid gap-3">
          {session.phase === 'intro' && (
            <button
              onClick={() => updateSession({ phase: 'voting' })}
              disabled={loading || phaseJustChanged}
              className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
            >
              {session.round === 1 ? '투표 시작' : '2차 투표 시작'}
            </button>
          )}

          {session.phase === 'voting' && (
            <button
              onClick={endVoting}
              disabled={loading || phaseJustChanged}
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
            >
              투표 완료
            </button>
          )}

          {session.phase === 'results' && session.round === 1 && (
            <>
              {immediateResult && (
                <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-red-800 text-sm whitespace-pre-line">
                  <p className="font-bold mb-1">Bad End</p>
                  {immediateResult.text}
                </div>
              )}
              {hasSecondRound && (
                <button
                  onClick={() => updateSession({ phase: 'intro', round: 2 })}
                  disabled={loading || phaseJustChanged}
                  className="w-full bg-purple-600 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
                >
                  2차 선택지로 →
                </button>
              )}
              {(immediateResult || (!hasSecondRound && fcWinner !== null)) && (
                <button
                  onClick={() =>
                    updateSession({
                      current_stage: session.current_stage + 1,
                      phase: 'intro',
                      round: 1,
                      first_choice_winner: null,
                      second_choice_winner: null,
                    })
                  }
                  disabled={loading || isLast || phaseJustChanged}
                  className="w-full bg-gray-700 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
                >
                  {isLast ? '마지막 시나리오' : '다음 시나리오 →'}
                </button>
              )}
            </>
          )}

          {session.phase === 'results' && session.round === 2 && (
            <button
              onClick={() =>
                updateSession({
                  current_stage: session.current_stage + 1,
                  phase: 'intro',
                  round: 1,
                  first_choice_winner: null,
                  second_choice_winner: null,
                })
              }
              disabled={loading || isLast || phaseJustChanged}
              className="w-full bg-gray-700 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
            >
              {isLast ? '마지막 시나리오' : '다음 시나리오 →'}
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 shadow text-sm text-gray-900 space-y-1">
          <p>청중 페이지: <span className="font-mono">/</span></p>
          <p>결과 페이지: <span className="font-mono">/results</span></p>
        </div>

        <button
          onClick={resetAll}
          disabled={loading}
          className="w-full border-2 border-red-400 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          전체 초기화 (처음부터 시작)
        </button>
      </div>
    </main>
  )
}
