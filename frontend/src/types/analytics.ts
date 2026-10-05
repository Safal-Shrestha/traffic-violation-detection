export interface AnalyticsStats {
  totalViolations: number
  todayViolations: number
  averagePerDay: number
  averageConfidence: number
}

export interface ViolationTrend {
  date: string
  violations: number
}

export interface ViolationTypeCount {
  type: string
  count: number
}

export interface CameraActivity {
  camera: string
  violations: number
}

export interface DetectionPerformance {
  type: string
  confidence: number
}

export interface AnalyticsData {
  stats: AnalyticsStats
  violationTrend: ViolationTrend[]
  violationTypes: ViolationTypeCount[]
  cameraActivity: CameraActivity[]
  detectionPerformance: DetectionPerformance[]
}