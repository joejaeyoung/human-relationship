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
    if (s.round === 1) return scenario.firstRound.choices.map((c) => c.text)
    return scenario.secondRound.choices.map((c) => c.text)
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
  const { round = 1, phase } = session ?? {}

  const isResults = phase === 'results'

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

          {/* 이론 개요 */}
          {isResults && (
            <div className="p-6 bg-blue-100 rounded-xl space-y-3 border border-blue-200">
              <p className="font-bold text-blue-900 text-xl">{scenario.theory}</p>
              <p className="text-blue-900 whitespace-pre-line text-sm leading-relaxed">
                {scenario.theoryDetail}
              </p>
            </div>
          )}

          {/* Round 1: 모든 1차 선택지 해설 */}
          {isResults && round === 1 && (
            <div className="space-y-4">
              <p className="font-bold text-gray-900 text-lg border-b border-gray-200 pb-2">선택지별 해설</p>
              {scenario.firstRound.choices.map((c, i) => (
                <div key={i} className="p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">선택지 {i + 1}</p>
                  <p className="text-gray-900 text-sm leading-relaxed font-medium">{c.text}</p>
                  <p className="text-gray-700 whitespace-pre-line text-sm leading-relaxed border-t border-gray-200 pt-3">{c.theory}</p>
                </div>
              ))}
            </div>
          )}

          {/* Round 2: 모든 엔딩 + 해설 */}
          {isResults && round === 2 && (
            <div className="space-y-4">
              <p className="font-bold text-gray-900 text-lg border-b border-gray-200 pb-2">엔딩 결과</p>
              {scenario.secondRound.choices.map((c, i) => (
                <div key={i} className="p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">선택지 {i + 1}</p>
                  <p className="text-gray-900 text-sm leading-relaxed font-medium italic opacity-70">{c.text}</p>
                  <p className="text-gray-900 whitespace-pre-line text-sm font-medium border-t border-gray-200 pt-3">{c.responseText}</p>
                  <p className="text-gray-700 whitespace-pre-line text-sm leading-relaxed border-t border-gray-200 pt-3">{c.theory}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
