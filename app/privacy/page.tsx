import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Monstro',
  description: 'Comment Monstro collecte, utilise et protège vos données personnelles.',
}

const LAST_UPDATED = '10 mai 2025'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Monstro
        </Link>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Politique de confidentialité
          </h1>
          <p className="text-sm text-gray-400">Mise à jour le {LAST_UPDATED}</p>
        </div>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900 text-base">1. Qui sommes-nous ?</h2>
            <p>
              Monstro est une application d&apos;entraînement scolaire éditée à titre personnel.
              Pour toute question relative à vos données, contactez-nous à l&apos;adresse :{' '}
              <a
                href="mailto:vincentlebarbey@monstro.fr"
                className="text-indigo-600 hover:underline"
              >
                vincentlebarbey@monstro.fr
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900 text-base">2. Données collectées</h2>
            <p>Nous collectons uniquement les données nécessaires au fonctionnement de l&apos;application :</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong>Adresse e-mail</strong> — utilisée pour créer et authentifier votre compte.
              </li>
              <li>
                <strong>Pseudo</strong> — nom d&apos;affichage choisi lors de l&apos;inscription.
              </li>
              <li>
                <strong>Données d&apos;entraînement</strong> — exercices réalisés, résultats, temps de travail,
                séries consultées. Ces données servent à afficher votre progression et à alimenter
                les statistiques de suivi.
              </li>
              <li>
                <strong>Photo de profil (optionnelle)</strong> — image téléversée volontairement par l&apos;utilisateur.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900 text-base">3. Finalité du traitement</h2>
            <p>Les données sont utilisées exclusivement pour :</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Permettre l&apos;accès à votre compte et à vos entraînements.</li>
              <li>Afficher votre progression personnelle (Parcours, Classement).</li>
              <li>Permettre aux enseignants de suivre l&apos;activité de leurs élèves (Observatoire).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900 text-base">4. Hébergement et sous-traitants</h2>
            <p>
              L&apos;ensemble des données est hébergé sur{' '}
              <strong>Supabase</strong> (infrastructure PostgreSQL et stockage de fichiers),
              dont les serveurs sont situés dans l&apos;Union européenne (région{' '}
              <span className="font-medium">eu-west-3</span>, Paris).
              Supabase est soumis aux obligations du RGPD en tant que sous-traitant.
            </p>
            <p>
              L&apos;application web est hébergée sur <strong>Render</strong> (San Francisco, États-Unis),
              qui dispose de garanties contractuelles adéquates conformément aux règles de transfert
              international de données.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900 text-base">5. Partage des données</h2>
            <p>
              Vos données ne sont <strong>jamais vendues, louées ni partagées</strong> avec des tiers
              à des fins commerciales ou publicitaires. Aucun outil de tracking ou de publicité
              n&apos;est intégré à l&apos;application.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900 text-base">6. Durée de conservation</h2>
            <p>
              Les données sont conservées pendant toute la durée d&apos;utilisation du compte.
              En cas de suppression du compte, l&apos;ensemble des données associées est effacé
              dans un délai de 30 jours.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900 text-base">7. Vos droits</h2>
            <p>
              Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification,
              d&apos;effacement et de portabilité de vos données. Pour exercer ces droits
              ou demander la suppression de votre compte, écrivez à :
            </p>
            <p>
              <a
                href="mailto:vincentlebarbey@monstro.fr"
                className="text-indigo-600 hover:underline font-medium"
              >
                vincentlebarbey@monstro.fr
              </a>
            </p>
            <p>Nous répondrons à toute demande dans un délai maximum de 30 jours.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900 text-base">8. Cookies</h2>
            <p>
              Monstro n&apos;utilise pas de cookies publicitaires ou de tracking.
              Un cookie de session est utilisé uniquement pour maintenir votre connexion
              (cookie strictement nécessaire, exempt de consentement).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900 text-base">9. Contact</h2>
            <p>
              Pour toute question concernant cette politique de confidentialité :{' '}
              <a
                href="mailto:vincentlebarbey@monstro.fr"
                className="text-indigo-600 hover:underline"
              >
                vincentlebarbey@monstro.fr
              </a>
            </p>
          </section>

        </div>

        <div className="border-t border-gray-100 pt-6">
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            ← Retour à l&apos;application
          </Link>
        </div>

      </div>
    </div>
  )
}
