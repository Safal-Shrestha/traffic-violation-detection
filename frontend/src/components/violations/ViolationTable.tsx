import { Eye } from 'lucide-react'
import type { Violation } from '../../types/violations'
import ViolationStatusBadge from './ViolationStatusBadge'

interface ViolationTableProps {
  violations: Violation[]
  onView: (id: number) => void
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
            violations.map((violation) => (
              <tr key={violation.id}>
                <td className="violation-id">
                  #{String(violation.id).padStart(3, '0')}
                </td>

                <td>
                  <strong>{violation.vehicleNumber}</strong>
                </td>

                <td>
                  <span className="violation-type">
                    {violation.violationLabel}
                  </span>
                  <small>{violation.location}</small>
                </td>

                <td>{violation.camera}</td>

                <td>
                  <span className="violation-datetime">
                    {violation.date}
                  </span>
                  <small>{violation.time}</small>
                </td>

                <td>
                  <span className="violation-confidence">
                    {violation.confidence}%
                  </span>
                </td>

                <td>
                  <ViolationStatusBadge status={violation.status} />
                </td>

                <td>
                  <button
                    className="violation-view-button"
                    onClick={() => onView(violation.id)}
                    aria-label={`View violation ${violation.id}`}
                  >
                    <Eye size={17} />
                  </button>
                </td>
              </tr>
            ))
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