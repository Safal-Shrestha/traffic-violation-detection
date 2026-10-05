import {
  useState,
  type ReactNode,
} from 'react'
import { AuthContext } from './AuthContext'
import type { User } from '../types/auth'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser =
      localStorage.getItem('traffic-ai-user') ||
      sessionStorage.getItem('traffic-ai-user')

    return storedUser ? JSON.parse(storedUser) : null
  })

  const loginUser = (user: User, rememberMe: boolean) => {
    setUser(user)

    if (rememberMe) {
      localStorage.setItem('traffic-ai-user', JSON.stringify(user))
      sessionStorage.removeItem('traffic-ai-user')
    } else {
      sessionStorage.setItem('traffic-ai-user', JSON.stringify(user))
      localStorage.removeItem('traffic-ai-user')
    }
  }

  const logoutUser = () => {
    setUser(null)
    localStorage.removeItem('traffic-ai-user')
    sessionStorage.removeItem('traffic-ai-user')
  }

  return (
    <AuthContext.Provider value={{ user, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  )
}