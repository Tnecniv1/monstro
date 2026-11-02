'use client'

import ForumCardManager from './ForumCardManager'

// Les ressources (forum_resources) se gèrent dans l'onglet Cours de l'Admin.
export default function ForumScriptsView() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Forum</h2>
      <ForumCardManager table="forum_scripts" createLabel="+ Nouvelle fiche" itemLabelSingular="fiche" />
    </div>
  )
}
