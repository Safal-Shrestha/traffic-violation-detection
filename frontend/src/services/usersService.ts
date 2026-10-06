import { usersData } from '../mock-data/users'
import type {
  CreateUserRequest,
  User,
  UsersData,
} from '../types/users'
import { apiClient } from './apiClient'

const USE_MOCK_DATA = true

export async function getUsersData(): Promise<UsersData> {
  if (USE_MOCK_DATA) {
    return usersData
  }

  return apiClient<UsersData>('/officers', {
    method: 'GET',
  })
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

  const token = sessionStorage.getItem('access_token')

  return apiClient<User>('/officers', {
    method: 'POST',
    token: token ?? undefined,
    body: JSON.stringify(data),
  })
}