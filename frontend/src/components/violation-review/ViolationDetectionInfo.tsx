import {Camera,CalendarDays,Clock3,ShieldCheck} from 'lucide-react'
import type { ViolationDetail } from '../../types/violations'

interface ViolationDetectionInfoProps {
  violation: ViolationDetail
}

function ViolationDetectionInfo({
  violation,
}: ViolationDetectionInfoProps) {
  const occurredAt = new Date(violation.occurred_at)

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

  const confidence =
    violation.detection_confidence !== null
      ? `${(violation.detection_confidence * 100).toFixed(1)}%`
      : 'Not available'

  return (
    <section className="review-panel">
      <div className="review-panel-header">
        <div>
          <h2>Detection Information</h2>
        </div>
      </div>

      <div className="review-info-grid">
        <div className="review-info-item">
          <Camera size={18} />

          <div>
            <span>Camera</span>
            <strong>{violation.camera.name}</strong>
          </div>
        </div>

        <div className="review-info-item">
          <CalendarDays size={18} />

          <div>
            <span>Date</span>
            <strong>{date}</strong>
          </div>
        </div>

        <div className="review-info-item">
          <Clock3 size={18} />

          <div>
            <span>Time</span>
            <strong>{time}</strong>
          </div>
        </div>

        <div className="review-info-item">
          <ShieldCheck size={18} />

          <div>
            <span>Confidence</span>
            <strong>{confidence}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ViolationDetectionInfo