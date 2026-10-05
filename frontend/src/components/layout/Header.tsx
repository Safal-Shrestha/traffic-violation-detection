import { useEffect, useState } from 'react'
import {Bell,ChevronDown,Moon,Sun,User,Menu,AlertTriangle,ShieldAlert,HardHat,Gauge,Settings,LogOut,} from 'lucide-react'
import { useLocation,useNavigate } from 'react-router'
import { useTheme } from '../../context/useTheme'
import { useAuth } from '../../context/useAuth'
import { getNotifications } from '../../services/notificationService'
import type { Notification } from '../../types/notifications'

interface HeaderProps {
  onMenuClick: () => void
}

function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { user, logoutUser } = useAuth()
  const navigate = useNavigate()

  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const location = useLocation()
  const getPageTitle = () => {
    const path = location.pathname

    if (path.startsWith('/violations/')) {
      return 'Violation Review'
    }

    switch (path) {
      case '/dashboard':
        return 'Dashboard'
      case '/live':
        return 'Live Monitoring'
      case '/violations':
        return 'Violations'
      case '/vehicles':
        return 'Vehicles'
      case '/cameras':
        return 'Cameras'
      case '/analytics':
        return 'Analytics'
      case '/ai-models':
        return 'AI Models'
      case '/users':
        return 'Users'
      case '/settings':
        return 'Settings'
      default:
        return 'Dashboard'
    }
  }

  useEffect(() => {
    async function loadNotifications() {
      const data = await getNotifications()
      setNotifications(data)
    }

    loadNotifications()
  }, [])

  const handleNotificationClick = (violationId: number) => {
    setNotificationsOpen(false)
    navigate(`/violations/${violationId}`)
  }

  const handleSettingsClick = () => {
    setUserMenuOpen(false)
    navigate('/settings')
  }

  const handleLogout = () => {
    setUserMenuOpen(false)
    logoutUser()
    navigate('/login')
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'red-light':
        return <ShieldAlert size={17} />

      case 'stop-line':
        return <AlertTriangle size={17} />

      case 'helmet':
        return <HardHat size={17} />

      case 'speed':
        return <Gauge size={17} />
    }
  }

  return (
    <header className="header">
      <button
        className="header-menu-button"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu size={22} />
      </button>

      <div className="header-page">
        <h2>{getPageTitle()}</h2>
      </div>

      <div className="header-actions">
        <button
          className="header-icon-button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <div className="header-dropdown-wrapper">
          <button
            className="header-icon-button"
            onClick={() => {
              setNotificationsOpen(!notificationsOpen)
              setUserMenuOpen(false)
            }}
            aria-label="Notifications"
          >
            <Bell size={20} />

            {notifications.some(
              (notification) => !notification.read,
            ) && <span className="notification-dot" />}
          </button>

          {notificationsOpen && (
            <div className="header-dropdown notification-dropdown">
              <div className="dropdown-header">
                <div>
                  <strong>Notifications</strong>
                  <span>
                    {
                      notifications.filter(
                        (notification) => !notification.read,
                      ).length
                    }{' '}
                    new
                  </span>
                </div>
              </div>

              <div className="notification-list">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      className="notification-item"
                      onClick={() =>
                        handleNotificationClick(
                          notification.violationId,
                        )
                      }
                    >
                      <span className="notification-icon">
                        {getNotificationIcon(notification.type)}
                      </span>

                      <span className="notification-content">
                        <strong>{notification.title}</strong>

                        <span>{notification.message}</span>

                        <small>{notification.time}</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="notification-empty">
                    No notifications
                  </div>
                )}
              </div>

              <div className="dropdown-footer">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false)
                    navigate('/violations')
                  }}
                >
                  View all violations
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="header-dropdown-wrapper">
          <button
            className="header-user"
            onClick={() => {
              setUserMenuOpen(!userMenuOpen)
              setNotificationsOpen(false)
            }}
            aria-label="User menu"
          >
            <span className="header-user-icon">
              <User size={18} />
            </span>

            <span className="header-user-info">
              <strong>{user?.name ?? 'User'}</strong>
              <small>{user?.role ?? 'Officer'}</small>
            </span>

            <ChevronDown
              size={16}
              className={userMenuOpen ? 'header-chevron-open' : ''}
            />
          </button>

          {userMenuOpen && (
            <div className="header-dropdown user-dropdown">
              <div className="user-dropdown-info">
                <span className="user-dropdown-icon">
                  <User size={22} />
                </span>

                <div>
                  <strong>{user?.name ?? 'User'}</strong>
                  <span>{user?.email ?? ''}</span>
                </div>
              </div>

              <div className="user-dropdown-divider" />

              <button
                type="button"
                className="user-dropdown-item"
                onClick={handleSettingsClick}
              >
                <Settings size={17} />
                <span>Settings</span>
              </button>

              <button
                type="button"
                className="user-dropdown-item user-dropdown-logout"
                onClick={handleLogout}
              >
                <LogOut size={17} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header