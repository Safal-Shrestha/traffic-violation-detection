import { analyticsData } from '../mock-data/analytics'
import type { AnalyticsData } from '../types/analytics'

const USE_MOCK_DATA = true

export async function getAnalyticsData(): Promise<AnalyticsData> {
  if (USE_MOCK_DATA) {
    return analyticsData
  }

  const response = await fetch('/api/analytics')

  if (!response.ok) {
    throw new Error('Failed to fetch analytics data')
  }

  return response.json()
}