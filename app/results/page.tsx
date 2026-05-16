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
          <div className="p-6 bg-blue-100 rounded-xl space-y-3 border border-blue-200">
            <p className="font-bold text-blue-900 text-xl">{scenario.theory}</p>
            <p className="text-blue-900 whitespace-pre-line text-base font-medium">{scenario.theoryDetail}</p>
          </div>
        </div>
      )}
    </main>
  )
}
