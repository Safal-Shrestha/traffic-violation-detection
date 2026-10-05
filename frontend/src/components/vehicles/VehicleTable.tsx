import { UserRound } from 'lucide-react'
import type { Vehicle } from '../../types/vehicles'
import VehicleStatusBadge from './VehicleStatusBadge'

interface VehicleTableProps {
  vehicles: Vehicle[]
  // onEdit: (vehicle: Vehicle) => void
  // onDelete: (vehicle: Vehicle) => void
}

function VehicleTable({
  vehicles,
  // onEdit,
  // onDelete,
}: VehicleTableProps) {
  if (vehicles.length === 0) {
    return (
      <div className="vehicles-empty">
        <p>No vehicles found.</p>
        <span>Try changing your search or filters.</span>
      </div>
    )
  }

  return (
    <div className="vehicles-table-wrapper">
      <table className="vehicles-table">
        <thead>
          <tr>
            <th>Vehicle</th>
            <th>Type</th>
            <th>Make & Model</th>
            <th>Owner</th>
            <th>Last Detected</th>
            <th>Status</th>
            {/* <th>Actions</th> */}
          </tr>
        </thead>

        <tbody>
          {vehicles.map((vehicle) => (
            <tr key={vehicle.id}>
              <td>
                <div className="vehicles-main-cell">
                  <div className="vehicles-avatar">
                    <UserRound size={17} />
                  </div>

                  <div>
                    <strong>{vehicle.plateNumber}</strong>
                    <span>{vehicle.color}</span>
                  </div>
                </div>
              </td>

              <td>
                <span className="vehicles-type">
                  {vehicle.type.charAt(0).toUpperCase() +
                    vehicle.type.slice(1)}
                </span>
              </td>

              <td>
                <div className="vehicles-model">
                  <strong>{vehicle.make}</strong>
                  <span>{vehicle.model}</span>
                </div>
              </td>

              <td>{vehicle.ownerName}</td>

              <td>{vehicle.lastDetected}</td>

              <td>
                <VehicleStatusBadge status={vehicle.status} />
              </td>

              {/* <td>
                <div className="vehicles-actions">
                  <button
                    type="button"
                    className="vehicles-edit-button"
                    onClick={() => onEdit(vehicle)}
                    aria-label={`Edit ${vehicle.plateNumber}`}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="vehicles-delete-button"
                    onClick={() => onDelete(vehicle)}
                    aria-label={`Delete ${vehicle.plateNumber}`}
                  >
                    Delete
                  </button>
                </div>
              </td> */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default VehicleTable