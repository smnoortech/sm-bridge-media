
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  BriefcaseBusiness,
  UserRound,
  Handshake,
  ExternalLink,
  LogOut,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './BrandCRM.css'

type BrandStatus =
  | 'discovered'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'meeting_scheduled'
  | 'negotiating'
  | 'active_client'
  | 'declined'
  | 'unresponsive'
  | 'paused'

type Brand = {
  id: string
  company_name: string
  brand_name: string | null
  website_url: string | null
  industry: string | null
  country: string | null
  city: string | null
  company_size: string | null
  general_email: string | null
  general_phone: string | null
  contact_channel: string | null
  acquisition_status: BrandStatus
  source: string | null
  estimated_budget: number | null
  currency: string | null
  notes: string | null
  first_contacted_at: string | null
  last_contacted_at: string | null
  follow_up_due_at: string | null
  created_at: string
  updated_at: string
}

type BrandContact = {
  id: string
  brand_id: string
  full_name: string
  job_title: string | null
  email: string | null
  phone: string | null
  preferred_channel: string
  is_primary: boolean
  notes: string | null
  created_at: string
}

type BrandInteraction = {
  id: string
  brand_id: string
  contact_id: string | null
  channel: string
  direction: string
  interaction_type: string
  subject: string | null
  summary: string
  occurred_at: string
  created_at: string
}

type BrandCRMProps = {
  onSignOut: () => Promise<void>
}

type BrandForm = {
  company_name: string
  brand_name: string
  website_url: string
  industry: string
  country: string
  city: string
  company_size: string
  general_email: string
  general_phone: string
  contact_channel: string
  acquisition_status: BrandStatus
  source: string
  estimated_budget: string
  currency: string
  notes: string
  follow_up_due_at: string
}

type ContactForm = {
  full_name: string
  job_title: string
  email: string
  phone: string
  preferred_channel: string
  is_primary: boolean
  notes: string
}

type InteractionForm = {
  contact_id: string
  channel: string
  direction: string
  interaction_type: string
  subject: string
  summary: string
  occurred_at: string
}

const statusLabels: Record<BrandStatus, string> = {
  discovered: 'Discovered',
  contacted: 'Contacted',
  replied: 'Replied',
  interested: 'Interested',
  meeting_scheduled: 'Meeting scheduled',
  negotiating: 'Negotiating',
  active_client: 'Active client',
  declined: 'Declined',
  unresponsive: 'Unresponsive',
  paused: 'Paused',
}

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
  value,
  label,
}))

const emptyBrandForm: BrandForm = {
  company_name: '',
  brand_name: '',
  website_url: '',
  industry: '',
  country: '',
  city: '',
  company_size: '',
  general_email: '',
  general_phone: '',
  contact_channel: 'email',
  acquisition_status: 'discovered',
  source: '',
  estimated_budget: '',
  currency: 'NGN',
  notes: '',
  follow_up_due_at: '',
}

const emptyContactForm: ContactForm = {
  full_name: '',
  job_title: '',
  email: '',
  phone: '',
  preferred_channel: 'email',
  is_primary: false,
  notes: '',
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Not set'

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toDateTimeLocal(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000

  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function statusClass(status: BrandStatus) {
  return `brand-status brand-status-${status}`
}

function BrandCRM({ onSignOut }: BrandCRMProps) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [contacts, setContacts] = useState<BrandContact[]>([])
  const [interactions, setInteractions] = useState<BrandInteraction[]>([])

  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [industryFilter, setIndustryFilter] = useState('all')

  const [loading, setLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [modal, setModal] = useState<'brand' | 'contact' | 'interaction' | null>(null)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [editingContact, setEditingContact] = useState<BrandContact | null>(null)

  const [brandForm, setBrandForm] = useState<BrandForm>(emptyBrandForm)
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContactForm)
  const [interactionForm, setInteractionForm] = useState<InteractionForm>({
    contact_id: '',
    channel: 'email',
    direction: 'outbound',
    interaction_type: 'introduction',
    subject: '',
    summary: '',
    occurred_at: toDateTimeLocal(new Date().toISOString()),
  })

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === selectedBrandId) ?? null,
    [brands, selectedBrandId],
  )

  const industries = useMemo(
    () =>
      [...new Set(brands.map((brand) => brand.industry).filter(Boolean))].sort(),
    [brands],
  )

  const filteredBrands = useMemo(() => {
    const term = search.trim().toLowerCase()

    return brands.filter((brand) => {
      const matchesSearch =
        !term ||
        [
          brand.company_name,
          brand.brand_name,
          brand.industry,
          brand.city,
          brand.country,
          brand.general_email,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))

      const matchesStatus =
        statusFilter === 'all' || brand.acquisition_status === statusFilter

      const matchesIndustry =
        industryFilter === 'all' || brand.industry === industryFilter

      return matchesSearch && matchesStatus && matchesIndustry
    })
  }, [brands, search, statusFilter, industryFilter])

  const stats = useMemo(
    () => ({
      total: brands.length,
      prospects: brands.filter(
        (brand) =>
          !['active_client', 'declined', 'paused'].includes(
            brand.acquisition_status,
          ),
      ).length,
      active: brands.filter(
        (brand) => brand.acquisition_status === 'active_client',
      ).length,
      followUps: brands.filter((brand) => {
        if (!brand.follow_up_due_at) return false
        return new Date(brand.follow_up_due_at).getTime() <= Date.now()
      }).length,
    }),
    [brands],
  )

  const loadBrands = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const { data, error: queryError } = await supabase
      .from('brands')
      .select('*')
      .order('updated_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setBrands([])
    } else {
      const records = (data ?? []) as Brand[]
      setBrands(records)

      setSelectedBrandId((current) => {
        if (current && records.some((brand) => brand.id === current)) {
          return current
        }

        return records[0]?.id ?? null
      })
    }

    setLoading(false)
  }, [])

  const loadBrandRecords = useCallback(async (brandId: string) => {
    if (!supabase) return

    setRecordsLoading(true)

    const [contactsResult, interactionsResult] = await Promise.all([
      supabase
        .from('brand_contacts')
        .select('*')
        .eq('brand_id', brandId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true }),

      supabase
        .from('brand_interactions')
        .select('*')
        .eq('brand_id', brandId)
        .order('occurred_at', { ascending: false }),
    ])

    if (contactsResult.error) {
      setError(contactsResult.error.message)
    } else {
      setContacts((contactsResult.data ?? []) as BrandContact[])
    }

    if (interactionsResult.error) {
      setError(interactionsResult.error.message)
    } else {
      setInteractions((interactionsResult.data ?? []) as BrandInteraction[])
    }

    setRecordsLoading(false)
  }, [])

  useEffect(() => {
    void loadBrands()
  }, [loadBrands])

  useEffect(() => {
    if (selectedBrandId) {
      void loadBrandRecords(selectedBrandId)
    } else {
      setContacts([])
      setInteractions([])
    }
  }, [selectedBrandId, loadBrandRecords])

  function openNewBrand() {
    setEditingBrand(null)
    setBrandForm(emptyBrandForm)
    setError('')
    setModal('brand')
  }

  function openEditBrand(brand: Brand) {
    setEditingBrand(brand)
    setBrandForm({
      company_name: brand.company_name,
      brand_name: brand.brand_name ?? '',
      website_url: brand.website_url ?? '',
      industry: brand.industry ?? '',
      country: brand.country ?? '',
      city: brand.city ?? '',
      company_size: brand.company_size ?? '',
      general_email: brand.general_email ?? '',
      general_phone: brand.general_phone ?? '',
      contact_channel: brand.contact_channel ?? 'email',
      acquisition_status: brand.acquisition_status,
      source: brand.source ?? '',
      estimated_budget:
        brand.estimated_budget === null ? '' : String(brand.estimated_budget),
      currency: brand.currency ?? 'NGN',
      notes: brand.notes ?? '',
      follow_up_due_at: brand.follow_up_due_at
        ? toDateTimeLocal(brand.follow_up_due_at)
        : '',
    })
    setError('')
    setModal('brand')
  }

  function openNewContact() {
    setEditingContact(null)
    setContactForm({
      ...emptyContactForm,
      is_primary: contacts.length === 0,
    })
    setError('')
    setModal('contact')
  }

  function openEditContact(contact: BrandContact) {
    setEditingContact(contact)
    setContactForm({
      full_name: contact.full_name,
      job_title: contact.job_title ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      preferred_channel: contact.preferred_channel,
      is_primary: contact.is_primary,
      notes: contact.notes ?? '',
    })
    setError('')
    setModal('contact')
  }

  function openNewInteraction() {
    setInteractionForm({
      contact_id: '',
      channel: 'email',
      direction: 'outbound',
      interaction_type: 'introduction',
      subject: '',
      summary: '',
      occurred_at: toDateTimeLocal(new Date().toISOString()),
    })
    setError('')
    setModal('interaction')
  }

  function closeModal() {
    if (saving) return
    setModal(null)
    setEditingBrand(null)
    setEditingContact(null)
    setError('')
  }

  async function handleSaveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase) return

    setSaving(true)
    setError('')

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setError('Your administrator session could not be verified.')
      setSaving(false)
      return
    }

    const payload = {
      company_name: brandForm.company_name.trim(),
      brand_name: brandForm.brand_name.trim() || null,
      website_url: brandForm.website_url.trim() || null,
      industry: brandForm.industry.trim() || null,
      country: brandForm.country.trim() || null,
      city: brandForm.city.trim() || null,
      company_size: brandForm.company_size || null,
      general_email: brandForm.general_email.trim() || null,
      general_phone: brandForm.general_phone.trim() || null,
      contact_channel: brandForm.contact_channel,
      acquisition_status: brandForm.acquisition_status,
      source: brandForm.source.trim() || null,
      estimated_budget: brandForm.estimated_budget
        ? Number(brandForm.estimated_budget)
        : null,
      currency: brandForm.currency,
      notes: brandForm.notes.trim() || null,
      follow_up_due_at: brandForm.follow_up_due_at
        ? new Date(brandForm.follow_up_due_at).toISOString()
        : null,
    }

    const result = editingBrand
      ? await supabase
          .from('brands')
          .update(payload)
          .eq('id', editingBrand.id)
          .select()
          .single()
      : await supabase
          .from('brands')
          .insert({
            ...payload,
            created_by: userData.user.id,
          })
          .select()
          .single()

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
      return
    }

    const savedBrand = result.data as Brand

    setNotice(editingBrand ? 'Brand profile updated.' : 'Brand added successfully.')
    setSelectedBrandId(savedBrand.id)
    setModal(null)
    setEditingBrand(null)
    await loadBrands()
    setSaving(false)
  }

  async function handleSaveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase || !selectedBrand) return

    setSaving(true)
    setError('')

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setError('Your administrator session could not be verified.')
      setSaving(false)
      return
    }

    if (contactForm.is_primary) {
      const { error: clearError } = await supabase
        .from('brand_contacts')
        .update({ is_primary: false })
        .eq('brand_id', selectedBrand.id)
        .eq('is_primary', true)

      if (clearError) {
        setError(clearError.message)
        setSaving(false)
        return
      }
    }

    const payload = {
      brand_id: selectedBrand.id,
      full_name: contactForm.full_name.trim(),
      job_title: contactForm.job_title.trim() || null,
      email: contactForm.email.trim() || null,
      phone: contactForm.phone.trim() || null,
      preferred_channel: contactForm.preferred_channel,
      is_primary: contactForm.is_primary,
      notes: contactForm.notes.trim() || null,
    }

    const result = editingContact
      ? await supabase
          .from('brand_contacts')
          .update(payload)
          .eq('id', editingContact.id)
          .select()
          .single()
      : await supabase
          .from('brand_contacts')
          .insert({
            ...payload,
            created_by: userData.user.id,
          })
          .select()
          .single()

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
      return
    }

    setNotice(editingContact ? 'Contact updated.' : 'Contact added successfully.')
    setModal(null)
    setEditingContact(null)
    await loadBrandRecords(selectedBrand.id)
    setSaving(false)
  }

  async function handleSaveInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase || !selectedBrand) return

    setSaving(true)
    setError('')

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setError('Your administrator session could not be verified.')
      setSaving(false)
      return
    }

    const payload = {
      brand_id: selectedBrand.id,
      contact_id: interactionForm.contact_id || null,
      channel: interactionForm.channel,
      direction: interactionForm.direction,
      interaction_type: interactionForm.interaction_type,
      subject: interactionForm.subject.trim() || null,
      summary: interactionForm.summary.trim(),
      occurred_at: new Date(interactionForm.occurred_at).toISOString(),
      created_by: userData.user.id,
    }

    const { error: insertError } = await supabase
      .from('brand_interactions')
      .insert(payload)

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    const now = new Date().toISOString()

    await supabase
      .from('brands')
      .update({
        last_contacted_at: now,
        first_contacted_at: selectedBrand.first_contacted_at ?? now,
      })
      .eq('id', selectedBrand.id)

    setNotice('Interaction recorded successfully.')
    setModal(null)
    await Promise.all([
      loadBrandRecords(selectedBrand.id),
      loadBrands(),
    ])
    setSaving(false)
  }

  async function handleDeleteBrand() {
    if (!supabase || !selectedBrand) return

    const confirmed = window.confirm(
      `Delete ${selectedBrand.company_name} and all its contacts and interaction history? This cannot be undone.`,
    )

    if (!confirmed) return

    const { error: deleteError } = await supabase
      .from('brands')
      .delete()
      .eq('id', selectedBrand.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setNotice('Brand deleted.')
    setSelectedBrandId(null)
    await loadBrands()
  }

  async function handleDeleteContact(contact: BrandContact) {
    if (!supabase || !selectedBrand) return

    if (!window.confirm(`Delete contact ${contact.full_name}?`)) return

    const { error: deleteError } = await supabase
      .from('brand_contacts')
      .delete()
      .eq('id', contact.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setNotice('Contact deleted.')
    await loadBrandRecords(selectedBrand.id)
  }

  function displayBudget(brand: Brand) {
    if (brand.estimated_budget === null) return 'Not specified'

    return `${brand.currency ?? 'NGN'} ${brand.estimated_budget.toLocaleString()}`
  }

  return (
    <main className="brand-crm">
      <aside className="brand-crm-sidebar">
        <a className="brand-crm-brand" href="/dashboard">
          <span className="brand-crm-mark">SM</span>
          <span>SM BRIDGE <strong>MEDIA</strong></span>
        </a>

        <div className="brand-crm-nav-label">WORKSPACE</div>
        <a className="brand-crm-nav-link" href="/dashboard">
          <ArrowLeft size={17} />
          Back to dashboard
        </a>

        <div className="brand-crm-nav-label">MANAGEMENT</div>
        <a className="brand-crm-nav-link" href="/creators">
          <Users size={17} />
          Creator CRM
        </a>
        <a className="brand-crm-nav-link active" href="/brands">
          <Building2 size={17} />
          Brand CRM
        </a>

        <div className="brand-crm-sidebar-bottom">
          <div className="brand-crm-user">
            <div className="brand-crm-avatar">SM</div>
            <div>
              <strong>Administrator</strong>
              <span>Authorised account</span>
            </div>
          </div>
          <button className="brand-crm-signout" onClick={() => void onSignOut()}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <section className="brand-crm-main">
        <header className="brand-crm-header">
          <div>
            <span className="brand-crm-overline">SM BRIDGE MEDIA / MANAGEMENT</span>
            <h1>Brand CRM</h1>
            <p>Manage brand prospects, business contacts and client relationships.</p>
          </div>

          <div className="brand-crm-header-actions">
            <button
              className="brand-crm-secondary-button"
              onClick={() => void loadBrands()}
              disabled={loading}
              title="Refresh brands"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button className="brand-crm-primary-button" onClick={openNewBrand}>
              <Plus size={17} />
              Add brand
            </button>
          </div>
        </header>

        {notice && (
          <div className="brand-crm-notice">
            <Check size={16} />
            {notice}
            <button onClick={() => setNotice('')} aria-label="Dismiss notice">
              <X size={15} />
            </button>
          </div>
        )}

        {error && (
          <div className="brand-crm-error" role="alert">
            {error}
            <button onClick={() => setError('')} aria-label="Dismiss error">
              <X size={15} />
            </button>
          </div>
        )}

        <div className="brand-crm-stats">
          <div className="brand-crm-stat">
            <span className="brand-crm-stat-icon"><Building2 size={18} /></span>
            <div><span>Total brands</span><strong>{stats.total}</strong></div>
          </div>
          <div className="brand-crm-stat">
            <span className="brand-crm-stat-icon"><BriefcaseBusiness size={18} /></span>
            <div><span>Open prospects</span><strong>{stats.prospects}</strong></div>
          </div>
          <div className="brand-crm-stat">
            <span className="brand-crm-stat-icon"><Handshake size={18} /></span>
            <div><span>Active clients</span><strong>{stats.active}</strong></div>
          </div>
          <div className="brand-crm-stat">
            <span className="brand-crm-stat-icon"><CalendarClock size={18} /></span>
            <div><span>Due follow-ups</span><strong>{stats.followUps}</strong></div>
          </div>
        </div>

        <div className="brand-crm-workspace">
          <section className="brand-crm-directory">
            <div className="brand-crm-directory-heading">
              <div>
                <h2>Brand directory</h2>
                <span>{filteredBrands.length} records</span>
              </div>
            </div>

            <div className="brand-crm-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search brands..."
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="brand-crm-filters">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={industryFilter}
                onChange={(event) => setIndustryFilter(event.target.value)}
                aria-label="Filter by industry"
              >
                <option value="all">All industries</option>
                {industries.map((industry) => (
                  <option key={industry} value={industry ?? ''}>
                    {industry}
                  </option>
                ))}
              </select>
            </div>

            <div className="brand-crm-list">
              {loading ? (
                <div className="brand-crm-empty">
                  <RefreshCw size={20} className="brand-crm-spinner" />
                  <span>Loading brands...</span>
                </div>
              ) : filteredBrands.length === 0 ? (
                <div className="brand-crm-empty">
                  <Building2 size={25} />
                  <strong>No brands found</strong>
                  <span>Add a brand or adjust your filters.</span>
                  <button onClick={openNewBrand}>
                    <Plus size={15} /> Add first brand
                  </button>
                </div>
              ) : (
                filteredBrands.map((brand) => (
                  <button
                    key={brand.id}
                    className={`brand-crm-list-item ${selectedBrandId === brand.id ? 'selected' : ''}`}
                    onClick={() => setSelectedBrandId(brand.id)}
                  >
                    <span className="brand-crm-list-avatar">
                      {(brand.brand_name || brand.company_name).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="brand-crm-list-copy">
                      <strong>{brand.brand_name || brand.company_name}</strong>
                      <span>{brand.industry || 'Industry not specified'}</span>
                      <small>
                        {brand.city || brand.country
                          ? [brand.city, brand.country].filter(Boolean).join(', ')
                          : 'Location not specified'}
                      </small>
                      <span className={statusClass(brand.acquisition_status)}>
                        {statusLabels[brand.acquisition_status]}
                      </span>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="brand-crm-detail">
            {!selectedBrand ? (
              <div className="brand-crm-detail-empty">
                <Building2 size={38} />
                <h2>Select a brand</h2>
                <p>Choose a company from the directory or add a new brand.</p>
                <button className="brand-crm-primary-button" onClick={openNewBrand}>
                  <Plus size={16} /> Add brand
                </button>
              </div>
            ) : (
              <>
                <div className="brand-crm-profile-header">
                  <div className="brand-crm-profile-identity">
                    <div className="brand-crm-profile-avatar">
                      {(selectedBrand.brand_name || selectedBrand.company_name)
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>
                    <div>
                      <span className="brand-crm-overline">COMPANY PROFILE</span>
                      <h2>{selectedBrand.brand_name || selectedBrand.company_name}</h2>
                      {selectedBrand.brand_name && (
                        <p>{selectedBrand.company_name}</p>
                      )}
                      <span className={statusClass(selectedBrand.acquisition_status)}>
                        {statusLabels[selectedBrand.acquisition_status]}
                      </span>
                    </div>
                  </div>

                  <div className="brand-crm-profile-actions">
                    <button
                      className="brand-crm-secondary-button"
                      onClick={() => openEditBrand(selectedBrand)}
                    >
                      <Pencil size={15} /> Edit
                    </button>
                    <button
                      className="brand-crm-icon-button danger"
                      onClick={() => void handleDeleteBrand()}
                      title="Delete brand"
                      aria-label="Delete brand"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="brand-crm-info-grid">
                  <div className="brand-crm-info-card">
                    <span><Building2 size={15} /> Industry</span>
                    <strong>{selectedBrand.industry || 'Not specified'}</strong>
                  </div>
                  <div className="brand-crm-info-card">
                    <span><MapPin size={15} /> Location</span>
                    <strong>
                      {[selectedBrand.city, selectedBrand.country]
                        .filter(Boolean)
                        .join(', ') || 'Not specified'}
                    </strong>
                  </div>
                  <div className="brand-crm-info-card">
                    <span><BriefcaseBusiness size={15} /> Company size</span>
                    <strong>{selectedBrand.company_size || 'Not specified'}</strong>
                  </div>
                  <div className="brand-crm-info-card">
                    <span><Handshake size={15} /> Estimated budget</span>
                    <strong>{displayBudget(selectedBrand)}</strong>
                  </div>
                </div>

                <div className="brand-crm-section">
                  <div className="brand-crm-section-heading">
                    <div>
                      <h3>Company information</h3>
                      <p>Business details and primary contact channels</p>
                    </div>
                  </div>

                  <div className="brand-crm-company-details">
                    <div>
                      <Globe size={16} />
                      <span>Website</span>
                      {selectedBrand.website_url ? (
                        <a
                          href={selectedBrand.website_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {selectedBrand.website_url}
                          <ExternalLink size={12} />
                        </a>
                      ) : <strong>Not provided</strong>}
                    </div>
                    <div>
                      <Mail size={16} />
                      <span>Email</span>
                      <strong>{selectedBrand.general_email || 'Not provided'}</strong>
                    </div>
                    <div>
                      <Phone size={16} />
                      <span>Phone</span>
                      <strong>{selectedBrand.general_phone || 'Not provided'}</strong>
                    </div>
                    <div>
                      <MessageSquare size={16} />
                      <span>Preferred channel</span>
                      <strong>{selectedBrand.contact_channel || 'Not specified'}</strong>
                    </div>
                    <div>
                      <UserRound size={16} />
                      <span>Lead source</span>
                      <strong>{selectedBrand.source || 'Not specified'}</strong>
                    </div>
                    <div>
                      <CalendarClock size={16} />
                      <span>Next follow-up</span>
                      <strong>{formatDate(selectedBrand.follow_up_due_at)}</strong>
                    </div>
                  </div>

                  {selectedBrand.notes && (
                    <div className="brand-crm-notes">
                      <strong>Internal notes</strong>
                      <p>{selectedBrand.notes}</p>
                    </div>
                  )}
                </div>

                <div className="brand-crm-section">
                  <div className="brand-crm-section-heading">
                    <div>
                      <h3>Contact people</h3>
                      <p>{contacts.length} saved contact{contacts.length === 1 ? '' : 's'}</p>
                    </div>
                    <button
                      className="brand-crm-small-button"
                      onClick={openNewContact}
                    >
                      <Plus size={14} /> Add contact
                    </button>
                  </div>

                  {recordsLoading ? (
                    <div className="brand-crm-inline-loading">Loading contacts...</div>
                  ) : contacts.length === 0 ? (
                    <div className="brand-crm-section-empty">
                      <Users size={20} />
                      <span>No contact people have been added.</span>
                    </div>
                  ) : (
                    <div className="brand-crm-contact-list">
                      {contacts.map((contact) => (
                        <div className="brand-crm-contact-card" key={contact.id}>
                          <div className="brand-crm-contact-avatar">
                            {contact.full_name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="brand-crm-contact-main">
                            <div className="brand-crm-contact-name">
                              <strong>{contact.full_name}</strong>
                              {contact.is_primary && <span>PRIMARY</span>}
                            </div>
                            <small>{contact.job_title || 'Position not specified'}</small>
                            <div className="brand-crm-contact-meta">
                              {contact.email && <span><Mail size={12} /> {contact.email}</span>}
                              {contact.phone && <span><Phone size={12} /> {contact.phone}</span>}
                            </div>
                          </div>
                          <div className="brand-crm-contact-actions">
                            <button
                              className="brand-crm-icon-button"
                              onClick={() => openEditContact(contact)}
                              aria-label={`Edit ${contact.full_name}`}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="brand-crm-icon-button danger"
                              onClick={() => void handleDeleteContact(contact)}
                              aria-label={`Delete ${contact.full_name}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="brand-crm-section">
                  <div className="brand-crm-section-heading">
                    <div>
                      <h3>Outreach history</h3>
                      <p>{interactions.length} recorded interaction{interactions.length === 1 ? '' : 's'}</p>
                    </div>
                    <button
                      className="brand-crm-small-button"
                      onClick={openNewInteraction}
                    >
                      <Plus size={14} /> Log interaction
                    </button>
                  </div>

                  {recordsLoading ? (
                    <div className="brand-crm-inline-loading">Loading history...</div>
                  ) : interactions.length === 0 ? (
                    <div className="brand-crm-section-empty">
                      <MessageSquare size={20} />
                      <span>No outreach history recorded yet.</span>
                    </div>
                  ) : (
                    <div className="brand-crm-timeline">
                      {interactions.map((interaction) => {
                        const contact = contacts.find(
                          (item) => item.id === interaction.contact_id,
                        )

                        return (
                          <div className="brand-crm-timeline-item" key={interaction.id}>
                            <span className="brand-crm-timeline-dot" />
                            <div className="brand-crm-timeline-content">
                              <div className="brand-crm-timeline-top">
                                <strong>
                                  {interaction.subject ||
                                    interaction.interaction_type.replaceAll('_', ' ')}
                                </strong>
                                <time>{formatDateTime(interaction.occurred_at)}</time>
                              </div>
                              <div className="brand-crm-timeline-meta">
                                <span>{interaction.direction}</span>
                                <span>{interaction.channel}</span>
                                {contact && <span>{contact.full_name}</span>}
                              </div>
                              <p>{interaction.summary}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </section>

      {modal && (
        <div className="brand-crm-modal-backdrop" onMouseDown={closeModal}>
          <section
            className="brand-crm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="brand-crm-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="brand-crm-modal-header">
              <div>
                <span className="brand-crm-overline">SM BRIDGE MEDIA</span>
                <h2 id="brand-crm-modal-title">
                  {modal === 'brand'
                    ? editingBrand ? 'Edit brand profile' : 'Add a brand'
                    : modal === 'contact'
                      ? editingContact ? 'Edit contact' : 'Add contact person'
                      : 'Log an interaction'}
                </h2>
              </div>
              <button
                className="brand-crm-icon-button"
                onClick={closeModal}
                aria-label="Close dialog"
              >
                <X size={19} />
              </button>
            </header>

            {modal === 'brand' && (
              <form className="brand-crm-form" onSubmit={handleSaveBrand}>
                <div className="brand-crm-form-grid">
                  <label>
                    Company legal / registered name *
                    <input
                      required
                      value={brandForm.company_name}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, company_name: event.target.value })
                      }
                      placeholder="e.g. Example Technologies Ltd"
                    />
                  </label>
                  <label>
                    Brand / trading name
                    <input
                      value={brandForm.brand_name}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, brand_name: event.target.value })
                      }
                      placeholder="Public-facing brand name"
                    />
                  </label>
                  <label>
                    Website
                    <input
                      type="url"
                      value={brandForm.website_url}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, website_url: event.target.value })
                      }
                      placeholder="https://example.com"
                    />
                  </label>
                  <label>
                    Industry
                    <input
                      value={brandForm.industry}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, industry: event.target.value })
                      }
                      placeholder="e.g. Technology, Fashion, Finance"
                    />
                  </label>
                  <label>
                    Country
                    <input
                      value={brandForm.country}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, country: event.target.value })
                      }
                      placeholder="Country"
                    />
                  </label>
                  <label>
                    City
                    <input
                      value={brandForm.city}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, city: event.target.value })
                      }
                      placeholder="City"
                    />
                  </label>
                  <label>
                    Company size
                    <select
                      value={brandForm.company_size}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, company_size: event.target.value })
                      }
                    >
                      <option value="">Select size</option>
                      <option value="Individual / Founder">Individual / Founder</option>
                      <option value="1–10 employees">1–10 employees</option>
                      <option value="11–50 employees">11–50 employees</option>
                      <option value="51–200 employees">51–200 employees</option>
                      <option value="201–500 employees">201–500 employees</option>
                      <option value="501–1000 employees">501–1000 employees</option>
                      <option value="1000+ employees">1000+ employees</option>
                    </select>
                  </label>
                  <label>
                    Acquisition status
                    <select
                      value={brandForm.acquisition_status}
                      onChange={(event) =>
                        setBrandForm({
                          ...brandForm,
                          acquisition_status: event.target.value as BrandStatus,
                        })
                      }
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    General business email
                    <input
                      type="email"
                      value={brandForm.general_email}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, general_email: event.target.value })
                      }
                      placeholder="contact@example.com"
                    />
                  </label>
                  <label>
                    General business phone
                    <input
                      value={brandForm.general_phone}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, general_phone: event.target.value })
                      }
                      placeholder="+234..."
                    />
                  </label>
                  <label>
                    Preferred contact channel
                    <select
                      value={brandForm.contact_channel}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, contact_channel: event.target.value })
                      }
                    >
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="phone">Phone</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Lead source
                    <input
                      value={brandForm.source}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, source: event.target.value })
                      }
                      placeholder="e.g. LinkedIn, referral, website"
                    />
                  </label>
                  <label>
                    Estimated budget
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={brandForm.estimated_budget}
                      onChange={(event) =>
                        setBrandForm({
                          ...brandForm,
                          estimated_budget: event.target.value,
                        })
                      }
                      placeholder="Optional"
                    />
                  </label>
                  <label>
                    Budget currency
                    <select
                      value={brandForm.currency}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, currency: event.target.value })
                      }
                    >
                      <option value="NGN">NGN — Nigerian Naira</option>
                      <option value="USD">USD — US Dollar</option>
                      <option value="GBP">GBP — British Pound</option>
                      <option value="EUR">EUR — Euro</option>
                    </select>
                  </label>
                  <label className="brand-crm-full-field">
                    Follow-up date and time
                    <input
                      type="datetime-local"
                      value={brandForm.follow_up_due_at}
                      onChange={(event) =>
                        setBrandForm({
                          ...brandForm,
                          follow_up_due_at: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="brand-crm-full-field">
                    Internal notes
                    <textarea
                      rows={3}
                      value={brandForm.notes}
                      onChange={(event) =>
                        setBrandForm({ ...brandForm, notes: event.target.value })
                      }
                      placeholder="Background, opportunities, requirements..."
                    />
                  </label>
                </div>

                {error && <p className="brand-crm-form-error">{error}</p>}

                <div className="brand-crm-form-actions">
                  <button type="button" className="brand-crm-secondary-button" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="brand-crm-primary-button" disabled={saving}>
                    {saving ? 'Saving...' : editingBrand ? 'Save changes' : 'Create brand'}
                  </button>
                </div>
              </form>
            )}

            {modal === 'contact' && (
              <form className="brand-crm-form" onSubmit={handleSaveContact}>
                <div className="brand-crm-form-grid">
                  <label>
                    Full name *
                    <input
                      required
                      value={contactForm.full_name}
                      onChange={(event) =>
                        setContactForm({ ...contactForm, full_name: event.target.value })
                      }
                      placeholder="Contact person's name"
                    />
                  </label>
                  <label>
                    Job title
                    <input
                      value={contactForm.job_title}
                      onChange={(event) =>
                        setContactForm({ ...contactForm, job_title: event.target.value })
                      }
                      placeholder="e.g. Marketing Manager"
                    />
                  </label>
                  <label>
                    Email address
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(event) =>
                        setContactForm({ ...contactForm, email: event.target.value })
                      }
                      placeholder="name@company.com"
                    />
                  </label>
                  <label>
                    Phone number
                    <input
                      value={contactForm.phone}
                      onChange={(event) =>
                        setContactForm({ ...contactForm, phone: event.target.value })
                      }
                      placeholder="+234..."
                    />
                  </label>
                  <label className="brand-crm-full-field">
                    Preferred contact channel
                    <select
                      value={contactForm.preferred_channel}
                      onChange={(event) =>
                        setContactForm({
                          ...contactForm,
                          preferred_channel: event.target.value,
                        })
                      }
                    >
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="phone">Phone</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="brand-crm-checkbox brand-crm-full-field">
                    <input
                      type="checkbox"
                      checked={contactForm.is_primary}
                      onChange={(event) =>
                        setContactForm({
                          ...contactForm,
                          is_primary: event.target.checked,
                        })
                      }
                    />
                    Set as primary contact for this brand
                  </label>
                  <label className="brand-crm-full-field">
                    Contact notes
                    <textarea
                      rows={3}
                      value={contactForm.notes}
                      onChange={(event) =>
                        setContactForm({ ...contactForm, notes: event.target.value })
                      }
                      placeholder="Additional contact information..."
                    />
                  </label>
                </div>

                {error && <p className="brand-crm-form-error">{error}</p>}

                <div className="brand-crm-form-actions">
                  <button type="button" className="brand-crm-secondary-button" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="brand-crm-primary-button" disabled={saving}>
                    {saving ? 'Saving...' : editingContact ? 'Save changes' : 'Add contact'}
                  </button>
                </div>
              </form>
            )}

            {modal === 'interaction' && (
              <form className="brand-crm-form" onSubmit={handleSaveInteraction}>
                <div className="brand-crm-form-grid">
                  <label>
                    Contact person
                    <select
                      value={interactionForm.contact_id}
                      onChange={(event) =>
                        setInteractionForm({
                          ...interactionForm,
                          contact_id: event.target.value,
                        })
                      }
                    >
                      <option value="">General company interaction</option>
                      {contacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Interaction type
                    <select
                      value={interactionForm.interaction_type}
                      onChange={(event) =>
                        setInteractionForm({
                          ...interactionForm,
                          interaction_type: event.target.value,
                        })
                      }
                    >
                      <option value="introduction">Introduction</option>
                      <option value="follow_up">Follow-up</option>
                      <option value="reply">Reply</option>
                      <option value="call">Call</option>
                      <option value="meeting">Meeting</option>
                      <option value="proposal">Proposal</option>
                      <option value="negotiation">Negotiation</option>
                      <option value="note">Internal note</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Channel
                    <select
                      value={interactionForm.channel}
                      onChange={(event) =>
                        setInteractionForm({
                          ...interactionForm,
                          channel: event.target.value,
                        })
                      }
                    >
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="phone">Phone</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="meeting">Meeting</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Direction
                    <select
                      value={interactionForm.direction}
                      onChange={(event) =>
                        setInteractionForm({
                          ...interactionForm,
                          direction: event.target.value,
                        })
                      }
                    >
                      <option value="outbound">Outbound — we contacted them</option>
                      <option value="inbound">Inbound — they contacted us</option>
                      <option value="internal">Internal — agency note</option>
                    </select>
                  </label>
                  <label className="brand-crm-full-field">
                    Subject
                    <input
                      value={interactionForm.subject}
                      onChange={(event) =>
                        setInteractionForm({
                          ...interactionForm,
                          subject: event.target.value,
                        })
                      }
                      placeholder="e.g. Initial partnership introduction"
                    />
                  </label>
                  <label className="brand-crm-full-field">
                    Summary *
                    <textarea
                      required
                      rows={4}
                      value={interactionForm.summary}
                      onChange={(event) =>
                        setInteractionForm({
                          ...interactionForm,
                          summary: event.target.value,
                        })
                      }
                      placeholder="Describe what happened, the response, and agreed next steps..."
                    />
                  </label>
                  <label className="brand-crm-full-field">
                    Date and time
                    <input
                      type="datetime-local"
                      required
                      value={interactionForm.occurred_at}
                      onChange={(event) =>
                        setInteractionForm({
                          ...interactionForm,
                          occurred_at: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                {error && <p className="brand-crm-form-error">{error}</p>}

                <div className="brand-crm-form-actions">
                  <button type="button" className="brand-crm-secondary-button" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="brand-crm-primary-button" disabled={saving}>
                    {saving ? 'Saving...' : 'Save interaction'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

export default BrandCRM
