export type UserRole = 'ADMIN' | 'OFFICER'

export interface User {
  id: string
  name: string
  badge_number: string
  role: UserRole
  email: string
}

export interface UsersData {
  users: User[]
}

export interface CreateUserRequest {
  name: string
  badge_number: string
  role: UserRole
  email: string
  password: string
}