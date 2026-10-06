import { apiClient } from './apiClient'

import type {
  DashboardData,
  CameraPreview,
  RecentViolation,
  ViolationSummary,
} from '../types/dashboard'

interface CameraApiResponse {
  data: CameraApiCamera[]
  page: {
    next_cursor: string | null
    has_more: boolean
  }
}

interface CameraApiCamera {
  id: string
  name: string
  district: string
  municipality: string
  status: 'ACTIVE' | 'INACTIVE'
  worker: {
    online: boolean
  }
}

interface ViolationApiResponse {
  data: ViolationApiItem[]
  page: {
    next_cursor: string | null
    has_more: boolean
  }
}

interface ViolationApiItem {
  id: string
  plate: string | null
  violation_type: {
    name: string
  }
  camera: {
    name: string
  }
  occurred_at: string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
}

function getNepalTodayRange() {
  const now = new Date()

  const nepalDate = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Kathmandu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    },
  ).format(now)

  const [year, month, day] =
    nepalDate.split('-')

  return {
    from: `${year}-${month}-${day}T00:00:00+05:45`,
    to: `${year}-${month}-${day}T23:59:59.999+05:45`,
  }
}

function mapCamera(
  camera: CameraApiCamera,
): CameraPreview {
  return {
    id: camera.id,
    name: camera.name,
    district: camera.district,
    municipality: camera.municipality,
    status: camera.status,
    workerOnline: camera.worker.online,
  }
}

function mapViolation(
  violation: ViolationApiItem,
): RecentViolation {
  return {
    id: violation.id,
    plate: violation.plate,
    violationType:
      violation.violation_type.name,
    camera: violation.camera.name,
    occurredAt: violation.occurred_at,
    status: violation.status,
  }
}

function createViolationSummary(
  violations: ViolationApiItem[],
): ViolationSummary[] {
  const counts = new Map<string, number>()

  violations.forEach((violation) => {
    const type =
      violation.violation_type.name

    counts.set(
      type,
      (counts.get(type) ?? 0) + 1,
    )
  })

  return Array.from(counts.entries()).map(
    ([label, count]) => ({
      label,
      count,
    }),
  )
}

export async function getDashboardData(): Promise<DashboardData> {
  const token =
    sessionStorage.getItem('access_token')

  const { from, to } =
    getNepalTodayRange()

  const [
    camerasResponse,
    violationsResponse,
    todayViolationsResponse,
  ] = await Promise.all([
    apiClient<CameraApiResponse>(
      '/cameras',
      {
        method: 'GET',
        token: token ?? undefined,
      },
    ),

    apiClient<ViolationApiResponse>(
      '/violations?limit=100',
      {
        method: 'GET',
        token: token ?? undefined,
      },
    ),

    apiClient<ViolationApiResponse>(
      `/violations?limit=100&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      {
        method: 'GET',
        token: token ?? undefined,
      },
    ),
  ])

  const cameras =
    camerasResponse.data.map(mapCamera)

  const violations =
    violationsResponse.data

  const todayViolations =
    todayViolationsResponse.data

  const recentViolations =
    [...violations]
      .sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() -
          new Date(a.occurred_at).getTime(),
      )
      .slice(0, 5)
      .map(mapViolation)

  const activeCameras =
    cameras.filter(
      (camera) =>
        camera.status === 'ACTIVE',
    ).length

  return {
    stats: {
      totalViolations:
        violations.length,

      todayViolations:
        todayViolations.length,

      activeCameras,

      // No confirmed backend endpoint
      // for currently monitored vehicles yet.
      monitoredVehicles: 0,
    },

    violationSummary:
      createViolationSummary(
        todayViolations,
      ),

    cameras,

    recentViolations,
  }
}