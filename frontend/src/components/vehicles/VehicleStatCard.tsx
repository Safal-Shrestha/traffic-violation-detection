import type { ReactNode } from 'react'

interface VehicleStatCardProps {
  title: string
  value: string
  description: string
  icon: ReactNode
}

function VehicleStatCard({
  title,
  value,
  description,
  icon,
}: VehicleStatCardProps) {
  return (
    <div className="vehicles-stat-card">
      <div className="vehicles-stat-icon">
        {icon}
      </div>

      <div className="vehicles-stat-content">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </div>
  )
}

export default VehicleStatCard