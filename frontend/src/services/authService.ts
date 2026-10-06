import type {
  LoginRequest,
  LoginResponse,
  SignupRequest,
  SignupResponse,
} from '../types/auth'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1'

export async function signup(
  data: SignupRequest,
): Promise<SignupResponse> {
  void data
  return { success: false, message: 'Account signup is disabled. Ask an administrator to create your account.' }
}

export async function login(
  data: LoginRequest,
): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const result: LoginResponse = await response.json()
  if (!response.ok) throw new Error('Email or password is incorrect.')
  return result
}
