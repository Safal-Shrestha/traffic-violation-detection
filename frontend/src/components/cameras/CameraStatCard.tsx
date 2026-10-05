import type { ReactNode } from 'react'

interface CameraStatCardProps {
  title: string
  value: string
  description: string
  icon: ReactNode
}

function CameraStatCard({
  title,
  value,
  description,
  icon,
}: CameraStatCardProps) {
  return (
    <div className="cameras-stat-card">
      <div className="cameras-stat-icon">
        {icon}
      </div>

      <div className="cameras-stat-content">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </div>
  )
}

export default CameraStatCard