import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/getUser'
import { isForumAdmin } from '../adminGate'
import { formatJoursDepuis } from '../relativeTime'
import { niveauPixels } from '@/lib/pixels'
import { onboardingEleve } from './etapes'
import OnboardingView, { type EleveOnboarding } from './OnboardingView'
import SuiviTabs from './SuiviTabs'

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
  const [{ data, error }, onboarding, { count: nonLus }] = await Promise.all([
    supabase.rpc('get_regularite_admin'),
    chargerOnboarding(supabase),
    // Pastille du toggle Conversation : messages WhatsApp reçus non lus
    supabase.from('whatsapp_message').select('id', { count: 'exact', head: true }).eq('sens', 'entrant').is('lu_le', null),
  ])
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

        <SuiviTabs
          regularite={
            error ? (
              <Erreur message={error.message} />
            ) : (
              // Sur mobile, Perdants passe en premier.
              <div className="grid gap-6 md:grid-cols-2">
                <Colonne titre="Gagnants" eleves={gagnants} className="order-2 md:order-1" />
                <Colonne titre="Perdants" eleves={perdants} className="order-1 md:order-2" />
              </div>
            )
          }
          onboarding={'erreur' in onboarding ? <Erreur message={onboarding.erreur} /> : <OnboardingView eleves={onboarding.eleves} />}
          nonLus={nonLus ?? 0}
        />
      </div>
    </div>
  )
}

type Client = ReturnType<typeof createClient>

// Lignes au-delà de la limite de 1 000 par requête : lecture par pages.
const PAGE = 1000

async function toutesLesLignes<T>(
  lire: (de: number, a: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<{ lignes: T[]; erreur: string | null }> {
  const lignes: T[] = []
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await lire(de, de + PAGE - 1)
    if (error) return { lignes, erreur: error.message }
    lignes.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return { lignes, erreur: null }
  }
}

type LigneProfil = {
  id: string
  prenom: string | null
  nom: string | null
  pseudo: string | null
  plan: 'abonne' | 'essai' | 'classe'
  created_at: string | null
  script1_ouvert_at: string | null
}

type LigneAssignation = {
  user_id: string
  created_at: string
  positionnement_at: string | null
  etape_depart_id: string | null
  parcours: { nom: string } | null
  depart: { type: 'feuille' | 'examen'; libelle: string | null; feuille: { titre: string } | null } | null
}

type LigneEntrainement = {
  user_id: string
  date_creation: string | null
  statut: string
  termine_at: string | null
  // Une observation au plus par entraînement (unique) ; tableau par prudence.
  observation: { etat: string | null } | { etat: string | null }[] | null
  session: { date: string }[] | null
}

// Onglet Onboarding : élèves au rôle etudiant avec accès complet (plan
// abonne, classe ou essai), étapes calculées par onboardingEleve (etapes.ts),
// niveau = niveauPixels du nombre d'observations succes ou corrige (même
// compteur que l'accueil). Lectures directes (droits admin), entraînements
// lus par pages (sessions et observation embarquées).
async function chargerOnboarding(supabase: Client): Promise<{ eleves: EleveOnboarding[] } | { erreur: string }> {
  const { data: profils, error: errProfils } = await supabase
    .from('user_profile')
    .select('id, prenom, nom, pseudo, plan, created_at, script1_ouvert_at')
    .eq('role', 'etudiant')
    .in('plan', ['abonne', 'classe', 'essai'])
  if (errProfils) return { erreur: errProfils.message }
  const eleves = (profils ?? []) as LigneProfil[]
  const ids = eleves.map((e) => e.id)
  if (ids.length === 0) return { eleves: [] }

  const [assignations, entrainements] = await Promise.all([
    toutesLesLignes<LigneAssignation>((de, a) =>
      supabase
        .from('parcours_eleve')
        .select(
          'user_id, created_at, positionnement_at, etape_depart_id, parcours ( nom ), depart:parcours_etape!etape_depart_id ( type, libelle, feuille:feuille_entrainement ( titre ) )'
        )
        .in('user_id', ids)
        .order('created_at')
        .order('user_id')
        .range(de, a)
    ),
    toutesLesLignes<LigneEntrainement>((de, a) =>
      supabase
        .from('entrainement')
        .select('user_id, date_creation, statut, termine_at, observation ( etat ), session ( date )')
        .in('user_id', ids)
        .order('id')
        .range(de, a)
    ),
  ])
  const erreur = assignations.erreur ?? entrainements.erreur
  if (erreur) return { erreur }

  // Première assignation de chaque élève (la plus ancienne).
  const assignationDe = new Map<string, LigneAssignation>()
  for (const a of assignations.lignes) if (!assignationDe.has(a.user_id)) assignationDe.set(a.user_id, a)
  const entrainementsDe = new Map<string, LigneEntrainement[]>()
  for (const e of entrainements.lignes) entrainementsDe.set(e.user_id, [...(entrainementsDe.get(e.user_id) ?? []), e])

  return {
    eleves: eleves.map((p) => {
      const a = assignationDe.get(p.id)
      const ents = entrainementsDe.get(p.id) ?? []
      const pixels = ents.filter((e) => {
        const obs = Array.isArray(e.observation) ? e.observation : e.observation ? [e.observation] : []
        return obs.some((o) => o.etat === 'succes' || o.etat === 'corrige')
      }).length
      const termines = ents.filter((e) => e.statut === 'termine')
      return {
        id: p.id,
        nom: [p.prenom, p.nom].filter(Boolean).join(' ') || p.pseudo || p.id,
        plan: p.plan,
        inscritLe: p.created_at,
        parcoursNom: a?.parcours?.nom ?? null,
        depart: a ? (a.depart ? (a.depart.feuille?.titre ?? a.depart.libelle ?? 'Étape') : 'début') : null,
        niveau: niveauPixels(pixels),
        pixels,
        onboarding: onboardingEleve({
          inscritLe: p.created_at,
          objectifLe: a?.created_at ?? null,
          positionLe: a?.positionnement_at ?? null,
          script1Le: p.script1_ouvert_at,
          entrainementsCreesLe: ents.map((e) => e.date_creation),
          entrainementsTerminesLe: termines.map((e) => e.termine_at),
          sessionsLe: ents.flatMap((e) => (e.session ?? []).map((s) => s.date)),
          aUnObjectif: a != null,
          aUnEntrainement: ents.length > 0,
          aUnTermine: termines.length > 0,
        }),
      }
    }),
  }
}

function Erreur({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-danger">
      Impossible de charger le suivi : {message}
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
