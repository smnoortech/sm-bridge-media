
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  FileText,
  Plus,
  Search,
  RefreshCw,
  X,
  Wallet,
  Building2,
  Users,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import './AgreementsPaymentsCRM.css'

type AgreementStatus =
  | 'draft'
  | 'sent'
  | 'under_review'
  | 'signed'
  | 'active'
  | 'completed'
  | 'terminated'
  | 'expired'

type PaymentDirection = 'incoming' | 'outgoing'

type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'overdue'
  | 'failed'
  | 'cancelled'
  | 'refunded'

interface Agreement {
  id: string
  brand_id: string | null
  creator_id: string | null
  campaign_id: string | null
  agreement_title: string
  agreement_type: string
  status: AgreementStatus
  start_date: string | null
  end_date: string | null
  total_value: number
  currency: string
  payment_terms: string | null
  document_url: string | null
  sent_at: string | null
  signed_at: string | null
  notes: string | null
  created_at: string
}

interface Payment {
  id: string
  agreement_id: string | null
  campaign_id: string | null
  brand_id: string | null
  creator_id: string | null
  direction: PaymentDirection
  payment_type: string
  description: string | null
  amount: number
  currency: string
  status: PaymentStatus
  due_date: string | null
  paid_at: string | null
  payment_method: string | null
  transaction_reference: string | null
  notes: string | null
  created_at: string
}

interface Brand {
  id: string
  company_name: string
}

interface Creator {
  id: string
  full_name: string
  creator_name: string | null
}

interface Campaign {
  id: string
  campaign_name: string
}

interface Props {
  onSignOut: () => Promise<void>
}

type ActiveTab = 'agreements' | 'payments'

const AGREEMENT_STATUSES: AgreementStatus[] = [
  'draft',
  'sent',
  'under_review',
  'signed',
  'active',
  'completed',
  'terminated',
  'expired',
]

const PAYMENT_STATUSES: PaymentStatus[] = [
  'pending',
  'processing',
  'paid',
  'overdue',
  'failed',
  'cancelled',
  'refunded',
]

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR']

const emptyAgreementForm = {
  title: '',
  agreement_type: 'campaign',
  brand_id: '',
  creator_id: '',
  campaign_id: '',
  status: 'draft' as AgreementStatus,
  start_date: '',
  end_date: '',
  total_value: '',
  currency: 'NGN',
  payment_terms: '',
  document_url: '',
  notes: '',
}

const emptyPaymentForm = {
  agreement_id: '',
  campaign_id: '',
  brand_id: '',
  creator_id: '',
  direction: 'incoming' as PaymentDirection,
  payment_type: 'campaign_fee',
  description: '',
  amount: '',
  currency: 'NGN',
  status: 'pending' as PaymentStatus,
  due_date: '',
  paid_at: '',
  payment_method: '',
  transaction_reference: '',
  notes: '',
}

function getClient() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Check your environment settings.',
    )
  }

  return supabase
}

function formatMoney(value: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function formatDate(value: string | null) {
  if (!value) return '—'

  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getStatusClass(status: string) {
  return `ap-status ap-status-${status}`
}

function AgreementsPaymentsCRM({ onSignOut }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('agreements')
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [showAgreementForm, setShowAgreementForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  const [agreementForm, setAgreementForm] = useState(emptyAgreementForm)
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const client = getClient()

      const [
        agreementResult,
        paymentResult,
        brandResult,
        creatorResult,
        campaignResult,
      ] = await Promise.all([
        client.from('agreements').select('*').order('created_at', {
          ascending: false,
        }),
        client.from('payments').select('*').order('created_at', {
          ascending: false,
        }),
        client.from('brands').select('id, company_name').order('company_name'),
        client
          .from('creators')
          .select('id, full_name, creator_name')
          .order('full_name'),
        client
          .from('campaigns')
          .select('id, campaign_name')
          .order('created_at', { ascending: false }),
      ])

      if (agreementResult.error) throw agreementResult.error
      if (paymentResult.error) throw paymentResult.error
      if (brandResult.error) throw brandResult.error
      if (creatorResult.error) throw creatorResult.error
      if (campaignResult.error) throw campaignResult.error

      setAgreements((agreementResult.data || []) as Agreement[])
      setPayments((paymentResult.data || []) as Payment[])
      setBrands((brandResult.data || []) as Brand[])
      setCreators((creatorResult.data || []) as Creator[])
      setCampaigns((campaignResult.data || []) as Campaign[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load agreements and payment records.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const brandName = (id: string | null) =>
    brands.find((brand) => brand.id === id)?.company_name || '—'

  const creatorName = (id: string | null) => {
    const creator = creators.find((item) => item.id === id)
    return creator
      ? creator.creator_name || creator.full_name
      : '—'
  }

  const campaignName = (id: string | null) =>
    campaigns.find((campaign) => campaign.id === id)?.campaign_name || '—'

  const agreementName = (id: string | null) =>
    agreements.find((agreement) => agreement.id === id)?.agreement_title || '—'

  const filteredAgreements = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return agreements

    return agreements.filter((agreement) =>
      [
        agreement.agreement_title,
        agreement.agreement_type,
        agreement.status,
        agreement.currency,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [agreements, search])

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return payments

    return payments.filter((payment) =>
      [
        payment.description,
        payment.payment_type,
        payment.direction,
        payment.status,
        payment.transaction_reference,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [payments, search])

  const financialSummary = useMemo(() => {
    const incomingPaid = payments
      .filter(
        (payment) =>
          payment.direction === 'incoming' && payment.status === 'paid',
      )
      .reduce((total, payment) => total + Number(payment.amount), 0)

    const outgoingPaid = payments
      .filter(
        (payment) =>
          payment.direction === 'outgoing' && payment.status === 'paid',
      )
      .reduce((total, payment) => total + Number(payment.amount), 0)

    const outstanding = payments
      .filter(
        (payment) =>
          payment.status === 'pending' ||
          payment.status === 'processing' ||
          payment.status === 'overdue',
      )
      .reduce((total, payment) => total + Number(payment.amount), 0)

    const overdue = payments
      .filter((payment) => payment.status === 'overdue')
      .reduce((total, payment) => total + Number(payment.amount), 0)

    return {
      incomingPaid,
      outgoingPaid,
      outstanding,
      overdue,
    }
  }, [payments])

  async function handleCreateAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const client = getClient()
      const { data: authData, error: authError } = await client.auth.getUser()

      if (authError || !authData.user) {
        throw new Error('Your administrator session could not be verified.')
      }

      const payload = {
        agreement_title: agreementForm.title.trim(),
        agreement_type: agreementForm.agreement_type,
        brand_id: agreementForm.brand_id || null,
        creator_id: agreementForm.creator_id || null,
        campaign_id: agreementForm.campaign_id || null,
        status: agreementForm.status,
        start_date: agreementForm.start_date || null,
        end_date: agreementForm.end_date || null,
        total_value: Number(agreementForm.total_value || 0),
        currency: agreementForm.currency,
        payment_terms: agreementForm.payment_terms.trim() || null,
        document_url: agreementForm.document_url.trim() || null,
        notes: agreementForm.notes.trim() || null,
        created_by: authData.user.id,
      }

      const { error: insertError } = await client
        .from('agreements')
        .insert(payload)

      if (insertError) throw insertError

      setAgreementForm(emptyAgreementForm)
      setShowAgreementForm(false)
      setSuccess('Agreement created successfully.')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create agreement.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleAgreementStatus(
    agreement: Agreement,
    status: AgreementStatus,
  ) {
    setError('')
    setSuccess('')

    try {
      const client = getClient()
      const updates: Record<string, string | null> = { status }

      if (status === 'sent' && !agreement.sent_at) {
        updates.sent_at = new Date().toISOString()
      }

      if (status === 'signed' && !agreement.signed_at) {
        updates.signed_at = new Date().toISOString()
      }

      const { error: updateError } = await client
        .from('agreements')
        .update(updates)
        .eq('id', agreement.id)

      if (updateError) throw updateError

      setSuccess('Agreement status updated.')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update agreement status.',
      )
    }
  }

  async function handleCreatePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const client = getClient()
      const { data: authData, error: authError } = await client.auth.getUser()

      if (authError || !authData.user) {
        throw new Error('Your administrator session could not be verified.')
      }

      const payload = {
        agreement_id: paymentForm.agreement_id || null,
        campaign_id: paymentForm.campaign_id || null,
        brand_id: paymentForm.brand_id || null,
        creator_id: paymentForm.creator_id || null,
        direction: paymentForm.direction,
        payment_type: paymentForm.payment_type,
        description: paymentForm.description.trim() || null,
        amount: Number(paymentForm.amount),
        currency: paymentForm.currency,
        status: paymentForm.status,
        due_date: paymentForm.due_date || null,
        paid_at: paymentForm.paid_at
          ? new Date(paymentForm.paid_at).toISOString()
          : paymentForm.status === 'paid'
            ? new Date().toISOString()
            : null,
        payment_method: paymentForm.payment_method.trim() || null,
        transaction_reference:
          paymentForm.transaction_reference.trim() || null,
        notes: paymentForm.notes.trim() || null,
        created_by: authData.user.id,
      }

      const { error: insertError } = await client
        .from('payments')
        .insert(payload)

      if (insertError) throw insertError

      setPaymentForm(emptyPaymentForm)
      setShowPaymentForm(false)
      setSuccess('Payment record created successfully.')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create payment record.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handlePaymentStatus(
    payment: Payment,
    status: PaymentStatus,
  ) {
    setError('')
    setSuccess('')

    try {
      const client = getClient()
      const updates: Record<string, string | null> = { status }

      if (status === 'paid' && !payment.paid_at) {
        updates.paid_at = new Date().toISOString()
      }

      const { error: updateError } = await client
        .from('payments')
        .update(updates)
        .eq('id', payment.id)

      if (updateError) throw updateError

      setSuccess('Payment status updated.')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update payment status.',
      )
    }
  }

  return (
    <main className="ap-page">
      <header className="ap-header">
        <div className="ap-header-left">
          <Link to="/dashboard" className="ap-back-link">
            <ArrowLeft size={17} />
            Dashboard
          </Link>

          <div className="ap-heading">
            <div className="ap-heading-icon">
              <FileText size={23} />
            </div>
            <div>
              <span className="ap-eyebrow">SM BRIDGE MEDIA · MANAGEMENT</span>
              <h1>Agreements &amp; Payments</h1>
              <p>Manage contracts, financial obligations and transactions.</p>
            </div>
          </div>
        </div>

        <div className="ap-header-actions">
          <button
            className="ap-button ap-button-secondary"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="ap-button ap-button-dark" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="ap-content">
        {error && (
          <div className="ap-alert ap-alert-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="ap-alert ap-alert-success" role="status">
            <CheckCircle2 size={18} />
            <span>{success}</span>
            <button onClick={() => setSuccess('')} aria-label="Dismiss message">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="ap-summary-grid">
          <article className="ap-summary-card">
            <div className="ap-summary-icon ap-icon-blue">
              <FileText size={20} />
            </div>
            <span>Total agreements</span>
            <strong>{agreements.length}</strong>
            <small>All recorded contracts</small>
          </article>

          <article className="ap-summary-card">
            <div className="ap-summary-icon ap-icon-green">
              <ArrowDownLeft size={20} />
            </div>
            <span>Incoming paid</span>
            <strong>{formatMoney(financialSummary.incomingPaid)}</strong>
            <small>Across all currencies combined</small>
          </article>

          <article className="ap-summary-card">
            <div className="ap-summary-icon ap-icon-purple">
              <ArrowUpRight size={20} />
            </div>
            <span>Outgoing paid</span>
            <strong>{formatMoney(financialSummary.outgoingPaid)}</strong>
            <small>Creator and partner payouts</small>
          </article>

          <article className="ap-summary-card">
            <div className="ap-summary-icon ap-icon-orange">
              <Clock size={20} />
            </div>
            <span>Outstanding</span>
            <strong>{formatMoney(financialSummary.outstanding)}</strong>
            <small>
              {formatMoney(financialSummary.overdue)} overdue
            </small>
          </article>
        </div>

        <div className="ap-workspace">
          <div className="ap-toolbar">
            <div className="ap-tabs">
              <button
                className={activeTab === 'agreements' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('agreements')
                  setSearch('')
                }}
              >
                <FileText size={17} />
                Agreements
                <span>{agreements.length}</span>
              </button>

              <button
                className={activeTab === 'payments' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('payments')
                  setSearch('')
                }}
              >
                <Wallet size={17} />
                Payments
                <span>{payments.length}</span>
              </button>
            </div>

            <div className="ap-toolbar-actions">
              <div className="ap-search">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={
                    activeTab === 'agreements'
                      ? 'Search agreements...'
                      : 'Search payments...'
                  }
                />
              </div>

              {activeTab === 'agreements' ? (
                <button
                  className="ap-button ap-button-primary"
                  onClick={() => setShowAgreementForm(true)}
                >
                  <Plus size={17} />
                  New agreement
                </button>
              ) : (
                <button
                  className="ap-button ap-button-primary"
                  onClick={() => setShowPaymentForm(true)}
                >
                  <Plus size={17} />
                  Record payment
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="ap-loading">
              <div className="ap-spinner" />
              <p>Loading financial records...</p>
            </div>
          ) : activeTab === 'agreements' ? (
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Agreement</th>
                    <th>Brand</th>
                    <th>Creator</th>
                    <th>Campaign</th>
                    <th>Value</th>
                    <th>End date</th>
                    <th>Status</th>
                    <th>Update status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgreements.map((agreement) => (
                    <tr key={agreement.id}>
                      <td>
                        <strong>{agreement.agreement_title}</strong>
                        <small>{titleCase(agreement.agreement_type)}</small>
                      </td>
                      <td>{brandName(agreement.brand_id)}</td>
                      <td>{creatorName(agreement.creator_id)}</td>
                      <td>{campaignName(agreement.campaign_id)}</td>
                      <td className="ap-money">
                        {formatMoney(
                          agreement.total_value,
                          agreement.currency,
                        )}
                      </td>
                      <td>{formatDate(agreement.end_date)}</td>
                      <td>
                        <span className={getStatusClass(agreement.status)}>
                          {titleCase(agreement.status)}
                        </span>
                      </td>
                      <td>
                        <select
                          className="ap-status-select"
                          value={agreement.status}
                          onChange={(event) =>
                            void handleAgreementStatus(
                              agreement,
                              event.target.value as AgreementStatus,
                            )
                          }
                          aria-label={`Update ${agreement.agreement_title} status`}
                        >
                          {AGREEMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {titleCase(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}

                  {filteredAgreements.length === 0 && (
                    <tr>
                      <td colSpan={8} className="ap-empty">
                        <FileText size={28} />
                        <strong>No agreements found</strong>
                        <span>Create an agreement to start tracking contracts.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Direction</th>
                    <th>Agreement</th>
                    <th>Brand / Creator</th>
                    <th>Amount</th>
                    <th>Due date</th>
                    <th>Status</th>
                    <th>Update status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <strong>
                          {payment.description || titleCase(payment.payment_type)}
                        </strong>
                        <small>
                          {payment.transaction_reference || 'No reference'}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`ap-direction ap-direction-${payment.direction}`}
                        >
                          {payment.direction === 'incoming' ? (
                            <ArrowDownLeft size={14} />
                          ) : (
                            <ArrowUpRight size={14} />
                          )}
                          {titleCase(payment.direction)}
                        </span>
                      </td>
                      <td>{agreementName(payment.agreement_id)}</td>
                      <td>
                        {payment.direction === 'incoming'
                          ? brandName(payment.brand_id)
                          : creatorName(payment.creator_id)}
                      </td>
                      <td className="ap-money">
                        {formatMoney(payment.amount, payment.currency)}
                      </td>
                      <td>{formatDate(payment.due_date)}</td>
                      <td>
                        <span className={getStatusClass(payment.status)}>
                          {titleCase(payment.status)}
                        </span>
                      </td>
                      <td>
                        <select
                          className="ap-status-select"
                          value={payment.status}
                          onChange={(event) =>
                            void handlePaymentStatus(
                              payment,
                              event.target.value as PaymentStatus,
                            )
                          }
                          aria-label={`Update payment status ${payment.id}`}
                        >
                          {PAYMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {titleCase(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}

                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="ap-empty">
                        <Wallet size={28} />
                        <strong>No payment records found</strong>
                        <span>Record an incoming or outgoing payment to begin tracking.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ap-info-grid">
          <div className="ap-info-card">
            <Building2 size={19} />
            <div>
              <strong>{brands.length} brands connected</strong>
              <span>Available for agreement and payment records</span>
            </div>
          </div>
          <div className="ap-info-card">
            <Users size={19} />
            <div>
              <strong>{creators.length} creators connected</strong>
              <span>Available for partnership agreements and payouts</span>
            </div>
          </div>
          <div className="ap-info-card">
            <BriefcaseBusiness size={19} />
            <div>
              <strong>{campaigns.length} campaigns connected</strong>
              <span>Campaign records available for financial tracking</span>
            </div>
          </div>
        </div>
      </section>

      {showAgreementForm && (
        <div
          className="ap-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowAgreementForm(false)
            }
          }}
        >
          <section className="ap-modal">
            <div className="ap-modal-header">
              <div>
                <span className="ap-eyebrow">CONTRACT MANAGEMENT</span>
                <h2>Create agreement</h2>
                <p>Register a brand, creator or campaign agreement.</p>
              </div>
              <button
                className="ap-icon-button"
                onClick={() => setShowAgreementForm(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAgreement}>
              <div className="ap-form-grid">
                <label className="ap-field ap-field-full">
                  Agreement title *
                  <input
                    required
                    value={agreementForm.title}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        title: event.target.value,
                      })
                    }
                    placeholder="e.g. Product launch partnership agreement"
                  />
                </label>

                <label className="ap-field">
                  Agreement type *
                  <select
                    value={agreementForm.agreement_type}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        agreement_type: event.target.value,
                      })
                    }
                  >
                    <option value="brand_service">Brand service</option>
                    <option value="creator_partnership">Creator partnership</option>
                    <option value="campaign">Campaign</option>
                    <option value="nda">NDA</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="ap-field">
                  Initial status
                  <select
                    value={agreementForm.status}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        status: event.target.value as AgreementStatus,
                      })
                    }
                  >
                    {AGREEMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {titleCase(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ap-field">
                  Brand
                  <select
                    value={agreementForm.brand_id}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        brand_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.company_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ap-field">
                  Creator
                  <select
                    value={agreementForm.creator_id}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        creator_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Select creator</option>
                    {creators.map((creator) => (
                      <option key={creator.id} value={creator.id}>
                        {creator.creator_name || creator.full_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ap-field ap-field-full">
                  Campaign
                  <select
                    value={agreementForm.campaign_id}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        campaign_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Select campaign</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.campaign_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ap-field">
                  Agreement value *
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={agreementForm.total_value}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        total_value: event.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </label>

                <label className="ap-field">
                  Currency
                  <select
                    value={agreementForm.currency}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        currency: event.target.value,
                      })
                    }
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ap-field">
                  Start date
                  <input
                    type="date"
                    value={agreementForm.start_date}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        start_date: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="ap-field">
                  End date
                  <input
                    type="date"
                    value={agreementForm.end_date}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        end_date: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="ap-field ap-field-full">
                  Payment terms
                  <textarea
                    rows={2}
                    value={agreementForm.payment_terms}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        payment_terms: event.target.value,
                      })
                    }
                    placeholder="e.g. 50% deposit, 50% after delivery"
                  />
                </label>

                <label className="ap-field ap-field-full">
                  Agreement document URL
                  <input
                    type="url"
                    value={agreementForm.document_url}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        document_url: event.target.value,
                      })
                    }
                    placeholder="https://..."
                  />
                </label>

                <label className="ap-field ap-field-full">
                  Internal notes
                  <textarea
                    rows={3}
                    value={agreementForm.notes}
                    onChange={(event) =>
                      setAgreementForm({
                        ...agreementForm,
                        notes: event.target.value,
                      })
                    }
                    placeholder="Additional agreement details..."
                  />
                </label>
              </div>

              <div className="ap-modal-actions">
                <button
                  type="button"
                  className="ap-button ap-button-secondary"
                  onClick={() => setShowAgreementForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ap-button ap-button-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Create agreement'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showPaymentForm && (
        <div
          className="ap-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowPaymentForm(false)
            }
          }}
        >
          <section className="ap-modal">
            <div className="ap-modal-header">
              <div>
                <span className="ap-eyebrow">FINANCIAL MANAGEMENT</span>
                <h2>Record payment</h2>
                <p>Register money received or a payment made.</p>
              </div>
              <button
                className="ap-icon-button"
                onClick={() => setShowPaymentForm(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePayment}>
              <div className="ap-form-grid">
                <label className="ap-field">
                  Payment direction *
                  <select
                    value={paymentForm.direction}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        direction: event.target.value as PaymentDirection,
                      })
                    }
                  >
                    <option value="incoming">Incoming — money received</option>
                    <option value="outgoing">Outgoing — money paid</option>
                  </select>
                </label>

                <label className="ap-field">
                  Payment type *
                  <select
                    value={paymentForm.payment_type}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_type: event.target.value,
                      })
                    }
                  >
                    <option value="campaign_fee">Campaign fee</option>
                    <option value="creator_payout">Creator payout</option>
                    <option value="deposit">Deposit</option>
                    <option value="commission">Commission</option>
                    <option value="refund">Refund</option>
                    <option value="service_fee">Service fee</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="ap-field ap-field-full">
                  Description
                  <input
                    value={paymentForm.description}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="e.g. Initial campaign deposit"
                  />
                </label>

                <label className="ap-field">
                  Amount *
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        amount: event.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </label>

                <label className="ap-field">
                  Currency
                  <select
                    value={paymentForm.currency}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        currency: event.target.value,
                      })
                    }
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ap-field">
                  Agreement
                  <select
                    value={paymentForm.agreement_id}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        agreement_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Select agreement</option>
                    {agreements.map((agreement) => (
                      <option key={agreement.id} value={agreement.id}>
                        {agreement.agreement_title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ap-field">
                  Campaign
                  <select
                    value={paymentForm.campaign_id}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        campaign_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Select campaign</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.campaign_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ap-field">
                  Brand
                  <select
                    value={paymentForm.brand_id}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        brand_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.company_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ap-field">
                  Creator
                  <select
                    value={paymentForm.creator_id}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        creator_id: event.target.value,
                      })
                    }
                  >
                    <option value="">Select creator</option>
                    {creators.map((creator) => (
                      <option key={creator.id} value={creator.id}>
                        {creator.creator_name || creator.full_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ap-field">
                  Payment status
                  <select
                    value={paymentForm.status}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        status: event.target.value as PaymentStatus,
                      })
                    }
                  >
                    {PAYMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {titleCase(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ap-field">
                  Due date
                  <input
                    type="date"
                    value={paymentForm.due_date}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        due_date: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="ap-field">
                  Date paid
                  <input
                    type="datetime-local"
                    value={paymentForm.paid_at}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        paid_at: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="ap-field">
                  Payment method
                  <input
                    value={paymentForm.payment_method}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        payment_method: event.target.value,
                      })
                    }
                    placeholder="Bank transfer, card, etc."
                  />
                </label>

                <label className="ap-field">
                  Transaction reference
                  <input
                    value={paymentForm.transaction_reference}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        transaction_reference: event.target.value,
                      })
                    }
                    placeholder="Transaction ID or reference"
                  />
                </label>

                <label className="ap-field ap-field-full">
                  Internal notes
                  <textarea
                    rows={3}
                    value={paymentForm.notes}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        notes: event.target.value,
                      })
                    }
                    placeholder="Additional payment details..."
                  />
                </label>
              </div>

              <div className="ap-modal-actions">
                <button
                  type="button"
                  className="ap-button ap-button-secondary"
                  onClick={() => setShowPaymentForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ap-button ap-button-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save payment'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default AgreementsPaymentsCRM
