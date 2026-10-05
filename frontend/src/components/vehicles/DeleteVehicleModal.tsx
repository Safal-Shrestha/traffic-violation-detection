import { AlertTriangle, X } from 'lucide-react'
import type { Vehicle } from '../../types/vehicles'

interface DeleteVehicleModalProps {
  vehicle: Vehicle
  onClose: () => void
  onConfirm: () => void
}

function DeleteVehicleModal({
  vehicle,
  onClose,
  onConfirm,
}: DeleteVehicleModalProps) {
  return (
    <div className="vehicles-modal-overlay" onClick={onClose}>
      <div
        className="vehicles-modal vehicles-delete-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vehicles-modal-header">
          <div>
            <h2>Delete Vehicle</h2>
            <p>This action cannot be undone.</p>
          </div>

          <button
            type="button"
            className="vehicles-modal-close"
            onClick={onClose}
            aria-label="Close delete dialog"
          >
            <X size={19} />
          </button>
        </div>

        <div className="vehicles-delete-body">
          <div className="vehicles-delete-icon">
            <AlertTriangle size={22} />
          </div>

          <div>
            <p>
              Are you sure you want to delete
              <strong> {vehicle.plateNumber}</strong>?
            </p>

            <span>
              This vehicle will be removed from the registered vehicle list.
            </span>
          </div>
        </div>

        <div className="vehicles-modal-footer">
          <button
            type="button"
            className="vehicles-modal-cancel"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="vehicles-modal-delete"
            onClick={onConfirm}
          >
            Delete Vehicle
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteVehicleModal