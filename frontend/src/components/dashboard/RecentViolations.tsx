import { Eye } from 'lucide-react'
import type { RecentViolation } from '../../types/dashboard'

interface RecentViolationsProps {
  violations: RecentViolation[]
  onViewViolation: (id: number) => void
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
          <p>Latest detected traffic violations</p>
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
                  <strong>{violation.vehicleNumber}</strong>
                </td>

                <td>{violation.violation}</td>

                <td>{violation.camera}</td>

                <td>{violation.time}</td>

                <td>
                  <span
                    className={`violation-status ${violation.status}`}
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