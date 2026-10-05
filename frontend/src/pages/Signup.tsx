import { useState } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { signup } from '../services/authService'
import '../css/signup.css'

function Signup() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (
    event: React.SubmitEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!termsAccepted) {
      setError('You must accept the terms and conditions.')
      return
    }

    try {
      setIsLoading(true)

      const response = await signup({
        name,
        email,
        password,
      })

      if (!response.success) {
        setError(response.message)
        return
      }

      setMessage(
        'Account created successfully. Redirecting to login...',
      )

      setTimeout(() => {
        navigate('/login')
      }, 1000)
    } catch {
      setError('Unable to connect to the server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card signup-card">
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
          <h2>Create Account</h2>
          <p>Create an account to access the Traffic monitoring system.</p>
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
            <label htmlFor="name">Full Name</label>

            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your full name"
              autoComplete="name"
            />
          </div>

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
                placeholder="Create a password"
                autoComplete="new-password"
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

          <div className="auth-field">
            <label htmlFor="confirmPassword">
              Confirm Password
            </label>

            <div className="auth-password-wrapper">
              <input
                id="confirmPassword"
                type={
                  showConfirmPassword ? 'text' : 'password'
                }
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Confirm your password"
                autoComplete="new-password"
              />

              <button
                type="button"
                className="auth-password-toggle"
                onClick={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
                aria-label={
                  showConfirmPassword
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </div>

          <label className="auth-checkbox auth-terms">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) =>
                setTermsAccepted(event.target.checked)
              }
            />

            <span>
              I agree to the terms and conditions.
            </span>
          </label>

          <button
            type="submit"
            className="auth-submit-button"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Already have an account?</span>
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}

export default Signup