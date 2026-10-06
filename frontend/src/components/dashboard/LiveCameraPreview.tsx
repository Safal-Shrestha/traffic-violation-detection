import { Camera, Circle } from 'lucide-react'
import type { CameraPreview } from '../../types/dashboard'

interface LiveCameraPreviewProps {
  cameras: CameraPreview[]
  onCameraClick: () => void
}

function LiveCameraPreview({
  cameras,
  onCameraClick,
}: LiveCameraPreviewProps) {
  return (
    <section className="dashboard-panel dashboard-camera-panel">
      <div className="dashboard-panel-header">
        <div>
          <h3>Live Monitoring</h3>
        </div>

        <button
          className="dashboard-text-button"
          onClick={onCameraClick}
        >
          View all
        </button>
      </div>

      <div className="dashboard-camera-grid">
        {cameras.map((camera) => (
          <button
            className="dashboard-camera-card"
            key={camera.id}
            onClick={onCameraClick}
          >
            <div className="dashboard-camera-image">
              <Camera size={28} />

              <span
                className={`camera-status ${
                  camera.workerOnline
                    ? 'online'
                    : 'offline'
                }`}
              >
                <Circle
                  size={8}
                  fill="currentColor"
                />
                {camera.workerOnline
                  ? 'online'
                  : 'offline'}
              </span>
            </div>

            <div className="dashboard-camera-info">
              <div>
                <strong>{camera.name}</strong>

                <span>
                  {camera.municipality}, {camera.district}
                </span>
              </div>

              <small>
                {camera.status === 'ACTIVE'
                  ? 'Active camera'
                  : 'Inactive camera'}
              </small>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export default LiveCameraPreview