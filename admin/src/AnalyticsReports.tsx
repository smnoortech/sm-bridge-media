
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  Download,
  FileText,
  RefreshCw,
  Wallet,
  Users,
  BriefcaseBusiness,
  AlertCircle,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './AnalyticsReports.css'

type RecordRow = Record<string, any>

type ReportData = {
  creators: RecordRow[]
  brands: RecordRow[]
  campaigns: RecordRow[]
  agreements: RecordRow[]
  payments: RecordRow[]
}

const emptyData: ReportData = {
  creators: [],
  brands: [],
  campaigns: [],
  agreements: [],
  payments: [],
}

const currencySymbols: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€',
}

function currencyAmount(amount: number, currency: string) {
  const code = currency.toUpperCase()
  const symbol = currencySymbols[code]

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return symbol ? `${symbol}${formatted}` : `${code} ${formatted}`
}

function groupByCurrency(
  rows: RecordRow[],
  amountField: string,
  filter?: (row: RecordRow) => boolean,
) {
  const totals = new Map<string, number>()

  rows.forEach((row) => {
    if (filter && !filter(row)) return

    const currency = String(row.currency || 'NGN').toUpperCase()
    const amount = Number(row[amountField] || 0)

    if (!Number.isFinite(amount)) return

    totals.set(currency, (totals.get(currency) || 0) + amount)
  })

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({
      currency,
      amount,
      formatted: currencyAmount(amount, currency),
    }))
}

function formatCurrencyGroups(
  groups: ReturnType<typeof groupByCurrency>,
) {
  if (!groups.length) return '—'
  return groups.map((group) => group.formatted).join(' · ')
}

function formatDate(value?: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getName(row: RecordRow, fallback: string) {
  return (
    row.name ||
    row.full_name ||
    row.creator_name ||
    row.brand_name ||
    row.title ||
    row.agreement_title ||
    fallback
  )
}

function getStatusClass(status?: string) {
  return String(status || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
}

function downloadCsv(filename: string, rows: RecordRow[]) {
  if (!rows.length) return

  const headers = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row))),
  )

  const escapeValue = (value: unknown) => {
    const text =
      value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)

    return `"${text.replace(/"/g, '""')}"`
  }

  const csv = [
    headers.map(escapeValue).join(','),
    ...rows.map((row) =>
      headers.map((header) => escapeValue(row[header])).join(','),
    ),
  ].join('\r\n')

  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(url)
}

function AnalyticsReports({
  onSignOut,
}: {
  onSignOut: () => void
}) {
  const [data, setData] = useState<ReportData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeReport, setActiveReport] = useState<
    'overview' | 'financial' | 'campaigns' | 'agreements'
  >('overview')

  const loadData = useCallback(async (isRefresh = false) => {
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }

    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const client = supabase

      const [
        creatorsResult,
        brandsResult,
        campaignsResult,
        agreementsResult,
        paymentsResult,
      ] = await Promise.all([
        client.from('creators').select('*'),
        client.from('brands').select('*'),
        client.from('campaigns').select('*'),
        client.from('agreements').select('*'),
        client.from('payments').select('*'),
      ])

      const failedResult = [
        creatorsResult,
        brandsResult,
        campaignsResult,
        agreementsResult,
        paymentsResult,
      ].find((result) => result.error)

      if (failedResult?.error) {
        throw failedResult.error
      }

      setData({
        creators: creatorsResult.data || [],
        brands: brandsResult.data || [],
        campaigns: campaignsResult.data || [],
        agreements: agreementsResult.data || [],
        payments: paymentsResult.data || [],
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load analytics data.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const isWithinDateRange = useCallback(
    (row: RecordRow) => {
      const value = row.created_at || row.start_date || row.due_date

      if (!value) return true

      const date = new Date(value)

      if (Number.isNaN(date.getTime())) return true

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`)
        if (date < start) return false
      }

      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`)
        if (date > end) return false
      }

      return true
    },
    [startDate, endDate],
  )

  const filtered = useMemo<ReportData>(
    () => ({
      creators: data.creators.filter(isWithinDateRange),
      brands: data.brands.filter(isWithinDateRange),
      campaigns: data.campaigns.filter(isWithinDateRange),
      agreements: data.agreements.filter(isWithinDateRange),
      payments: data.payments.filter(isWithinDateRange),
    }),
    [data, isWithinDateRange],
  )

  const financial = useMemo(() => {
    const incoming = groupByCurrency(
      filtered.payments,
      'amount',
      (row) =>
        row.direction === 'incoming' &&
        row.status === 'paid',
    )

    const outgoing = groupByCurrency(
      filtered.payments,
      'amount',
      (row) =>
        row.direction === 'outgoing' &&
        row.status === 'paid',
    )

    const pending = groupByCurrency(
      filtered.payments,
      'amount',
      (row) =>
        ['pending', 'processing'].includes(
          String(row.status || '').toLowerCase(),
        ),
    )

    const overdue = groupByCurrency(
      filtered.payments,
      'amount',
      (row) =>
        String(row.status || '').toLowerCase() === 'overdue',
    )

    return { incoming, outgoing, pending, overdue }
  }, [filtered.payments])

  const campaignStatuses = useMemo(() => {
    const counts = new Map<string, number>()

    filtered.campaigns.forEach((campaign) => {
      const status = String(campaign.status || 'unspecified')
      counts.set(status, (counts.get(status) || 0) + 1)
    })

    return Array.from(counts.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )
  }, [filtered.campaigns])

  const agreementStatuses = useMemo(() => {
    const counts = new Map<string, number>()

    filtered.agreements.forEach((agreement) => {
      const status = String(agreement.status || 'unspecified')
      counts.set(status, (counts.get(status) || 0) + 1)
    })

    return Array.from(counts.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )
  }, [filtered.agreements])

  const recentPayments = useMemo(
    () =>
      [...filtered.payments]
        .sort(
          (a, b) =>
            new Date(b.created_at || b.due_date || 0).getTime() -
            new Date(a.created_at || a.due_date || 0).getTime(),
        )
        .slice(0, 7),
    [filtered.payments],
  )

  const recentCampaigns = useMemo(
    () =>
      [...filtered.campaigns]
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime(),
        )
        .slice(0, 7),
    [filtered.campaigns],
  )

  const totalRecords =
    filtered.creators.length +
    filtered.brands.length +
    filtered.campaigns.length +
    filtered.agreements.length +
    filtered.payments.length

  function exportCurrentReport() {
    const reportRows =
      activeReport === 'financial'
        ? filtered.payments
        : activeReport === 'campaigns'
          ? filtered.campaigns
          : activeReport === 'agreements'
            ? filtered.agreements
            : [
                ...filtered.creators.map((row) => ({
                  ...row,
                  report_type: 'creator',
                })),
                ...filtered.brands.map((row) => ({
                  ...row,
                  report_type: 'brand',
                })),
                ...filtered.campaigns.map((row) => ({
                  ...row,
                  report_type: 'campaign',
                })),
                ...filtered.agreements.map((row) => ({
                  ...row,
                  report_type: 'agreement',
                })),
                ...filtered.payments.map((row) => ({
                  ...row,
                  report_type: 'payment',
                })),
              ]

    downloadCsv(
      `sm-bridge-media-${activeReport}-report-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`,
      reportRows,
    )
  }

  return (
    <main className="analytics-page">
      <aside className="analytics-sidebar">
        <Link className="analytics-brand" to="/dashboard">
          <span className="analytics-brand-mark">SM</span>
          <span>
            SM BRIDGE <strong>MEDIA</strong>
          </span>
        </Link>

        <div className="analytics-sidebar-label">WORKSPACE</div>
        <Link className="analytics-nav-link" to="/dashboard">
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>

        <div className="analytics-sidebar-label">REPORTING</div>
        <button
          className={`analytics-nav-link ${
            activeReport === 'overview' ? 'active' : ''
          }`}
          onClick={() => setActiveReport('overview')}
        >
          <BarChart3 size={18} />
          Overview
        </button>
        <button
          className={`analytics-nav-link ${
            activeReport === 'financial' ? 'active' : ''
          }`}
          onClick={() => setActiveReport('financial')}
        >
          <Wallet size={18} />
          Financial reports
        </button>
        <button
          className={`analytics-nav-link ${
            activeReport === 'campaigns' ? 'active' : ''
          }`}
          onClick={() => setActiveReport('campaigns')}
        >
          <BriefcaseBusiness size={18} />
          Campaign reports
        </button>
        <button
          className={`analytics-nav-link ${
            activeReport === 'agreements' ? 'active' : ''
          }`}
          onClick={() => setActiveReport('agreements')}
        >
          <FileText size={18} />
          Agreement reports
        </button>

        <div className="analytics-sidebar-bottom">
          <div className="analytics-admin">
            <span className="analytics-avatar">SM</span>
            <span>
              <strong>Administrator</strong>
              <small>Authorised account</small>
            </span>
          </div>
          <button className="analytics-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <section className="analytics-main">
        <header className="analytics-topbar">
          <div>
            <span className="analytics-overline">
              SM BRIDGE MEDIA / REPORTING
            </span>
            <h1>Analytics & Reports</h1>
            <p>
              Monitor agency activity, partnership operations and financial
              performance.
            </p>
          </div>

          <div className="analytics-top-actions">
            <button
              className="analytics-secondary-button"
              onClick={() => void loadData(true)}
              disabled={loading || refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? 'analytics-spin' : ''}
              />
              Refresh
            </button>
            <button
              className="analytics-primary-button"
              onClick={exportCurrentReport}
              disabled={loading || totalRecords === 0}
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </header>

        <div className="analytics-filter-panel">
          <div className="analytics-filter-title">
            <CalendarDays size={18} />
            Reporting period
          </div>
          <label>
            From
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <button
            className="analytics-clear-filter"
            onClick={() => {
              setStartDate('')
              setEndDate('')
            }}
          >
            Clear dates
          </button>
        </div>

        {error && (
          <div className="analytics-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => void loadData(true)}>Try again</button>
          </div>
        )}

        {loading ? (
          <div className="analytics-loading">
            <div className="analytics-loader" />
            <p>Preparing your agency reports...</p>
          </div>
        ) : (
          <>
            {activeReport === 'overview' && (
              <>
                <div className="analytics-section-heading">
                  <div>
                    <h2>Agency overview</h2>
                    <p>
                      A snapshot of records within the selected reporting
                      period.
                    </p>
                  </div>
                  <span className="analytics-record-count">
                    {totalRecords.toLocaleString()} records
                  </span>
                </div>

                <div className="analytics-stat-grid">
                  <StatCard
                    icon={<Users size={20} />}
                    label="Creators"
                    value={filtered.creators.length}
                    description="Creator records"
                  />
                  <StatCard
                    icon={<Building2 size={20} />}
                    label="Brands"
                    value={filtered.brands.length}
                    description="Brand records"
                  />
                  <StatCard
                    icon={<BriefcaseBusiness size={20} />}
                    label="Campaigns"
                    value={filtered.campaigns.length}
                    description="Campaign records"
                  />
                  <StatCard
                    icon={<FileText size={20} />}
                    label="Agreements"
                    value={filtered.agreements.length}
                    description="Agreement records"
                  />
                  <StatCard
                    icon={<Wallet size={20} />}
                    label="Payments"
                    value={filtered.payments.length}
                    description="Payment records"
                  />
                </div>

                <div className="analytics-section-heading">
                  <div>
                    <h2>Financial snapshot</h2>
                    <p>
                      Paid transactions and outstanding amounts, separated
                      by currency.
                    </p>
                  </div>
                </div>

                <div className="analytics-financial-grid">
                  <FinancialCard
                    icon={<ArrowDownLeft size={19} />}
                    label="Incoming payments"
                    values={financial.incoming}
                    tone="positive"
                  />
                  <FinancialCard
                    icon={<ArrowUpRight size={19} />}
                    label="Outgoing payments"
                    values={financial.outgoing}
                    tone="neutral"
                  />
                  <FinancialCard
                    icon={<Wallet size={19} />}
                    label="Pending payments"
                    values={financial.pending}
                    tone="warning"
                  />
                  <FinancialCard
                    icon={<AlertCircle size={19} />}
                    label="Overdue payments"
                    values={financial.overdue}
                    tone="danger"
                  />
                </div>

                <div className="analytics-two-column">
                  <StatusPanel
                    title="Campaign status"
                    items={campaignStatuses}
                    emptyText="No campaign records in this period."
                  />
                  <StatusPanel
                    title="Agreement status"
                    items={agreementStatuses}
                    emptyText="No agreement records in this period."
                  />
                </div>

                <div className="analytics-section-heading">
                  <div>
                    <h2>Recent payments</h2>
                    <p>Latest payment records in the selected period.</p>
                  </div>
                  <button
                    className="analytics-text-button"
                    onClick={() => setActiveReport('financial')}
                  >
                    View financial report →
                  </button>
                </div>

                <PaymentTable rows={recentPayments} />
              </>
            )}

            {activeReport === 'financial' && (
              <>
                <div className="analytics-section-heading">
                  <div>
                    <h2>Financial reports</h2>
                    <p>
                      Payment activity grouped by transaction currency.
                    </p>
                  </div>
                </div>

                <div className="analytics-financial-grid">
                  <FinancialCard
                    icon={<ArrowDownLeft size={19} />}
                    label="Incoming · Paid"
                    values={financial.incoming}
                    tone="positive"
                  />
                  <FinancialCard
                    icon={<ArrowUpRight size={19} />}
                    label="Outgoing · Paid"
                    values={financial.outgoing}
                    tone="neutral"
                  />
                  <FinancialCard
                    icon={<Wallet size={19} />}
                    label="Pending / Processing"
                    values={financial.pending}
                    tone="warning"
                  />
                  <FinancialCard
                    icon={<AlertCircle size={19} />}
                    label="Overdue"
                    values={financial.overdue}
                    tone="danger"
                  />
                </div>

                <div className="analytics-data-panel">
                  <div className="analytics-panel-heading">
                    <div>
                      <h3>Payment records</h3>
                      <p>{filtered.payments.length} records</p>
                    </div>
                  </div>
                  <PaymentTable rows={filtered.payments} />
                </div>
              </>
            )}

            {activeReport === 'campaigns' && (
              <>
                <div className="analytics-section-heading">
                  <div>
                    <h2>Campaign reports</h2>
                    <p>
                      Campaign volume and status distribution.
                    </p>
                  </div>
                </div>

                <div className="analytics-stat-grid analytics-stat-grid-three">
                  <StatCard
                    icon={<BriefcaseBusiness size={20} />}
                    label="Total campaigns"
                    value={filtered.campaigns.length}
                    description="In selected period"
                  />
                  <StatCard
                    icon={<Activity size={20} />}
                    label="Active campaigns"
                    value={
                      filtered.campaigns.filter(
                        (row) =>
                          String(row.status || '').toLowerCase() ===
                          'active',
                      ).length
                    }
                    description="Currently marked active"
                  />
                  <StatCard
                    icon={<FileText size={20} />}
                    label="Completed campaigns"
                    value={
                      filtered.campaigns.filter(
                        (row) =>
                          String(row.status || '').toLowerCase() ===
                          'completed',
                      ).length
                    }
                    description="Marked completed"
                  />
                </div>

                <StatusPanel
                  title="Campaign status breakdown"
                  items={campaignStatuses}
                  emptyText="No campaign records in this period."
                />

                <div className="analytics-data-panel">
                  <div className="analytics-panel-heading">
                    <div>
                      <h3>Campaign records</h3>
                      <p>{filtered.campaigns.length} campaigns</p>
                    </div>
                  </div>
                  <CampaignTable rows={recentCampaigns} />
                </div>
              </>
            )}

            {activeReport === 'agreements' && (
              <>
                <div className="analytics-section-heading">
                  <div>
                    <h2>Agreement reports</h2>
                    <p>
                      Agreement pipeline and recorded agreement values.
                    </p>
                  </div>
                </div>

                <div className="analytics-stat-grid analytics-stat-grid-three">
                  <StatCard
                    icon={<FileText size={20} />}
                    label="Total agreements"
                    value={filtered.agreements.length}
                    description="In selected period"
                  />
                  <StatCard
                    icon={<Activity size={20} />}
                    label="Signed agreements"
                    value={
                      filtered.agreements.filter((row) =>
                        ['signed', 'active', 'completed'].includes(
                          String(row.status || '').toLowerCase(),
                        ),
                      ).length
                    }
                    description="Signed, active or completed"
                  />
                  <StatCard
                    icon={<AlertCircle size={20} />}
                    label="Draft agreements"
                    value={
                      filtered.agreements.filter(
                        (row) =>
                          String(row.status || '').toLowerCase() ===
                          'draft',
                      ).length
                    }
                    description="Awaiting further action"
                  />
                </div>

                <StatusPanel
                  title="Agreement status breakdown"
                  items={agreementStatuses}
                  emptyText="No agreement records in this period."
                />

                <div className="analytics-data-panel">
                  <div className="analytics-panel-heading">
                    <div>
                      <h3>Agreement records</h3>
                      <p>{filtered.agreements.length} agreements</p>
                    </div>
                  </div>
                  <AgreementTable rows={filtered.agreements} />
                </div>
              </>
            )}
          </>
        )}

        <footer className="analytics-footer">
          © {new Date().getFullYear()} SM Bridge Media · Private agency
          reporting
        </footer>
      </section>
    </main>
  )
}

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode
  label: string
  value: number
  description: string
}) {
  return (
    <article className="analytics-stat-card">
      <div className="analytics-stat-top">
        <span className="analytics-stat-icon">{icon}</span>
        <span className="analytics-stat-label">{label}</span>
      </div>
      <strong className="analytics-stat-value">
        {value.toLocaleString()}
      </strong>
      <span className="analytics-stat-description">{description}</span>
    </article>
  )
}

function FinancialCard({
  icon,
  label,
  values,
  tone,
}: {
  icon: React.ReactNode
  label: string
  values: ReturnType<typeof groupByCurrency>
  tone: string
}) {
  return (
    <article className={`analytics-financial-card ${tone}`}>
      <div className="analytics-financial-heading">
        <span>{icon}</span>
        <label>{label}</label>
      </div>
      <strong>{formatCurrencyGroups(values)}</strong>
      <small>
        {values.length
          ? `${values.length} currency group${values.length === 1 ? '' : 's'}`
          : 'No recorded amount'}
      </small>
    </article>
  )
}

function StatusPanel({
  title,
  items,
  emptyText,
}: {
  title: string
  items: [string, number][]
  emptyText: string
}) {
  const maximum = Math.max(1, ...items.map((item) => item[1]))

  return (
    <section className="analytics-status-panel">
      <div className="analytics-panel-heading">
        <div>
          <h3>{title}</h3>
          <p>Status distribution</p>
        </div>
      </div>

      {!items.length ? (
        <p className="analytics-empty">{emptyText}</p>
      ) : (
        <div className="analytics-status-list">
          {items.map(([status, count]) => (
            <div className="analytics-status-item" key={status}>
              <div className="analytics-status-line">
                <span className={`analytics-status-dot ${getStatusClass(status)}`} />
                <span className="analytics-status-name">
                  {status.replace(/_/g, ' ')}
                </span>
                <strong>{count}</strong>
              </div>
              <div className="analytics-progress-track">
                <span
                  style={{ width: `${(count / maximum) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function PaymentTable({ rows }: { rows: RecordRow[] }) {
  if (!rows.length) {
    return <p className="analytics-empty">No payment records found.</p>
  }

  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Direction</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Due date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              <td>
                <strong>
                  {row.description ||
                    row.payment_type ||
                    'Payment record'}
                </strong>
                <small>{row.transaction_reference || '—'}</small>
              </td>
              <td>
                <span className="analytics-capitalize">
                  {row.direction || '—'}
                </span>
              </td>
              <td className="analytics-amount">
                {currencyAmount(
                  Number(row.amount || 0),
                  String(row.currency || 'NGN'),
                )}
              </td>
              <td>
                <span
                  className={`analytics-status-pill ${getStatusClass(row.status)}`}
                >
                  {row.status || 'Unknown'}
                </span>
              </td>
              <td>{formatDate(row.due_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CampaignTable({ rows }: { rows: RecordRow[] }) {
  if (!rows.length) {
    return <p className="analytics-empty">No campaign records found.</p>
  }

  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Status</th>
            <th>Start date</th>
            <th>End date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              <td>
                <strong>{getName(row, 'Untitled campaign')}</strong>
                <small>{row.campaign_type || 'Campaign'}</small>
              </td>
              <td>
                <span
                  className={`analytics-status-pill ${getStatusClass(row.status)}`}
                >
                  {row.status || 'Unknown'}
                </span>
              </td>
              <td>{formatDate(row.start_date)}</td>
              <td>{formatDate(row.end_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AgreementTable({ rows }: { rows: RecordRow[] }) {
  if (!rows.length) {
    return <p className="analytics-empty">No agreement records found.</p>
  }

  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead>
          <tr>
            <th>Agreement</th>
            <th>Status</th>
            <th>Value</th>
            <th>Start date</th>
            <th>End date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              <td>
                <strong>
                  {row.title ||
                    row.agreement_title ||
                    'Untitled agreement'}
                </strong>
                <small>{row.agreement_type || 'Agreement'}</small>
              </td>
              <td>
                <span
                  className={`analytics-status-pill ${getStatusClass(row.status)}`}
                >
                  {row.status || 'Unknown'}
                </span>
              </td>
              <td className="analytics-amount">
                {currencyAmount(
                  Number(row.total_value || 0),
                  String(row.currency || 'NGN'),
                )}
              </td>
              <td>{formatDate(row.start_date)}</td>
              <td>{formatDate(row.end_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AnalyticsReports
