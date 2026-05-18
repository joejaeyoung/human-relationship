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

  const { phase, round, first_choice_winner } = session

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
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-xl font-medium text-gray-600">발표자 화면에서 결과를 확인하세요!</p>
        </div>
      )}
    </main>
  )
}
