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

import { createCamera, getCamerasData, saveCalibration } from '../services/camerasService'

import type {
  Camera as CameraType,
  CameraStatus,
  CamerasData,
} from '../types/cameras'

import '../css/cameras.css'
import { useAuth } from '../context/useAuth'

function Cameras() {
  const { user } = useAuth()
  const isAdministrator = user?.role === 'administrator'

  const [data, setData] = useState<CamerasData | null>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] =
    useState<CameraStatus | 'all'>('all')

  const [editingCamera, setEditingCamera] =
    useState<CameraType | null>(null)

  const [deletingCamera, setDeletingCamera] =
    useState<CameraType | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [cameraName, setCameraName] = useState('')
  const [district, setDistrict] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [calibratingCamera, setCalibratingCamera] = useState<CameraType | null>(null)
  const [frameWidth, setFrameWidth] = useState('1280')
  const [frameHeight, setFrameHeight] = useState('720')
  const [p1x, setP1x] = useState('100')
  const [p1y, setP1y] = useState('500')
  const [p2x, setP2x] = useState('1180')
  const [p2y, setP2y] = useState('500')
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    let active = true
    const refresh = () => getCamerasData().then((next) => { if (active) setData(next) })
      .catch((error: Error) => { if (active) setApiError(error.message) })
    refresh()
    const timer = window.setInterval(refresh, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  const filteredCameras = useMemo(() => {
    if (!data) return []

    return data.cameras.filter((camera) => {
      const searchValue = search.toLowerCase()

      const matchesSearch =
        camera.name.toLowerCase().includes(searchValue) ||
        camera.location.toLowerCase().includes(searchValue) ||
        camera.ipAddress.toLowerCase().includes(searchValue)

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
    (camera) => camera.status === 'online',
  ).length

  const offlineCameras = data.cameras.filter(
    (camera) => camera.status === 'offline',
  ).length

  const averageFps =
    totalCameras > 0
      ? Math.round(
          data.cameras.reduce(
            (total, camera) => total + camera.fps,
            0,
          ) / totalCameras,
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

  const handleCreateCamera = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError('')
    try {
      const camera = await createCamera({ name: cameraName, district, municipality })
      setData((current) => ({ cameras: [...(current?.cameras || []), camera] }))
      setShowAddForm(false)
      setCameraName('')
      setDistrict('')
      setMunicipality('')
      setCalibratingCamera(camera)
      setApiError('Camera created. The manager is selecting an unused demo video and starting its worker. Confirm the source frame size before saving calibration.')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not add camera')
    }
  }

  const handleSaveCalibration = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!calibratingCamera) return
    setApiError('')
    try {
      await saveCalibration(String(calibratingCamera.id), {
        frame_width: Number(frameWidth), frame_height: Number(frameHeight),
        red_grace_seconds: 0,
        stop_line: {
          p1: { x: Number(p1x), y: Number(p1y) },
          p2: { x: Number(p2x), y: Number(p2y) },
          approach_side: 'below',
        },
        expected_config_version: calibratingCamera.configVersion || 1,
      })
      setCalibratingCamera(null)
      const next = await getCamerasData()
      setData(next)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not save calibration')
    }
  }

  return (
    <div className="cameras-page">
      {/* <div className="cameras-heading">
        <div>
          <h1>Cameras</h1>
        </div>
      </div> */}

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
          description="Across all cameras"
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
              onClick={() => { setApiError(''); setShowAddForm(true) }}
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
          onCalibrate={(camera) => { setApiError(''); setCalibratingCamera(camera) }}
        />
      </section>

      {apiError && <p role="status" className="cameras-api-message">{apiError}</p>}

      {showAddForm && <div className="cameras-modal-overlay">
        <form className="cameras-modal" onSubmit={handleCreateCamera}>
          <div className="cameras-modal-header"><div><h2>Add Camera</h2><p>A unique demo video and worker will be assigned automatically.</p></div></div>
          <div className="cameras-modal-body">
            <label className="cameras-form-group">Camera name<input required value={cameraName} onChange={(e) => setCameraName(e.target.value)} /></label>
            <label className="cameras-form-group">District<input value={district} onChange={(e) => setDistrict(e.target.value)} /></label>
            <label className="cameras-form-group">Municipality<input value={municipality} onChange={(e) => setMunicipality(e.target.value)} /></label>
          </div>
          <div className="cameras-modal-footer"><button type="button" className="cameras-modal-cancel" onClick={() => setShowAddForm(false)}>Cancel</button><button className="cameras-modal-save">Create and configure</button></div>
        </form>
      </div>}

      {calibratingCamera && <div className="cameras-modal-overlay">
        <form className="cameras-modal" onSubmit={handleSaveCalibration}>
          <div className="cameras-modal-header"><div><h2>Configure {calibratingCamera.name}</h2><p>Enter the source frame dimensions and stop-line coordinates in pixels.</p><small>Camera ID: {calibratingCamera.id} · Worker: {calibratingCamera.provisioningStatus}</small></div></div>
          <div className="cameras-modal-body">
            <div className="cameras-form-row"><label className="cameras-form-group">Frame width<input type="number" min="1" value={frameWidth} onChange={(e) => setFrameWidth(e.target.value)} required /></label><label className="cameras-form-group">Frame height<input type="number" min="1" value={frameHeight} onChange={(e) => setFrameHeight(e.target.value)} required /></label></div>
            <div className="cameras-form-row"><label className="cameras-form-group">Point 1 X<input type="number" value={p1x} onChange={(e) => setP1x(e.target.value)} required /></label><label className="cameras-form-group">Point 1 Y<input type="number" value={p1y} onChange={(e) => setP1y(e.target.value)} required /></label></div>
            <div className="cameras-form-row"><label className="cameras-form-group">Point 2 X<input type="number" value={p2x} onChange={(e) => setP2x(e.target.value)} required /></label><label className="cameras-form-group">Point 2 Y<input type="number" value={p2y} onChange={(e) => setP2y(e.target.value)} required /></label></div>
          </div>
          <div className="cameras-modal-footer"><button type="button" className="cameras-modal-cancel" onClick={() => setCalibratingCamera(null)}>Configure later</button><button className="cameras-modal-save">Save calibration</button></div>
        </form>
      </div>}

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
