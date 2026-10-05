import { monitoringData } from '../mock-data/monitoring'
import type { MonitoringData } from '../types/monitoring'

const USE_MOCK_DATA = true

export async function getMonitoringData(): Promise<MonitoringData> {
  if (USE_MOCK_DATA) {
    return monitoringData
  }

  const response = await fetch('/api/monitoring')

  if (!response.ok) {
    throw new Error('Failed to fetch monitoring data')
  }

  return response.json()
}