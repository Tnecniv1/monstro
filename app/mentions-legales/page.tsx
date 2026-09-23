import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mentions légales — Monstro',
  description: 'Mentions légales du site Monstro : éditeur et hébergement.',
}

const EDITEUR: [string, React.ReactNode][] = [
  ['Raison sociale', 'LE BARBEY Vincent (nom commercial : MONSTRO)'],
  ['Forme juridique', 'Entrepreneur individuel (micro-entreprise)'],
  ['SIREN', '888 867 611'],
  ['SIRET (siège)', '888 867 611 00038'],
  ['Numéro de TVA intracommunautaire', 'FR95888867611'],
  ['Activité', 'Autres enseignements'],
  ['Adresse du siège', 'Bâtiment 7, Appartement 82, 106 Avenue du Général Leclerc, 28100 Dreux'],
  ['Directeur de la publication', 'Vincent Le Barbey'],
  [
    'Email de contact',
    <a key="email" href="mailto:vincentlebarbey@monstro.fr" className="text-accent hover:underline">
      vincentlebarbey@monstro.fr
    </a>,
  ],
]

const HEBERGEMENT: [string, React.ReactNode][] = [
  [
    'Application web',
    <>
      Render Services, Inc.
      <br />
      525 Brannan Street Ste 300, San Francisco, CA 94107, États-Unis
      <br />
      Tél. : +1 415-319-8186
    </>,
  ],
  [
    'Base de données',
    <>
      Supabase Pte. Ltd.
      <br />
      65 Chulia Street #38-02/03, OCBC Centre, Singapour 049513
      <br />
      Pas de numéro de téléphone public — contact :{' '}
      <a href="mailto:legal@supabase.io" className="text-accent hover:underline">
        legal@supabase.io
      </a>
    </>,
  ],
]

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Monstro
        </Link>

        <h1 className="text-2xl font-bold text-gray-900">Mentions légales</h1>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <Section title="Éditeur du site" rows={EDITEUR} />
          <Section title="Hébergement" rows={HEBERGEMENT} />
        </div>

      </div>
    </div>
  )
}

function Section({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-gray-900 text-base">{title}</h2>
      <dl className="space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="sm:flex sm:gap-2">
            <dt className="text-gray-500 sm:w-64 sm:shrink-0">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
