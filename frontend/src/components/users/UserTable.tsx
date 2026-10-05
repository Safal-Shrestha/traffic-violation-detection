import {UserRound } from 'lucide-react'
import type { User } from '../../types/users'
import UserStatusBadge from './UserStatusBadge'
import { useAuth } from '../../context/useAuth'

interface UserTableProps {
  users: User[]
  onEdit: (user: User) => void
  onDelete: (user: User) => void
}

function UserTable({
  users,
  onEdit,
  onDelete,
}: UserTableProps) {  
  const { user } = useAuth()
  const isAdministrator = user?.role === 'administrator'

  return (
    <div className="users-table-wrapper">
      <table className="users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Active</th>
            <th>Joined</th>
            {isAdministrator && (<th>Actions</th>)}
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
                    <span>{user.email}</span>
                  </div>
                </div>
              </td>

              <td>
                <span className={`users-role ${user.role}`}>
                  {user.role === 'administrator'
                    ? 'Administrator'
                    : 'Officer'}
                </span>
              </td>

              <td>
                <UserStatusBadge status={user.status} />
              </td>

              <td className="users-muted-cell">
                {user.lastActive}
              </td>

              <td className="users-muted-cell">
                {user.joinedDate}
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

                    <button
                      type="button"
                      className="users-delete-button"
                      aria-label={`Delete ${user.name}`}
                      onClick={() => onDelete(user)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}

          {users.length === 0 && (
            <tr>
              <td colSpan={6}>
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