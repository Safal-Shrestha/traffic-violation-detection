import { API_BASE_URL } from './authService'
import type { Camera, CamerasData } from '../types/cameras'

type ApiCamera = {
  id: string
  name: string
  district?: string | null
  municipality?: string | null
  status: string
  installed_at?: string | null
  provisioning: { status: string; source_video: string | null; error: string | null }
  calibration: { status: string; config_version: number; frame_width: number | null; frame_height: number | null }
  worker: { online: boolean; fps?: number | null; last_heartbeat?: string | null }
}

export type CalibrationInput = {
  frame_width: number
  frame_height: number
  red_grace_seconds: number
  stop_line: { p1: { x: number; y: number }; p2: { x: number; y: number }; approach_side: 'above' | 'below' }
  expected_config_version: number
}

function token() {
  return localStorage.getItem('traffic-ai-token') || sessionStorage.getItem('traffic-ai-token') || ''
}

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...init.headers,
    },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message || 'Camera request failed')
  return body
}

function toCamera(camera: ApiCamera): Camera {
  return {
    id: camera.id,
    name: camera.name,
    location: [camera.municipality, camera.district].filter(Boolean).join(', ') || 'Unspecified location',
    status: camera.worker.online ? 'online' : 'offline',
    resolution: camera.calibration.frame_width && camera.calibration.frame_height
      ? `${camera.calibration.frame_width} × ${camera.calibration.frame_height}` : 'Pending calibration',
    fps: Math.round(camera.worker.fps || 0),
    ipAddress: camera.provisioning.source_video || camera.id,
    lastActive: camera.worker.last_heartbeat || 'Waiting for worker',
    installedDate: camera.installed_at || '—',
    provisioningStatus: camera.provisioning.status,
    provisioningError: camera.provisioning.error,
    calibrationStatus: camera.calibration.status,
    configVersion: camera.calibration.config_version,
  }
}

export async function getCamerasData(): Promise<CamerasData> {
  const body = await api('/cameras')
  return { cameras: (body.data as ApiCamera[]).map(toCamera) }
}

export async function createCamera(input: { name: string; district: string; municipality: string }) {
  const body = await api('/cameras', { method: 'POST', body: JSON.stringify(input) })
  return toCamera(body as ApiCamera)
}

export async function saveCalibration(cameraId: string, input: CalibrationInput) {
  await api(`/cameras/${cameraId}/config`, { method: 'PUT', body: JSON.stringify(input) })
}
