import { Scenario } from '@/lib/scenarios'

interface Props {
  scenario: Scenario
  round: number
}

export default function ScenarioView({ scenario, round }: Props) {
  const description = round === 1
    ? scenario.firstRound.description
    : scenario.secondRound.description

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">{scenario.title}</h2>
      {scenario.image && (
        <img
          src={scenario.image}
          alt={scenario.title}
          className="w-full rounded-xl object-cover max-h-64"
        />
      )}
      <p className="text-gray-900 whitespace-pre-line leading-relaxed text-lg">
        {description}
      </p>
      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-blue-700 text-sm">
        잠시 후 선택지가 활성화됩니다...
      </div>
    </div>
  )
}
