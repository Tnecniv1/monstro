'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Plan = 'classe' | 'abonne' | 'gratuit'
type PlanFilter = Plan | 'tous'

interface UtilisateurRow {
  id: string
  pseudo: string
  nom: string | null
  prenom: string | null
  email: string
  role: string
  plan: Plan
  statut_abonnement: string | null
}

const PLAN_CONFIG: Record<Plan, { bg: string; color: string; label: string }> = {
  classe:  { bg: '#dcfce7', color: '#166534', label: 'Classe' },
  abonne:  { bg: '#ede9fe', color: '#5b21b6', label: 'Abonné' },
  gratuit: { bg: '#f3f4f6', color: '#6b7280', label: 'Aucun accès' },
}

function norm(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function PlanBadge({ plan }: { plan: Plan }) {
  const { bg, color, label } = PLAN_CONFIG[plan]
  return (
    <span style={{ background: bg, color, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
      {label}
    </span>
  )
}

const INPUT_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #EDEAE3',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 13,
  color: '#1a1a1a',
  outline: 'none',
}

const COLS = ['Pseudo', 'Prénom', 'Nom', 'Email', 'Rôle', 'Plan (accès)', 'Abonnement Stripe', 'Action']

export default function UtilisateursView() {
  const [rows, setRows]               = useState<UtilisateurRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [fetchError, setFetchError]   = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [planFilter, setPlanFilter]   = useState<PlanFilter>('tous')
  const [invokingId, setInvokingId]   = useState<string | null>(null)
  const [rowErrors, setRowErrors]     = useState<Record<string, string>>({})

  async function fetchRows() {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('get_utilisateurs_admin')
    if (error) {
      setFetchError(error.message)
    } else {
      setRows((data as UtilisateurRow[]) ?? [])
      setFetchError(null)
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchRows() }, [])

  async function handlePlanChange(userId: string, newPlan: 'classe' | 'gratuit') {
    setInvokingId(userId)
    setRowErrors((prev) => { const next = { ...prev }; delete next[userId]; return next })
    const supabase = createClient()
    const { error } = await supabase.rpc('set_utilisateur_plan', {
      cible: userId,
      nouveau_plan: newPlan,
    })
    if (error) {
      setRowErrors((prev) => ({ ...prev, [userId]: error.message }))
    } else {
      await fetchRows()
    }
    setInvokingId(null)
  }

  const query = norm(search.trim())
  const filtered = rows.filter((r) => {
    if (planFilter !== 'tous' && r.plan !== planFilter) return false
    if (!query) return true
    return (
      norm(r.pseudo).includes(query) ||
      norm(r.prenom).includes(query) ||
      norm(r.nom).includes(query) ||
      norm(r.email).includes(query)
    )
  })

  const noResults = query || planFilter !== 'tous'

  return (
    <div className="space-y-4">
      {/* Header + filtres */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="text-lg font-semibold text-[#1a1a1a]">Utilisateurs</h2>
        <div style={{ flex: 1, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
            style={{ ...INPUT_STYLE, width: 160 }}
          >
            <option value="tous">Tous les plans</option>
            <option value="classe">Classe</option>
            <option value="abonne">Abonné</option>
            <option value="gratuit">Aucun accès</option>
          </select>
          <input
            type="search"
            placeholder="Nom, prénom, pseudo, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...INPUT_STYLE, width: 240 }}
          />
        </div>
      </div>

      {/* Tableau */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm w-full">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-gray-400 text-sm">Chargement…</div>
        ) : fetchError ? (
          <div className="flex h-32 items-center justify-center text-sm" style={{ color: '#f87171' }}>{fetchError}</div>
        ) : filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-gray-400 text-sm">
            {noResults ? 'Aucun résultat.' : 'Aucun utilisateur.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                {COLS.map((col) => (
                  <th key={col} className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 font-medium text-[#1a1a1a]">{row.pseudo || '—'}</td>
                  <td className="px-3 py-3 text-gray-600">{row.prenom || '—'}</td>
                  <td className="px-3 py-3 text-gray-600">{row.nom || '—'}</td>
                  <td className="px-3 py-3 text-gray-500">{row.email}</td>
                  <td className="px-3 py-3 text-gray-500">{row.role}</td>
                  <td className="px-3 py-3"><PlanBadge plan={row.plan} /></td>
                  <td className="px-3 py-3 text-xs text-gray-400">{row.statut_abonnement || '—'}</td>
                  <td className="px-3 py-3">
                    {row.plan === 'abonne' ? (
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Géré par Stripe</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button
                          onClick={() => handlePlanChange(row.id, row.plan === 'classe' ? 'gratuit' : 'classe')}
                          disabled={invokingId === row.id}
                          style={{
                            border: 'none',
                            borderRadius: 6,
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: invokingId === row.id ? 'not-allowed' : 'pointer',
                            opacity: invokingId === row.id ? 0.6 : 1,
                            background: row.plan === 'classe' ? '#fee2e2' : '#dcfce7',
                            color: row.plan === 'classe' ? '#991b1b' : '#166534',
                            transition: 'opacity 0.15s',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {invokingId === row.id ? '…' : row.plan === 'classe' ? "Retirer l'accès" : 'Donner accès classe'}
                        </button>
                        {rowErrors[row.id] && (
                          <span style={{ fontSize: 11, color: '#f87171' }}>{rowErrors[row.id]}</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
