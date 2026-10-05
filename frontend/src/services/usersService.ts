import { usersData } from '../mock-data/users'
import type { UsersData } from '../types/users'

const USE_MOCK_DATA = true

export async function getUsersData(): Promise<UsersData> {
  if (USE_MOCK_DATA) {
    return usersData
  }

  const response = await fetch('/api/users')

  if (!response.ok) {
    throw new Error('Failed to fetch users data')
  }

  return response.json()
}