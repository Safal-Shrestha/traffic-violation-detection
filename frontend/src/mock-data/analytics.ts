import type { AnalyticsData } from '../types/analytics'

export const analyticsData: AnalyticsData = {
  stats: {
    totalViolations: 1248,
    todayViolations: 37,
    averagePerDay: 41.6,
    averageConfidence: 94.8,
  },

  violationTrend: [
    { date: 'Sep 25', violations: 42 },
    { date: 'Sep 26', violations: 38 },
    { date: 'Sep 27', violations: 51 },
    { date: 'Sep 28', violations: 45 },
    { date: 'Sep 29', violations: 34 },
    { date: 'Sep 30', violations: 48 },
    { date: 'Oct 1', violations: 37 },
  ],

  violationTypes: [
    { type: 'Red Light', count: 412 },
    { type: 'No Helmet', count: 326 },
    { type: 'Stop Line', count: 287 },
    { type: 'Speeding', count: 223 },
  ],

  cameraActivity: [
    { camera: 'Camera 01', violations: 486 },
    { camera: 'Camera 02', violations: 398 },
    { camera: 'Camera 03', violations: 214 },
    { camera: 'Camera 04', violations: 150 },
  ],

  detectionPerformance: [
    { type: 'Red Light', confidence: 97 },
    { type: 'No Helmet', confidence: 98 },
    { type: 'Stop Line', confidence: 94 },
    { type: 'Speeding', confidence: 91 },
  ],
}