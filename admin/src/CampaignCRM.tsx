
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Plus,
  Search,
  Users,
  X,
  Megaphone,
  ExternalLink,
  FileText,
  Target,
  RefreshCw,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './CampaignCRM.css'

type CampaignStatus =
  | 'draft'
  | 'planning'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'

type Campaign = {
  id: string
  brand_id: string
  campaign_name: string
  description: string | null
  objective: string | null
  campaign_type: string
  status: CampaignStatus
  start_date: string | null
  end_date: string | null
  budget: number
  currency: string
  platforms: string[] | null
  notes: string | null
  created_at: string
  brand?: { company_name: string } | null
}

type Brand = {
  id: string
  company_name: string
}

type Creator = {
  id: string
  full_name: string
  creator_name: string | null
}

type Assignment = {
  id: string
  campaign_id: string
  creator_id: string
  status: string
  agreed_fee: number
  currency: string
  notes: string | null
  creator?: Creator
}

type Deliverable = {
  id: string
  campaign_creator_id: string
  title: string
  description: string | null
  platform: string | null
  content_type: string | null
  quantity: number
  due_date: string | null
  status: string
  content_url: string | null
  published_url: string | null
  notes: string | null
}

type CampaignCRMProps = {
  onSignOut: () => Promise<void>
}

/**
 * Returns a validated Supabase client.
 * This keeps nullable-client handling consistent throughout the CRM.
 */
const getSupabaseClient = () => {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Check your environment variables and restart the application.',
    )
  }

  return supabase
}

const campaignStatuses: CampaignStatus[] = [
  'draft',
  'planning',
  'active',
  'paused',
  'completed',
  'cancelled',
]

const assignmentStatuses = [
  'invited',
  'interested',
  'confirmed',
  'in_progress',
  'completed',
  'declined',
  'cancelled',
]

const deliverableStatuses = [
  'pending',
  'in_progress',
  'submitted',
  'under_review',
  'approved',
  'revision_requested',
  'published',
  'rejected',
  'cancelled',
]

const platforms = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Facebook',
  'X',
  'LinkedIn',
]

const formatMoney = (amount: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

const formatDate = (value: string | null) => {
  if (!value) return 'Not set'

  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const titleCase = (value: string) =>
  value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function CampaignCRM({ onSignOut }: CampaignCRMProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [activeTab, setActiveTab] = useState<
    'overview' | 'creators' | 'deliverables'
  >('overview')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [showDeliverableForm, setShowDeliverableForm] = useState(false)

  const [campaignForm, setCampaignForm] = useState({
    brand_id: '',
    campaign_name: '',
    description: '',
    objective: '',
    campaign_type: 'influencer_marketing',
    start_date: '',
    end_date: '',
    budget: '',
    currency: 'NGN',
    platforms: [] as string[],
    notes: '',
  })

  const [assignmentForm, setAssignmentForm] = useState({
    creator_id: '',
    agreed_fee: '',
    currency: 'NGN',
    notes: '',
  })

  const [deliverableForm, setDeliverableForm] = useState({
    campaign_creator_id: '',
    title: '',
    description: '',
    platform: 'Instagram',
    content_type: 'Reel',
    quantity: '1',
    due_date: '',
    notes: '',
  })

  // Load campaigns, brands and creators.
  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const client = getSupabaseClient()

      const [campaignResult, brandResult, creatorResult] = await Promise.all([
        client
          .from('campaigns')
          .select('*, brand:brands(company_name)')
          .order('created_at', { ascending: false }),

        client
          .from('brands')
          .select('id, company_name')
          .order('company_name'),

        client
          .from('creators')
          .select('id, full_name, creator_name')
          .order('full_name'),
      ])

      if (campaignResult.error) throw campaignResult.error
      if (brandResult.error) throw brandResult.error
      if (creatorResult.error) throw creatorResult.error

      setCampaigns((campaignResult.data || []) as Campaign[])
      setBrands((brandResult.data || []) as Brand[])
      setCreators((creatorResult.data || []) as Creator[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load campaign data.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  // Load the selected campaign's creators and deliverables.
  const loadCampaignDetails = useCallback(async (campaignId: string) => {
    const client = getSupabaseClient()

    const [assignmentResult, deliverableResult] = await Promise.all([
      client
        .from('campaign_creators')
        .select('*, creator:creators(id, full_name, creator_name)')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false }),

      client
        .from('campaign_deliverables')
        .select('*, assignment:campaign_creators!inner(campaign_id)')
        .eq('assignment.campaign_id', campaignId)
        .order('created_at', { ascending: false }),
    ])

    if (assignmentResult.error) throw assignmentResult.error
    if (deliverableResult.error) throw deliverableResult.error

    setAssignments((assignmentResult.data || []) as Assignment[])
    setDeliverables((deliverableResult.data || []) as Deliverable[])
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (selectedCampaign) {
      void loadCampaignDetails(selectedCampaign.id).catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load campaign details.',
        )
      })
    } else {
      setAssignments([])
      setDeliverables([])
    }
  }, [selectedCampaign, loadCampaignDetails])

  // Search and status filtering.
  const filteredCampaigns = useMemo(() => {
    const term = search.trim().toLowerCase()

    return campaigns.filter((campaign) => {
      const matchesSearch =
        !term ||
        campaign.campaign_name.toLowerCase().includes(term) ||
        (campaign.brand?.company_name || '').toLowerCase().includes(term)

      const matchesStatus =
        statusFilter === 'all' || campaign.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [campaigns, search, statusFilter])

  // Campaign overview statistics.
  const totals = useMemo(
    () => ({
      total: campaigns.length,
      active: campaigns.filter((item) => item.status === 'active').length,
      planning: campaigns.filter((item) => item.status === 'planning').length,
      budget: campaigns.reduce(
        (sum, item) => sum + Number(item.budget || 0),
        0,
      ),
    }),
    [campaigns],
  )

  const assignmentStats = useMemo(
    () => ({
      total: assignments.length,
      confirmed: assignments.filter((item) =>
        ['confirmed', 'in_progress', 'completed'].includes(item.status),
      ).length,
    }),
    [assignments],
  )

  const deliverableStats = useMemo(
    () => ({
      total: deliverables.length,
      approved: deliverables.filter((item) =>
        ['approved', 'published'].includes(item.status),
      ).length,
      pending: deliverables.filter((item) =>
        ['pending', 'in_progress', 'under_review', 'submitted'].includes(
          item.status,
        ),
      ).length,
    }),
    [deliverables],
  )

  // Create a campaign.
  const handleCreateCampaign = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const client = getSupabaseClient()
      const { data: authData, error: authError } =
        await client.auth.getUser()

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const payload = {
        brand_id: campaignForm.brand_id,
        campaign_name: campaignForm.campaign_name.trim(),
        description: campaignForm.description.trim() || null,
        objective: campaignForm.objective.trim() || null,
        campaign_type: campaignForm.campaign_type,
        start_date: campaignForm.start_date || null,
        end_date: campaignForm.end_date || null,
        budget: Number(campaignForm.budget || 0),
        currency: campaignForm.currency,
        platforms: campaignForm.platforms,
        notes: campaignForm.notes.trim() || null,
        created_by: authData.user.id,
      }

      const { error: insertError } = await client
        .from('campaigns')
        .insert(payload)

      if (insertError) throw insertError

      setShowCampaignForm(false)

      setCampaignForm({
        brand_id: '',
        campaign_name: '',
        description: '',
        objective: '',
        campaign_type: 'influencer_marketing',
        start_date: '',
        end_date: '',
        budget: '',
        currency: 'NGN',
        platforms: [],
        notes: '',
      })

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create campaign.',
      )
    } finally {
      setSaving(false)
    }
  }

  // Update campaign status.
  const handleUpdateStatus = async (status: CampaignStatus) => {
    if (!selectedCampaign) return

    setSaving(true)
    setError('')

    try {
      const client = getSupabaseClient()

      const { error: updateError } = await client
        .from('campaigns')
        .update({ status })
        .eq('id', selectedCampaign.id)

      if (updateError) throw updateError

      setSelectedCampaign({ ...selectedCampaign, status })

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update campaign.',
      )
    } finally {
      setSaving(false)
    }
  }

  // Assign a creator to the selected campaign.
  const handleAssignCreator = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (!selectedCampaign) return

    setSaving(true)
    setError('')

    try {
      const client = getSupabaseClient()
      const { data: authData, error: authError } =
        await client.auth.getUser()

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const { error: insertError } = await client
        .from('campaign_creators')
        .insert({
          campaign_id: selectedCampaign.id,
          creator_id: assignmentForm.creator_id,
          agreed_fee: Number(assignmentForm.agreed_fee || 0),
          currency: assignmentForm.currency,
          notes: assignmentForm.notes.trim() || null,
          created_by: authData.user.id,
        })

      if (insertError) throw insertError

      setShowAssignForm(false)

      setAssignmentForm({
        creator_id: '',
        agreed_fee: '',
        currency: 'NGN',
        notes: '',
      })

      await loadCampaignDetails(selectedCampaign.id)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to assign creator.',
      )
    } finally {
      setSaving(false)
    }
  }

  // Update creator assignment status.
  const handleAssignmentStatus = async (
    id: string,
    status: string,
  ) => {
    if (!selectedCampaign) return

    setSaving(true)
    setError('')

    try {
      const client = getSupabaseClient()

      const { error: updateError } = await client
        .from('campaign_creators')
        .update({ status })
        .eq('id', id)

      if (updateError) throw updateError

      await loadCampaignDetails(selectedCampaign.id)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update creator assignment.',
      )
    } finally {
      setSaving(false)
    }
  }

  // Create a deliverable for an assigned creator.
  const handleCreateDeliverable = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (!selectedCampaign) return

    setSaving(true)
    setError('')

    try {
      const client = getSupabaseClient()
      const { data: authData, error: authError } =
        await client.auth.getUser()

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const payload = {
        campaign_creator_id: deliverableForm.campaign_creator_id,
        title: deliverableForm.title.trim(),
        description: deliverableForm.description.trim() || null,
        platform: deliverableForm.platform || null,
        content_type: deliverableForm.content_type || null,
        quantity: Number(deliverableForm.quantity || 1),
        due_date: deliverableForm.due_date || null,
        notes: deliverableForm.notes.trim() || null,
        created_by: authData.user.id,
      }

      const { error: insertError } = await client
        .from('campaign_deliverables')
        .insert(payload)

      if (insertError) throw insertError

      setShowDeliverableForm(false)

      setDeliverableForm({
        campaign_creator_id: '',
        title: '',
        description: '',
        platform: 'Instagram',
        content_type: 'Reel',
        quantity: '1',
        due_date: '',
        notes: '',
      })

      await loadCampaignDetails(selectedCampaign.id)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create deliverable.',
      )
    } finally {
      setSaving(false)
    }
  }

  // Update deliverable status.
  const handleDeliverableStatus = async (
    id: string,
    status: string,
  ) => {
    if (!selectedCampaign) return

    setSaving(true)
    setError('')

    try {
      const client = getSupabaseClient()

      const updates: Record<string, string> = { status }

      if (status === 'approved') {
        updates.approved_at = new Date().toISOString()
      }

      const { error: updateError } = await client
        .from('campaign_deliverables')
        .update(updates)
        .eq('id', id)

      if (updateError) throw updateError

      await loadCampaignDetails(selectedCampaign.id)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update deliverable.',
      )
    } finally {
      setSaving(false)
    }
  }

  const togglePlatform = (platform: string) => {
    setCampaignForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }))
  }

  const closeForms = () => {
    setShowCampaignForm(false)
    setShowAssignForm(false)
    setShowDeliverableForm(false)
  }

  return (
    <div className="campaign-crm">
      <header className="campaign-header">
        <div className="campaign-header-brand">
          <div className="campaign-logo">
            <Megaphone size={21} />
          </div>

          <div>
            <span className="campaign-eyebrow">SM BRIDGE MEDIA</span>
            <h1>Campaign Management</h1>
          </div>
        </div>

        <div className="campaign-header-actions">
          <button
            className="campaign-icon-button"
            onClick={() => void loadData()}
            title="Refresh"
            type="button"
          >
            <RefreshCw size={17} />
          </button>

          <button
            className="campaign-signout"
            onClick={() => void onSignOut()}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="campaign-main">
        {error && (
          <div className="campaign-alert" role="alert">
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              type="button"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {selectedCampaign ? (
          <>
            <button
              className="campaign-back"
              onClick={() => setSelectedCampaign(null)}
              type="button"
            >
              <ArrowLeft size={16} /> All campaigns
            </button>

            <section className="campaign-detail-heading">
              <div>
                <div className="campaign-detail-kicker">
                  {selectedCampaign.brand?.company_name || 'Brand campaign'}
                </div>

                <h2>{selectedCampaign.campaign_name}</h2>

                <p>
                  {selectedCampaign.objective ||
                    'No campaign objective added yet.'}
                </p>
              </div>

              <div className="campaign-detail-actions">
                <span
                  className={`campaign-status status-${selectedCampaign.status}`}
                >
                  {titleCase(selectedCampaign.status)}
                </span>

                <select
                  value={selectedCampaign.status}
                  onChange={(event) =>
                    void handleUpdateStatus(
                      event.target.value as CampaignStatus,
                    )
                  }
                  disabled={saving}
                  aria-label="Update campaign status"
                >
                  {campaignStatuses.map((status) => (
                    <option key={status} value={status}>
                      {titleCase(status)}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <div className="campaign-detail-stats">
              <div className="campaign-stat-card">
                <Users size={19} />
                <span>Assigned creators</span>
                <strong>{assignmentStats.total}</strong>
              </div>

              <div className="campaign-stat-card">
                <ClipboardList size={19} />
                <span>Deliverables</span>
                <strong>{deliverableStats.total}</strong>
              </div>

              <div className="campaign-stat-card">
                <CheckCircle2 size={19} />
                <span>Approved / published</span>
                <strong>{deliverableStats.approved}</strong>
              </div>

              <div className="campaign-stat-card">
                <CircleDollarSign size={19} />
                <span>Campaign budget</span>
                <strong>
                  {formatMoney(
                    Number(selectedCampaign.budget),
                    selectedCampaign.currency,
                  )}
                </strong>
              </div>
            </div>

            <nav className="campaign-tabs">
              <button
                className={activeTab === 'overview' ? 'active' : ''}
                onClick={() => setActiveTab('overview')}
                type="button"
              >
                Overview
              </button>

              <button
                className={activeTab === 'creators' ? 'active' : ''}
                onClick={() => setActiveTab('creators')}
                type="button"
              >
                Creators ({assignments.length})
              </button>

              <button
                className={activeTab === 'deliverables' ? 'active' : ''}
                onClick={() => setActiveTab('deliverables')}
                type="button"
              >
                Deliverables ({deliverables.length})
              </button>
            </nav>

            {activeTab === 'overview' && (
              <section className="campaign-panel">
                <h3>Campaign information</h3>

                <div className="campaign-info-grid">
                  <div>
                    <span>Brand</span>
                    <strong>
                      {selectedCampaign.brand?.company_name || '—'}
                    </strong>
                  </div>

                  <div>
                    <span>Campaign type</span>
                    <strong>{titleCase(selectedCampaign.campaign_type)}</strong>
                  </div>

                  <div>
                    <span>Start date</span>
                    <strong>{formatDate(selectedCampaign.start_date)}</strong>
                  </div>

                  <div>
                    <span>End date</span>
                    <strong>{formatDate(selectedCampaign.end_date)}</strong>
                  </div>

                  <div>
                    <span>Budget</span>
                    <strong>
                      {formatMoney(
                        Number(selectedCampaign.budget),
                        selectedCampaign.currency,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Platforms</span>
                    <strong>
                      {selectedCampaign.platforms?.join(', ') ||
                        'Not specified'}
                    </strong>
                  </div>
                </div>

                <div className="campaign-description">
                  <h4>Description</h4>
                  <p>
                    {selectedCampaign.description ||
                      'No description provided.'}
                  </p>
                </div>

                <div className="campaign-description">
                  <h4>Internal notes</h4>
                  <p>{selectedCampaign.notes || 'No internal notes.'}</p>
                </div>
              </section>
            )}

            {activeTab === 'creators' && (
              <section className="campaign-panel">
                <div className="campaign-panel-heading">
                  <div>
                    <h3>Assigned creators</h3>
                    <p>
                      Manage creator participation and agreed fees.
                    </p>
                  </div>

                  <button
                    className="campaign-primary-button"
                    onClick={() => setShowAssignForm(true)}
                    type="button"
                  >
                    <Plus size={16} /> Assign creator
                  </button>
                </div>

                {assignments.length === 0 ? (
                  <div className="campaign-empty">
                    <Users size={27} />
                    <strong>No creators assigned</strong>
                    <span>
                      Assign a creator to begin managing campaign work.
                    </span>
                  </div>
                ) : (
                  <div className="campaign-table-wrap">
                    <table className="campaign-table">
                      <thead>
                        <tr>
                          <th>Creator</th>
                          <th>Agreed fee</th>
                          <th>Assignment status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {assignments.map((assignment) => (
                          <tr key={assignment.id}>
                            <td>
                              <strong>
                                {assignment.creator?.creator_name ||
                                  assignment.creator?.full_name ||
                                  'Creator'}
                              </strong>
                            </td>

                            <td>
                              {formatMoney(
                                Number(assignment.agreed_fee),
                                assignment.currency,
                              )}
                            </td>

                            <td>
                              <select
                                value={assignment.status}
                                disabled={saving}
                                onChange={(event) =>
                                  void handleAssignmentStatus(
                                    assignment.id,
                                    event.target.value,
                                  )
                                }
                              >
                                {assignmentStatuses.map((status) => (
                                  <option key={status} value={status}>
                                    {titleCase(status)}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'deliverables' && (
              <section className="campaign-panel">
                <div className="campaign-panel-heading">
                  <div>
                    <h3>Campaign deliverables</h3>
                    <p>
                      Track content requirements, submissions and approvals.
                    </p>
                  </div>

                  <button
                    className="campaign-primary-button"
                    onClick={() => setShowDeliverableForm(true)}
                    disabled={assignments.length === 0}
                    type="button"
                  >
                    <Plus size={16} /> Add deliverable
                  </button>
                </div>

                {deliverables.length === 0 ? (
                  <div className="campaign-empty">
                    <ClipboardList size={27} />
                    <strong>No deliverables yet</strong>
                    <span>
                      Add deliverables after assigning at least one creator.
                    </span>
                  </div>
                ) : (
                  <div className="campaign-deliverable-list">
                    {deliverables.map((item) => (
                      <article
                        className="campaign-deliverable"
                        key={item.id}
                      >
                        <div className="campaign-deliverable-icon">
                          <FileText size={19} />
                        </div>

                        <div className="campaign-deliverable-content">
                          <strong>{item.title}</strong>

                          <span>
                            {item.platform || 'Platform not set'} ·{' '}
                            {item.content_type || 'Content type not set'} · Qty{' '}
                            {item.quantity}
                          </span>

                          <small>Due: {formatDate(item.due_date)}</small>

                          {item.content_url && (
                            <a
                              href={item.content_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View submission <ExternalLink size={12} />
                            </a>
                          )}

                          {item.published_url && (
                            <a
                              href={item.published_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View published content{' '}
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>

                        <select
                          value={item.status}
                          disabled={saving}
                          onChange={(event) =>
                            void handleDeliverableStatus(
                              item.id,
                              event.target.value,
                            )
                          }
                          aria-label={`Update status for ${item.title}`}
                        >
                          {deliverableStatuses.map((status) => (
                            <option key={status} value={status}>
                              {titleCase(status)}
                            </option>
                          ))}
                        </select>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <>
            <section className="campaign-welcome">
              <div>
                <span className="campaign-eyebrow">
                  OPERATIONS WORKSPACE
                </span>

                <h2>Manage your campaigns.</h2>

                <p>
                  Plan brand collaborations, assign creators and track every
                  deliverable from one workspace.
                </p>
              </div>

              <button
                className="campaign-primary-button"
                onClick={() => setShowCampaignForm(true)}
                type="button"
              >
                <Plus size={17} /> Create campaign
              </button>
            </section>

            <section className="campaign-overview-cards">
              <div className="campaign-overview-card">
                <span>Total campaigns</span>
                <strong>{totals.total}</strong>
                <Megaphone size={20} />
              </div>

              <div className="campaign-overview-card">
                <span>Active campaigns</span>
                <strong>{totals.active}</strong>
                <Target size={20} />
              </div>

              <div className="campaign-overview-card">
                <span>In planning</span>
                <strong>{totals.planning}</strong>
                <CalendarDays size={20} />
              </div>

              <div className="campaign-overview-card">
                <span>Total planned budget</span>
                <strong>{formatMoney(totals.budget)}</strong>
                <CircleDollarSign size={20} />
              </div>
            </section>

            <section className="campaign-panel">
              <div className="campaign-panel-heading campaign-list-heading">
                <div>
                  <h3>Campaign directory</h3>
                  <p>
                    All brand campaigns managed by SM Bridge Media.
                  </p>
                </div>

                <button
                  className="campaign-secondary-button"
                  onClick={() => void loadData()}
                  type="button"
                >
                  <RefreshCw size={15} /> Refresh
                </button>
              </div>

              <div className="campaign-filters">
                <label className="campaign-search">
                  <Search size={16} />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search campaigns or brands..."
                  />
                </label>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter campaigns by status"
                >
                  <option value="all">All statuses</option>

                  {campaignStatuses.map((status) => (
                    <option key={status} value={status}>
                      {titleCase(status)}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="campaign-loading">
                  <RefreshCw size={20} className="campaign-spin" />
                  Loading campaigns...
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="campaign-empty">
                  <Megaphone size={28} />
                  <strong>No campaigns found</strong>
                  <span>
                    Create your first campaign or adjust your search filters.
                  </span>
                </div>
              ) : (
                <div className="campaign-list">
                  {filteredCampaigns.map((campaign) => (
                    <button
                      className="campaign-list-item"
                      key={campaign.id}
                      onClick={() => {
                        setSelectedCampaign(campaign)
                        setActiveTab('overview')
                      }}
                      type="button"
                    >
                      <div className="campaign-list-icon">
                        <Megaphone size={19} />
                      </div>

                      <div className="campaign-list-copy">
                        <strong>{campaign.campaign_name}</strong>

                        <span>
                          {campaign.brand?.company_name ||
                            'Brand not available'}
                        </span>

                        <small>
                          <CalendarDays size={12} />{' '}
                          {formatDate(campaign.start_date)} –{' '}
                          {formatDate(campaign.end_date)}
                        </small>
                      </div>

                      <div className="campaign-list-meta">
                        <span
                          className={`campaign-status status-${campaign.status}`}
                        >
                          {titleCase(campaign.status)}
                        </span>

                        <strong>
                          {formatMoney(
                            Number(campaign.budget),
                            campaign.currency,
                          )}
                        </strong>
                      </div>

                      <ArrowLeft
                        className="campaign-list-arrow"
                        size={17}
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Create campaign modal */}
      {showCampaignForm && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForms()
          }}
        >
          <form
            className="campaign-modal"
            onSubmit={handleCreateCampaign}
          >
            <div className="campaign-modal-heading">
              <div>
                <span>NEW CAMPAIGN</span>
                <h2>Create campaign</h2>
              </div>

              <button
                type="button"
                onClick={closeForms}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <label>
              Campaign name
              <input
                required
                value={campaignForm.campaign_name}
                onChange={(event) =>
                  setCampaignForm({
                    ...campaignForm,
                    campaign_name: event.target.value,
                  })
                }
                placeholder="e.g. Q4 Product Awareness Campaign"
              />
            </label>

            <label>
              Brand
              <select
                required
                value={campaignForm.brand_id}
                onChange={(event) =>
                  setCampaignForm({
                    ...campaignForm,
                    brand_id: event.target.value,
                  })
                }
              >
                <option value="">Select a brand</option>

                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.company_name}
                  </option>
                ))}
              </select>
            </label>

            <div className="campaign-form-grid">
              <label>
                Campaign type
                <select
                  value={campaignForm.campaign_type}
                  onChange={(event) =>
                    setCampaignForm({
                      ...campaignForm,
                      campaign_type: event.target.value,
                    })
                  }
                >
                  <option value="influencer_marketing">
                    Influencer marketing
                  </option>
                  <option value="product_launch">Product launch</option>
                  <option value="brand_awareness">Brand awareness</option>
                  <option value="product_review">Product review</option>
                  <option value="event">Event promotion</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                Budget
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={campaignForm.budget}
                  onChange={(event) =>
                    setCampaignForm({
                      ...campaignForm,
                      budget: event.target.value,
                    })
                  }
                  placeholder="0.00"
                />
              </label>
            </div>

            <div className="campaign-form-grid">
              <label>
                Start date
                <input
                  type="date"
                  value={campaignForm.start_date}
                  onChange={(event) =>
                    setCampaignForm({
                      ...campaignForm,
                      start_date: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                End date
                <input
                  type="date"
                  min={campaignForm.start_date || undefined}
                  value={campaignForm.end_date}
                  onChange={(event) =>
                    setCampaignForm({
                      ...campaignForm,
                      end_date: event.target.value,
                    })
                  }
                />
              </label>
            </div>

            <label>
              Objective
              <input
                value={campaignForm.objective}
                onChange={(event) =>
                  setCampaignForm({
                    ...campaignForm,
                    objective: event.target.value,
                  })
                }
                placeholder="What should this campaign achieve?"
              />
            </label>

            <label>
              Description
              <textarea
                rows={3}
                value={campaignForm.description}
                onChange={(event) =>
                  setCampaignForm({
                    ...campaignForm,
                    description: event.target.value,
                  })
                }
                placeholder="Describe the campaign..."
              />
            </label>

            <fieldset className="campaign-platform-picker">
              <legend>Platforms</legend>

              {platforms.map((platform) => (
                <label key={platform}>
                  <input
                    type="checkbox"
                    checked={campaignForm.platforms.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                  />
                  {platform}
                </label>
              ))}
            </fieldset>

            <label>
              Internal notes
              <textarea
                rows={2}
                value={campaignForm.notes}
                onChange={(event) =>
                  setCampaignForm({
                    ...campaignForm,
                    notes: event.target.value,
                  })
                }
              />
            </label>

            <div className="campaign-modal-actions">
              <button
                type="button"
                className="campaign-secondary-button"
                onClick={closeForms}
              >
                Cancel
              </button>

              <button
                className="campaign-primary-button"
                disabled={saving}
              >
                {saving ? 'Creating...' : 'Create campaign'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assign creator modal */}
      {showAssignForm && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForms()
          }}
        >
          <form
            className="campaign-modal campaign-modal-small"
            onSubmit={handleAssignCreator}
          >
            <div className="campaign-modal-heading">
              <div>
                <span>CAMPAIGN TEAM</span>
                <h2>Assign creator</h2>
              </div>

              <button
                type="button"
                onClick={closeForms}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <label>
              Creator
              <select
                required
                value={assignmentForm.creator_id}
                onChange={(event) =>
                  setAssignmentForm({
                    ...assignmentForm,
                    creator_id: event.target.value,
                  })
                }
              >
                <option value="">Select a creator</option>

                {creators
                  .filter(
                    (creator) =>
                      !assignments.some(
                        (item) => item.creator_id === creator.id,
                      ),
                  )
                  .map((creator) => (
                    <option key={creator.id} value={creator.id}>
                      {creator.creator_name || creator.full_name}
                    </option>
                  ))}
              </select>
            </label>

            <div className="campaign-form-grid">
              <label>
                Agreed fee
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={assignmentForm.agreed_fee}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      agreed_fee: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Currency
                <select
                  value={assignmentForm.currency}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      currency: event.target.value,
                    })
                  }
                >
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>

            <label>
              Notes
              <textarea
                rows={3}
                value={assignmentForm.notes}
                onChange={(event) =>
                  setAssignmentForm({
                    ...assignmentForm,
                    notes: event.target.value,
                  })
                }
              />
            </label>

            <div className="campaign-modal-actions">
              <button
                type="button"
                className="campaign-secondary-button"
                onClick={closeForms}
              >
                Cancel
              </button>

              <button
                className="campaign-primary-button"
                disabled={saving}
              >
                {saving ? 'Assigning...' : 'Assign creator'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add deliverable modal */}
      {showDeliverableForm && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForms()
          }}
        >
          <form
            className="campaign-modal campaign-modal-small"
            onSubmit={handleCreateDeliverable}
          >
            <div className="campaign-modal-heading">
              <div>
                <span>CONTENT REQUIREMENTS</span>
                <h2>Add deliverable</h2>
              </div>

              <button
                type="button"
                onClick={closeForms}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <label>
              Assigned creator
              <select
                required
                value={deliverableForm.campaign_creator_id}
                onChange={(event) =>
                  setDeliverableForm({
                    ...deliverableForm,
                    campaign_creator_id: event.target.value,
                  })
                }
              >
                <option value="">Select assigned creator</option>

                {assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.creator?.creator_name ||
                      assignment.creator?.full_name ||
                      'Creator'}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Deliverable title
              <input
                required
                value={deliverableForm.title}
                onChange={(event) =>
                  setDeliverableForm({
                    ...deliverableForm,
                    title: event.target.value,
                  })
                }
                placeholder="e.g. Product review Reel"
              />
            </label>

            <div className="campaign-form-grid">
              <label>
                Platform
                <select
                  value={deliverableForm.platform}
                  onChange={(event) =>
                    setDeliverableForm({
                      ...deliverableForm,
                      platform: event.target.value,
                    })
                  }
                >
                  {platforms.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Content type
                <select
                  value={deliverableForm.content_type}
                  onChange={(event) =>
                    setDeliverableForm({
                      ...deliverableForm,
                      content_type: event.target.value,
                    })
                  }
                >
                  <option>Reel</option>
                  <option>Video</option>
                  <option>Story</option>
                  <option>Carousel</option>
                  <option>Short</option>
                  <option>Post</option>
                  <option>Live stream</option>
                  <option>Other</option>
                </select>
              </label>
            </div>

            <div className="campaign-form-grid">
              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  value={deliverableForm.quantity}
                  onChange={(event) =>
                    setDeliverableForm({
                      ...deliverableForm,
                      quantity: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Due date
                <input
                  type="date"
                  value={deliverableForm.due_date}
                  onChange={(event) =>
                    setDeliverableForm({
                      ...deliverableForm,
                      due_date: event.target.value,
                    })
                  }
                />
              </label>
            </div>

            <label>
              Description
              <textarea
                rows={3}
                value={deliverableForm.description}
                onChange={(event) =>
                  setDeliverableForm({
                    ...deliverableForm,
                    description: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Notes
              <textarea
                rows={2}
                value={deliverableForm.notes}
                onChange={(event) =>
                  setDeliverableForm({
                    ...deliverableForm,
                    notes: event.target.value,
                  })
                }
              />
            </label>

            <div className="campaign-modal-actions">
              <button
                type="button"
                className="campaign-secondary-button"
                onClick={closeForms}
              >
                Cancel
              </button>

              <button
                className="campaign-primary-button"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Add deliverable'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
