import { useEffect, useState } from 'react'

import '../css/monitoring.css'

import CameraSelector from '../components/monitoring/CameraSelector'
import LiveCameraFeed from '../components/monitoring/LiveCameraFeed'
import SelectedVehicle from '../components/monitoring/SelectedVehicle'
import DetectedVehicles from '../components/monitoring/DetectedVehicles'
import AIDetections from '../components/monitoring/AIDetections'

import { getMonitoringData } from '../services/monitoringService'
import type { MonitoringData } from '../types/monitoring'

function LiveMonitoring() {
  const [data, setData] =
    useState<MonitoringData | null>(null)

  const [selectedCameraId, setSelectedCameraId] =
    useState<number | null>(null)

  const [selectedVehicleId, setSelectedVehicleId] =
    useState<number | null>(null)

  useEffect(() => {
    getMonitoringData().then((monitoringData) => {
      setData(monitoringData)
      setSelectedCameraId(
        monitoringData.selectedCameraId,
      )
      setSelectedVehicleId(
        monitoringData.selectedVehicleId,
      )
    })
  }, [])

  if (!data || selectedCameraId === null) {
    return (
      <div className="monitoring-loading">
        Loading live monitoring...
      </div>
    )
  }

  const selectedCamera =
    data.cameras.find(
      (camera) => camera.id === selectedCameraId,
    ) ?? data.cameras[0]

  const selectedVehicle =
    data.detectedVehicles.find(
      (vehicle) => vehicle.id === selectedVehicleId,
    ) ?? null

  return (
    <div className="monitoring-page">
      {/* <div className="monitoring-heading">
        <div>
          <h1>Live Monitoring</h1>
        </div>

        <div className="monitoring-system-status">
          <span />
          System Active
        </div>
      </div> */}

      <div className="monitoring-layout">
        <aside className="monitoring-sidebar">
          <div className="monitoring-sidebar-title">
            <h3>Cameras</h3>
            <span>{data.cameras.length}</span>
          </div>

          <CameraSelector
            cameras={data.cameras}
            selectedCameraId={selectedCameraId}
            onSelect={setSelectedCameraId}
          />
        </aside>

        <main className="monitoring-main">
          <LiveCameraFeed camera={selectedCamera} />

          <div className="monitoring-bottom-grid">
            <SelectedVehicle vehicle={selectedVehicle} />

            <AIDetections
              detections={data.detections}
            />
          </div>

          <DetectedVehicles
            vehicles={data.detectedVehicles}
            selectedVehicleId={selectedVehicleId}
            onSelect={setSelectedVehicleId}
          />
        </main>
      </div>
    </div>
  )
}

export default LiveMonitoring