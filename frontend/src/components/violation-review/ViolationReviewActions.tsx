import { useState } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'

import type {
  ViolationDetail,
} from '../../types/violations'

interface ViolationReviewActionsProps {
  violation: ViolationDetail
  onAction: (
    action: 'confirm' | 'reject' | 'reopen',
    notes: string,
  ) => Promise<void>
}

function ViolationReviewActions({
  violation,
  onAction,
}: ViolationReviewActionsProps) {
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const isPending = violation.status === 'PENDING'

  const handleAction = async (
    action: 'confirm' | 'reject' | 'reopen',
  ) => {
    if (
      (action === 'reject' ||
        action === 'reopen') &&
      !notes.trim()
    ) {
      return
    }

    try {
      setIsSubmitting(true)

      await onAction(action, notes.trim())

      setNotes('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="review-panel review-actions-panel">
      <div className="review-panel-header">
        <div>
          <h2>Review Actions</h2>
        </div>
      </div>

      {isPending ? (
        <>
          <div className="review-action-status">
            <span>Current Status</span>
            <strong>Pending Review</strong>
          </div>

          <div className="review-notes-field">
            <label htmlFor="review-notes">
              Officer Remarks
            </label>

            <textarea
              id="review-notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Add remarks about this violation..."
              rows={5}
              disabled={isSubmitting}
            />

            <span>
              Remarks are optional for confirmation but
              required for rejection.
            </span>
          </div>

          <div className="review-action-buttons">
            <button
              type="button"
              className="review-action-reject"
              onClick={() => handleAction('reject')}
              disabled={
                isSubmitting || !notes.trim()
              }
            >
              <X size={17} />
              Reject Violation
            </button>

            <button
              type="button"
              className="review-action-confirm"
              onClick={() => handleAction('confirm')}
              disabled={isSubmitting}
            >
              <Check size={17} />
              Confirm Violation
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="review-action-status">
            <span>Current Status</span>

            <strong>
              {violation.status === 'CONFIRMED'
                ? 'Violation Confirmed'
                : 'Violation Rejected'}
            </strong>
          </div>

          <div className="review-notes-field">
            <label htmlFor="reopen-notes">
              Reopen Remarks
            </label>

            <textarea
              id="reopen-notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Enter the reason for reopening this violation..."
              rows={5}
              disabled={isSubmitting}
            />

            <span>
              A reason is required to reopen the violation.
            </span>
          </div>

          <div className="review-action-buttons">
            <button
              type="button"
              className="review-action-reopen"
              onClick={() => handleAction('reopen')}
              disabled={
                isSubmitting || !notes.trim()
              }
            >
              <RotateCcw size={17} />
              Reopen Violation
            </button>
          </div>
        </>
      )}
    </section>
  )
}

export default ViolationReviewActions