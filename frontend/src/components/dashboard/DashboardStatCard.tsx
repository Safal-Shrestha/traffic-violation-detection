import type { LucideIcon } from 'lucide-react'

interface DashboardStatCardProps {
  title: string
  value: number
  icon: LucideIcon
  description: string
}

function DashboardStatCard({
  title,
  value,
  icon: Icon,
  description,
}: DashboardStatCardProps) {
  return (
    <div className="dashboard-stat-card">
      <div className="dashboard-stat-header">
        <span>{title}</span>

        <div className="dashboard-stat-icon">
          <Icon size={20} />
        </div>
      </div>

      <strong>{value.toLocaleString()}</strong>

      <small>{description}</small>
    </div>
  )
}

export default DashboardStatCard