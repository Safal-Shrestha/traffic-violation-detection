import { camerasData } from '../mock-data/cameras'
import type {Camera,CameraCreateRequest,CameraUpdateRequest,CamerasData} from '../types/cameras'
import { apiClient } from './apiClient'

const USE_MOCK_DATA = false

interface CameraIndexResponse {
  data: Camera[]
  page: { next_cursor: string | null; has_more: boolean }
}

export async function getCamerasData(): Promise<CamerasData> {
  if (USE_MOCK_DATA) {
    return camerasData
  }

  const response = await apiClient<CameraIndexResponse>('/cameras', {
    method: 'GET',
    token: sessionStorage.getItem('access_token') ?? undefined,
  })
  return { cameras: response.data.map((camera) => ({
    ...camera,
    installed_at: camera.installed_at ?? '',
  })) }
}

export async function getCameraConfig(id: string) {
  return apiClient<import('../types/cameras').CameraConfig>(`/cameras/${id}/config`, {
    method: 'GET',
    token: sessionStorage.getItem('access_token') ?? undefined,
  })
}

export async function updateCameraConfig(
  id: string,
  data: import('../types/cameras').UpdateCameraConfigRequest,
) {
  return apiClient<import('../types/cameras').CameraConfig>(`/cameras/${id}/config`, {
    method: 'PUT',
    token: sessionStorage.getItem('access_token') ?? undefined,
    body: JSON.stringify(data),
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
