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

export type SignalState = 'RED' | 'YELLOW' | 'GREEN'

export interface CameraSignalState {
  camera_id: string
  state: SignalState
  updated_at: string
}

export async function getCameraSignalState(
  cameraId: string,
): Promise<CameraSignalState> {
  const token = sessionStorage.getItem('access_token')
  return apiClient<CameraSignalState>(
    `/cameras/${cameraId}/signal`,
    { method: 'GET', token: token ?? undefined },
  )
}

export async function setCameraSignalState(
  cameraId: string,
  state: SignalState,
): Promise<CameraSignalState> {
  const token = sessionStorage.getItem('access_token')
  return apiClient<CameraSignalState>(
    `/cameras/${cameraId}/signal`,
    {
      method: 'PUT',
      token: token ?? undefined,
      body: JSON.stringify({ state }),
    },
  )
}
