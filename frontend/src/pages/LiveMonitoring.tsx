import { useEffect, useState } from 'react'

import '../css/monitoring.css'

import CameraSelector from '../components/monitoring/CameraSelector'
import LiveCameraFeed from '../components/monitoring/LiveCameraFeed'
import AddCameraModal from '../components/monitoring/AddCameraModal'

import {
  createCamera,
  getCamera,
  getCameras,
} from '../services/monitoringService'

import type {
  Camera,
  CameraCreateRequest,
} from '../types/monitoring'

function LiveMonitoring() {
  const [cameras, setCameras] =
    useState<Camera[]>([])

  const [selectedCameraId, setSelectedCameraId] =
    useState<string | null>(null)

  const [selectedCamera, setSelectedCamera] =
    useState<Camera | null>(null)

  const [isLoading, setIsLoading] =
    useState(true)

  const [isAddCameraOpen, setIsAddCameraOpen] =
    useState(false)

  useEffect(() => {
    async function loadCameras() {
      try {
        const cameraList =
          await getCameras()

        setCameras(cameraList)

        if (cameraList.length > 0) {
          setSelectedCameraId(
            cameraList[0].id,
          )
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadCameras()
  }, [])

  useEffect(() => {
    if (!selectedCameraId) {
      return
    }

    const cameraId =
      selectedCameraId

    async function loadSelectedCamera() {
      const camera =
        await getCamera(cameraId)

      setSelectedCamera(camera)
    }

    loadSelectedCamera()
  }, [selectedCameraId])

  const handleAddCamera = async (
    data: CameraCreateRequest,
  ) => {
    const newCamera =
      await createCamera(data)

    setCameras((currentCameras) => [
      ...currentCameras,
      newCamera,
    ])

    setSelectedCameraId(
      newCamera.id,
    )

    setIsAddCameraOpen(false)
  }

  if (isLoading) {
    return (
      <div className="monitoring-loading">
        Loading live monitoring...
      </div>
    )
  }

  if (cameras.length === 0) {
    return (
      <>
        <div className="monitoring-loading">
          <p>No cameras available.</p>

          <button
            type="button"
            className="monitoring-empty-add-button"
            onClick={() =>
              setIsAddCameraOpen(true)
            }
          >
            Add Camera
          </button>
        </div>

        {isAddCameraOpen && (
          <AddCameraModal
            onClose={() =>
              setIsAddCameraOpen(false)
            }
            onAdd={handleAddCamera}
          />
        )}
      </>
    )
  }

  return (
    <div className="monitoring-page">
      <div className="monitoring-layout">
        <aside className="monitoring-sidebar">
          <div className="monitoring-sidebar-title">
            <h3>Cameras</h3>

            <span>
              {cameras.length}
            </span>
          </div>

          <CameraSelector
            cameras={cameras}
            selectedCameraId={
              selectedCameraId
            }
            onSelect={
              setSelectedCameraId
            }
            onAddCamera={() =>
              setIsAddCameraOpen(true)
            }
          />
        </aside>

        <main className="monitoring-main">
          {selectedCamera ? (
            <LiveCameraFeed
              camera={selectedCamera}
            />
          ) : (
            <div className="monitoring-loading">
              Loading camera...
            </div>
          )}
        </main>
      </div>

      {isAddCameraOpen && (
        <AddCameraModal
          onClose={() =>
            setIsAddCameraOpen(false)
          }
          onAdd={handleAddCamera}
        />
      )}
    </div>
  )
}

export default LiveMonitoring