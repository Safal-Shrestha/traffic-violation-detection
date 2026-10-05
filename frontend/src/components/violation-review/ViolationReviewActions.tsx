import {CheckCircle,XCircle} from 'lucide-react'
import type { ViolationStatus } from '../../types/violations'

interface ViolationReviewActionsProps {
  status: ViolationStatus
  onStatusChange: (status: ViolationStatus) => void
}

function ViolationReviewActions({
  status,
  onStatusChange,
}: ViolationReviewActionsProps) {
  const isPending = status === 'pending'

  return (
    <section className="review-actions">
      {isPending && (
        <>
          <button
            className="review-confirm-button"
            onClick={() => onStatusChange('confirmed')}
          >
            <CheckCircle size={17} />
            Confirm Violation
          </button>

          <button
            className="review-reject-button"
            onClick={() => onStatusChange('rejected')}
          >
            <XCircle size={17} />
            Reject Violation
          </button>
        </>
      )}

      {status === 'confirmed' && (
        <div className="review-completed confirmed">
          <CheckCircle size={17} />
          Violation Confirmed
        </div>
      )}

      {status === 'rejected' && (
        <div className="review-completed rejected">
          <XCircle size={17} />
          Violation Rejected
        </div>
      )}
    </section>
  )
}

export default ViolationReviewActions