import { Eye } from 'lucide-react'
import type { ViolationListItem } from '../../types/violations'
import ViolationStatusBadge from './ViolationStatusBadge'

interface ViolationTableProps {
  violations: ViolationListItem[]
  onView: (id: string) => void
}

function ViolationTable({
  violations,
  onView,
}: ViolationTableProps) {
  return (
    <div className="violations-table-wrapper">
      <table className="violations-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Vehicle</th>
            <th>Violation</th>
            <th>Camera</th>
            <th>Date & Time</th>
            <th>Confidence</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {violations.length > 0 ? (
            violations.map((violation) => {
              const occurredAt = new Date(violation.occurred_at)

              const date = occurredAt.toLocaleDateString('en-CA', {
                timeZone: 'Asia/Kathmandu',
              })

              const time = occurredAt.toLocaleTimeString('en-US', {
                timeZone: 'Asia/Kathmandu',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })

              const confidence =
                violation.plate_confidence !== null
                  ? `${Math.round(violation.plate_confidence * 100)}%`
                  : '—'

              return (
                <tr key={violation.id}>
                  <td className="violation-id">
                    #{violation.id.slice(0, 8)}
                  </td>

                  <td>
                    <strong>
                      {violation.vehicle?.plate_number ??
                        violation.detected_plate_raw ??
                        'Unknown'}
                    </strong>
                  </td>

                  <td>
                    <span className="violation-type">
                      {violation.violation_type.name}
                    </span>
                  </td>

                  <td>{violation.camera.name}</td>

                  <td>
                    <span className="violation-datetime">
                      {date}
                    </span>
                    <small>{time}</small>
                  </td>

                  <td>
                    <span className="violation-confidence">
                      {confidence}
                    </span>
                  </td>

                  <td>
                    <ViolationStatusBadge
                      status={violation.status}
                    />
                  </td>

                  <td>
                    <button
                      type="button"
                      className="violation-view-button"
                      onClick={() => onView(violation.id)}
                      aria-label={`View violation ${violation.id}`}
                    >
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              )
            })
          ) : (
            <tr>
              <td colSpan={8}>
                <div className="violations-empty-state">
                  No violations found.
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default ViolationTable