import { createContext } from 'react'
import type { User } from '../types/auth'

export interface AuthContextType {
  user: User | null
  accessToken: string | null
  expiresAt: string | null
  isAuthenticated: boolean
  isLoading: boolean
  loginUser: (
    accessToken: string,
    expiresAt: string,
    user: User,
  ) => void
  logoutUser: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
)