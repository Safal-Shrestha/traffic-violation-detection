export type UserRole = 'administrator' | 'officer'

export type UserStatus = 'active' | 'inactive'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  status: UserStatus
}

export interface SignupRequest {
  name: string
  email: string
  password: string
}

export interface SignupResponse {
  success: boolean
  message: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  expires_at: string
  officer: { id: number; name: string; email: string; role: string; badge_number: string }
}
