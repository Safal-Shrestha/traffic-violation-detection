export interface DetectedVehicle {
  id: number
  plateNumber: string
  vehicleType: string
  color: string
  confidence: number
  speed: number
  detectedAt: string
}

export interface Detection {
  id: number
  type: 'red-light' | 'stop-line' | 'helmet' | 'speed'
  label: string
  confidence: number
  timestamp: string
}

export interface MonitoringCamera {
  id: number
  name: string
  location: string
  status: 'online' | 'offline'
  resolution: string
  fps: number
  streamUrl?: string
}

export interface MonitoringData {
  cameras: MonitoringCamera[]
  selectedCameraId: number
  detectedVehicles: DetectedVehicle[]
  selectedVehicleId: number | null
  detections: Detection[]
}
