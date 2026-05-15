'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface ChartData {
  choice: string
  count: number
}

export default function ResultsChart({ data }: { data: ChartData[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

  return (
    <div className="w-full space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 40 }}>
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="choice" width={200} tick={{ fontSize: 13 }} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => {
              const num = typeof value === 'number' ? value : 0
              return [`${num}표 (${total ? Math.round((num / total) * 100) : 0}%)`, '']
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-center text-gray-500 text-sm">총 {total}명 참여</p>
    </div>
  )
}
