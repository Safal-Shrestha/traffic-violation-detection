import { Camera, Image } from 'lucide-react'
import type { ViolationDetail } from '../../types/violations'

interface ViolationEvidenceProps {
  violation: ViolationDetail
}

function ViolationEvidence({
  violation,
}: ViolationEvidenceProps) {
  const fullFrameEvidence =
    violation.evidence.find(
      (item) =>
        item.evidence_role === 'FULL_FRAME',
    )

  const occurredAt = new Date(
    violation.occurred_at,
  )

  const date = occurredAt.toLocaleDateString(
    'en-GB',
    {
      timeZone: 'Asia/Kathmandu',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    },
  )

  const time = occurredAt.toLocaleTimeString(
    'en-GB',
    {
      timeZone: 'Asia/Kathmandu',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    },
  )

  return (
    <section className="review-panel review-evidence-panel">
      <div className="review-panel-header">
        <div>
          <h2>Violation Evidence</h2>
        </div>

        <Camera size={19} />
      </div>

      <div className="review-evidence">
        {fullFrameEvidence ? (
          <img
            src={fullFrameEvidence.download_url}
            alt="Violation evidence"
            className="review-evidence-image"
          />
        ) : (
          <div className="review-evidence-placeholder">
            <Image size={44} />

            <strong>Camera Evidence</strong>

            <span>
              Evidence image is not available
            </span>

            <small>
              {violation.camera.name}
            </small>
          </div>
        )}

        <div className="review-evidence-overlay">
          <span>{date}</span>
          <span>{time}</span>
        </div>
      </div>
    </section>
  )
}

export default ViolationEvidence