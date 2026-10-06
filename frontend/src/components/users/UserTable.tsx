import { UserRound } from 'lucide-react'
import type { User } from '../../types/users'
import { useAuth } from '../../context/useAuth'

interface UserTableProps {
  users: User[]
  onEdit: (user: User) => void
}

function UserTable({
  users,
  onEdit,
}: UserTableProps) {
  const { user } = useAuth()
  const isAdministrator = user?.role === 'ADMIN'

  return (
    <div className="users-table-wrapper">
      <table className="users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Badge Number</th>
            <th>Role</th>
            <th>Email</th>
            {isAdministrator && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="users-user-cell">
                  <div className="users-avatar">
                    <UserRound size={17} />
                  </div>

                  <div>
                    <strong>{user.name}</strong>
                  </div>
                </div>
              </td>

              <td className="users-muted-cell">
                {user.badge_number}
              </td>

              <td>
                <span className={`users-role ${user.role}`}>
                  {user.role === 'ADMIN'
                    ? 'Administrator'
                    : 'Officer'}
                </span>
              </td>

              <td className="users-muted-cell">
                {user.email}
              </td>

              {isAdministrator && (
                <td>
                  <div className="users-actions">
                    <button
                      type="button"
                      className="users-edit-button"
                      aria-label={`Edit ${user.name}`}
                      onClick={() => onEdit(user)}
                    >
                      Edit
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}

          {users.length === 0 && (
            <tr>
              <td colSpan={isAdministrator ? 5 : 4}>
                <div className="users-empty-state">
                  <UserRound size={30} />
                  <strong>No users found</strong>
                  <span>
                    Try changing your search or filter criteria.
                  </span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default UserTable