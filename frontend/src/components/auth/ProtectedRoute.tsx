import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuth } from '../../context/useAuth'

function ProtectedRoute() {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth()

  const location = useLocation()

  if (isLoading) {
    return (
      <div className="protected-route-loading">
        Loading...
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    )
  }

  return <Outlet />
}

export default ProtectedRoute