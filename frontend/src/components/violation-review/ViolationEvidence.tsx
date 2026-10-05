import { Camera, Image } from 'lucide-react'
import type { Violation } from '../../types/violations'

interface ViolationEvidenceProps {
  violation: Violation
}

function ViolationEvidence({ violation }: ViolationEvidenceProps) {
  return (
    <section className="review-panel review-evidence-panel">
      <div className="review-panel-header">
        <div>
          <h2>Violation Evidence</h2>
          <p>Captured frame from the traffic camera</p>
        </div>

        <Camera size={19} />
      </div>

      <div className="review-evidence">
        <div className="review-evidence-placeholder">
          <Image size={44} />

          <strong>Camera Evidence</strong>

          <span>
            Evidence image will be displayed here
          </span>

          <small>
            {violation.camera} · {violation.location}
          </small>
        </div>

        <div className="review-evidence-overlay">
          <span>{violation.date}</span>
          <span>{violation.time}</span>
        </div>
      </div>
    </section>
  )
}

export default ViolationEvidence