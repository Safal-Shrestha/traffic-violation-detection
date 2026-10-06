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

interface StoredAuth {
  user: User | null
  accessToken: string | null
  expiresAt: string | null
}

function getStoredAuth(): StoredAuth {
  const accessToken =
    sessionStorage.getItem('access_token')

  const expiresAt =
    sessionStorage.getItem('expires_at')

  const storedUser =
    sessionStorage.getItem('user')

  if (
    !accessToken ||
    !expiresAt ||
    !storedUser
  ) {
    return {
      user: null,
      accessToken: null,
      expiresAt: null,
    }
  }

  const expiryTime =
    new Date(expiresAt).getTime()

  if (expiryTime <= Date.now()) {
    sessionStorage.removeItem(
      'access_token',
    )
    sessionStorage.removeItem(
      'expires_at',
    )
    sessionStorage.removeItem('user')

    return {
      user: null,
      accessToken: null,
      expiresAt: null,
    }
  }

  try {
    const user =
      JSON.parse(storedUser) as User

    return {
      user,
      accessToken,
      expiresAt,
    }
  } catch {
    sessionStorage.removeItem(
      'access_token',
    )
    sessionStorage.removeItem(
      'expires_at',
    )
    sessionStorage.removeItem('user')

    return {
      user: null,
      accessToken: null,
      expiresAt: null,
    }
  }
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [initialAuth] =
    useState<StoredAuth>(getStoredAuth)

  const [user, setUser] =
    useState<User | null>(
      initialAuth.user,
    )

  const [accessToken, setAccessToken] =
    useState<string | null>(
      initialAuth.accessToken,
    )

  const [expiresAt, setExpiresAt] =
    useState<string | null>(
      initialAuth.expiresAt,
    )

  const loginUser = (
    token: string,
    expiry: string,
    loggedInUser: User,
  ) => {
    setAccessToken(token)
    setExpiresAt(expiry)
    setUser(loggedInUser)

    sessionStorage.setItem(
      'access_token',
      token,
    )

    sessionStorage.setItem(
      'expires_at',
      expiry,
    )

    sessionStorage.setItem(
      'user',
      JSON.stringify(loggedInUser),
    )
  }

  const logoutUser = () => {
    setUser(null)
    setAccessToken(null)
    setExpiresAt(null)

    sessionStorage.removeItem(
      'access_token',
    )

    sessionStorage.removeItem(
      'expires_at',
    )

    sessionStorage.removeItem('user')
  }

  // Automatically log the user out when the token expires.
  useEffect(() => {
    if (!expiresAt || !accessToken) {
      return
    }

    const expiryTime =
      new Date(expiresAt).getTime()

    const remainingTime =
      expiryTime - Date.now()

    const timeoutId = window.setTimeout(
      () => {
        logoutUser()
      },
      Math.max(remainingTime, 0),
    )

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
          user !== null &&
          accessToken !== null,
        isLoading: false,
        loginUser,
        logoutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}