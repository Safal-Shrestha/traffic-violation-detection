import type { CameraStatus } from '../../types/cameras'

interface CameraStatusBadgeProps {
  status: CameraStatus
}

function CameraStatusBadge({ status }: CameraStatusBadgeProps) {
  const label = status === 'ACTIVE' ? 'Active' : 'Inactive'
  return (
    <span className={`cameras-status-badge ${status.toLowerCase()}`}>
      <span className="cameras-status-dot" />
      {label}
    </span>
  )
}

export default CameraStatusBadge