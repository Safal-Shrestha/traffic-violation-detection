import { useState } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../context/useAuth'
import { login } from '../services/authService'
import '../css/login.css'

function Login() {
  const navigate = useNavigate()
  const { loginUser } = useAuth()

  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [email, setEmail] = useState(
    () => localStorage.getItem('remember-email') ?? '',
  )

  const handleSubmit = async (
    event: React.SubmitEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!email || !password) {
      setError('Email and password are required.')
      return
    }

    try {
      setIsLoading(true)

      const response = await login({
        email,
        password,
      })

      if (!response.success || !response.user) {
        setError(response.message)
        return
      }

      loginUser(response.user, rememberMe)

      if (rememberMe) {
        localStorage.setItem('remember-email', email)
      } else {
        localStorage.removeItem('remember-email')
      }

      navigate('/dashboard')
    } catch {
      setError('Unable to connect to the server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <ShieldCheck size={28} />
          </div>

          <div>
            <h1>Sentry</h1>
            <p>Traffic Violation Monitoring System</p>
          </div>
        </div>

        <div className="auth-heading">
          <h2>Welcome Back</h2>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-message auth-message-error">
              {error}
            </div>
          )}

          {message && (
            <div className="auth-message auth-message-success">
              {message}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="email">Email Address</label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>

            <div className="auth-password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />

              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword ? 'Hide password' : 'Show password'
                }
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </div>

          <div className="auth-options">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(event.target.checked)
                }
              />

              <span>Remember me</span>
            </label>

            <button
              type="button"
              className="auth-link-button"
              onClick={() =>
                setMessage(
                  'Password recovery will be available later.',
                )
              }
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            className="auth-submit-button"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Don't have an account?</span>
          <Link to="/signup">Create an account</Link>
        </div>
      </div>
    </div>
  )
}

export default Login