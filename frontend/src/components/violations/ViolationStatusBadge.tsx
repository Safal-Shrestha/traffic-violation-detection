import { CheckCircle, Clock, XCircle } from 'lucide-react'
import type { ViolationStatus } from '../../types/violations'

interface ViolationStatusBadgeProps {
  status: ViolationStatus
}

function ViolationStatusBadge({
  status,
}: ViolationStatusBadgeProps) {
  const statusConfig = {
    PENDING: {
      label: 'Pending',
      icon: Clock,
      className: 'pending',
    },
    CONFIRMED: {
      label: 'Confirmed',
      icon: CheckCircle,
      className: 'confirmed',
    },
    REJECTED: {
      label: 'Rejected',
      icon: XCircle,
      className: 'rejected',
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <span
      className={`violation-status-badge ${config.className}`}
    >
      <Icon size={14} />
      {config.label}
    </span>
  )
}

export default ViolationStatusBadge