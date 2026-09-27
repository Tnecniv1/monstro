import { VitrineTitre } from '@/app/components/VitrineShell'
import { vitrineMetadata } from '../metadata'

// TODO : passer indexable: true quand la page aura du contenu (et l'ajouter à app/sitemap.ts).
export const metadata = vitrineMetadata({
  path: '/voyage',
  title: 'Voyage — Monstro', // TODO : titre définitif
  description: 'TODO : description de la page Voyage.',
})

export default function VoyagePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <VitrineTitre>Voyage</VitrineTitre>
      {/* Contenu à venir */}
      <section />
    </div>
  )
}
