import type { VehicleStatus } from '../../types/vehicles'

interface VehicleStatusBadgeProps {
  status: VehicleStatus
}

function VehicleStatusBadge({ status }: VehicleStatusBadgeProps) {
  return (
    <span className={`vehicles-status-badge ${status}`}>
      <span className="vehicles-status-dot" />
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  )
}

export default VehicleStatusBadge