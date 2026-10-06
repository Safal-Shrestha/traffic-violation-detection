import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  Car,
  ShieldAlert,
} from 'lucide-react'
import { useNavigate } from 'react-router'

import '../css/dashboard.css'

import DashboardStatCard from '../components/dashboard/DashboardStatCard'
import ViolationOverview from '../components/dashboard/ViolationOverview'
import LiveCameraPreview from '../components/dashboard/LiveCameraPreview'
import RecentViolations from '../components/dashboard/RecentViolations'
import CameraStatus from '../components/dashboard/CameraStatus'

import { getDashboardData } from '../services/dashboardService'
import type { DashboardData } from '../types/dashboard'

function Dashboard() {
  const navigate = useNavigate()

  const [data, setData] =
    useState<DashboardData | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const dashboardData =
          await getDashboardData()

        setData(dashboardData)
      } catch {
        setError(
          'Unable to load dashboard data.',
        )
      }
    }

    loadDashboard()
  }, [])

  if (error) {
    return (
      <div className="dashboard-loading">
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="dashboard-loading">
        Loading dashboard...
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-stats">
        <DashboardStatCard
          title="Total Violations"
          value={data.stats.totalViolations}
          icon={ShieldAlert}
          description="Recorded violations"
        />

        <DashboardStatCard
          title="Today's Violations"
          value={data.stats.todayViolations}
          icon={AlertTriangle}
          description="Detected today"
        />

        <DashboardStatCard
          title="Active Cameras"
          value={data.stats.activeCameras}
          icon={Camera}
          description="Currently monitoring"
        />

        <DashboardStatCard
          title="Monitored Vehicles"
          value={data.stats.monitoredVehicles}
          icon={Car}
          description="Currently detected"
        />
      </div>

      <div className="dashboard-grid dashboard-grid-top">
        <ViolationOverview
          violations={data.violationSummary}
        />

        <CameraStatus
          cameras={data.cameras}
        />
      </div>

      <LiveCameraPreview
        cameras={data.cameras}
        onCameraClick={() =>
          navigate('/live')
        }
      />

      <RecentViolations
        violations={data.recentViolations}
        onViewViolation={(id) =>
          navigate(`/violations/${id}`)
        }
      />
    </div>
  )
}

export default Dashboard