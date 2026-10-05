export type CameraStatus = 'online' | 'offline'

export interface Camera {
  id: number
  name: string
  location: string
  status: CameraStatus
  resolution: string
  fps: number
  ipAddress: string
  lastActive: string
  installedDate: string
}

export interface CamerasData {
  cameras: Camera[]
}