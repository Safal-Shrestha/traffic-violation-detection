import type { ReactNode } from 'react'

interface AnalyticsStatCardProps {
  title: string
  value: string
  icon: ReactNode
}

function AnalyticsStatCard({
  title,
  value,
  icon,
}: AnalyticsStatCardProps) {
  return (
    <div className="analytics-stat-card">
      <div className="analytics-stat-icon">
        {icon}
      </div>

      <div className="analytics-stat-content">
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

export default AnalyticsStatCard