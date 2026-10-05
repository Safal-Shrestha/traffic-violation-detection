import type { CameraActivity as CameraActivityData } from '../../types/analytics'

interface CameraActivityProps {
  data: CameraActivityData[]
}

function CameraActivity({
  data,
}: CameraActivityProps) {
  const maxViolations = Math.max(
    ...data.map((camera) => camera.violations),
  )

  return (
    <section className="analytics-chart-card">
      <div className="analytics-chart-header">
        <div>
          <h2>Camera Activity</h2>
          <p>Violations detected by camera</p>
        </div>
      </div>

      <div className="analytics-camera-list">
        {data.map((camera) => {
          const percentage =
            (camera.violations / maxViolations) * 100

          return (
            <div
              className="analytics-camera-item"
              key={camera.camera}
            >
              <div className="analytics-camera-info">
                <span>{camera.camera}</span>
                <strong>{camera.violations}</strong>
              </div>

              <div className="analytics-progress">
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

export default CameraActivity