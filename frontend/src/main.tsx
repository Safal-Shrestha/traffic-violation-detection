import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

import './index.css'
// import App from './App.tsx'

import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import LiveMonitoring from './pages/LiveMonitoring'
import ViolationReview from './pages/ViolationReview'
import Violations from './pages/Violations'
import Vehicles from './pages/Vehicles'
import Cameras from './pages/Cameras'
import Analytics from './pages/Analytics'
// import AIModels from './pages/AIModels'
import Users from './pages/Users'
import Settings from './pages/Settings'

import { ThemeProvider } from './context/ThemeProvider'
import { AuthProvider } from './context/AuthProvider'

const router = createBrowserRouter([
  { path: '/', element: <Login /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  {
    element: <AppLayout />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'live', element: <LiveMonitoring /> },
      { path: 'violations', element: <Violations /> },
      { path: 'violations/:id', element: <ViolationReview /> },
      { path: 'vehicles', element: <Vehicles /> },
      { path: 'cameras', element: <Cameras /> },
      { path: 'analytics', element: <Analytics /> },
      // { path: 'ai-models', element: <AIModels /> },
      { path: 'users', element: <Users /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
])

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
