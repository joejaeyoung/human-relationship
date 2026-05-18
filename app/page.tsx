'use client'

import { useEffect, useState } from 'react'
import { supabase, SessionState } from '@/lib/supabase'
import { scenarios } from '@/lib/scenarios'
import ScenarioView from '@/components/ScenarioView'
import VotingView from '@/components/VotingView'

export default function AudiencePage() {
  const [session, setSession] = useState<SessionState | null>(null)

  useEffect(() => {
    supabase
      .from('session_state')
      .select('*')
      .single()
      .then(({ data }) => setSession(data))

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

  useEffect(() => {
    if (session?.phase === 'voting') {
      localStorage.removeItem(`voted_stage_${session.current_stage}_round_${session.round}`)
    }
  }, [session?.phase, session?.current_stage, session?.round])

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-900">
        연결 중...
      </div>
    )
  }

  const scenario = scenarios[session.current_stage]

  if (!scenario) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-2xl font-bold text-gray-900">발표가 종료되었습니다. 감사합니다!</p>
      </div>
    )
  }

  const { phase, round, first_choice_winner, second_choice_winner } = session

  // 최종 결과 텍스트 계산
  const outcomeText = (() => {
    if (phase !== 'results') return null
    if (round === 1 && first_choice_winner !== null) {
      const result = scenario.firstChoices[first_choice_winner].result
      if (result.kind === 'immediate') return { type: result.type, text: result.text }
    }
    if (round === 2 && first_choice_winner !== null && second_choice_winner !== null) {
      const result = scenario.firstChoices[first_choice_winner].result
      if (result.kind === 'second') return result.outcomes[second_choice_winner]
    }
    return null
  })()

  const outcomeColors = {
    best: 'bg-green-50 border-green-400 text-green-900',
    normal: 'bg-yellow-50 border-yellow-400 text-yellow-900',
    bad: 'bg-red-50 border-red-400 text-red-900',
  }
  const outcomeLabels = { best: 'Best End', normal: 'Normal End', bad: 'Bad End' }

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      {phase === 'intro' && (
        <ScenarioView
          scenario={scenario}
          round={round}
          firstChoiceWinner={first_choice_winner}
        />
      )}
      {phase === 'voting' && (
        <VotingView
          scenario={scenario}
          stage={session.current_stage}
          round={round}
          firstChoiceWinner={first_choice_winner}
        />
      )}
      {phase === 'results' && (
        <div className="max-w-xl mx-auto p-6 text-center space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">{scenario.title}</h2>
          {outcomeText ? (
            <div className={`p-5 rounded-xl border-2 text-left ${outcomeColors[outcomeText.type]}`}>
              <p className="font-bold text-sm mb-2">{outcomeLabels[outcomeText.type]}</p>
              <p className="whitespace-pre-line leading-relaxed">{outcomeText.text}</p>
            </div>
          ) : (
            <p className="text-gray-600">발표자 화면에서 결과를 확인하세요!</p>
          )}
        </div>
      )}
    </main>
  )
}
