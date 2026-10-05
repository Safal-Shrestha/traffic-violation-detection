import type { ViolationSummary } from '../../types/dashboard'

interface ViolationOverviewProps {
  violations: ViolationSummary[]
}

function ViolationOverview({
  violations,
}: ViolationOverviewProps) {
  const total = violations.reduce(
    (sum, violation) => sum + violation.count,
    0,
  )

  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-header">
        <div>
          <h3>Violation Overview</h3>
          <p>Today's detected violations</p>
        </div>

        <strong>{total}</strong>
      </div>

      <div className="violation-overview">
        {violations.map((violation) => {
          const percentage =
            total > 0
              ? (violation.count / total) * 100
              : 0

          return (
            <div
              className="violation-overview-item"
              key={violation.label}
            >
              <div className="violation-overview-label">
                <span>{violation.label}</span>
                <strong>{violation.count}</strong>
              </div>

              <div className="violation-bar">
                <div
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default ViolationOverview