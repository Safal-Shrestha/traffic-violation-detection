import type { CameraStatus } from '../../types/cameras'

interface CameraStatusBadgeProps {
  status: CameraStatus
}

function CameraStatusBadge({ status }: CameraStatusBadgeProps) {
  return (
    <span className={`cameras-status-badge ${status}`}>
      <span className="cameras-status-dot" />
      {status === 'online' ? 'Online' : 'Offline'}
    </span>
  )
}

export default CameraStatusBadge