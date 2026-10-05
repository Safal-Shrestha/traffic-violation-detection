import type { UserStatus } from '../../types/users'

interface UserStatusBadgeProps {
  status: UserStatus
}

function UserStatusBadge({ status }: UserStatusBadgeProps) {
  return (
    <span className={`users-status-badge ${status}`}>
      <span className="users-status-dot" />
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  )
}

export default UserStatusBadge