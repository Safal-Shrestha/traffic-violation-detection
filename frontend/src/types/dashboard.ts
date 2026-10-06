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
  id: string
  name: string
  district: string
  municipality: string
  status: 'ACTIVE' | 'INACTIVE'
  workerOnline: boolean
}

export interface RecentViolation {
  id: string
  plate: string | null
  violationType: string
  camera: string
  occurredAt: string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
}

export interface DashboardData {
  stats: DashboardStats
  violationSummary: ViolationSummary[]
  cameras: CameraPreview[]
  recentViolations: RecentViolation[]
}