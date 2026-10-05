import { dashboardData } from '../mock-data/dashboard'
import type { DashboardData } from '../types/dashboard'

const USE_MOCK_DATA = true

export async function getDashboardData(): Promise<DashboardData> {
  if (USE_MOCK_DATA) {
    return dashboardData
  }

  const response = await fetch('/api/dashboard')

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data')
  }

  return response.json()
}