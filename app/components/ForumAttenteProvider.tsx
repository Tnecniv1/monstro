'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ForumAttente = {
  ids: Set<string>
  count: number
  refresh: () => Promise<void>
}

// Hors provider (ne devrait pas arriver : il est monté dans app/layout.tsx).
const ForumAttenteContext = createContext<ForumAttente>({ ids: new Set(), count: 0, refresh: async () => {} })

// Questions du forum en attente pour l'utilisateur connecté (RPC
// forum_tickets_en_attente(), règle entièrement côté SQL). Source unique de la
// carte Forum de l'accueil, de l'onglet Questions et des points par question.
// Rechargé au montage, à chaque changement de route, à la connexion /
// déconnexion et sur refresh() — pas de temps réel ni de polling.
export function ForumAttenteProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [ids, setIds] = useState<Set<string>>(() => new Set())
  // Seule la réponse de la dernière requête est retenue (navigations rapprochées).
  const derniere = useRef(0)

  const refresh = useCallback(async () => {
    const n = ++derniere.current
    const supabase = createClient()
    // Session lue localement, sans requête : pas connecté → pas d'appel.
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      if (n === derniere.current) setIds(new Set())
      return
    }
    const { data, error } = await supabase.rpc('forum_tickets_en_attente')
    // En cas d'erreur, l'état précédent est conservé.
    if (error || n !== derniere.current) return
    setIds(new Set(((data ?? []) as { ticket_id: string }[]).map((r) => r.ticket_id)))
  }, [])

  useEffect(() => {
    refresh()
  }, [pathname, refresh])

  // Connexion / déconnexion sans changement de route (formulaire de la landing),
  // comme OnboardingGate.
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') refresh()
    })
    return () => data.subscription.unsubscribe()
  }, [refresh])

  const value = useMemo(() => ({ ids, count: ids.size, refresh }), [ids, refresh])
  return <ForumAttenteContext.Provider value={value}>{children}</ForumAttenteContext.Provider>
}

export function useForumAttente(): ForumAttente {
  return useContext(ForumAttenteContext)
}
