import {Car,CircleAlert,MapPin,ShieldCheck} from 'lucide-react'
import type { Violation } from '../../types/violations'
import ViolationStatusBadge from '../violations/ViolationStatusBadge'

interface ViolationDetailsProps {
  violation: Violation
}

function ViolationDetails({
  violation,
}: ViolationDetailsProps) {
  return (
    <section className="review-panel">
      <div className="review-panel-header">
        <div>
          <h2>Violation Details</h2>
        </div>

        <CircleAlert size={19} />
      </div>

      <div className="review-detail-main">
        <span className="review-detail-label">
          Violation Type
        </span>

        <h3>{violation.violationLabel}</h3>

        <ViolationStatusBadge status={violation.status} />
      </div>

      <div className="review-detail-list">
        <div className="review-detail-item">
          <Car size={18} />

          <div>
            <span>Vehicle Number</span>
            <strong>{violation.vehicleNumber}</strong>
          </div>
        </div>

        <div className="review-detail-item">
          <MapPin size={18} />

          <div>
            <span>Location</span>
            <strong>{violation.location}</strong>
          </div>
        </div>

        <div className="review-detail-item">
          <ShieldCheck size={18} />

          <div>
            <span>AI Confidence</span>
            <strong>{violation.confidence}%</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ViolationDetails