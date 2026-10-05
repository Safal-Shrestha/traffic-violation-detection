import { AlertTriangle, X } from 'lucide-react'
import type { Camera as CameraType } from '../../types/cameras'

interface DeleteCameraModalProps {
  camera: CameraType
  onClose: () => void
  onConfirm: () => void
}

function DeleteCameraModal({
  camera,
  onClose,
  onConfirm,
}: DeleteCameraModalProps) {
  return (
    <div className="cameras-modal-overlay" onClick={onClose}>
      <div
        className="cameras-modal cameras-delete-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cameras-modal-header">
          <div>
            <h2>Delete Camera</h2>
            <p>This action cannot be undone.</p>
          </div>

          <button
            type="button"
            className="cameras-modal-close"
            onClick={onClose}
            aria-label="Close delete dialog"
          >
            <X size={19} />
          </button>
        </div>

        <div className="cameras-delete-body">
          <div className="cameras-delete-icon">
            <AlertTriangle size={22} />
          </div>

          <div>
            <p>
              Are you sure you want to delete
              <strong> {camera.name}</strong>?
            </p>

            <span>
              This camera will be removed from the registered
              camera list.
            </span>
          </div>
        </div>

        <div className="cameras-modal-footer">
          <button
            type="button"
            className="cameras-modal-cancel"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="cameras-modal-delete"
            onClick={onConfirm}
          >
            Delete Camera
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteCameraModal