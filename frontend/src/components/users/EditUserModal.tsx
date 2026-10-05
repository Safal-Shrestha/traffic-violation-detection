import { useState } from 'react'
import { X } from 'lucide-react'
import type { User, UserRole, UserStatus } from '../../types/users'

interface EditUserModalProps {
  user: User
  onClose: () => void
  onSave: (updatedUser: User) => void
}

function EditUserModal({
  user,
  onClose,
  onSave,
}: EditUserModalProps) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState<UserRole>(user.role)
  const [status, setStatus] = useState<UserStatus>(user.status)

  return (
    <div
      className="users-modal-overlay"
      onClick={onClose}
    >
      <div
        className="users-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="users-modal-header">
          <div>
            <h2>Edit User</h2>
            <p>Update this user's account information.</p>
          </div>

          <button
            type="button"
            className="users-modal-close"
            onClick={onClose}
            aria-label="Close edit user dialog"
          >
            <X size={19} />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()

            onSave({
              ...user,
              name,
              email,
              role,
              status,
            })
          }}
        >
          <div className="users-modal-body">
            <div className="users-form-group">
              <label htmlFor="user-name">
                Name
              </label>

              <input
                id="user-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="users-form-group">
              <label htmlFor="user-email">
                Email
              </label>

              <input
                id="user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="users-form-row">
              <div className="users-form-group">
                <label htmlFor="user-role">
                  Role
                </label>

                <select
                  id="user-role"
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as UserRole)
                  }
                >
                  <option value="administrator">
                    Administrator
                  </option>

                  <option value="officer">
                    Officer
                  </option>
                </select>
              </div>

              <div className="users-form-group">
                <label htmlFor="user-status">
                  Status
                </label>

                <select
                  id="user-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as UserStatus)
                  }
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div className="users-modal-footer">
            <button
              type="button"
              className="users-modal-cancel"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="users-modal-save"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditUserModal