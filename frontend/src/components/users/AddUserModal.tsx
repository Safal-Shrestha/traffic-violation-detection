import { useState } from 'react'
import { X } from 'lucide-react'

import type { CreateUserRequest, UserRole } from '../../types/users'

interface AddUserModalProps {
  onClose: () => void
  onSave: (data: CreateUserRequest) => Promise<void>
}

function AddUserModal({
  onClose,
  onSave,
}: AddUserModalProps) {
  const [name, setName] = useState('')
  const [badgeNumber, setBadgeNumber] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('OFFICER')
  const [password, setPassword] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError(null)
    setIsSubmitting(true)

    try {
      await onSave({
        name: name.trim(),
        badge_number: badgeNumber.trim(),
        role,
        email: email.trim(),
        password,
      })

      onClose()
    } catch {
      setError('Failed to create the user. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

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
            <h2>Add User</h2>
            <p>
              Create a new officer account.
            </p>
          </div>

          <button
            type="button"
            className="users-modal-close"
            onClick={onClose}
            aria-label="Close add user dialog"
            disabled={isSubmitting}
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="users-modal-body">
            {error && (
              <div className="users-form-error">
                {error}
              </div>
            )}

            <div className="users-form-group">
              <label htmlFor="add-user-name">
                Name
              </label>

              <input
                id="add-user-name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Enter full name"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="users-form-group">
              <label htmlFor="add-user-badge">
                Badge Number
              </label>

              <input
                id="add-user-badge"
                type="text"
                value={badgeNumber}
                onChange={(event) =>
                  setBadgeNumber(event.target.value)
                }
                placeholder="e.g. NP-2216"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="users-form-group">
              <label htmlFor="add-user-email">
                Email
              </label>

              <input
                id="add-user-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Enter email address"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="users-form-group">
              <label htmlFor="add-user-role">
                Role
              </label>

              <select
                id="add-user-role"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as UserRole)
                }
                disabled={isSubmitting}
              >
                <option value="OFFICER">
                  Officer
                </option>

                <option value="ADMIN">
                  Administrator
                </option>
              </select>
            </div>

            <div className="users-form-group">
              <label htmlFor="add-user-password">
                Initial Password
              </label>

              <input
                id="add-user-password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter initial password"
                required
                minLength={8}
                disabled={isSubmitting}
              />

              <small>
                The user can change this password after signing in.
              </small>
            </div>
          </div>

          <div className="users-modal-footer">
            <button
              type="button"
              className="users-modal-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="users-modal-save"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddUserModal