export type CameraStatus = 'online' | 'offline'

export interface Camera {
  id: string | number
  name: string
  location: string
  status: CameraStatus
  resolution: string
  fps: number
  ipAddress: string
  lastActive: string
  installedDate: string
  provisioningStatus?: string
  provisioningError?: string | null
  calibrationStatus?: string
  configVersion?: number
}

export interface CamerasData {
  cameras: Camera[]
}
