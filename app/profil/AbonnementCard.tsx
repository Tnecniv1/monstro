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

function statutInfo(statut: Statut | null | undefined): {
  label: string
  dotClass: string
  textClass: string
} {
  switch (statut) {
    case 'active':
    case 'trialing':
      return { label: 'Abonnement actif', dotClass: 'bg-success', textClass: 'text-success' }
    case 'past_due':
      return { label: 'Paiement en attente', dotClass: 'bg-warning', textClass: 'text-warning' }
    case 'unpaid':
      return { label: 'Paiement en attente', dotClass: 'bg-danger', textClass: 'text-danger' }
    case 'paused':
      return { label: 'En pause', dotClass: 'bg-warning', textClass: 'text-warning' }
    default:
      return { label: 'Aucun abonnement actif', dotClass: 'bg-text-muted', textClass: 'text-text-secondary' }
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
  const { label, dotClass, textClass } = statutInfo(abonnement?.statut)

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
    <div className="bg-surface border border-border rounded-2xl px-6 py-5 flex flex-col gap-4">
      <div className="text-sm font-bold text-text-primary tracking-tight">
        Abonnement
      </div>

      {loading || activating ? (
        <div className="text-[13px] text-text-muted">
          {activating ? 'Activation en cours…' : 'Chargement…'}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
              <span className={`text-[13px] font-semibold ${textClass}`}>{label}</span>
            </div>
            {hasSub && abonnement?.current_period_end && (
              <div className="text-xs text-text-muted pl-4">
                Prochain renouvellement : {formatDateFR(abonnement.current_period_end)}
              </div>
            )}
          </div>

          {hasSub ? (
            <button
              onClick={handlePortal}
              disabled={invoking}
              className="bg-surface-2 border border-border-strong text-text-primary hover:bg-surface rounded-[10px] px-4 py-2.5 text-[13px] font-semibold w-full text-left transition-opacity"
              style={{ cursor: invoking ? 'not-allowed' : 'pointer', opacity: invoking ? 0.6 : 1 }}
            >
              {invoking ? 'Redirection…' : 'Gérer mon abonnement'}
            </button>
          ) : (
            <button
              onClick={handleCheckout}
              disabled={invoking}
              className="bg-accent text-bg rounded-[10px] px-4 py-2.5 text-[13px] font-semibold w-full transition-opacity"
              style={{ cursor: invoking ? 'not-allowed' : 'pointer', opacity: invoking ? 0.6 : 1 }}
            >
              {invoking ? 'Redirection…' : "S’abonner — 50 €/mois"}
            </button>
          )}

          {error && <p className="text-xs text-danger m-0">{error}</p>}
        </>
      )}
    </div>
  )
}
