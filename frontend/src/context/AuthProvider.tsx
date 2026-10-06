import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { AuthContext } from './AuthContext'
import type { User } from '../types/auth'
import { getCurrentUser } from '../services/authService'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] =
    useState<string | null>(null)
  const [expiresAt, setExpiresAt] =
    useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loginUser = (
    token: string,
    expiry: string,
    loggedInUser: User,
  ) => {
    setAccessToken(token)
    setExpiresAt(expiry)
    setUser(loggedInUser)

    sessionStorage.setItem('access_token', token)
    sessionStorage.setItem('expires_at', expiry)
  }

  const logoutUser = () => {
    setUser(null)
    setAccessToken(null)
    setExpiresAt(null)

    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('expires_at')
  }

  // Restore an existing session after page refresh.
  useEffect(() => {
    async function restoreSession() {
      const storedToken =
        sessionStorage.getItem('access_token')

      const storedExpiresAt =
        sessionStorage.getItem('expires_at')

      if (!storedToken || !storedExpiresAt) {
        setIsLoading(false)
        return
      }

      const expiryTime =
        new Date(storedExpiresAt).getTime()

      if (expiryTime <= Date.now()) {
        logoutUser()
        setIsLoading(false)
        return
      }

      try {
        const response = await getCurrentUser()

        setAccessToken(storedToken)
        setExpiresAt(storedExpiresAt)
        setUser(response.officer)
      } catch {
        logoutUser()
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  // Automatically log the user out when the token expires.
  useEffect(() => {
    if (!expiresAt || !accessToken) {
      return
    }

    const expiryTime =
      new Date(expiresAt).getTime()

    const remainingTime =
      expiryTime - Date.now()

    const timeoutId = window.setTimeout(() => {
      logoutUser()
    }, Math.max(remainingTime, 0))

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [expiresAt, accessToken])

  // Handle a 401 response from any API request.
  useEffect(() => {
    const handleUnauthorized = () => {
      logoutUser()
    }

    window.addEventListener(
      'auth:logout',
      handleUnauthorized,
    )

    return () => {
      window.removeEventListener(
        'auth:logout',
        handleUnauthorized,
      )
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        expiresAt,
        isAuthenticated:
          user !== null && accessToken !== null,
        isLoading,
        loginUser,
        logoutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}