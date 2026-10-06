import {
  Camera,
  Car,
  CalendarDays,
  CircleAlert,
  Clock3,
  MapPin,
  ShieldCheck,
} from 'lucide-react'

import type { ViolationDetail } from '../../types/violations'
import ViolationStatusBadge from '../violations/ViolationStatusBadge'

interface ViolationDetailsProps {
  violation: ViolationDetail
}

function ViolationDetails({
  violation,
}: ViolationDetailsProps) {
  const vehiclePlate =
    violation.vehicle?.plate_number ??
    violation.detected_plate_raw ??
    'Not detected'

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

  const detectionConfidence =
    violation.detection_confidence !== null
      ? `${(
          violation.detection_confidence * 100
        ).toFixed(1)}%`
      : 'Not available'

  const plateConfidence =
    violation.plate_confidence !== null
      ? `${(
          violation.plate_confidence * 100
        ).toFixed(1)}%`
      : 'Not available'

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

        <h3>{violation.violation_type.name}</h3>

        <ViolationStatusBadge
          status={violation.status}
        />
      </div>

      <div className="review-detail-list">
        <div className="review-detail-item">
          <Car size={18} />

          <div>
            <span>Vehicle Number</span>
            <strong>{vehiclePlate}</strong>
          </div>
        </div>

        <div className="review-detail-item">
          <Camera size={18} />

          <div>
            <span>Camera</span>
            <strong>
              {violation.camera.name}
            </strong>
          </div>
        </div>

        <div className="review-detail-item">
          <MapPin size={18} />

          <div>
            <span>Location</span>
            <strong>
              Camera location
            </strong>
          </div>
        </div>

        <div className="review-detail-item">
          <CalendarDays size={18} />

          <div>
            <span>Date</span>
            <strong>{date}</strong>
          </div>
        </div>

        <div className="review-detail-item">
          <Clock3 size={18} />

          <div>
            <span>Time</span>
            <strong>{time}</strong>
          </div>
        </div>

        <div className="review-detail-item">
          <ShieldCheck size={18} />

          <div>
            <span>Detection Confidence</span>
            <strong>
              {detectionConfidence}
            </strong>
          </div>
        </div>

        <div className="review-detail-item">
          <ShieldCheck size={18} />

          <div>
            <span>Plate Confidence</span>
            <strong>
              {plateConfidence}
            </strong>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ViolationDetails