
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  ArrowLeft,
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  Globe,
  MapPin,
  Camera,
  Play,
  MessageSquare,
  Pencil,
  Trash2,
  X,
  Save,
  RefreshCw,
  ExternalLink,
  UserRound,
  CalendarClock,
  AtSign,
  Building2,
  LogOut,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './CreatorCRM.css'

type RecruitmentStatus =
  | 'discovered'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'negotiating'
  | 'onboarded'
  | 'declined'
  | 'unresponsive'
  | 'paused'

type Creator = {
  id: string
  full_name: string
  creator_name: string | null
  country: string | null
  city: string | null
  primary_niche: string | null
  secondary_niches: string[]
  email: string | null
  phone: string | null
  website_url: string | null
  contact_channel: string | null
  recruitment_status: RecruitmentStatus
  source: string | null
  notes: string | null
  first_contacted_at: string | null
  last_contacted_at: string | null
  follow_up_due_at: string | null
  created_at: string
  updated_at: string
}

type SocialAccount = {
  id: string
  creator_id: string
  platform: string
  handle: string
  profile_url: string | null
  follower_count: number | null
  average_views: number | null
  is_primary: boolean
}

type Interaction = {
  id: string
  creator_id: string
  channel: string
  direction: string
  interaction_type: string
  subject: string | null
  summary: string
  occurred_at: string
}

type CreatorForm = {
  full_name: string
  creator_name: string
  country: string
  city: string
  primary_niche: string
  secondary_niches: string
  email: string
  phone: string
  website_url: string
  contact_channel: string
  recruitment_status: RecruitmentStatus
  source: string
  notes: string
  follow_up_due_at: string
}

const statuses: RecruitmentStatus[] = [
  'discovered',
  'contacted',
  'replied',
  'interested',
  'negotiating',
  'onboarded',
  'declined',
  'unresponsive',
  'paused',
]

const platforms = [
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'x',
  'linkedin',
  'twitch',
  'other',
]

const channels = [
  'email',
  'instagram',
  'tiktok',
  'whatsapp',
  'linkedin',
  'phone',
  'other',
]

const interactionTypes = [
  'introduction',
  'follow_up',
  'reply',
  'call',
  'meeting',
  'negotiation',
  'note',
  'other',
]

const emptyCreatorForm: CreatorForm = {
  full_name: '',
  creator_name: '',
  country: '',
  city: '',
  primary_niche: '',
  secondary_niches: '',
  email: '',
  phone: '',
  website_url: '',
  contact_channel: 'email',
  recruitment_status: 'discovered',
  source: '',
  notes: '',
  follow_up_due_at: '',
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not specified'

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not scheduled'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Not scheduled'

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'

  return new Intl.NumberFormat('en', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  )

  return localDate.toISOString().slice(0, 16)
}

function CreatorCRM({ onSignOut }: { onSignOut: () => void }) {
  const [creators, setCreators] = useState<Creator[]>([])
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [showCreatorForm, setShowCreatorForm] = useState(false)
  const [editingCreatorId, setEditingCreatorId] = useState<string | null>(null)
  const [creatorForm, setCreatorForm] = useState<CreatorForm>(emptyCreatorForm)

  const [showSocialForm, setShowSocialForm] = useState(false)
  const [socialForm, setSocialForm] = useState({
    platform: 'instagram',
    handle: '',
    profile_url: '',
    follower_count: '',
    average_views: '',
    is_primary: false,
  })

  const [showInteractionForm, setShowInteractionForm] = useState(false)
  const [interactionForm, setInteractionForm] = useState({
    channel: 'email',
    direction: 'outbound',
    interaction_type: 'note',
    subject: '',
    summary: '',
    occurred_at: toDateTimeLocal(new Date().toISOString()),
  })

  const selectedCreator = useMemo(
    () => creators.find((creator) => creator.id === selectedCreatorId) ?? null,
    [creators, selectedCreatorId],
  )

  const selectedSocialAccounts = useMemo(
    () =>
      socialAccounts.filter(
        (account) => account.creator_id === selectedCreatorId,
      ),
    [socialAccounts, selectedCreatorId],
  )

  const selectedInteractions = useMemo(
    () =>
      interactions.filter(
        (interaction) => interaction.creator_id === selectedCreatorId,
      ),
    [interactions, selectedCreatorId],
  )

  const filteredCreators = useMemo(() => {
    const term = search.trim().toLowerCase()

    return creators.filter((creator) => {
      const matchesStatus =
        statusFilter === 'all' || creator.recruitment_status === statusFilter

      const searchableText = [
        creator.full_name,
        creator.creator_name,
        creator.country,
        creator.city,
        creator.primary_niche,
        creator.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return matchesStatus && (!term || searchableText.includes(term))
    })
  }, [creators, search, statusFilter])

  const loadCreators = useCallback(async () => {
    const client = supabase

    if (!client) {
      setError('Supabase is not configured. Check your admin environment settings.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const { data, error: queryError } = await client
      .from('creators')
      .select('*')
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(`Unable to load creators: ${queryError.message}`)
      setLoading(false)
      return
    }

    setCreators((data ?? []) as Creator[])
    setLoading(false)
  }, [])

  const loadCreatorRecords = useCallback(async (creatorId: string) => {
    const client = supabase

    if (!client) return

    const [socialResult, interactionResult] = await Promise.all([
      client
        .from('creator_social_accounts')
        .select('*')
        .eq('creator_id', creatorId)
        .order('is_primary', { ascending: false }),

      client
        .from('creator_interactions')
        .select('*')
        .eq('creator_id', creatorId)
        .order('occurred_at', { ascending: false }),
    ])

    if (socialResult.error) {
      setError(`Unable to load social accounts: ${socialResult.error.message}`)
    } else {
      setSocialAccounts((socialResult.data ?? []) as SocialAccount[])
    }

    if (interactionResult.error) {
      setError(`Unable to load interaction history: ${interactionResult.error.message}`)
    } else {
      setInteractions((interactionResult.data ?? []) as Interaction[])
    }
  }, [])

  useEffect(() => {
    void loadCreators()
  }, [loadCreators])

  useEffect(() => {
    if (selectedCreatorId) {
      void loadCreatorRecords(selectedCreatorId)
    }
  }, [selectedCreatorId, loadCreatorRecords])

  function openNewCreatorForm() {
    setEditingCreatorId(null)
    setCreatorForm(emptyCreatorForm)
    setError('')
    setNotice('')
    setShowCreatorForm(true)
  }

  function openEditCreatorForm(creator: Creator) {
    setEditingCreatorId(creator.id)
    setCreatorForm({
      full_name: creator.full_name ?? '',
      creator_name: creator.creator_name ?? '',
      country: creator.country ?? '',
      city: creator.city ?? '',
      primary_niche: creator.primary_niche ?? '',
      secondary_niches: (creator.secondary_niches ?? []).join(', '),
      email: creator.email ?? '',
      phone: creator.phone ?? '',
      website_url: creator.website_url ?? '',
      contact_channel: creator.contact_channel ?? 'email',
      recruitment_status: creator.recruitment_status,
      source: creator.source ?? '',
      notes: creator.notes ?? '',
      follow_up_due_at: toDateTimeLocal(creator.follow_up_due_at),
    })

    setError('')
    setNotice('')
    setShowCreatorForm(true)
  }

  async function handleSaveCreator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const client = supabase

    if (!client) return

    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      full_name: creatorForm.full_name.trim(),
      creator_name: creatorForm.creator_name.trim() || null,
      country: creatorForm.country.trim() || null,
      city: creatorForm.city.trim() || null,
      primary_niche: creatorForm.primary_niche.trim() || null,
      secondary_niches: creatorForm.secondary_niches
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      email: creatorForm.email.trim() || null,
      phone: creatorForm.phone.trim() || null,
      website_url: creatorForm.website_url.trim() || null,
      contact_channel: creatorForm.contact_channel || null,
      recruitment_status: creatorForm.recruitment_status,
      source: creatorForm.source.trim() || null,
      notes: creatorForm.notes.trim() || null,
      follow_up_due_at: creatorForm.follow_up_due_at
        ? new Date(creatorForm.follow_up_due_at).toISOString()
        : null,
    }

    try {
      if (editingCreatorId) {
        const { error: updateError } = await client
          .from('creators')
          .update(payload)
          .eq('id', editingCreatorId)

        if (updateError) throw updateError

        setNotice('Creator profile updated successfully.')
        setSelectedCreatorId(editingCreatorId)
      } else {
        const { data: userData, error: userError } =
          await client.auth.getUser()

        if (userError || !userData.user) {
          throw new Error('Your administrator session could not be verified.')
        }

        const { data, error: insertError } = await client
          .from('creators')
          .insert({
            ...payload,
            created_by: userData.user.id,
          })
          .select()
          .single()

        if (insertError) throw insertError

        const newCreator = data as Creator

        setCreators((current) => [newCreator, ...current])
        setSelectedCreatorId(newCreator.id)
        setNotice('Creator added successfully.')
      }

      await loadCreators()
      setShowCreatorForm(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save this creator.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCreator(creator: Creator) {
    const client = supabase

    if (!client) return

    const confirmed = window.confirm(
      `Delete ${creator.full_name} and all associated social accounts and interaction history? This cannot be undone.`,
    )

    if (!confirmed) return

    setError('')
    setNotice('')

    const { error: deleteError } = await client
      .from('creators')
      .delete()
      .eq('id', creator.id)

    if (deleteError) {
      setError(`Unable to delete creator: ${deleteError.message}`)
      return
    }

    setCreators((current) =>
      current.filter((item) => item.id !== creator.id),
    )

    if (selectedCreatorId === creator.id) {
      setSelectedCreatorId(null)
    }

    setNotice('Creator deleted successfully.')
  }

  async function handleSaveSocialAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const client = supabase

    if (!client || !selectedCreator) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      if (socialForm.is_primary) {
        const { error: clearError } = await client
          .from('creator_social_accounts')
          .update({ is_primary: false })
          .eq('creator_id', selectedCreator.id)
          .eq('platform', socialForm.platform)

        if (clearError) throw clearError
      }

      const { error: insertError } = await client
        .from('creator_social_accounts')
        .insert({
          creator_id: selectedCreator.id,
          platform: socialForm.platform,
          handle: socialForm.handle.trim(),
          profile_url: socialForm.profile_url.trim() || null,
          follower_count: socialForm.follower_count
            ? Number(socialForm.follower_count)
            : null,
          average_views: socialForm.average_views
            ? Number(socialForm.average_views)
            : null,
          is_primary: socialForm.is_primary,
        })

      if (insertError) throw insertError

      setSocialForm({
        platform: 'instagram',
        handle: '',
        profile_url: '',
        follower_count: '',
        average_views: '',
        is_primary: false,
      })

      setShowSocialForm(false)
      setNotice('Social account added successfully.')
      await loadCreatorRecords(selectedCreator.id)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save this social account.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteSocialAccount(account: SocialAccount) {
    const client = supabase

    if (!client) return

    if (!window.confirm(`Remove the ${account.platform} account @${account.handle}?`)) {
      return
    }

    const { error: deleteError } = await client
      .from('creator_social_accounts')
      .delete()
      .eq('id', account.id)

    if (deleteError) {
      setError(`Unable to remove social account: ${deleteError.message}`)
      return
    }

    setSocialAccounts((current) =>
      current.filter((item) => item.id !== account.id),
    )

    setNotice('Social account removed.')
  }

  async function handleSaveInteraction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const client = supabase

    if (!client || !selectedCreator) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const { data: userData, error: userError } = await client.auth.getUser()

      if (userError || !userData.user) {
        throw new Error('Your administrator session could not be verified.')
      }

      const occurredAt = interactionForm.occurred_at
        ? new Date(interactionForm.occurred_at).toISOString()
        : new Date().toISOString()

      const { error: insertError } = await client
        .from('creator_interactions')
        .insert({
          creator_id: selectedCreator.id,
          channel: interactionForm.channel,
          direction: interactionForm.direction,
          interaction_type: interactionForm.interaction_type,
          subject: interactionForm.subject.trim() || null,
          summary: interactionForm.summary.trim(),
          occurred_at: occurredAt,
          created_by: userData.user.id,
        })

      if (insertError) throw insertError

      const { error: updateError } = await client
        .from('creators')
        .update({
          last_contacted_at: occurredAt,
          ...(interactionForm.direction === 'outbound'
            ? {
                first_contacted_at:
                  selectedCreator.first_contacted_at ?? occurredAt,
              }
            : {}),
        })
        .eq('id', selectedCreator.id)

      if (updateError) throw updateError

      setInteractionForm({
        channel: 'email',
        direction: 'outbound',
        interaction_type: 'note',
        subject: '',
        summary: '',
        occurred_at: toDateTimeLocal(new Date().toISOString()),
      })

      setShowInteractionForm(false)
      setNotice('Interaction recorded successfully.')

      await Promise.all([
        loadCreatorRecords(selectedCreator.id),
        loadCreators(),
      ])
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to record this interaction.',
      )
    } finally {
      setSaving(false)
    }
  }

  const counts = useMemo(() => ({
    total: creators.length,
    contacted: creators.filter((item) =>
      ['contacted', 'replied', 'interested', 'negotiating', 'onboarded'].includes(
        item.recruitment_status,
      ),
    ).length,
    interested: creators.filter((item) =>
      ['interested', 'negotiating'].includes(item.recruitment_status),
    ).length,
    onboarded: creators.filter(
      (item) => item.recruitment_status === 'onboarded',
    ).length,
  }), [creators])

  if (selectedCreator) {
    return (
      <main className="crm-page">
        <header className="crm-topbar">
          <div className="crm-brand">
            <span className="crm-brand-mark">SM</span>
            <span>SM BRIDGE <strong>MEDIA</strong></span>
          </div>
          <div className="crm-topbar-actions">
            <span className="crm-admin-label">PRIVATE ADMIN PORTAL</span>
            <button className="crm-logout" onClick={onSignOut}>
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </header>

        <div className="crm-content">
          <button
            className="crm-back-button"
            onClick={() => {
              setSelectedCreatorId(null)
              setError('')
              setNotice('')
            }}
          >
            <ArrowLeft size={17} />
            Back to creator directory
          </button>

          {error && <div className="crm-alert crm-alert-error">{error}</div>}
          {notice && <div className="crm-alert crm-alert-success">{notice}</div>}

          <section className="creator-profile-heading">
            <div className="creator-avatar">
              {(selectedCreator.creator_name || selectedCreator.full_name)
                .slice(0, 1)
                .toUpperCase()}
            </div>
            <div className="creator-heading-info">
              <span className="crm-eyebrow">CREATOR PROFILE</span>
              <h1>{selectedCreator.creator_name || selectedCreator.full_name}</h1>
              <p>
                {selectedCreator.creator_name
                  ? selectedCreator.full_name
                  : 'Creator name not separately specified'}
              </p>
              <span className={`crm-status status-${selectedCreator.recruitment_status}`}>
                {formatLabel(selectedCreator.recruitment_status)}
              </span>
            </div>
            <div className="creator-heading-actions">
              <button
                className="crm-secondary-button"
                onClick={() => openEditCreatorForm(selectedCreator)}
              >
                <Pencil size={16} />
                Edit profile
              </button>
              <button
                className="crm-danger-button"
                onClick={() => void handleDeleteCreator(selectedCreator)}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </section>

          <div className="crm-profile-grid">
            <section className="crm-panel creator-information">
              <div className="crm-panel-heading">
                <div>
                  <span className="crm-eyebrow">PROFILE INFORMATION</span>
                  <h2>Creator details</h2>
                </div>
              </div>

              <div className="creator-info-grid">
                <div className="creator-info-item">
                  <Mail size={17} />
                  <div>
                    <span>Email</span>
                    <strong>{selectedCreator.email || 'Not provided'}</strong>
                  </div>
                </div>
                <div className="creator-info-item">
                  <Phone size={17} />
                  <div>
                    <span>Phone</span>
                    <strong>{selectedCreator.phone || 'Not provided'}</strong>
                  </div>
                </div>
                <div className="creator-info-item">
                  <MapPin size={17} />
                  <div>
                    <span>Location</span>
                    <strong>
                      {[selectedCreator.city, selectedCreator.country]
                        .filter(Boolean)
                        .join(', ') || 'Not provided'}
                    </strong>
                  </div>
                </div>
                <div className="creator-info-item">
                  <Globe size={17} />
                  <div>
                    <span>Website</span>
                    {selectedCreator.website_url ? (
                      <a href={selectedCreator.website_url} target="_blank" rel="noreferrer">
                        Visit website <ExternalLink size={12} />
                      </a>
                    ) : (
                      <strong>Not provided</strong>
                    )}
                  </div>
                </div>
                <div className="creator-info-item">
                  <Building2 size={17} />
                  <div>
                    <span>Primary niche</span>
                    <strong>{selectedCreator.primary_niche || 'Not specified'}</strong>
                  </div>
                </div>
                <div className="creator-info-item">
                  <AtSign size={17} />
                  <div>
                    <span>Contact channel</span>
                    <strong>{formatLabel(selectedCreator.contact_channel)}</strong>
                  </div>
                </div>
              </div>

              {selectedCreator.secondary_niches?.length > 0 && (
                <div className="creator-extra">
                  <span>Additional niches</span>
                  <div className="crm-tags">
                    {selectedCreator.secondary_niches.map((niche) => (
                      <span key={niche}>{niche}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedCreator.notes && (
                <div className="creator-notes">
                  <span>Internal notes</span>
                  <p>{selectedCreator.notes}</p>
                </div>
              )}
            </section>

            <section className="crm-panel creator-follow-up">
              <div className="crm-panel-heading">
                <div>
                  <span className="crm-eyebrow">RECRUITMENT</span>
                  <h2>Relationship tracking</h2>
                </div>
              </div>
              <div className="tracking-item">
                <CalendarClock size={18} />
                <div>
                  <span>Follow-up due</span>
                  <strong>{formatDate(selectedCreator.follow_up_due_at)}</strong>
                </div>
              </div>
              <div className="tracking-item">
                <MessageSquare size={18} />
                <div>
                  <span>First contacted</span>
                  <strong>{formatDate(selectedCreator.first_contacted_at)}</strong>
                </div>
              </div>
              <div className="tracking-item">
                <RefreshCw size={18} />
                <div>
                  <span>Last contacted</span>
                  <strong>{formatDate(selectedCreator.last_contacted_at)}</strong>
                </div>
              </div>
              <div className="tracking-item">
                <UserRound size={18} />
                <div>
                  <span>Lead source</span>
                  <strong>{selectedCreator.source || 'Not recorded'}</strong>
                </div>
              </div>
            </section>
          </div>

          <section className="crm-panel crm-section-panel">
            <div className="crm-panel-heading">
              <div>
                <span className="crm-eyebrow">CONNECTED PLATFORMS</span>
                <h2>Social accounts</h2>
                <p>Creator profiles and audience information</p>
              </div>
              <button
                className="crm-primary-button"
                onClick={() => {
                  setError('')
                  setShowSocialForm(true)
                }}
              >
                <Plus size={17} />
                Add account
              </button>
            </div>

            {selectedSocialAccounts.length === 0 ? (
              <div className="crm-empty-small">
                No social accounts have been added to this creator yet.
              </div>
            ) : (
              <div className="crm-social-grid">
                {selectedSocialAccounts.map((account) => (
                  <article className="crm-social-card" key={account.id}>
                    <div className="crm-social-card-top">
                      <div className="crm-platform-icon">
                        {account.platform === 'youtube' ? (
                          <Play size={20} />
                        ) : account.platform === 'instagram' ? (
                          <Camera size={20} />
                        ) : (
                          <AtSign size={20} />
                        )}
                      </div>
                      <div className="crm-social-actions">
                        {account.is_primary && (
                          <span className="crm-primary-label">PRIMARY</span>
                        )}
                        <button
                          className="crm-icon-button danger"
                          title="Remove account"
                          onClick={() => void handleDeleteSocialAccount(account)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <h3>{formatLabel(account.platform)}</h3>
                    <p className="crm-handle">@{account.handle}</p>
                    <div className="crm-social-metrics">
                      <div>
                        <strong>{formatNumber(account.follower_count)}</strong>
                        <span>Followers</span>
                      </div>
                      <div>
                        <strong>{formatNumber(account.average_views)}</strong>
                        <span>Average views</span>
                      </div>
                    </div>
                    {account.profile_url && (
                      <a
                        className="crm-profile-link"
                        href={account.profile_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View profile <ExternalLink size={13} />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="crm-panel crm-section-panel">
            <div className="crm-panel-heading">
              <div>
                <span className="crm-eyebrow">COMMUNICATION RECORD</span>
                <h2>Interaction history</h2>
                <p>Track introductions, responses, calls and follow-ups</p>
              </div>
              <button
                className="crm-primary-button"
                onClick={() => {
                  setError('')
                  setShowInteractionForm(true)
                }}
              >
                <Plus size={17} />
                Record interaction
              </button>
            </div>

            {selectedInteractions.length === 0 ? (
              <div className="crm-empty-small">No interactions recorded yet.</div>
            ) : (
              <div className="crm-timeline">
                {selectedInteractions.map((interaction) => (
                  <article className="crm-timeline-item" key={interaction.id}>
                    <div className="crm-timeline-dot" />
                    <div className="crm-timeline-content">
                      <div className="crm-timeline-top">
                        <div>
                          <strong>{formatLabel(interaction.interaction_type)}</strong>
                          <span>
                            {formatLabel(interaction.direction)} ·{' '}
                            {formatLabel(interaction.channel)}
                          </span>
                        </div>
                        <time>{formatDate(interaction.occurred_at)}</time>
                      </div>
                      {interaction.subject && <h3>{interaction.subject}</h3>}
                      <p>{interaction.summary}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {showCreatorForm && (
          <div className="crm-modal-backdrop">
            <section className="crm-modal">
              <div className="crm-modal-heading">
                <div>
                  <span className="crm-eyebrow">CREATOR MANAGEMENT</span>
                  <h2>Edit creator profile</h2>
                </div>
                <button
                  className="crm-icon-button"
                  onClick={() => setShowCreatorForm(false)}
                  aria-label="Close form"
                >
                  <X size={20} />
                </button>
              </div>
              <CreatorFormFields
                form={creatorForm}
                setForm={setCreatorForm}
                saving={saving}
                onSubmit={handleSaveCreator}
                onCancel={() => setShowCreatorForm(false)}
                editing
              />
            </section>
          </div>
        )}

        {showSocialForm && (
          <div className="crm-modal-backdrop">
            <section className="crm-modal">
              <div className="crm-modal-heading">
                <div>
                  <span className="crm-eyebrow">CREATOR MANAGEMENT</span>
                  <h2>Add social account</h2>
                </div>
                <button
                  className="crm-icon-button"
                  onClick={() => setShowSocialForm(false)}
                  aria-label="Close form"
                >
                  <X size={20} />
                </button>
              </div>
              <form className="crm-form" onSubmit={handleSaveSocialAccount}>
                <label>
                  Platform
                  <select
                    value={socialForm.platform}
                    onChange={(event) =>
                      setSocialForm((current) => ({
                        ...current,
                        platform: event.target.value,
                      }))
                    }
                  >
                    {platforms.map((platform) => (
                      <option value={platform} key={platform}>
                        {formatLabel(platform)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Username / handle
                  <input
                    value={socialForm.handle}
                    onChange={(event) =>
                      setSocialForm((current) => ({
                        ...current,
                        handle: event.target.value,
                      }))
                    }
                    placeholder="e.g. creatorhandle"
                    required
                  />
                </label>
                <label>
                  Profile URL
                  <input
                    type="url"
                    value={socialForm.profile_url}
                    onChange={(event) =>
                      setSocialForm((current) => ({
                        ...current,
                        profile_url: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                  />
                </label>
                <div className="crm-form-row">
                  <label>
                    Followers
                    <input
                      type="number"
                      min="0"
                      value={socialForm.follower_count}
                      onChange={(event) =>
                        setSocialForm((current) => ({
                          ...current,
                          follower_count: event.target.value,
                        }))
                      }
                      placeholder="e.g. 25000"
                    />
                  </label>
                  <label>
                    Average views
                    <input
                      type="number"
                      min="0"
                      value={socialForm.average_views}
                      onChange={(event) =>
                        setSocialForm((current) => ({
                          ...current,
                          average_views: event.target.value,
                        }))
                      }
                      placeholder="e.g. 12000"
                    />
                  </label>
                </div>
                <label className="crm-checkbox-label">
                  <input
                    type="checkbox"
                    checked={socialForm.is_primary}
                    onChange={(event) =>
                      setSocialForm((current) => ({
                        ...current,
                        is_primary: event.target.checked,
                      }))
                    }
                  />
                  Mark as primary account for this platform
                </label>
                <div className="crm-form-actions">
                  <button
                    type="button"
                    className="crm-secondary-button"
                    onClick={() => setShowSocialForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="crm-primary-button"
                    disabled={saving}
                  >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save account'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {showInteractionForm && (
          <div className="crm-modal-backdrop">
            <section className="crm-modal">
              <div className="crm-modal-heading">
                <div>
                  <span className="crm-eyebrow">RELATIONSHIP MANAGEMENT</span>
                  <h2>Record interaction</h2>
                </div>
                <button
                  className="crm-icon-button"
                  onClick={() => setShowInteractionForm(false)}
                  aria-label="Close form"
                >
                  <X size={20} />
                </button>
              </div>
              <form className="crm-form" onSubmit={handleSaveInteraction}>
                <div className="crm-form-row">
                  <label>
                    Communication channel
                    <select
                      value={interactionForm.channel}
                      onChange={(event) =>
                        setInteractionForm((current) => ({
                          ...current,
                          channel: event.target.value,
                        }))
                      }
                    >
                      {channels.map((channel) => (
                        <option value={channel} key={channel}>
                          {formatLabel(channel)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Direction
                    <select
                      value={interactionForm.direction}
                      onChange={(event) =>
                        setInteractionForm((current) => ({
                          ...current,
                          direction: event.target.value,
                        }))
                      }
                    >
                      <option value="outbound">Outbound</option>
                      <option value="inbound">Inbound</option>
                      <option value="internal">Internal</option>
                    </select>
                  </label>
                </div>
                <label>
                  Interaction type
                  <select
                    value={interactionForm.interaction_type}
                    onChange={(event) =>
                      setInteractionForm((current) => ({
                        ...current,
                        interaction_type: event.target.value,
                      }))
                    }
                  >
                    {interactionTypes.map((type) => (
                      <option value={type} key={type}>
                        {formatLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Subject
                  <input
                    value={interactionForm.subject}
                    onChange={(event) =>
                      setInteractionForm((current) => ({
                        ...current,
                        subject: event.target.value,
                      }))
                    }
                    placeholder="e.g. Initial partnership introduction"
                  />
                </label>
                <label>
                  Interaction summary
                  <textarea
                    value={interactionForm.summary}
                    onChange={(event) =>
                      setInteractionForm((current) => ({
                        ...current,
                        summary: event.target.value,
                      }))
                    }
                    placeholder="Record what was discussed, sent or agreed..."
                    rows={4}
                    required
                  />
                </label>
                <label>
                  Date and time
                  <input
                    type="datetime-local"
                    value={interactionForm.occurred_at}
                    onChange={(event) =>
                      setInteractionForm((current) => ({
                        ...current,
                        occurred_at: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="crm-form-actions">
                  <button
                    type="button"
                    className="crm-secondary-button"
                    onClick={() => setShowInteractionForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="crm-primary-button"
                    disabled={saving}
                  >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save interaction'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    )
  }

  return (
    <main className="crm-page">
      <header className="crm-topbar">
        <div className="crm-brand">
          <span className="crm-brand-mark">SM</span>
          <span>SM BRIDGE <strong>MEDIA</strong></span>
        </div>
        <div className="crm-topbar-actions">
          <span className="crm-admin-label">PRIVATE ADMIN PORTAL</span>
          <button className="crm-logout" onClick={onSignOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <div className="crm-content">
        <div className="crm-page-heading">
          <div>
            <span className="crm-eyebrow">AGENCY MANAGEMENT</span>
            <h1>Creator CRM</h1>
            <p>Manage creator relationships, recruitment and communication.</p>
          </div>
          <div className="crm-heading-buttons">
            <button
              className="crm-secondary-button"
              onClick={() => void loadCreators()}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              className="crm-primary-button"
              onClick={openNewCreatorForm}
            >
              <Plus size={17} />
              Add creator
            </button>
          </div>
        </div>

        {error && <div className="crm-alert crm-alert-error">{error}</div>}
        {notice && <div className="crm-alert crm-alert-success">{notice}</div>}

        <section className="crm-stats-grid">
          <div className="crm-stat-card">
            <span className="crm-stat-icon"><Users size={19} /></span>
            <span className="crm-stat-label">Total creators</span>
            <strong>{counts.total}</strong>
            <span className="crm-stat-description">Creator records</span>
          </div>
          <div className="crm-stat-card">
            <span className="crm-stat-icon"><MessageSquare size={19} /></span>
            <span className="crm-stat-label">Contacted</span>
            <strong>{counts.contacted}</strong>
            <span className="crm-stat-description">Contact or response recorded</span>
          </div>
          <div className="crm-stat-card">
            <span className="crm-stat-icon"><UserRound size={19} /></span>
            <span className="crm-stat-label">Interested / negotiating</span>
            <strong>{counts.interested}</strong>
            <span className="crm-stat-description">Potential partnerships</span>
          </div>
          <div className="crm-stat-card">
            <span className="crm-stat-icon"><Building2 size={19} /></span>
            <span className="crm-stat-label">Onboarded</span>
            <strong>{counts.onboarded}</strong>
            <span className="crm-stat-description">Confirmed creator partners</span>
          </div>
        </section>

        <section className="crm-panel crm-directory">
          <div className="crm-directory-heading">
            <div>
              <span className="crm-eyebrow">RELATIONSHIP DATABASE</span>
              <h2>Creator directory</h2>
              <p>Search and manage your creator recruitment pipeline.</p>
            </div>
          </div>

          <div className="crm-filters">
            <div className="crm-search">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, niche, country or email..."
              />
              {search && (
                <button
                  className="crm-clear-search"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <select
              className="crm-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All recruitment statuses</option>
              {statuses.map((status) => (
                <option value={status} key={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="crm-loading">
              <RefreshCw size={22} />
              <p>Loading creator records...</p>
            </div>
          ) : filteredCreators.length === 0 ? (
            <div className="crm-empty">
              <div className="crm-empty-icon"><Users size={27} /></div>
              <h3>
                {creators.length === 0
                  ? 'Your creator directory is ready'
                  : 'No matching creators'}
              </h3>
              <p>
                {creators.length === 0
                  ? 'Add your first creator to begin building your recruitment database.'
                  : 'Try another search term or change the recruitment status filter.'}
              </p>
              {creators.length === 0 && (
                <button className="crm-primary-button" onClick={openNewCreatorForm}>
                  <Plus size={17} />
                  Add your first creator
                </button>
              )}
            </div>
          ) : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th>Location</th>
                    <th>Primary niche</th>
                    <th>Status</th>
                    <th>Follow-up</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCreators.map((creator) => (
                    <tr key={creator.id}>
                      <td>
                        <button
                          className="crm-creator-name"
                          onClick={() => {
                            setSelectedCreatorId(creator.id)
                            setError('')
                            setNotice('')
                          }}
                        >
                          <span className="crm-table-avatar">
                            {(creator.creator_name || creator.full_name)
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                          <span>
                            <strong>{creator.creator_name || creator.full_name}</strong>
                            <small>{creator.full_name}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        {[creator.city, creator.country]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </td>
                      <td>{creator.primary_niche || '—'}</td>
                      <td>
                        <span className={`crm-status status-${creator.recruitment_status}`}>
                          {formatLabel(creator.recruitment_status)}
                        </span>
                      </td>
                      <td>{formatDate(creator.follow_up_due_at)}</td>
                      <td>
                        <div className="crm-row-actions">
                          <button
                            className="crm-icon-button"
                            title="View creator"
                            onClick={() => setSelectedCreatorId(creator.id)}
                          >
                            <ExternalLink size={16} />
                          </button>
                          <button
                            className="crm-icon-button"
                            title="Edit creator"
                            onClick={() => openEditCreatorForm(creator)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="crm-icon-button danger"
                            title="Delete creator"
                            onClick={() => void handleDeleteCreator(creator)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="crm-directory-footer">
            Showing {filteredCreators.length} of {creators.length} creator records
          </div>
        </section>

        <button
          className="crm-dashboard-return"
          onClick={() => window.location.assign('/dashboard')}
        >
          <ArrowLeft size={16} />
          Return to agency dashboard
        </button>
      </div>

      {showCreatorForm && (
        <div className="crm-modal-backdrop">
          <section className="crm-modal crm-creator-modal">
            <div className="crm-modal-heading">
              <div>
                <span className="crm-eyebrow">CREATOR MANAGEMENT</span>
                <h2>{editingCreatorId ? 'Edit creator profile' : 'Add new creator'}</h2>
                <p>Enter the creator's details for your agency records.</p>
              </div>
              <button
                className="crm-icon-button"
                onClick={() => setShowCreatorForm(false)}
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>
            <CreatorFormFields
              form={creatorForm}
              setForm={setCreatorForm}
              saving={saving}
              onSubmit={handleSaveCreator}
              onCancel={() => setShowCreatorForm(false)}
              editing={Boolean(editingCreatorId)}
            />
          </section>
        </div>
      )}
    </main>
  )
}

function CreatorFormFields({
  form,
  setForm,
  saving,
  onSubmit,
  onCancel,
  editing,
}: {
  form: CreatorForm
  setForm: Dispatch<SetStateAction<CreatorForm>>
  saving: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  editing: boolean
}) {
  function update(field: keyof CreatorForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <form className="crm-form" onSubmit={onSubmit}>
      <div className="crm-form-section-title">Basic information</div>

      <div className="crm-form-row">
        <label>
          Full name *
          <input
            value={form.full_name}
            onChange={(event) => update('full_name', event.target.value)}
            placeholder="Creator's full name"
            required
          />
        </label>
        <label>
          Creator / brand name
          <input
            value={form.creator_name}
            onChange={(event) => update('creator_name', event.target.value)}
            placeholder="Public creator name"
          />
        </label>
      </div>

      <div className="crm-form-row">
        <label>
          Country
          <input
            value={form.country}
            onChange={(event) => update('country', event.target.value)}
            placeholder="e.g. Nigeria"
          />
        </label>
        <label>
          City
          <input
            value={form.city}
            onChange={(event) => update('city', event.target.value)}
            placeholder="e.g. Lagos"
          />
        </label>
      </div>

      <div className="crm-form-section-title">Creator niche</div>

      <label>
        Primary niche
        <input
          value={form.primary_niche}
          onChange={(event) => update('primary_niche', event.target.value)}
          placeholder="e.g. Technology and AI"
        />
      </label>

      <label>
        Additional niches
        <input
          value={form.secondary_niches}
          onChange={(event) => update('secondary_niches', event.target.value)}
          placeholder="Separate multiple niches with commas"
        />
      </label>

      <div className="crm-form-section-title">Contact information</div>

      <div className="crm-form-row">
        <label>
          Business email
          <input
            type="email"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            placeholder="creator@example.com"
          />
        </label>
        <label>
          Phone / WhatsApp
          <input
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            placeholder="International number"
          />
        </label>
      </div>

      <label>
        Website
        <input
          type="url"
          value={form.website_url}
          onChange={(event) => update('website_url', event.target.value)}
          placeholder="https://..."
        />
      </label>

      <div className="crm-form-row">
        <label>
          Preferred contact channel
          <select
            value={form.contact_channel}
            onChange={(event) => update('contact_channel', event.target.value)}
          >
            <option value="email">Email</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="linkedin">LinkedIn</option>
            <option value="phone">Phone</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Recruitment status
          <select
            value={form.recruitment_status}
            onChange={(event) => update('recruitment_status', event.target.value)}
          >
            {statuses.map((status) => (
              <option value={status} key={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="crm-form-section-title">Recruitment tracking</div>

      <div className="crm-form-row">
        <label>
          Lead source
          <input
            value={form.source}
            onChange={(event) => update('source', event.target.value)}
            placeholder="e.g. Instagram, YouTube, referral"
          />
        </label>
        <label>
          Follow-up date
          <input
            type="datetime-local"
            value={form.follow_up_due_at}
            onChange={(event) => update('follow_up_due_at', event.target.value)}
          />
        </label>
      </div>

      <label>
        Internal notes
        <textarea
          value={form.notes}
          onChange={(event) => update('notes', event.target.value)}
          rows={3}
          placeholder="Relevant creator details, outreach context and next steps..."
        />
      </label>

      <div className="crm-form-actions">
        <button
          type="button"
          className="crm-secondary-button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="crm-primary-button"
          disabled={saving}
        >
          <Save size={16} />
          {saving ? 'Saving...' : editing ? 'Update creator' : 'Save creator'}
        </button>
      </div>
    </form>
  )
}

export default CreatorCRM
