'use client'

import Link from 'next/link'
import PastilleCompteur from './PastilleCompteur'
import { useForumAttente } from './ForumAttenteProvider'

// Carte « Forum » de l'accueil, avec la pastille des questions en attente à
// cheval sur le coin supérieur droit (client : page.tsx est un composant serveur).
export default function EntreeForum() {
  const { count } = useForumAttente()
  return (
    <Link href="/forum" className="relative block w-full rounded-2xl py-5 text-center font-bold text-lg bg-surface border border-border text-text-primary hover:bg-surface-2 transition-colors">
      Forum
      <PastilleCompteur count={count} className="absolute -right-2 -top-2" />
    </Link>
  )
}
