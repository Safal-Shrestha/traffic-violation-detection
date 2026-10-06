import { usersData } from '../mock-data/users'

import type {
  CreateUserRequest,
  UpdateUserRequest,
  User,
  UsersData,
} from '../types/users'

import { apiClient } from './apiClient'

const USE_MOCK_DATA = false

interface OfficersApiResponse {
  data: User[]
  page: {
    next_cursor: string | null
    has_more: boolean
  }
}

export async function getUsersData(): Promise<UsersData> {
  if (USE_MOCK_DATA) {
    return usersData
  }

  const token =
    sessionStorage.getItem('access_token')

  const response =
    await apiClient<OfficersApiResponse>(
      '/officers',
      {
        method: 'GET',
        token: token ?? undefined,
      },
    )

  return {
    users: response.data,
  }
}

export async function createUser(
  data: CreateUserRequest,
): Promise<User> {
  if (USE_MOCK_DATA) {
    const newUser: User = {
      id: crypto.randomUUID(),
      name: data.name,
      badge_number: data.badge_number,
      role: data.role,
      email: data.email,
    }

    return newUser
  }

  const token =
    sessionStorage.getItem('access_token')

  return apiClient<User>('/officers', {
    method: 'POST',
    token: token ?? undefined,
    body: JSON.stringify(data),
  })
}

export async function updateUser(
  id: string,
  data: UpdateUserRequest,
): Promise<User> {
  if (USE_MOCK_DATA) {
    return {
      id,
      name: data.name ?? '',
      badge_number: data.badge_number ?? '',
      role: data.role ?? 'OFFICER',
      email: data.email ?? '',
    }
  }

  const token =
    sessionStorage.getItem('access_token')

  return apiClient<User>(`/officers/${id}`, {
    method: 'PATCH',
    token: token ?? undefined,
    body: JSON.stringify(data),
  })
}