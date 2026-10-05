import { Search } from 'lucide-react'
import type { UserRole, UserStatus } from '../../types/users'

interface UserFiltersProps {
  search: string
  status: UserStatus | 'all'
  role: UserRole | 'all'
  onSearchChange: (value: string) => void
  onStatusChange: (value: UserStatus | 'all') => void
  onRoleChange: (value: UserRole | 'all') => void
}

function UserFilters({
  search,
  status,
  role,
  onSearchChange,
  onStatusChange,
  onRoleChange,
}: UserFiltersProps) {
  return (
    <div className="users-filters">
      <div className="users-search">
        <Search size={17} />

        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <select
        value={status}
        onChange={(event) =>
          onStatusChange(event.target.value as UserStatus | 'all')
        }
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      <select
        value={role}
        onChange={(event) =>
          onRoleChange(event.target.value as UserRole | 'all')
        }
      >
        <option value="all">All Roles</option>
        <option value="administrator">Administrator</option>
        <option value="officer">Officer</option>
      </select>
    </div>
  )
}

export default UserFilters