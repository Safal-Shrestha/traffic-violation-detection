import { Camera } from 'lucide-react'
import type { MonitoringCamera } from '../../types/monitoring'

interface CameraSelectorProps {
  cameras: MonitoringCamera[]
  selectedCameraId: number
  onSelect: (cameraId: number) => void
}

function CameraSelector({
  cameras,
  selectedCameraId,
  onSelect,
}: CameraSelectorProps) {
  return (
    <div className="monitoring-camera-selector">
      {cameras.map((camera) => (
        <button
          key={camera.id}
          className={`monitoring-camera-option ${
            selectedCameraId === camera.id ? 'active' : ''
          }`}
          onClick={() => onSelect(camera.id)}
        >
          <Camera size={17} />

          <span>
            <strong>{camera.name}</strong>
            <small>{camera.location}</small>
          </span>

          <span
            className={`monitoring-camera-status ${camera.status}`}
          />
        </button>
      ))}
    </div>
  )
}

export default CameraSelector