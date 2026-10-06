import { Eye } from 'lucide-react'
import type { RecentViolation } from '../../types/dashboard'

interface RecentViolationsProps {
  violations: RecentViolation[]
  onViewViolation: (id: string) => void
}

function formatViolationTime(
  occurredAt: string,
): string {
  return new Intl.DateTimeFormat('en-NP', {
    timeZone: 'Asia/Kathmandu',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(occurredAt))
}

function RecentViolations({
  violations,
  onViewViolation,
}: RecentViolationsProps) {
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-header">
        <div>
          <h3>Recent Violations</h3>
        </div>

        <span className="dashboard-count">
          {violations.length}
        </span>
      </div>

      <div className="dashboard-table-wrapper">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Violation</th>
              <th>Camera</th>
              <th>Time</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {violations.map((violation) => (
              <tr key={violation.id}>
                <td>
                  <strong>
                    {violation.plate ?? 'Unknown'}
                  </strong>
                </td>

                <td>{violation.violationType}</td>

                <td>{violation.camera}</td>

                <td>
                  {formatViolationTime(
                    violation.occurredAt,
                  )}
                </td>

                <td>
                  <span
                    className={`violation-status ${violation.status.toLowerCase()}`}
                  >
                    {violation.status}
                  </span>
                </td>

                <td>
                  <button
                    className="dashboard-view-button"
                    onClick={() =>
                      onViewViolation(violation.id)
                    }
                    aria-label="View violation"
                  >
                    <Eye size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default RecentViolations