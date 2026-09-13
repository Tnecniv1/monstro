'use client'

import { useState } from 'react'
import ForumCardManager from './ForumCardManager'

type SousOnglet = 'fiches' | 'ressources'

export default function ForumScriptsView() {
  const [sousOnglet, setSousOnglet] = useState<SousOnglet>('fiches')

  function tabClass(active: boolean) {
    return active
      ? 'rounded-lg px-3 py-1.5 text-xs font-medium bg-surface-2 border border-border-strong text-text-primary'
      : 'rounded-lg px-3 py-1.5 text-xs font-medium bg-surface border border-border text-text-muted hover:text-text-secondary transition-colors'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Forum</h2>
        <div className="flex items-center gap-2">
          <button className={tabClass(sousOnglet === 'fiches')} onClick={() => setSousOnglet('fiches')}>
            Fiches
          </button>
          <button className={tabClass(sousOnglet === 'ressources')} onClick={() => setSousOnglet('ressources')}>
            Ressources
          </button>
        </div>
      </div>

      {sousOnglet === 'fiches' && (
        <ForumCardManager
          table="forum_scripts"
          createLabel="+ Nouvelle fiche"
          itemLabelSingular="fiche"
          showContenu
        />
      )}

      {sousOnglet === 'ressources' && (
        <ForumCardManager
          table="forum_resources"
          createLabel="+ Nouvelle ressource"
          itemLabelSingular="ressource"
          showContenu={false}
        />
      )}
    </div>
  )
}
