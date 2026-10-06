import type {
  Camera,
  CameraCreateRequest,
} from '../types/monitoring'

import { apiClient } from './apiClient'

interface CamerasApiResponse {
  data: Camera[]
}

export async function getCameras(): Promise<Camera[]> {
  const token =
    sessionStorage.getItem('access_token')

  const response =
    await apiClient<CamerasApiResponse>(
      '/cameras',
      {
        method: 'GET',
        token: token ?? undefined,
      },
    )

  return response.data
}

export async function getCamera(
  id: string,
): Promise<Camera> {
  const token =
    sessionStorage.getItem('access_token')

  return apiClient<Camera>(
    `/cameras/${id}`,
    {
      method: 'GET',
      token: token ?? undefined,
    },
  )
}

export async function createCamera(
  data: CameraCreateRequest,
): Promise<Camera> {
  const token =
    sessionStorage.getItem('access_token')

  return apiClient<Camera>(
    '/cameras',
    {
      method: 'POST',
      token: token ?? undefined,
      body: JSON.stringify(data),
    },
  )
}