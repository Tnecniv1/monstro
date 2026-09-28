import { VitrineTitre } from '@/app/components/VitrineShell'
import { vitrineMetadata } from '../metadata'

// Espaces insécables : normale avant « ? », fine comme séparateur de milliers
const NBSP = '\u00a0'
const FINE = '\u202f'

const BUT_QUESTION = `Le but du jeu${NBSP}?`
const BUT_REPONSE = `Résoudre 1${FINE}000 problèmes.`

const REGLES = [
  "Respecter le parcours d'apprentissage.",
  'Poser une question par blocage.',
  'Prouver chaque session de travail.',
]

export const metadata = vitrineMetadata({
  path: '/voyage',
  title: 'Voyage — Monstro',
  description: `${BUT_QUESTION} ${BUT_REPONSE}`,
  indexable: true,
})

export default function VoyagePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <VitrineTitre>Voyage</VitrineTitre>

      <div className="divide-y divide-gray-200">
        <QuestionReponse question={BUT_QUESTION} reponse={BUT_REPONSE} />

        <section className="py-12">
          {/* Cartes symétriques : la grille étire les trois cartes à la même hauteur ; dans chaque carte,
              le rond est en haut (ronds alignés) et le texte centré dans l'espace restant */}
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {REGLES.map((regle, i) => (
              <li
                key={regle}
                className="grid grid-rows-[auto_1fr] justify-items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-6 text-center"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-accent"
                >
                  {i + 1}
                </span>
                <p className="flex items-center justify-center font-serif text-lg font-semibold leading-snug text-text-primary">
                  {regle}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <QuestionReponse question={`Le trésor${NBSP}?`} reponse="Fabriquer des ponts.">
          {/* TODO image : déposer le fichier dans public/images/voyage/ (ex. ponts.png), ajouter
              `import Image from 'next/image'` puis afficher ici, sous « Fabriquer des ponts. » :
              <div className="relative mt-8 aspect-[16/7] overflow-hidden rounded-2xl border border-gray-200">
                <Image src="/images/voyage/ponts.png" alt="…" fill sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
              </div> */}
        </QuestionReponse>
      </div>
    </div>
  )
}

function QuestionReponse({
  question,
  reponse,
  children,
}: {
  question: string
  reponse: string
  children?: React.ReactNode
}) {
  return (
    <section className="space-y-2 py-12 first:pt-4">
      <p className="text-sm font-medium text-accent">{question}</p>
      <h2 className="font-serif text-3xl sm:text-4xl font-bold leading-tight text-text-primary">{reponse}</h2>
      {children}
    </section>
  )
}
