import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Camera,
  CircleCheck,
  Plus,
} from 'lucide-react'

import CameraStatCard from '../components/cameras/CameraStatCard'
import CameraFilters from '../components/cameras/CameraFilters'
import CameraTable from '../components/cameras/CameraTable'
import EditCameraModal from '../components/cameras/EditCameraModal'
import DeleteCameraModal from '../components/cameras/DeleteCameraModal'

import { getCamerasData } from '../services/camerasService'

import type {
  Camera as CameraType,
  CameraStatus,
  CamerasData,
} from '../types/cameras'

import '../css/cameras.css'
import { useAuth } from '../context/useAuth'

function Cameras() {
  const { user } = useAuth()
  const isAdministrator = user?.role === 'ADMIN'

  const [data, setData] = useState<CamerasData | null>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CameraStatus | 'all'>('all')

  const [editingCamera, setEditingCamera] =
    useState<CameraType | null>(null)

  const [deletingCamera, setDeletingCamera] =
    useState<CameraType | null>(null)

  useEffect(() => {
    getCamerasData().then(setData)
  }, [])

  const filteredCameras = useMemo(() => {
    if (!data) return []

    return data.cameras.filter((camera) => {
      const searchValue = search.toLowerCase()

      const matchesSearch =
        camera.name.toLowerCase().includes(searchValue) ||
        camera.district.toLowerCase().includes(searchValue) ||
        camera.municipality.toLowerCase().includes(searchValue)

      const matchesStatus =
        status === 'all' || camera.status === status

      return matchesSearch && matchesStatus
    })
  }, [data, search, status])

  if (!data) {
    return (
      <div className="cameras-loading">
        Loading cameras...
      </div>
    )
  }

  const totalCameras = data.cameras.length

  const onlineCameras = data.cameras.filter(
    (camera) => camera.worker.online,
  ).length

  const offlineCameras = data.cameras.filter(
    (camera) => !camera.worker.online,
  ).length

  const camerasWithFps = data.cameras.filter(
    (camera) => camera.worker.fps !== null,
  )

  const averageFps =
    camerasWithFps.length > 0
      ? Math.round(
          camerasWithFps.reduce(
            (total, camera) => total + (camera.worker.fps ?? 0),
            0,
          ) / camerasWithFps.length,
        )
      : 0

  const handleEditCamera = (camera: CameraType) => {
    setEditingCamera(camera)
  }

  const handleSaveCamera = (updatedCamera: CameraType) => {
    setData((currentData) => {
      if (!currentData) return currentData

      return {
        ...currentData,
        cameras: currentData.cameras.map((camera) =>
          camera.id === updatedCamera.id
            ? updatedCamera
            : camera,
        ),
      }
    })

    setEditingCamera(null)
  }

  const handleDeleteCamera = (camera: CameraType) => {
    setDeletingCamera(camera)
  }

  const handleConfirmDelete = () => {
    if (!deletingCamera) return

    setData((currentData) => {
      if (!currentData) return currentData

      return {
        ...currentData,
        cameras: currentData.cameras.filter(
          (camera) => camera.id !== deletingCamera.id,
        ),
      }
    })

    setDeletingCamera(null)
  }

  return (
    <div className="cameras-page">
      <div className="cameras-stats">
        <CameraStatCard
          title="Total Cameras"
          value={String(totalCameras)}
          description="Registered cameras"
          icon={<Camera size={20} />}
        />

        <CameraStatCard
          title="Online Cameras"
          value={String(onlineCameras)}
          description="Currently connected"
          icon={<CircleCheck size={20} />}
        />

        <CameraStatCard
          title="Offline Cameras"
          value={String(offlineCameras)}
          description="Currently disconnected"
          icon={<Activity size={20} />}
        />

        <CameraStatCard
          title="Average FPS"
          value={String(averageFps)}
          description="Across connected cameras"
          icon={<Activity size={20} />}
        />
      </div>

      <section className="cameras-content">
        <div className="cameras-content-header">
          <div>
            <h2>All Cameras</h2>
            <p>
              {filteredCameras.length} camera
              {filteredCameras.length !== 1 ? 's' : ''} found
            </p>
          </div>

          {isAdministrator && (
            <button
              type="button"
              className="cameras-add-button"
            >
              <Plus size={17} />
              Add Camera
            </button>
          )}
        </div>

        <CameraFilters
          search={search}
          status={status}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
        />

        <CameraTable
          cameras={filteredCameras}
          onEdit={handleEditCamera}
          onDelete={handleDeleteCamera}
        />
      </section>

      {editingCamera && (
        <EditCameraModal
          camera={editingCamera}
          onClose={() => setEditingCamera(null)}
          onSave={handleSaveCamera}
        />
      )}

      {deletingCamera && (
        <DeleteCameraModal
          camera={deletingCamera}
          onClose={() => setDeletingCamera(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}

export default Cameras