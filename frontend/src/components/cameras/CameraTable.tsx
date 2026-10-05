import { Camera } from 'lucide-react'
import type { Camera as CameraType } from '../../types/cameras'
import CameraStatusBadge from './CameraStatusBadge'
import { useAuth } from '../../context/useAuth'

interface CameraTableProps {
  cameras: CameraType[]
  onEdit: (camera: CameraType) => void
  onDelete: (camera: CameraType) => void
}

function CameraTable({
  cameras,
  onEdit,
  onDelete,
}: CameraTableProps) {
  const { user } = useAuth()
  const isAdministrator = user?.role === 'administrator'

  if (cameras.length === 0) {
    return (
      <div className="cameras-empty">
        <p>No cameras found.</p>
        <span>Try changing your search or filters.</span>
      </div>
    )
  }

  return (
    <div className="cameras-table-wrapper">
      <table className="cameras-table">
        <thead>
          <tr>
            <th>Camera</th>
            <th>Location</th>
            <th>Resolution</th>
            <th>FPS</th>
            <th>Last Active</th>
            <th>Status</th>
            {isAdministrator && (<th>Actions</th>)}
          </tr>
        </thead>

        <tbody>
          {cameras.map((camera) => (
            <tr key={camera.id}>
              <td>
                <div className="cameras-main-cell">
                  <div className="cameras-avatar">
                    <Camera size={17} />
                  </div>

                  <div>
                    <strong>{camera.name}</strong>
                    <span>{camera.ipAddress}</span>
                  </div>
                </div>
              </td>

              <td>{camera.location}</td>

              <td>{camera.resolution}</td>

              <td>{camera.fps}</td>

              <td>{camera.lastActive}</td>

              <td>
                <CameraStatusBadge status={camera.status} />
              </td>

              {isAdministrator && (
                <td>
                  <div className="cameras-actions">
                    <button
                      type="button"
                      className="cameras-edit-button"
                      onClick={() => onEdit(camera)}
                      aria-label={`Edit ${camera.name}`}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="cameras-delete-button"
                      onClick={() => onDelete(camera)}
                      aria-label={`Delete ${camera.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CameraTable