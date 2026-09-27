import VitrineShell from '@/app/components/VitrineShell'

// Voyage, Problèmes, Philosophie : même coquille que la page d'accueil,
// contenu aligné en haut. Chaque page fixe sa largeur (lecture ou grille d'articles).
export default function VitrineLayout({ children }: { children: React.ReactNode }) {
  return (
    <VitrineShell>
      <div className="w-full pt-12">{children}</div>
    </VitrineShell>
  )
}
