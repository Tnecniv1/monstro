'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import IconeAdn from '../components/IconeAdn'

// Un jeton ADN tous les 25 QCM réussis pour la première fois (compté en base :
// supabase/migrations/20261013_tokens_adn.sql).
const QCM_PAR_JETON = 25

// Barre « 18 / 25 vers ton prochain jeton ». `version` : à incrémenter pour
// recharger (après chaque réponse validée).
export default function JetonProgression({ version = 0 }: { version?: number }) {
  const [reussis, setReussis] = useState<number | null>(null)

  useEffect(() => {
    let annule = false
    createClient()
      .rpc('token_etat')
      .then(({ data, error }) => {
        if (annule || error) return
        const etat = (Array.isArray(data) ? data[0] : data) as { qcm_reussis: number } | null
        if (etat) setReussis(etat.qcm_reussis)
      })
    return () => {
      annule = true
    }
  }, [version])

  if (reussis === null) return null

  const avancement = reussis % QCM_PAR_JETON

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        <IconeAdn size={14} className="text-accent" />
        {avancement} / {QCM_PAR_JETON} vers ton prochain jeton
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={QCM_PAR_JETON}
        aria-valuenow={avancement}
        className="h-1.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(avancement / QCM_PAR_JETON) * 100}%` }} />
      </div>
    </div>
  )
}
