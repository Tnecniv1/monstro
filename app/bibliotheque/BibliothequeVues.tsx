'use client'

import { useState, type ComponentProps } from 'react'
import BibliothequeClient from './BibliothequeClient'
import CoursVue from './CoursVue'
import { bibliothequeHref, type CategorieCours, type Cours, type VueBibliotheque } from './cours'

interface Props {
  initialVue: VueBibliotheque
  initialCategorie: CategorieCours | null
  cours: Cours[]
  // Vue « Problèmes » : la Bibliothèque des feuilles (BibliothequeClient).
  problemes: Omit<ComponentProps<typeof BibliothequeClient>, 'toggleVue'>
}

const VUES: { key: VueBibliotheque; label: string }[] = [
  { key: 'problemes', label: 'Problèmes' },
  { key: 'cours', label: 'Cours' },
]

// Contrôle segmenté « Problèmes | Cours », version compacte de celui du Forum
// (ForumTabs) : même hauteur que les pastilles de sa ligne (24px).
function ToggleVue({ vue, onVue }: { vue: VueBibliotheque; onVue: (vue: VueBibliotheque) => void }) {
  return (
    <div role="tablist" className="ml-auto flex shrink-0 gap-0.5 rounded-lg bg-surface-2 p-0.5">
      {VUES.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={vue === v.key}
          onClick={() => onVue(v.key)}
          className={`rounded-md border px-2.5 text-[13px] leading-[18px] transition-colors ${
            vue === v.key
              ? 'border-border bg-surface font-bold text-accent'
              : 'border-transparent font-semibold text-text-primary hover:bg-surface/60'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

// Vue active (Problèmes ou Cours), gardée dans l'URL (?vue=cours&categorie=…)
// sans nouvel aller-retour serveur. Le toggle est placé par chaque vue à
// droite de sa ligne de pastilles, sous la recherche ; il est masqué pendant
// l'étape d'onboarding Focus (la page reste alors sur Problèmes). Les deux
// vues restent montées : recherche et filtres survivent au changement de vue.
export default function BibliothequeVues({ initialVue, initialCategorie, cours, problemes }: Props) {
  const [vue, setVue] = useState<VueBibliotheque>(initialVue)
  const [categorie, setCategorie] = useState<CategorieCours | null>(initialCategorie)

  function changerVue(nouvelle: VueBibliotheque) {
    setVue(nouvelle)
    window.history.replaceState(null, '', bibliothequeHref(nouvelle, categorie))
  }

  function changerCategorie(nouvelle: CategorieCours | null) {
    setCategorie(nouvelle)
    window.history.replaceState(null, '', bibliothequeHref('cours', nouvelle))
  }

  const toggleVue = problemes.etapeFocus ? null : <ToggleVue vue={vue} onVue={changerVue} />

  return (
    <>
      <div hidden={vue !== 'problemes'}>
        <BibliothequeClient {...problemes} toggleVue={toggleVue} />
      </div>
      <div hidden={vue !== 'cours'}>
        <CoursVue cours={cours} categorie={categorie} onCategorie={changerCategorie} toggleVue={toggleVue} />
      </div>
    </>
  )
}
