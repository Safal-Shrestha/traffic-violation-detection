import type { DetectionPerformance as DetectionPerformanceData } from '../../types/analytics'

interface DetectionPerformanceProps {
  data: DetectionPerformanceData[]
}

function DetectionPerformance({
  data,
}: DetectionPerformanceProps) {
  return (
    <section className="analytics-chart-card">
      <div className="analytics-chart-header">
        <div>
          <h2>Detection Performance</h2>
          <p>Average AI confidence by violation type</p>
        </div>
      </div>

      <div className="analytics-performance-list">
        {data.map((item) => (
          <div
            className="analytics-performance-item"
            key={item.type}
          >
            <div className="analytics-performance-info">
              <span>{item.type}</span>
              <strong>{item.confidence}%</strong>
            </div>

            <div className="analytics-progress">
              <div
                style={{
                  width: `${item.confidence}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default DetectionPerformance