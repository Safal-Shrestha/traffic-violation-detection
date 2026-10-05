import { useState } from 'react'
import { X } from 'lucide-react'
import type {
  Camera as CameraType,
  CameraStatus,
} from '../../types/cameras'

interface EditCameraModalProps {
  camera: CameraType
  onClose: () => void
  onSave: (updatedCamera: CameraType) => void
}

function EditCameraModal({
  camera,
  onClose,
  onSave,
}: EditCameraModalProps) {
  const [name, setName] = useState(camera.name)
  const [location, setLocation] = useState(camera.location)
  const [resolution, setResolution] = useState(camera.resolution)
  const [fps, setFps] = useState(String(camera.fps))
  const [ipAddress, setIpAddress] = useState(camera.ipAddress)
  const [status, setStatus] = useState<CameraStatus>(camera.status)

  const handleSubmit = (
    event: React.SubmitEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    onSave({
      ...camera,
      name,
      location,
      resolution,
      fps: Number(fps),
      ipAddress,
      status,
    })
  }

  return (
    <div className="cameras-modal-overlay" onClick={onClose}>
      <div
        className="cameras-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cameras-modal-header">
          <div>
            <h2>Edit Camera</h2>
            <p>Update this camera's configuration.</p>
          </div>

          <button
            type="button"
            className="cameras-modal-close"
            onClick={onClose}
            aria-label="Close edit camera dialog"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cameras-modal-body">
            <div className="cameras-form-group">
              <label htmlFor="camera-name">Camera Name</label>
              <input
                id="camera-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="cameras-form-group">
              <label htmlFor="camera-location">Location</label>
              <input
                id="camera-location"
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                required
              />
            </div>

            <div className="cameras-form-row">
              <div className="cameras-form-group">
                <label htmlFor="camera-resolution">
                  Resolution
                </label>

                <select
                  id="camera-resolution"
                  value={resolution}
                  onChange={(event) =>
                    setResolution(event.target.value)
                  }
                >
                  <option value="1280 × 720">1280 × 720</option>
                  <option value="1920 × 1080">1920 × 1080</option>
                  <option value="2560 × 1440">2560 × 1440</option>
                  <option value="3840 × 2160">3840 × 2160</option>
                </select>
              </div>

              <div className="cameras-form-group">
                <label htmlFor="camera-fps">FPS</label>

                <input
                  id="camera-fps"
                  type="number"
                  min="1"
                  max="120"
                  value={fps}
                  onChange={(event) => setFps(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="cameras-form-row">
              <div className="cameras-form-group">
                <label htmlFor="camera-ip">IP Address</label>

                <input
                  id="camera-ip"
                  type="text"
                  value={ipAddress}
                  onChange={(event) =>
                    setIpAddress(event.target.value)
                  }
                  required
                />
              </div>

              <div className="cameras-form-group">
                <label htmlFor="camera-status">Status</label>

                <select
                  id="camera-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as CameraStatus)
                  }
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
            </div>
          </div>

          <div className="cameras-modal-footer">
            <button
              type="button"
              className="cameras-modal-cancel"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="cameras-modal-save"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditCameraModal