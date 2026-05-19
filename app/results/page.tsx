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

  function getChoices(s: SessionState): string[] {
    const scenario = scenarios[s.current_stage]
    if (!scenario) return []
    if (s.round === 1) return scenario.firstChoices.map((fc) => fc.text)
    if (s.first_choice_winner === null) return []
    return scenario.firstChoices[s.first_choice_winner].result.choices
  }

  useEffect(() => {
    supabase
      .from('session_state')
      .select('*')
      .single()
      .then(({ data }) => {
        if (data) {
          setSession(data)
          if (data.phase !== 'intro') {
            fetchVotes(data.current_stage, getChoices(data))
          } else {
            setVoteCounts([])
          }
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
          if (next.phase === 'intro') {
            setVoteCounts([])
          } else {
            fetchVotes(next.current_stage, getChoices(next))
          }
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
            .select('*')
            .single()
            .then(({ data }) => {
              if (data) fetchVotes(data.current_stage, getChoices(data))
            })
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'votes' },
        () => setVoteCounts([])
      )
      .subscribe()

    return () => {
      supabase.removeChannel(sessionChannel)
      supabase.removeChannel(votesChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scenario = session ? scenarios[session.current_stage] : null
  const { round = 1, first_choice_winner: fcW = null, second_choice_winner: scW = null, phase } = session ?? {}

  // 1차 결과: 이긴 선택지의 이론 해석
  const firstChoiceTheory =
    phase === 'results' && round === 1 && fcW !== null && scenario
      ? scenario.firstChoices[fcW]?.theory ?? null
      : null

  // 2차 결과: 스토리 결과 + 이론 해석
  const outcome =
    phase === 'results' && round === 2 && fcW !== null && scW !== null && scenario
      ? scenario.firstChoices[fcW]?.result.outcomes[scW] ?? null
      : null

  const outcomeColors = {
    best: 'bg-green-50 border-green-400 text-green-900',
    normal: 'bg-yellow-50 border-yellow-400 text-yellow-900',
  }
  const outcomeLabels = { best: '✓ Best End', normal: '→ Normal End' }

  return (
    <main className="min-h-screen bg-white p-8">
      {!scenario ? (
        <p className="text-center text-gray-900">연결 중...</p>
      ) : (
        <div className="max-w-2xl mx-auto space-y-8">
          <h1 className="text-3xl font-bold text-center">{scenario.title}</h1>
          {session && (
            <p className="text-center text-gray-500 text-sm">
              {session.round}차 투표 결과
            </p>
          )}

          <ResultsChart data={voteCounts} />

          {/* 2차 결과: 스토리 아웃컴 */}
          {outcome && (
            <div className={`p-6 rounded-xl border-2 ${outcomeColors[outcome.type]}`}>
              <p className="font-bold text-lg mb-2">{outcomeLabels[outcome.type]}</p>
              <p className="whitespace-pre-line leading-relaxed">{outcome.text}</p>
            </div>
          )}

          {/* 1차: 선택지 이론 해석 / 2차: 아웃컴 이론 해석 */}
          {(firstChoiceTheory || outcome?.theory) && (
            <div className="p-6 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
              <p className="font-bold text-amber-900 text-base">🔍 이론적 해석</p>
              <p className="text-amber-900 whitespace-pre-line text-sm leading-relaxed">
                {firstChoiceTheory ?? outcome?.theory}
              </p>
            </div>
          )}

          {/* 이론 개요 */}
          <div className="p-6 bg-blue-100 rounded-xl space-y-3 border border-blue-200">
            <p className="font-bold text-blue-900 text-xl">{scenario.theory}</p>
            <p className="text-blue-900 whitespace-pre-line text-base font-medium">
              {scenario.theoryDetail}
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
