export type UserRole = 'OFFICER' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  badge_number: string
  role: UserRole
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  expires_at: string
  officer: User
}

export interface MeResponse {
  officer: User
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}