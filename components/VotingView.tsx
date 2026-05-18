'use client'

import { useState } from 'react'
import { Scenario } from '@/lib/scenarios'
import { supabase } from '@/lib/supabase'

interface Props {
  scenario: Scenario
  stage: number
  round: number
  firstChoiceWinner: number | null
}

export default function VotingView({ scenario, stage, round, firstChoiceWinner }: Props) {
  const votedKey = `voted_stage_${stage}_round_${round}`
  const [voted, setVoted] = useState(() =>
    typeof window !== 'undefined' ? !!localStorage.getItem(votedKey) : false
  )

  const choices: string[] =
    round === 1
      ? scenario.firstChoices.map((fc) => fc.text)
      : (() => {
          if (firstChoiceWinner === null) return []
          const result = scenario.firstChoices[firstChoiceWinner].result
          return result.kind === 'second' ? result.choices : []
        })()

  async function handleVote(choice: string) {
    if (voted) return
    await supabase.from('votes').insert({ stage, round, choice })
    localStorage.setItem(votedKey, '1')
    setVoted(true)
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">{scenario.title}</h2>
      {round === 1 && scenario.image && (
        <img
          src={scenario.image}
          alt={scenario.title}
          className="w-full rounded-xl object-cover max-h-64"
        />
      )}
      <div className="space-y-3 mt-6">
        {choices.map((choice) => (
          <button
            key={choice}
            onClick={() => handleVote(choice)}
            disabled={voted}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all font-medium text-base ${
              voted
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-blue-400 bg-white text-gray-900 hover:border-blue-600 hover:bg-blue-50 active:bg-blue-100 cursor-pointer shadow-sm'
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
