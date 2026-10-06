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

  const loginUser = (user: User, token: string, rememberMe: boolean) => {
    setUser(user)

    if (rememberMe) {
      localStorage.setItem('traffic-ai-user', JSON.stringify(user))
      localStorage.setItem('traffic-ai-token', token)
      sessionStorage.removeItem('traffic-ai-user')
      sessionStorage.removeItem('traffic-ai-token')
    } else {
      sessionStorage.setItem('traffic-ai-user', JSON.stringify(user))
      sessionStorage.setItem('traffic-ai-token', token)
      localStorage.removeItem('traffic-ai-user')
      localStorage.removeItem('traffic-ai-token')
    }
  }

  const logoutUser = () => {
    setUser(null)
    localStorage.removeItem('traffic-ai-user')
    localStorage.removeItem('traffic-ai-token')
    sessionStorage.removeItem('traffic-ai-user')
    sessionStorage.removeItem('traffic-ai-token')
  }

  return (
    <AuthContext.Provider value={{ user, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  )
}
