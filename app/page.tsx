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

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      {session.phase === 'intro' && <ScenarioView scenario={scenario} />}
      {session.phase === 'voting' && (
        <VotingView scenario={scenario} stage={session.current_stage} />
      )}
      {session.phase === 'results' && (
        <div className="max-w-xl mx-auto p-6 text-center space-y-4">
          <h2 className="text-2xl font-bold">{scenario.title}</h2>
          <p className="text-gray-900">발표자 화면에서 결과를 확인하세요!</p>
        </div>
      )}
    </main>
  )
}
