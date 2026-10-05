import { useState } from 'react'
import { Bell, User } from 'lucide-react'
import { useAuth } from '../context/useAuth'

import '../css/settings.css'

type SettingsTab = 'account' | 'notifications'

interface NotificationSetting {
  id: string
  label: string
  enabled: boolean
}

function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] =
    useState<SettingsTab>('account')

  const [profileMessage, setProfileMessage] = useState('')

  const [notifications, setNotifications] = useState<
    NotificationSetting[]
  >([
    {
      id: 'red-light',
      label: 'Red Light Violations',
      enabled: true,
    },
    {
      id: 'stop-line',
      label: 'Stop Line Violations',
      enabled: true,
    },
    {
      id: 'helmet',
      label: 'Helmet Violations',
      enabled: true,
    },
    {
      id: 'speed',
      label: 'Speeding Violations',
      enabled: true,
    },
  ])

  const handleProfileSubmit = (
    event: React.SubmitEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    const name = String(formData.get('name') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()

    if (!name || !email) {
      setProfileMessage('Name and email are required.')
      return
    }

    setProfileMessage('Profile changes will be available when account updates are connected.',)
  }

  const handlePasswordSubmit = (
    event: React.SubmitEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    const currentPassword = String(
      formData.get('currentPassword') ?? '',
    )
    const newPassword = String(
      formData.get('newPassword') ?? '',
    )
    const confirmPassword = String(
      formData.get('confirmPassword') ?? '',
    )

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage('Please fill in all password fields.')
      setPasswordMessageType('error')
      return
    }

    if (newPassword.length < 8) {
      setPasswordMessage(
        'New password must be at least 8 characters.',
      )
      setPasswordMessageType('error')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage(
        'New password and confirmation do not match.',
      )
      setPasswordMessageType('error')
      return
    }

    setPasswordMessage('Password updated successfully.')
    setPasswordMessageType('success')

    event.currentTarget.reset()
  }

  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordMessageType, setPasswordMessageType] =
    useState<'success' | 'error' | ''>('')

  const handleNotificationToggle = (id: string) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              enabled: !notification.enabled,
            }
          : notification,
      ),
    )
  }

  return (
    <div className="settings-page">
      <div className="settings-layout">
        <aside className="settings-sidebar">
          <button
            type="button"
            className={`settings-nav-item ${
              activeTab === 'account' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('account')}
          >
            <User size={18} />
            <span>Account</span>
          </button>

          <button
            type="button"
            className={`settings-nav-item ${
              activeTab === 'notifications' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={18} />
            <span>Notifications</span>
          </button>
        </aside>

        <main className="settings-content">
          {activeTab === 'account' && (
            <section className="settings-section">
              <div className="settings-section-header">
                <h2>Account</h2>
              </div>

              <div className="settings-section-content">
                <form
                  className="settings-form"
                  onSubmit={handleProfileSubmit}
                >
                  <div className="settings-subsection-heading">
                    <h3>Profile Information</h3>
                  </div>

                  <div className="settings-form-grid">
                    <div className="settings-field">
                      <label htmlFor="profile-name">Name</label>

                      <input
                        id="profile-name"
                        name="name"
                        type="text"
                        defaultValue={user?.name ?? ''}
                        placeholder="Enter your name"
                      />
                    </div>

                    <div className="settings-field">
                      <label htmlFor="profile-email">
                        Email
                      </label>

                      <input
                        id="profile-email"
                        name="email"
                        type="email"
                        defaultValue={user?.email ?? ''}
                        placeholder="Enter your email"
                      />
                    </div>

                    <div className="settings-field">
                      <label htmlFor="profile-role">Role</label>

                      <input
                        id="profile-role"
                        type="text"
                        value={user?.role ?? ''}
                        disabled
                      />

                      <span className="settings-field-hint">
                        Your role cannot be changed from Settings.
                      </span>
                    </div>
                  </div>

                  {profileMessage && (
                    <p className="settings-form-message success">
                      {profileMessage}
                    </p>
                  )}

                  <div className="settings-form-actions">
                    <button
                      type="submit"
                      className="settings-primary-button"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>

                <div className="settings-divider" />

                <form
                  className="settings-form"
                  onSubmit={handlePasswordSubmit}
                >
                  <div className="settings-subsection-heading">
                    <h3>Change Password</h3>
                  </div>

                  <div className="settings-password-fields">
                    <div className="settings-field">
                      <label htmlFor="current-password">
                        Current Password
                      </label>

                      <input
                        id="current-password"
                        name="currentPassword"
                        type="password"
                        placeholder="Enter current password"
                      />
                    </div>

                    <div className="settings-field">
                      <label htmlFor="new-password">
                        New Password
                      </label>

                      <input
                        id="new-password"
                        name="newPassword"
                        type="password"
                        placeholder="Enter new password"
                      />
                    </div>

                    <div className="settings-field">
                      <label htmlFor="confirm-password">
                        Confirm New Password
                      </label>

                      <input
                        id="confirm-password"
                        name="confirmPassword"
                        type="password"
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>

                  {passwordMessage && (
                    <p
                      className={`settings-form-message ${passwordMessageType}`}
                    >
                      {passwordMessage}
                    </p>
                  )}

                  <div className="settings-form-actions">
                    <button
                      type="submit"
                      className="settings-primary-button"
                    >
                      Update Password
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {activeTab === 'notifications' && (
            <section className="settings-section">
              <div className="settings-section-header">
                <h2>Notifications</h2>
              </div>

              <div className="settings-section-content">
                <div className="notification-settings">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="notification-setting"
                    >
                      <div className="notification-setting-info">
                        <h3>{notification.label}</h3>
                      </div>

                      <button
                        type="button"
                        className={`settings-toggle ${
                          notification.enabled ? 'active' : ''
                        }`}
                        onClick={() =>
                          handleNotificationToggle(
                            notification.id,
                          )
                        }
                        aria-label={`Toggle ${notification.label}`}
                        aria-pressed={notification.enabled}
                      >
                        <span className="settings-toggle-knob" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default Settings