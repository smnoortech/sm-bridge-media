
import { lazy, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { supabase } from './lib/supabase'

const CreatorCRM = lazy(() => import('./CreatorCRM'))
const BrandCRM = lazy(() => import('./BrandCRM'))
const CampaignCRM = lazy(() => import('./CampaignCRM'))
const AgreementsPaymentsCRM = lazy(
  () => import('./AgreementsPaymentsCRM'),
)
const AnalyticsReports = lazy(() => import('./AnalyticsReports'))

import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Users,
  Building2,
  BriefcaseBusiness,
  FileText,
  LogOut,
  LayoutDashboard,
  BarChart3,
} from 'lucide-react'

import './App.css'

const currentYear = new Date().getFullYear()

type AdminStatus = 'checking' | 'allowed' | 'denied' | 'signed-out'

const workspaceRoutes = [
  '/dashboard',
  '/creators',
  '/brands',
  '/campaigns',
  '/agreements-payments',
  '/analytics',
]

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(Boolean(supabase))
  const [adminStatus, setAdminStatus] = useState<AdminStatus>(
    supabase ? 'checking' : 'signed-out',
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')

  const supabaseConfigured = Boolean(supabase)

  useEffect(() => {
    if (!supabase) return

    const client = supabase
    let active = true

    async function restoreSession() {
      const { data, error } = await client.auth.getSession()

      if (!active) return

      if (error) {
        setAuthError('Unable to restore your session. Please sign in again.')
      }

      setSession(data.session)
      setAdminStatus(data.session ? 'checking' : 'signed-out')
      setSessionLoading(false)
    }

    void restoreSession()

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return

      setSession(nextSession)
      setAdminStatus(nextSession ? 'checking' : 'signed-out')
      setSessionLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session || !supabase) return

    const client = supabase
    let active = true

    async function verifyAdministrator() {
      setAdminStatus('checking')

      const { data, error } = await client
        .from('app_admins')
        .select('user_id')
        .eq('user_id', session!.user.id)
        .maybeSingle()

      if (!active) return

      if (error || !data) {
        setAdminStatus('denied')
        setAuthError(
          'This account does not have verified administrator access.',
        )

        await client.auth.signOut()
        return
      }

      setAdminStatus('allowed')
      setAuthError('')
    }

    void verifyAdministrator()

    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    if (
      adminStatus === 'allowed' &&
      !workspaceRoutes.includes(location.pathname)
    ) {
      navigate('/dashboard', { replace: true })
    }

    if (
      adminStatus === 'denied' &&
      location.pathname !== '/'
    ) {
      navigate('/', { replace: true })
    }
  }, [adminStatus, location.pathname, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setAuthError('')
    setAuthSuccess('')

    if (!supabase) {
      setAuthError('Authentication is not configured yet.')
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setAuthError(
          error.message === 'Invalid login credentials'
            ? 'Incorrect email address or password.'
            : error.message,
        )
        return
      }

      setAuthSuccess('Sign-in successful. Verifying administrator access...')
      navigate('/dashboard')
    } catch {
      setAuthError(
        'Unable to sign in. Please check your connection and try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) return

    const { error } = await supabase.auth.signOut()

    if (error) {
      setAuthError('Unable to sign out. Please try again.')
      return
    }

    setSession(null)
    setAdminStatus('signed-out')
    setPassword('')
    setAuthSuccess('')
    setAuthError('')
    navigate('/', { replace: true })
  }

  if (sessionLoading || (session && adminStatus === 'checking')) {
    return (
      <main className="portal-loading">
        <div className="loading-mark">SM</div>
        <p>Securing your agency workspace...</p>
      </main>
    )
  }

  if (
    workspaceRoutes.includes(location.pathname) &&
    (!session || adminStatus !== 'allowed')
  ) {
    return <Navigate to="/" replace />
  }

  if (location.pathname === '/creators' && adminStatus === 'allowed') {
    return <CreatorCRM onSignOut={handleSignOut} />
  }

  if (location.pathname === '/brands' && adminStatus === 'allowed') {
    return <BrandCRM onSignOut={handleSignOut} />
  }

  if (location.pathname === '/campaigns' && adminStatus === 'allowed') {
    return <CampaignCRM onSignOut={handleSignOut} />
  }

  if (
    location.pathname === '/agreements-payments' &&
    adminStatus === 'allowed'
  ) {
    return <AgreementsPaymentsCRM onSignOut={handleSignOut} />
  }

  if (location.pathname === '/analytics' && adminStatus === 'allowed') {
    return <AnalyticsReports onSignOut={handleSignOut} />
  }

  if (location.pathname === '/dashboard' && adminStatus === 'allowed') {
    return (
      <main className="dashboard-page">
        <aside className="dashboard-sidebar">
          <Link className="brand dashboard-brand" to="/dashboard">
            <span className="brand-mark">SM</span>
            <span className="brand-name">
              SM BRIDGE <strong>MEDIA</strong>
            </span>
          </Link>

          <div className="sidebar-label">WORKSPACE</div>

          <Link className="sidebar-link active" to="/dashboard">
            <LayoutDashboard size={18} />
            Dashboard
          </Link>

          <div className="sidebar-label">MANAGEMENT</div>

          <Link className="sidebar-link" to="/creators">
            <Users size={18} />
            Creator CRM
          </Link>

          <Link className="sidebar-link" to="/brands">
            <Building2 size={18} />
            Brand CRM
          </Link>

          <Link className="sidebar-link" to="/campaigns">
            <BriefcaseBusiness size={18} />
            Campaigns
          </Link>

          <Link className="sidebar-link" to="/agreements-payments">
            <FileText size={18} />
            Agreements & Payments
          </Link>

          <div className="sidebar-label">INSIGHTS</div>

          <Link className="sidebar-link" to="/analytics">
            <BarChart3 size={18} />
            Analytics & Reports
          </Link>

          <div className="sidebar-bottom">
            <div className="sidebar-user">
              <div className="user-avatar">SM</div>
              <div>
                <strong>Administrator</strong>
                <span>Authorised account</span>
              </div>
            </div>

            <button className="sign-out-button" onClick={handleSignOut}>
              <LogOut size={17} />
              Sign out
            </button>
          </div>
        </aside>

        <section className="dashboard-main">
          <header className="dashboard-topbar">
            <div>
              <span className="dashboard-overline">SM BRIDGE MEDIA</span>
              <h1>Agency overview</h1>
            </div>

            <div className="admin-status">
              <span className="status-dot" />
              Administrator access verified
            </div>
          </header>

          <div className="dashboard-welcome">
            <span className="dashboard-overline">INTERNAL OPERATIONS</span>
            <h2>Welcome to your workspace.</h2>
            <p>
              Manage creator relationships, brand opportunities and
              partnership operations from one secure platform.
            </p>
          </div>

          <div className="dashboard-section-heading">
            <div>
              <h2>Management modules</h2>
              <p>Your agency management tools</p>
            </div>
          </div>

          <div className="dashboard-modules">
            <Link
              className="module-card module-card-link"
              to="/creators"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              <div className="module-icon">
                <Users size={22} />
              </div>
              <h3>Creator CRM</h3>
              <p>
                Organise creator profiles, recruitment, contacts,
                performance information and partnership status.
              </p>
              <span className="module-status">Open Creator CRM →</span>
            </Link>

            <Link
              className="module-card module-card-link"
              to="/brands"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              <div className="module-icon">
                <Building2 size={22} />
              </div>
              <h3>Brand CRM</h3>
              <p>
                Track prospective brands, business contacts, outreach
                and client relationships.
              </p>
              <span className="module-status">Open Brand CRM →</span>
            </Link>

            <Link
              className="module-card module-card-link"
              to="/campaigns"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              <div className="module-icon">
                <BriefcaseBusiness size={22} />
              </div>
              <h3>Campaigns</h3>
              <p>
                Coordinate creator-brand collaborations, deliverables,
                deadlines and campaign progress.
              </p>
              <span className="module-status">Open Campaign CRM →</span>
            </Link>

            <Link
              className="module-card module-card-link"
              to="/agreements-payments"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              <div className="module-icon">
                <FileText size={22} />
              </div>
              <h3>Agreements & Payments</h3>
              <p>
                Organise partnership agreements, campaign fees,
                commissions and payment records.
              </p>
              <span className="module-status">
                Open Agreements & Payments →
              </span>
            </Link>

            <Link
              className="module-card module-card-link"
              to="/analytics"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              <div className="module-icon">
                <BarChart3 size={22} />
              </div>
              <h3>Analytics & Reports</h3>
              <p>
                Review agency activity, campaign performance, agreement
                progress and financial reports.
              </p>
              <span className="module-status">
                Open Analytics & Reports →
              </span>
            </Link>
          </div>

          <footer className="dashboard-footer">
            © {currentYear} SM Bridge Media · Private agency management
          </footer>
        </section>
      </main>
    )
  }

  return (
    <main className="login-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="login-header">
        <Link className="brand" to="/" aria-label="SM Bridge Media">
          <span className="brand-mark">SM</span>
          <span className="brand-name">
            SM BRIDGE <strong>MEDIA</strong>
          </span>
        </Link>

        <span className="portal-label">
          <span className="status-dot" />
          AGENCY MANAGEMENT PORTAL
        </span>
      </header>

      <section className="login-layout">
        <div className="intro-panel">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            INTERNAL OPERATIONS
          </div>

          <h1>
            Manage your
            <span> partnerships.</span>
          </h1>

          <p className="intro-description">
            One secure workspace for creator relationships, brand
            opportunities, campaigns and agency operations.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">
                <ShieldCheck size={19} />
              </span>
              <div>
                <strong>Private workspace</strong>
                <p>Access reserved for authorised team members.</p>
              </div>
            </div>

            <div className="feature-item">
              <span className="feature-icon">
                <LockKeyhole size={19} />
              </span>
              <div>
                <strong>Protected business records</strong>
                <p>Creator, brand and campaign information in one place.</p>
              </div>
            </div>
          </div>

          <div className="intro-footer">
            <span className="footer-line" />
            <span>FOUNDED IN NIGERIA. CONNECTING WORLDWIDE.</span>
          </div>
        </div>

        <div className="login-card">
          <div className="card-heading">
            <div className="card-icon">
              <LockKeyhole size={21} />
            </div>
            <span className="card-kicker">SECURE ACCESS</span>
          </div>

          <h2>Welcome back</h2>
          <p className="card-description">
            Sign in to access your agency workspace.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>

            <div className="input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@smbridgemedia.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <label htmlFor="password">Password</label>

            <div className="input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={isSubmitting}
              />

              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              className="sign-in-button"
              type="submit"
              disabled={!supabaseConfigured || isSubmitting}
            >
              <span>
                {isSubmitting
                  ? 'Signing in...'
                  : supabaseConfigured
                    ? 'Sign in securely'
                    : 'Authentication setup pending'}
              </span>
              <ArrowRight size={18} />
            </button>
          </form>

          {authError && (
            <div className="setup-notice" role="alert">
              <span className="notice-dot" />
              <div>
                <strong>Access unsuccessful</strong>
                <p>{authError}</p>
              </div>
            </div>
          )}

          {authSuccess && (
            <div className="setup-notice" role="status">
              <span className="notice-dot" />
              <div>
                <strong>Authentication successful</strong>
                <p>{authSuccess}</p>
              </div>
            </div>
          )}

          {!supabaseConfigured && (
            <div className="setup-notice" role="status">
              <span className="notice-dot" />
              <div>
                <strong>Secure sign-in is not connected yet.</strong>
                <p>
                  Supabase authentication must be configured before anyone
                  can sign in.
                </p>
              </div>
            </div>
          )}

          <div className="security-note">
            <ShieldCheck size={16} />
            <span>Private agency access · Protected authentication</span>
          </div>
        </div>
      </section>

      <footer className="page-footer">
        <span>© {currentYear} SM Bridge Media</span>
        <span>INTERNAL MANAGEMENT SYSTEM</span>
      </footer>
    </main>
  )
}

export default App
