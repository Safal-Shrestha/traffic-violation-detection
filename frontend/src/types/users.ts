export type UserStatus = 'active' | 'inactive'

export type UserRole = 'administrator' | 'officer'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  status: UserStatus
  lastActive: string
  joinedDate: string
}

export interface UsersData {
  users: User[]
}