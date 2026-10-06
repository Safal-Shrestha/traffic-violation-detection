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
  const isAdministrator = user?.role === 'ADMIN'

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
            <th>District</th>
            <th>Municiplaity</th>
            <th>Resolution</th>
            <th>FPS</th>
            <th>Last Heartbeat</th>
            <th>Status</th>
            {isAdministrator && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {cameras.map((camera) => {
            const resolution =
              camera.calibration.frame_width !== null &&
              camera.calibration.frame_height !== null
                ? `${camera.calibration.frame_width} × ${camera.calibration.frame_height}`
                : 'Not available'

            const fps =
              camera.worker.fps !== null
                ? `${camera.worker.fps} FPS`
                : '—'

            const lastHeartbeat = camera.worker.last_heartbeat
              ? new Date(camera.worker.last_heartbeat).toLocaleString()
              : 'Never'

            return (
              <tr key={camera.id}>
                <td>
                  <div className="cameras-main-cell">
                    <div className="cameras-avatar">
                      <Camera size={17} />
                    </div>

                    <div>
                      <strong>{camera.name}</strong>
                      <span>
                        {camera.worker.online
                          ? 'Worker online'
                          : 'Worker offline'}
                      </span>
                    </div>
                  </div>
                </td>

                <td>{camera.district}</td>
                <td>{camera.municipality}</td>
                <td>{resolution}</td>
                <td>{fps}</td>
                <td>{lastHeartbeat}</td>
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
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default CameraTable