import { Circle } from 'lucide-react'
import type { CameraPreview } from '../../types/dashboard'

interface CameraStatusProps {
  cameras: CameraPreview[]
}

function CameraStatus({
  cameras,
}: CameraStatusProps) {
  const online = cameras.filter(
    (camera) => camera.status === 'online',
  ).length

  const offline = cameras.length - online

  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-header">
        <div>
          <h3>Camera Status</h3>
          <p>Current system availability</p>
        </div>
      </div>

      <div className="camera-status-summary">
        <div>
          <span className="camera-status-number">
            {online}
          </span>

          <span>
            <Circle size={8} fill="currentColor" />
            Online
          </span>
        </div>

        <div>
          <span className="camera-status-number">
            {offline}
          </span>

          <span>
            <Circle size={8} fill="currentColor" />
            Offline
          </span>
        </div>
      </div>
    </section>
  )
}

export default CameraStatus