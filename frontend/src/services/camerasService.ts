import { camerasData } from '../mock-data/cameras'
import type {Camera,CameraCreateRequest,CameraUpdateRequest,CamerasData} from '../types/cameras'
import { apiClient } from './apiClient'

const USE_MOCK_DATA = true

export async function getCamerasData(): Promise<CamerasData> {
  if (USE_MOCK_DATA) {
    return camerasData
  }

  return apiClient<CamerasData>('/cameras', {
    method: 'GET',
  })
}

export async function createCamera(
  data: CameraCreateRequest,
): Promise<Camera> {
  const token = sessionStorage.getItem('access_token')

  return apiClient<Camera>('/cameras', {
    method: 'POST',
    token: token ?? undefined,
    body: JSON.stringify(data),
  })
}

export async function updateCamera(
  id: string,
  data: CameraUpdateRequest,
): Promise<Camera> {
  const token = sessionStorage.getItem('access_token')

  return apiClient<Camera>(`/cameras/${id}`, {
    method: 'PATCH',
    token: token ?? undefined,
    body: JSON.stringify(data),
  })
}