import { AlertTriangle, X } from 'lucide-react'
import type { User } from '../../types/users'

interface DeleteUserModalProps {
  user: User
  onClose: () => void
  onConfirm: () => void
}

function DeleteUserModal({
  user,
  onClose,
  onConfirm,
}: DeleteUserModalProps) {
  return (
    <div className="users-modal-overlay" onClick={onClose}>
      <div
        className="users-modal users-delete-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="users-modal-header">
          <div>
            <h2>Delete User</h2>
            <p>This action cannot be undone.</p>
          </div>

          <button
            type="button"
            className="users-modal-close"
            onClick={onClose}
            aria-label="Close delete dialog"
          >
            <X size={19} />
          </button>
        </div>

        <div className="users-delete-body">
          <div className="users-delete-icon">
            <AlertTriangle size={22} />
          </div>

          <div>
            <p>
              Are you sure you want to delete
              <strong> {user.name}</strong>?
            </p>

            <span>
              The user account and its associated access will be
              removed from the system.
            </span>
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
            type="button"
            className="users-modal-delete"
            onClick={onConfirm}
          >
            Delete User
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteUserModal