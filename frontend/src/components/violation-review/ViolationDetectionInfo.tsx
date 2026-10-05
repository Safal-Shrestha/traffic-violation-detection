import {Camera,CalendarDays,Clock3,ShieldCheck} from 'lucide-react'
import type { Violation } from '../../types/violations'

interface ViolationDetectionInfoProps {
  violation: Violation
}

function ViolationDetectionInfo({
  violation,
}: ViolationDetectionInfoProps) {
  return (
    <section className="review-panel">
      <div className="review-panel-header">
        <div>
          <h2>Detection Information</h2>
          <p>Technical information about this detection</p>
        </div>
      </div>

      <div className="review-info-grid">
        <div className="review-info-item">
          <Camera size={18} />

          <div>
            <span>Camera</span>
            <strong>{violation.camera}</strong>
          </div>
        </div>

        <div className="review-info-item">
          <CalendarDays size={18} />

          <div>
            <span>Date</span>
            <strong>{violation.date}</strong>
          </div>
        </div>

        <div className="review-info-item">
          <Clock3 size={18} />

          <div>
            <span>Time</span>
            <strong>{violation.time}</strong>
          </div>
        </div>

        <div className="review-info-item">
          <ShieldCheck size={18} />

          <div>
            <span>Confidence</span>
            <strong>{violation.confidence}%</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ViolationDetectionInfo