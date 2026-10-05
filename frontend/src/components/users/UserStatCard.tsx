import type { ReactNode } from 'react'

interface UserStatCardProps {
  title: string
  value: string
  description: string
  icon: ReactNode
}

function UserStatCard({
  title,
  value,
  description,
  icon,
}: UserStatCardProps) {
  return (
    <div className="users-stat-card">
      <div className="users-stat-icon">
        {icon}
      </div>

      <div className="users-stat-content">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </div>
  )
}

export default UserStatCard