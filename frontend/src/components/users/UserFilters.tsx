import { Search } from 'lucide-react'
import type { UserRole } from '../../types/users'

interface UserFiltersProps {
  search: string
  role: UserRole | 'all'
  onSearchChange: (value: string) => void
  onRoleChange: (value: UserRole | 'all') => void
}

function UserFilters({
  search,
  role,
  onSearchChange,
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
          onChange={(event) =>
            onSearchChange(event.target.value)
          }
        />
      </div>

      <select
        value={role}
        onChange={(event) =>
          onRoleChange(event.target.value as UserRole | 'all')
        }
      >
        <option value="all">All Roles</option>
        <option value="ADMIN">Administrator</option>
        <option value="OFFICER">Officer</option>
      </select>
    </div>
  )
}

export default UserFilters