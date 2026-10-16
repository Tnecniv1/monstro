'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Nombre de questions en attente pour l'utilisateur connecté (admin ou élève :
// la règle est entièrement dans la RPC forum_compteur_attente()). Chargé au
// montage, puis à chaque refresh() — pas de temps réel ni de polling.
// En cas d'erreur, le compteur garde sa dernière valeur (0 au départ).
export function useForumCompteur() {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    const { data, error } = await createClient().rpc('forum_compteur_attente')
    if (!error && typeof data === 'number') setCount(data)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { count, refresh }
}
