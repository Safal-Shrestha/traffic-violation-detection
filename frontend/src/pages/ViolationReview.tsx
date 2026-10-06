import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'

import ViolationEvidence from '../components/violation-review/ViolationEvidence'
import ViolationDetails from '../components/violation-review/ViolationDetails'
import ViolationReviewActions from '../components/violation-review/ViolationReviewActions'
import { confirmViolation, getViolation, rejectViolation, reopenViolation } from '../services/violationsService'
import type { ViolationDetail} from '../types/violations'

import '../css/violation-review.css'

function ViolationReview() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [violation, setViolation] =
    useState<ViolationDetail | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      return
    }

    getViolation(id)
      .then((data) => {
        setViolation(data)
        setError(null)
      })
      .catch(() => {
        setViolation(null)
        setError(
          'The requested violation could not be found.',
        )
      })
  }, [id])

  const handleReviewAction = async (
    action: 'confirm' | 'reject' | 'reopen',
    notes: string,
  ) => {
    if (!violation) {
      return
    }

    let response

    switch (action) {
      case 'confirm':
        response = await confirmViolation(
          violation.id,
          notes ? { notes } : {},
        )
        break

      case 'reject':
        response = await rejectViolation(
          violation.id,
          { notes },
        )
        break

      case 'reopen':
        response = await reopenViolation(
          violation.id,
          { notes },
        )
        break
    }

    setViolation(response.violation)
  }

  if (!id) {
    return (
      <div className="review-not-found">
        <h2>Violation Not Found</h2>

        <p>Invalid violation ID.</p>

        <button
          onClick={() => navigate('/violations')}
        >
          <ArrowLeft size={17} />
          Back to Violations
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="review-not-found">
        <h2>Violation Not Found</h2>

        <p>{error}</p>

        <button
          onClick={() => navigate('/violations')}
        >
          <ArrowLeft size={17} />
          Back to Violations
        </button>
      </div>
    )
  }

  if (!violation) {
    return (
      <div className="review-not-found">
        <h2>Loading Violation</h2>

        <p>Loading violation details...</p>
      </div>
    )
  }

  return (
    <div className="review-page">
      <div className="review-heading">
        <div>
          <button
            className="review-heading-back"
            onClick={() => navigate('/violations')}
          >
            <ArrowLeft size={17} />
            Back to Violations
          </button>

          <h1>
            Violation #{violation.id.slice(0, 8)}
          </h1>

          <p>
            {violation.camera.name}
          </p>
        </div>
      </div>

      <ViolationEvidence
        violation={violation}
      />

      <div className="review-bottom-grid">
        <ViolationDetails
          violation={violation}
        />

        <ViolationReviewActions
          violation={violation}
          onAction={handleReviewAction}
        />
      </div>
    </div>
  )
}

export default ViolationReview