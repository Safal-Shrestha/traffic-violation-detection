import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'

import ViolationEvidence from '../components/violation-review/ViolationEvidence'
import ViolationDetails from '../components/violation-review/ViolationDetails'
import ViolationDetectionInfo from '../components/violation-review/ViolationDetectionInfo'
import ViolationReviewActions from '../components/violation-review/ViolationReviewActions'

import { getViolationsData } from '../services/violationsService'
import type { Violation } from '../types/violations'

import '../css/violation-review.css'

function ViolationReview() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [violation, setViolation] =
    useState<Violation | null>(null)

  useEffect(() => {
    getViolationsData().then((data) => {
      const selectedViolation = data.violations.find(
        (item) => item.id === Number(id),
      )

      setViolation(selectedViolation ?? null)
    })
  }, [id])

  if (!violation) {
    return (
      <div className="review-not-found">
        <h2>Violation Not Found</h2>

        <p>
          The requested violation could not be found.
        </p>

        <button
          onClick={() => navigate('/violations')}
        >
          <ArrowLeft size={17} />
          Back to Violations
        </button>
      </div>
    )
  }

  const updateViolationStatus = (
    status: Violation['status'],
  ) => {
    setViolation((current) =>
      current
        ? {
            ...current,
            status,
          }
        : null,
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
            Violation #
            {String(violation.id).padStart(3, '0')}
          </h1>

          <p>
            {violation.camera} · {violation.location}
          </p>
        </div>
      </div>

      <div className="review-main-grid">
        <ViolationEvidence violation={violation} />

        <ViolationDetails violation={violation} />
      </div>

      <ViolationDetectionInfo
        violation={violation}
      />

      <ViolationReviewActions
        status={violation.status}
        onStatusChange={updateViolationStatus}
      />
    </div>
  )
}

export default ViolationReview