import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Gauge,
  ShieldCheck,
} from 'lucide-react'

import AnalyticsStatCard from '../components/analytics/AnalyticsStatCard'
import ViolationTrendChart from '../components/analytics/ViolationTrendChart'
import ViolationTypeChart from '../components/analytics/ViolationTypeChart'
import CameraActivity from '../components/analytics/CameraActivity'
import DetectionPerformance from '../components/analytics/DetectionPerformance'

import { getAnalyticsData } from '../services/analyticsService'
import type { AnalyticsData } from '../types/analytics'

import '../css/analytics.css'

function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    getAnalyticsData().then(setData)
  }, [])

  if (!data) {
    return (
      <div className="analytics-loading">
        Loading analytics...
      </div>
    )
  }

  return (
    <div className="analytics-page">
      {/* <div className="analytics-heading">
        <div>
          <h1>Analytics</h1>
        </div>

        <div className="analytics-period">
          Last 7 days
        </div>
      </div> */}

      <div className="analytics-stats">
        <AnalyticsStatCard
          title="Total Violations"
          value={data.stats.totalViolations.toLocaleString()}
          icon={<AlertTriangle size={20} />}
        />

        <AnalyticsStatCard
          title="Today's Violations"
          value={String(data.stats.todayViolations)}
          icon={<BarChart3 size={20} />}
        />

        <AnalyticsStatCard
          title="Average Per Day"
          value={data.stats.averagePerDay.toFixed(1)}
          icon={<Gauge size={20} />}
        />

        <AnalyticsStatCard
          title="AI Confidence"
          value={`${data.stats.averageConfidence}%`}
          icon={<ShieldCheck size={20} />}
        />
      </div>

      <div className="analytics-main-grid">
        <ViolationTrendChart
          data={data.violationTrend}
        />

        <ViolationTypeChart
          data={data.violationTypes}
        />
      </div>

      <div className="analytics-main-grid">
        <CameraActivity
          data={data.cameraActivity}
        />

        <DetectionPerformance
          data={data.detectionPerformance}
        />
      </div>
    </div>
  )
}

export default Analytics