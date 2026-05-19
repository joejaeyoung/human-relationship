import { Scenario } from '@/lib/scenarios'

interface Props {
  scenario: Scenario
  round: number
}

export default function ScenarioView({ scenario, round }: Props) {
  const currentRound = round === 1 ? scenario.firstRound : scenario.secondRound

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
      <p className="text-gray-900 whitespace-pre-line leading-relaxed text-lg">
        {currentRound.description}
      </p>
      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-blue-700 text-sm">
        잠시 후 선택지가 활성화됩니다...
      </div>
    </div>
  )
}
