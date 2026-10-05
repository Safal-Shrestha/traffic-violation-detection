import { camerasData } from '../mock-data/cameras'
import type { CamerasData } from '../types/cameras'

const USE_MOCK_DATA = true

export async function getCamerasData(): Promise<CamerasData> {
  if (USE_MOCK_DATA) {
    return camerasData
  }

  const response = await fetch('/api/cameras')

  if (!response.ok) {
    throw new Error('Failed to fetch cameras data')
  }

  return response.json()
}