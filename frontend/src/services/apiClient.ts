const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

interface ApiRequestOptions extends RequestInit {
  token?: string
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { token, headers, ...requestOptions } = options

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...requestOptions,
      headers: {
        'Content-Type': 'application/json',
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
        ...headers,
      },
    },
  )

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => null)

    if (response.status === 401) {
      window.dispatchEvent(
        new Event('auth:logout'),
      )
    }

    throw {
      status: response.status,
      ...error,
    }
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}