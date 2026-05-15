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
