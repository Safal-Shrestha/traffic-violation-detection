import { violationsData } from '../mock-data/violations'
import type { ViolationsData } from '../types/violations'

const USE_MOCK_DATA = true

export async function getViolationsData(): Promise<ViolationsData> {
  if (USE_MOCK_DATA) {
    return violationsData
  }

  const response = await fetch('/api/violations')

  if (!response.ok) {
    throw new Error('Failed to fetch violations data')
  }

  return response.json()
}