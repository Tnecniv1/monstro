'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Statut =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'unpaid'
  | 'paused'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'

interface Abonnement {
  statut: Statut
  current_period_end: string | null
}

interface FnResponse {
  url?: string
  error?: string
}

const ACTIVE_STATUTS: Statut[] = ['active', 'trialing', 'past_due', 'unpaid', 'paused']

function formatDateFR(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function statutInfo(statut: Statut | null | undefined): { label: string; color: string } {
  switch (statut) {
    case 'active':
    case 'trialing':
      return { label: 'Abonnement actif', color: '#4ade80' }
    case 'past_due':
    case 'unpaid':
      return { label: 'Paiement en attente', color: '#f87171' }
    case 'paused':
      return { label: 'En pause', color: '#a78bfa' }
    default:
      return { label: 'Aucun abonnement actif', color: '#9ca3af' }
  }
}

export default function AbonnementCard() {
  const searchParams = useSearchParams()
  const retour = searchParams.get('abonnement')

  const [abonnement, setAbonnement] = useState<Abonnement | null>(null)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(retour === 'success')
  const [invoking, setInvoking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function fetchRow(): Promise<Abonnement | null> {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('abonnement')
        .select('statut, current_period_end')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!data) return null
      return { statut: data.statut as Statut, current_period_end: data.current_period_end }
    }

    async function run() {
      if (retour === 'success') {
        setActivating(true)
        let lastRow: Abonnement | null = null

        for (const wait of [1500, 1500, 2000]) {
          await new Promise<void>((r) => setTimeout(r, wait))
          if (cancelled) return
          lastRow = await fetchRow()
          if (cancelled) return
          if (lastRow && ACTIVE_STATUTS.includes(lastRow.statut)) break
        }

        if (!cancelled) {
          setAbonnement(lastRow)
          setActivating(false)
          setLoading(false)
        }
      } else {
        const row = await fetchRow()
        if (!cancelled) {
          setAbonnement(row)
          setLoading(false)
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [retour])

  const hasSub = abonnement ? ACTIVE_STATUTS.includes(abonnement.statut) : false
  const { label, color } = statutInfo(abonnement?.statut)

  async function handlePortal() {
    setInvoking(true)
    setError(null)
    const supabase = createClient()
    const { data, error: fnError } = await supabase.functions.invoke<FnResponse>('abonnement-portal')
    if (fnError || data?.error || !data?.url) {
      setError(fnError?.message ?? data?.error ?? 'Une erreur est survenue')
      setInvoking(false)
      return
    }
    window.location.href = data.url
  }

  async function handleCheckout() {
    setInvoking(true)
    setError(null)
    const supabase = createClient()
    const { data, error: fnError } =
      await supabase.functions.invoke<FnResponse>('abonnement-checkout')
    if (fnError || data?.error || !data?.url) {
      setError(fnError?.message ?? data?.error ?? 'Une erreur est survenue')
      setInvoking(false)
      return
    }
    window.location.href = data.url
  }

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: '20px 24px',
        border: '1px solid #EDEAE3',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.01em' }}>
        Abonnement
      </div>

      {loading || activating ? (
        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          {activating ? 'Activation en cours…' : 'Chargement…'}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{label}</span>
            </div>
            {hasSub && abonnement?.current_period_end && (
              <div style={{ fontSize: 12, color: '#6b7280', paddingLeft: 16 }}>
                Prochain renouvellement : {formatDateFR(abonnement.current_period_end)}
              </div>
            )}
          </div>

          {hasSub ? (
            <button
              onClick={handlePortal}
              disabled={invoking}
              style={{
                background: '#EDEAE3',
                border: 'none',
                borderRadius: 10,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: '#1a1a1a',
                cursor: invoking ? 'not-allowed' : 'pointer',
                opacity: invoking ? 0.6 : 1,
                transition: 'opacity 0.15s',
                width: '100%',
                textAlign: 'left',
              }}
            >
              {invoking ? 'Redirection…' : 'Gérer mon abonnement'}
            </button>
          ) : (
            <button
              onClick={handleCheckout}
              disabled={invoking}
              style={{
                background: '#a78bfa',
                border: 'none',
                borderRadius: 10,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: '#ffffff',
                cursor: invoking ? 'not-allowed' : 'pointer',
                opacity: invoking ? 0.6 : 1,
                transition: 'opacity 0.15s',
                width: '100%',
              }}
            >
              {invoking ? 'Redirection…' : "S’abonner — 50 €/mois"}
            </button>
          )}

          {error && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{error}</p>}
        </>
      )}
    </div>
  )
}
