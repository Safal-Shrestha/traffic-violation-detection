import { vehiclesData } from '../mock-data/vehicles'
import type { VehiclesData } from '../types/vehicles'

const USE_MOCK_DATA = true

export async function getVehiclesData(): Promise<VehiclesData> {
  if (USE_MOCK_DATA) {
    return vehiclesData
  }

  const response = await fetch('/api/vehicles')

  if (!response.ok) {
    throw new Error('Failed to fetch vehicles data')
  }

  return response.json()
}