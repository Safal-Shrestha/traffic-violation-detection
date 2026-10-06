import type {ChangePasswordRequest,LoginRequest,LoginResponse,MeResponse} from '../types/auth'
import { apiClient } from './apiClient'

export async function login(
  data: LoginRequest,
): Promise<LoginResponse> {
  return apiClient<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getCurrentUser(): Promise<MeResponse> {
  const token = sessionStorage.getItem('access_token')

  return apiClient<MeResponse>('/auth/me', {
    method: 'GET',
    token: token ?? undefined,
  })
}

export async function changePassword(
  data: ChangePasswordRequest,
): Promise<void> {
  const token = sessionStorage.getItem('access_token')

  await apiClient<void>('/auth/change-password', {
    method: 'POST',
    token: token ?? undefined,
    body: JSON.stringify(data),
  })
}