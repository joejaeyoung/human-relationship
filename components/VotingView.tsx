'use client'

import { useState } from 'react'
import { Scenario } from '@/lib/scenarios'
import { supabase } from '@/lib/supabase'

interface Props {
  scenario: Scenario
  stage: number
  round: number
}

export default function VotingView({ scenario, stage, round }: Props) {
  const votedKey = `voted_stage_${stage}_round_${round}`
  const [voted, setVoted] = useState(() =>
    typeof window !== 'undefined' ? !!localStorage.getItem(votedKey) : false
  )
  const [votedIndex, setVotedIndex] = useState<number | null>(null)

  const currentRound = round === 1 ? scenario.firstRound : scenario.secondRound
  const choices = currentRound.choices

  function getResponseText(): string {
    if (votedIndex === null) return ''
    return currentRound.choices[votedIndex]?.responseText ?? ''
  }

  async function handleVote(choice: string, index: number) {
    if (voted) return
    const { error } = await supabase.from('votes').insert({ stage, round, choice })
    if (error) { console.error('투표 저장 실패:', error); return }
    localStorage.setItem(votedKey, '1')
    setVoted(true)
    setVotedIndex(index)
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">{scenario.title}</h2>
      {currentRound.image && (
        <img
          src={currentRound.image}
          alt={scenario.title}
          className="w-full rounded-xl object-cover max-h-64"
        />
      )}
      <div className="space-y-3 mt-6">
        {choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => handleVote(choice.text, i)}
            disabled={voted}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all font-medium text-base ${
              voted
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-blue-400 bg-white text-gray-900 hover:border-blue-600 hover:bg-blue-50 active:bg-blue-100 cursor-pointer shadow-sm'
            }`}
          >
            {choice.text}
          </button>
        ))}
      </div>
      {voted && votedIndex !== null && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-gray-900 whitespace-pre-line leading-relaxed text-base">
            {getResponseText()}
          </p>
        </div>
      )}
    </div>
  )
}
