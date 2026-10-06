import { Camera, Plus } from 'lucide-react'

import type {
  Camera as CameraType,
} from '../../types/monitoring'

interface CameraSelectorProps {
  cameras: CameraType[]
  selectedCameraId: string | null
  onSelect: (cameraId: string) => void
  onAddCamera: () => void
}

function CameraSelector({
  cameras,
  selectedCameraId,
  onSelect,
  onAddCamera,
}: CameraSelectorProps) {
  return (
    <div className="monitoring-camera-selector">
      {cameras.map((camera) => {
        const isOnline =
          camera.worker.online

        return (
          <button
            key={camera.id}
            className={`monitoring-camera-option ${
              selectedCameraId === camera.id
                ? 'active'
                : ''
            }`}
            onClick={() =>
              onSelect(camera.id)
            }
          >
            <Camera size={17} />

            <span>
              <strong>
                {camera.name}
              </strong>

              <small>
                {camera.district},{' '}
                {camera.municipality}
              </small>
            </span>

            <span
              className={`monitoring-camera-status ${
                isOnline
                  ? 'online'
                  : 'offline'
              }`}
            />
          </button>
        )
      })}

      <button
        type="button"
        className="monitoring-add-camera-button"
        onClick={onAddCamera}
      >
        <Plus size={17} />
        <span>Add Camera</span>
      </button>
    </div>
  )
}

export default CameraSelector