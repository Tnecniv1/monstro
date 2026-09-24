import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/getUser'
import { isForumAdmin } from '../adminGate'
import { formatJoursDepuis } from '../relativeTime'

// Ligne renvoyée par la RPC get_regularite_admin() (lève une exception hors admin).
type EleveRegularite = {
  id: string
  prenom: string | null
  nom: string | null
  pseudo: string
  plan: 'abonne' | 'essai' | 'classe'
  jours_actifs: number
  fenetre_jours: number
  derniere_activite: string | null
  categorie: 'gagnant' | 'perdant'
}

export default async function SuiviPage() {
  const { profile } = await getUser()
  if (!isForumAdmin(profile?.role)) redirect('/forum')

  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_regularite_admin')
  const eleves = (data ?? []) as EleveRegularite[]

  // Perdants : ordre de la RPC (jamais actifs, puis activité la plus ancienne).
  const perdants = eleves.filter((e) => e.categorie === 'perdant')
  const gagnants = eleves
    .filter((e) => e.categorie === 'gagnant')
    .sort((a, b) => b.jours_actifs - a.jours_actifs)

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Link href="/forum" className="text-sm text-text-muted hover:text-text-secondary transition-colors">← Forum</Link>

        <h1 className="text-2xl font-bold text-text-primary">Suivi</h1>

        {error ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-danger">
            Impossible de charger le suivi : {error.message}
          </div>
        ) : (
          // Sur mobile, Perdants passe en premier.
          <div className="grid gap-6 md:grid-cols-2">
            <Colonne titre="Gagnants" eleves={gagnants} className="order-2 md:order-1" />
            <Colonne titre="Perdants" eleves={perdants} className="order-1 md:order-2" />
          </div>
        )}
      </div>
    </div>
  )
}

function nomAffiche(e: EleveRegularite): string {
  return [e.prenom, e.nom].filter(Boolean).join(' ') || e.pseudo
}

function Colonne({
  titre,
  eleves,
  className,
}: {
  titre: string
  eleves: EleveRegularite[]
  className: string
}) {
  return (
    <section className={`rounded-2xl border border-border bg-surface ${className}`}>
      <h2 className="px-4 py-3 border-b border-border font-semibold text-text-primary">
        {titre} ({eleves.length})
      </h2>

      {eleves.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-text-muted">Aucun élève</p>
      ) : (
        <ul className="divide-y divide-border">
          {eleves.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate font-medium text-text-primary">{nomAffiche(e)}</span>
                {e.plan === 'essai' && (
                  <span className="shrink-0 rounded border border-border px-1.5 text-[10px] uppercase text-text-muted">
                    Essai
                  </span>
                )}
              </span>
              <span className="w-12 shrink-0 text-right tabular-nums text-text-secondary">
                {e.jours_actifs} / {e.fenetre_jours}
              </span>
              <span className="w-20 shrink-0 text-right text-text-muted">{formatJoursDepuis(e.derniere_activite)}</span>
              {/* Emplacement réservé : action de relance à venir */}
              <button
                type="button"
                disabled
                className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2 disabled:opacity-50 transition-colors"
              >
                Relancer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
