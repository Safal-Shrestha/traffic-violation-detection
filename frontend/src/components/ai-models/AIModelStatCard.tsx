import type { ReactNode } from 'react'

interface AIModelStatCardProps {
  title: string
  value: string
  description: string
  icon: ReactNode
}

function AIModelStatCard({
  title,
  value,
  description,
  icon,
}: AIModelStatCardProps) {
  return (
    <div className="ai-models-stat-card">
      <div className="ai-models-stat-icon">
        {icon}
      </div>

      <div className="ai-models-stat-content">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </div>
  )
}

export default AIModelStatCard