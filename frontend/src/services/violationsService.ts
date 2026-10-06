import { violationsData } from '../mock-data/violations'

import type {
  AddViolationNoteRequest,
  ConfirmViolationRequest,
  Evidence,
  RejectViolationRequest,
  ReopenViolationRequest,
  ViolationActionResponse,
  ViolationDetail,
  ViolationListItem,
  ViolationsData,
} from '../types/violations'

import { apiClient } from './apiClient'

const USE_MOCK_DATA = false

interface ViolationsApiResponse {
  data: ViolationListItem[]
  page: {
    next_cursor: string | null
    has_more: boolean
  }
}

export async function getViolationsData(): Promise<ViolationsData> {
  if (USE_MOCK_DATA) {
    return violationsData
  }

  const response =
    await apiClient<ViolationsApiResponse>(
      '/violations',
      {
        method: 'GET',
      },
    )

  return {
    violations: response.data,
  }
}

export async function getViolation(
  id: string,
): Promise<ViolationDetail> {
  if (USE_MOCK_DATA) {
    const violation = violationsData.violations.find(
      (item) => item.id === id,
    )

    if (!violation) {
      throw new Error('Violation not found')
    }

    return {
      ...violation,
      track_id: null,
      session_id: null,
      detection_confidence: null,
      signal_state: null,
      vehicle: violation.vehicle
        ? {
            ...violation.vehicle,
            province_code: '',
            vehicle_category: '',
            vehicle_type: '',
          }
        : null,
      review: null,
      vehicle_proposal: null,
      metadata: {},
      evidence: [],
      created_at: violation.occurred_at,
    }
  }

  const token =
    sessionStorage.getItem('access_token')

  return apiClient<ViolationDetail>(
    `/violations/${id}`,
    {
      method: 'GET',
      token: token ?? undefined,
    },
  )
}

export async function confirmViolation(
  id: string,
  data: ConfirmViolationRequest = {},
): Promise<ViolationActionResponse> {
  const token =
    sessionStorage.getItem('access_token')

  return apiClient<ViolationActionResponse>(
    `/violations/${id}/confirm`,
    {
      method: 'POST',
      token: token ?? undefined,
      body: JSON.stringify(data),
    },
  )
}

export async function rejectViolation(
  id: string,
  data: RejectViolationRequest,
): Promise<ViolationActionResponse> {
  const token =
    sessionStorage.getItem('access_token')

  return apiClient<ViolationActionResponse>(
    `/violations/${id}/reject`,
    {
      method: 'POST',
      token: token ?? undefined,
      body: JSON.stringify(data),
    },
  )
}

export async function reopenViolation(
  id: string,
  data: ReopenViolationRequest,
): Promise<ViolationActionResponse> {
  const token =
    sessionStorage.getItem('access_token')

  return apiClient<ViolationActionResponse>(
    `/violations/${id}/reopen`,
    {
      method: 'POST',
      token: token ?? undefined,
      body: JSON.stringify(data),
    },
  )
}

export async function addViolationNote(
  id: string,
  data: AddViolationNoteRequest,
): Promise<ViolationActionResponse> {
  const token =
    sessionStorage.getItem('access_token')

  return apiClient<ViolationActionResponse>(
    `/violations/${id}/notes`,
    {
      method: 'POST',
      token: token ?? undefined,
      body: JSON.stringify(data),
    },
  )
}

export async function getViolationEvidence(
  id: string,
): Promise<Evidence[]> {
  const token =
    sessionStorage.getItem('access_token')

  return apiClient<Evidence[]>(
    `/violations/${id}/evidence`,
    {
      method: 'GET',
      token: token ?? undefined,
    },
  )
}

export async function getEvidence(
  id: string,
): Promise<Evidence> {
  const token =
    sessionStorage.getItem('access_token')

  return apiClient<Evidence>(
    `/evidence/${id}`,
    {
      method: 'GET',
      token: token ?? undefined,
    },
  )
}