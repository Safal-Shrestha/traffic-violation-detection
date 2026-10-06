import {LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer,} from 'recharts'

import type { ViolationTrend } from '../../types/analytics'

interface ViolationTrendChartProps {
  data: ViolationTrend[]
}

function ViolationTrendChart({
  data,
}: ViolationTrendChartProps) {
  return (
    <section className="analytics-chart-card analytics-trend-card">
      <div className="analytics-chart-header">
        <div>
          <h2>Violation Trends</h2>
          <p>Detected violations over the last seven days</p>
        </div>
      </div>

      <div className="analytics-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-color)"
            />

            <XAxis
              dataKey="date"
              stroke="var(--text-secondary)"
              fontSize={11}
            />

            <YAxis
              stroke="var(--text-secondary)"
              fontSize={11}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '7px',
                color: 'var(--text-primary)',
              }}
              labelStyle={{
                color: 'var(--text-primary)',
              }}
              itemStyle={{
                color: 'var(--text-primary)',
              }}
            />

            <Line
              type="monotone"
              dataKey="violations"
              stroke="currentColor"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default ViolationTrendChart