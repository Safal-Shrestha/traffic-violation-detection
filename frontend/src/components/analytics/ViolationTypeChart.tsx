import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import type { ViolationTypeCount } from '../../types/analytics'

interface ViolationTypeChartProps {
  data: ViolationTypeCount[]
}

function ViolationTypeChart({
  data,
}: ViolationTypeChartProps) {
  return (
    <section className="analytics-chart-card">
      <div className="analytics-chart-header">
        <div>
          <h2>Violations by Type</h2>
        </div>
      </div>

      <div className="analytics-chart">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <BarChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-color)"
            />

            <XAxis
              dataKey="type"
              stroke="var(--text-secondary)"
              fontSize={10}
            />

            <YAxis
              stroke="var(--text-secondary)"
              fontSize={11}
            />

            <Tooltip
              contentStyle={{
                backgroundColor:
                  'var(--bg-primary)',
                border:
                  '1px solid var(--border-color)',
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

            <Bar
              dataKey="count"
              fill="currentColor"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default ViolationTypeChart