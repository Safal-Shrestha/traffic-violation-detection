export interface DashboardStats {
  totalViolations: number
  todayViolations: number
  activeCameras: number
  monitoredVehicles: number
}

export interface ViolationSummary {
  label: string
  count: number
}

export interface CameraPreview {
  id: number
  name: string
  location: string
  status: 'online' | 'offline'
  vehiclesDetected: number
  image: string
}

export interface RecentViolation {
  id: number
  vehicleNumber: string
  violation: string
  camera: string
  time: string
  status: 'pending' | 'confirmed' | 'rejected'
}

export interface DashboardData {
  stats: DashboardStats
  violationSummary: ViolationSummary[]
  cameras: CameraPreview[]
  recentViolations: RecentViolation[]
}