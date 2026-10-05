import { useState } from 'react'
import { X } from 'lucide-react'
import type {
  Vehicle,
  VehicleStatus,
  VehicleType,
} from '../../types/vehicles'

interface EditVehicleModalProps {
  vehicle: Vehicle
  onClose: () => void
  onSave: (updatedVehicle: Vehicle) => void
}

function EditVehicleModal({
  vehicle,
  onClose,
  onSave,
}: EditVehicleModalProps) {
  const [plateNumber, setPlateNumber] = useState(vehicle.plateNumber)
  const [type, setType] = useState<VehicleType>(vehicle.type)
  const [make, setMake] = useState(vehicle.make)
  const [model, setModel] = useState(vehicle.model)
  const [color, setColor] = useState(vehicle.color)
  const [ownerName, setOwnerName] = useState(vehicle.ownerName)
  const [status, setStatus] = useState<VehicleStatus>(vehicle.status)

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()

    onSave({
      ...vehicle,
      plateNumber,
      type,
      make,
      model,
      color,
      ownerName,
      status,
    })
  }

  return (
    <div className="vehicles-modal-overlay" onClick={onClose}>
      <div
        className="vehicles-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vehicles-modal-header">
          <div>
            <h2>Edit Vehicle</h2>
            <p>Update this vehicle's registration information.</p>
          </div>

          <button
            type="button"
            className="vehicles-modal-close"
            onClick={onClose}
            aria-label="Close edit vehicle dialog"
          >
            <X size={19} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
        >
          <div className="vehicles-modal-body">
            <div className="vehicles-form-group">
              <label htmlFor="vehicle-plate">Plate Number</label>
              <input
                id="vehicle-plate"
                type="text"
                value={plateNumber}
                onChange={(event) => setPlateNumber(event.target.value)}
                required
              />
            </div>

            <div className="vehicles-form-row">
              <div className="vehicles-form-group">
                <label htmlFor="vehicle-type">Vehicle Type</label>
                <select
                  id="vehicle-type"
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as VehicleType)
                  }
                >
                  <option value="car">Car</option>
                  <option value="bike">Bike</option>
                  <option value="bus">Bus</option>
                  <option value="truck">Truck</option>
                </select>
              </div>

              <div className="vehicles-form-group">
                <label htmlFor="vehicle-status">Status</label>
                <select
                  id="vehicle-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as VehicleStatus)
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="vehicles-form-row">
              <div className="vehicles-form-group">
                <label htmlFor="vehicle-make">Make</label>
                <input
                  id="vehicle-make"
                  type="text"
                  value={make}
                  onChange={(event) => setMake(event.target.value)}
                  required
                />
              </div>

              <div className="vehicles-form-group">
                <label htmlFor="vehicle-model">Model</label>
                <input
                  id="vehicle-model"
                  type="text"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="vehicles-form-row">
              <div className="vehicles-form-group">
                <label htmlFor="vehicle-color">Color</label>
                <input
                  id="vehicle-color"
                  type="text"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  required
                />
              </div>

              <div className="vehicles-form-group">
                <label htmlFor="vehicle-owner">Owner Name</label>
                <input
                  id="vehicle-owner"
                  type="text"
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                  required
                />
              </div>
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
              type="submit"
              className="vehicles-modal-save"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditVehicleModal