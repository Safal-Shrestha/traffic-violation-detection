import { createContext } from 'react'
import type { User } from '../types/auth'

export interface AuthContextType {
  user: User | null
  loginUser: (user: User, token: string, rememberMe: boolean) => void
  logoutUser: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
)
