import Link from 'next/link'
import MaisonNav from './MaisonNav'

// Coquille commune aux pages publiques (Maison, Voyage, Problèmes, Philosophie) :
// fond, marges, pilule de navigation en haut, liens légaux en pied de page.
export default function VitrineShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen bg-bg flex flex-col px-4 pt-6 pb-12 md:px-8">
      <MaisonNav />

      {children}

      <footer className="absolute inset-x-0 bottom-3 flex justify-center gap-2 text-xs text-gray-400">
        <Link href="/mentions-legales" className="hover:text-gray-600 transition-colors">
          Mentions légales
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="hover:text-gray-600 transition-colors">
          Confidentialité
        </Link>
      </footer>
    </main>
  )
}

// Grand titre serif des pages publiques (même style que « Apprendre à raisonner. »)
export function VitrineTitre({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-serif font-bold text-5xl sm:text-6xl lg:text-7xl leading-[1.05] text-text-primary">
      {children}
    </h1>
  )
}
