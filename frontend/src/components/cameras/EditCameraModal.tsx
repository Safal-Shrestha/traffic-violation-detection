import { useState } from 'react'
import { X } from 'lucide-react'
import type {Camera as CameraType, CameraStatus} from '../../types/cameras'

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
  const [district, setDistrict] = useState(camera.district)
  const [municipality, setMunicipality] = useState(camera.municipality)
  const [installedAt, setInstalledAt] = useState(camera.installed_at)
  const [status, setStatus] = useState<CameraStatus>(camera.status)

  const handleSubmit = (
    event: React.SubmitEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    onSave({
      ...camera,
      name,
      district,
      municipality,
      installed_at: installedAt,
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
            <p>Update this camera's details.</p>
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

            <div className="cameras-form-row">
              <div className="cameras-form-group">
                <label htmlFor="camera-district">District</label>
                <input
                  id="camera-district"
                  type="text"
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  required
                />
              </div>

              <div className="cameras-form-group">
                <label htmlFor="camera-municipality">
                  Municipality
                </label>
                <input
                  id="camera-municipality"
                  type="text"
                  value={municipality}
                  onChange={(event) =>
                    setMunicipality(event.target.value)
                  }
                  required
                />
              </div>
            </div>

            <div className="cameras-form-row">
              <div className="cameras-form-group">
                <label htmlFor="camera-installed-at">
                  Installed Date
                </label>
                <input
                  id="camera-installed-at"
                  type="date"
                  value={installedAt}
                  onChange={(event) =>
                    setInstalledAt(event.target.value)
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
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
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