'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/app/components/Avatar'
import IconeAdn from '@/app/components/IconeAdn'
import SoldeJetons from '@/app/components/SoldeJetons'
import EquipeDetailModal from './EquipeDetailModal'
import EquipeSessionModal from './EquipeSessionModal'
import { formatHeure, formatJourDate, jourParis } from './relativeTime'
import { ajouterJours, aujourdhuiParis, libelleJourLong, libellePeriode, libelleQuand, lundiDe } from './semaine'
import type { LiveSession } from './types'

// Design system MathBank, propre à cet onglet : Plus Jakarta Sans, texte
// #1E2233, gris #8A8B9B, bordures #ECECEF, un seul accent (#6D28D9 = accent).
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

const BOUTON_GRIS = 'bg-[#EEEEF1] text-[#5A5C6E]'

interface Props {
  userId: string
  isAdmin: boolean
}

// Onglet Équipe : sessions en direct (visio) de la semaine en cours, la
// prochaine en vedette. Un élève s'inscrit et se désinscrit ; un admin crée,
// modifie et supprime les sessions et voit les inscrits. Les règles (places,
// heure de début, lien masqué) sont appliquées par la base
// (supabase/migrations/20261012_live_sessions*.sql).
export default function EquipePanel({ userId, isAdmin }: Props) {
  const router = useRouter()
  // Lundi de la semaine en cours ('YYYY-MM-DD', heure de Paris)
  const [lundi] = useState(() => lundiDe(aujourdhuiParis()))
  const [sessions, setSessions] = useState<LiveSession[]>([])
  const [charge, setCharge] = useState(false)
  const [erreurChargement, setErreurChargement] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  // Solde de jetons ADN de l'élève ; null tant qu'il n'est pas chargé.
  const [solde, setSolde] = useState<number | null>(null)

  // Modals admin : formulaire (nouvelle session ou modification) et détail.
  const [formulaire, setFormulaire] = useState<{ session: LiveSession | null } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .rpc('get_live_sessions', { p_lundi: lundi })
      .then(({ data, error }) => {
        if (cancelled) return
        // Un chargement réussi efface l'erreur d'un chargement précédent.
        setErreurChargement(!!error)
        if (!error) setSessions((data ?? []) as LiveSession[])
        setCharge(true)
      })
    // Jetons ADN : une inscription en coûte 1 (les admins n'en ont pas besoin).
    if (!isAdmin) {
      supabase.rpc('token_etat').then(({ data, error }) => {
        if (cancelled || error) return
        const etat = (Array.isArray(data) ? data[0] : data) as { solde: number } | null
        if (etat) setSolde(etat.solde)
      })
    }
    return () => {
      cancelled = true
    }
  }, [lundi, version, isAdmin])

  function recharger() {
    setVersion((v) => v + 1)
  }

  // Inscription / désinscription : la base tranche (session complète ou
  // commencée) et son message est affiché tel quel. On recharge dans tous
  // les cas, pour refléter les places prises entre-temps.
  async function basculerInscription(session: LiveSession) {
    setBusyId(session.id)
    setError(null)
    setMessage(null)
    const { error } = await createClient().rpc(session.inscrit ? 'desinscrire_live' : 'inscrire_live', {
      p_session_id: session.id,
    })
    if (error) setError(error.message)
    setBusyId(null)
    recharger()
    // Le solde de jetons a changé : l'accueil (compteur ADN) ne doit pas
    // resservir sa version en cache.
    router.refresh()
  }

  async function supprimer(session: LiveSession) {
    const inscrits = session.nb_inscrits > 0 ? ` et ses ${session.nb_inscrits} inscription(s)` : ''
    if (!confirm(`Supprimer la session du ${formatJourDate(session.debut)} à ${formatHeure(session.debut)}${inscrits} ?`)) return
    setBusyId(session.id)
    setError(null)
    setMessage(null)
    const { error } = await createClient().from('live_session').delete().eq('id', session.id)
    if (error) setError(error.message)
    else setDetailId(null)
    setBusyId(null)
    recharger()
  }

  function handleSaved(texte: string, date: string) {
    setFormulaire(null)
    setError(null)
    // Seule la semaine en cours est affichée : on le signale si la session n'y est pas.
    setMessage(lundiDe(date) === lundi ? texte : `${texte} Elle n'est pas dans la semaine affichée.`)
    recharger()
  }

  // Sessions non terminées : la première est en vedette, les autres « plus tard ».
  const maintenant = Date.now()
  const aVenir = sessions.filter((s) => new Date(s.debut).getTime() + s.duree_minutes * 60_000 > maintenant)
  const vedette = aVenir[0]
  const suivantes = aVenir.slice(1)

  // Titre : du lundi au vendredi, ou jusqu'au week-end s'il y a une session.
  const vendredi = ajouterJours(lundi, 4)
  const dernierJour = sessions.length > 0 ? jourParis(sessions[sessions.length - 1].debut) : vendredi
  const detail = detailId ? sessions.find((s) => s.id === detailId) : undefined

  return (
    <div className={`${jakarta.className} space-y-6 text-[#1E2233]`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wide text-[#8A8B9B]">CETTE SEMAINE</p>
          <h2 className="text-[28px] font-extrabold leading-tight">
            Lives {libellePeriode(lundi, dernierJour > vendredi ? dernierJour : vendredi)}
          </h2>
        </div>
        {!isAdmin && solde !== null && <SoldeJetons solde={solde} className="h-11 px-4 text-base" />}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setFormulaire({ session: null })}
            className="h-11 rounded-xl border border-[#ECECEF] bg-white px-4 text-sm font-bold text-accent hover:bg-[#F3EEFD] transition-colors"
          >
            + Session
          </button>
        )}
      </div>

      {message && <p className="text-sm text-success">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {erreurChargement && <p className="text-sm text-danger">Impossible de charger les sessions.</p>}

      {charge && (
        <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
          {vedette ? (
            <CarteVedette
              session={vedette}
              isAdmin={isAdmin}
              busy={busyId === vedette.id}
              onBasculer={() => basculerInscription(vedette)}
              onOuvrir={isAdmin ? () => setDetailId(vedette.id) : undefined}
            />
          ) : (
            <div className="flex min-h-[16rem] items-center justify-center rounded-[22px] border border-[#ECECEF] bg-white p-8 text-center text-[#8A8B9B]">
              Pas d&apos;autre live cette semaine. Rendez-vous lundi !
            </div>
          )}

          <div className="space-y-3">
            {suivantes.length > 0 && <h3 className="text-base font-bold">Plus tard cette semaine</h3>}
            {suivantes.map((s) => (
              <CarteCompacte
                key={s.id}
                session={s}
                isAdmin={isAdmin}
                busy={busyId === s.id}
                onBasculer={() => basculerInscription(s)}
                onOuvrir={isAdmin ? () => setDetailId(s.id) : undefined}
              />
            ))}

            {!isAdmin && (
              <p className="rounded-[14px] bg-[#F3EEFD] p-4 text-sm">
                <span className="font-bold">Chaque inscription coûte 1 jeton ADN</span>, remboursé si tu te désinscris
                avant le début. Tu en gagnes 12 à chaque mois d&apos;abonnement et 1 tous les 25 QCM réussis.
              </p>
            )}
          </div>
        </div>
      )}

      {detail && (
        <EquipeDetailModal
          session={detail}
          busy={busyId === detail.id}
          onModifier={() => {
            setDetailId(null)
            setFormulaire({ session: detail })
          }}
          onSupprimer={() => supprimer(detail)}
          onClose={() => setDetailId(null)}
        />
      )}

      {formulaire && (
        <EquipeSessionModal
          userId={userId}
          session={formulaire.session}
          dateInitiale=""
          onSaved={handleSaved}
          onClose={() => setFormulaire(null)}
        />
      )}
    </div>
  )
}

interface CarteProps {
  session: LiveSession
  isAdmin: boolean
  busy: boolean
  onBasculer: () => void
  // Admin : la carte entière ouvre le détail de la session.
  onOuvrir?: () => void
}

function propsCliquable(onOuvrir?: () => void) {
  if (!onOuvrir) return {}
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onOuvrir,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      onOuvrir()
    },
  }
}

function placesRestantes(session: LiveSession): number {
  return Math.max(0, session.places - session.nb_inscrits)
}

// Rond à initiale de cet onglet, pour un utilisateur sans photo de profil.
const AVATAR_VIOLET = 'bg-[#F3EEFD] font-extrabold text-accent'

function CarteVedette({ session, isAdmin, busy, onBasculer, onOuvrir }: CarteProps) {
  const commencee = new Date(session.debut).getTime() <= Date.now()
  const restantes = placesRestantes(session)
  const quand = libelleQuand(jourParis(session.debut), formatHeure(session.debut))
  const initiales = session.inscrits_initiales ?? []
  const avatars = session.inscrits_avatars ?? []
  const enPlus = session.nb_inscrits - initiales.length

  return (
    <div
      {...propsCliquable(onOuvrir)}
      className={`rounded-[22px] border-2 border-accent bg-white p-6 sm:p-8 ${onOuvrir ? 'cursor-pointer' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-[#F3EEFD] px-3 py-1.5 text-xs font-bold tracking-wide text-accent">
          {commencee ? 'EN COURS' : `PROCHAIN LIVE · ${quand.toUpperCase()}`}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#8A8B9B]">
            Animé par <span className="font-bold text-[#1E2233]">{session.animateur_nom}</span>
          </span>
          <Avatar url={session.animateur_avatar_url} pseudo={session.animateur_nom} size={52} className="shrink-0" fallbackClassName={AVATAR_VIOLET} />
        </div>
      </div>

      <p className="mt-6 text-[72px] font-extrabold leading-none tracking-[-0.03em] text-accent">
        {formatHeure(session.debut)}
      </p>
      <p className="mt-2 text-[#5A5C6E]">
        {formatJourDate(session.debut)} · {session.duree_minutes} min
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {initiales.length > 0 && (
          <div className="flex">
            {initiales.map((initiale, i) => (
              <Avatar
                key={i}
                url={avatars[i]}
                pseudo={initiale}
                size={36}
                className="-ml-2 shrink-0 ring-2 ring-white first:ml-0"
                fallbackClassName={AVATAR_VIOLET}
              />
            ))}
            {enPlus > 0 && (
              <span className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#EEEEF1] text-xs font-bold text-[#5A5C6E] ring-2 ring-white">
                +{enPlus}
              </span>
            )}
          </div>
        )}
        <p className="text-sm text-[#5A5C6E]">
          {session.nb_inscrits === 0
            ? 'Aucun élève inscrit'
            : `${session.nb_inscrits} élève${session.nb_inscrits > 1 ? 's' : ''} inscrit${session.nb_inscrits > 1 ? 's' : ''}`}
          {' · '}
          {restantes === 0 ? 'Complet' : `${restantes} place${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}`}
        </p>
      </div>

      {isAdmin ? (
        <p className="mt-6 text-sm font-bold text-accent">
          {session.nb_inscrits} inscrit{session.nb_inscrits > 1 ? 's' : ''}
        </p>
      ) : session.inscrit ? (
        <div className="mt-6 space-y-1">
          {session.lien && (
            <a
              href={session.lien}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[52px] w-full items-center justify-center rounded-xl bg-accent text-base font-bold text-white hover:opacity-90 transition-opacity"
            >
              Rejoindre
            </a>
          )}
          {!commencee && (
            <button
              type="button"
              onClick={onBasculer}
              disabled={busy}
              className="block w-full py-2 text-center text-sm text-[#8A8B9B] underline hover:text-[#5A5C6E] disabled:opacity-50 transition-colors"
            >
              Se désinscrire
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onBasculer}
          disabled={busy || commencee || restantes === 0}
          className={`mt-6 flex h-[52px] w-full items-center justify-center gap-1.5 rounded-xl text-base font-bold transition-opacity ${
            commencee || restantes === 0 ? BOUTON_GRIS : 'bg-accent text-white hover:opacity-90 disabled:opacity-50'
          }`}
        >
          {commencee ? (
            'Déjà commencé'
          ) : restantes === 0 ? (
            'Complet'
          ) : (
            <>
              Je viens {quand} · 1 <IconeAdn size={18} />
            </>
          )}
        </button>
      )}
    </div>
  )
}

function CarteCompacte({ session, isAdmin, busy, onBasculer, onOuvrir }: CarteProps) {
  const restantes = placesRestantes(session)

  return (
    <div
      {...propsCliquable(onOuvrir)}
      className={`flex items-center gap-3 rounded-[14px] border border-[#ECECEF] bg-white p-4 ${
        onOuvrir ? 'cursor-pointer hover:border-accent/40 transition-colors' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-wide text-[#8A8B9B]">{libelleJourLong(jourParis(session.debut))}</p>
        <p className="font-bold">
          {formatHeure(session.debut)}
          {restantes > 0 && ` · ${restantes} place${restantes > 1 ? 's' : ''}`}
        </p>
      </div>

      {isAdmin ? (
        <span className="shrink-0 text-sm font-bold text-accent">
          {session.nb_inscrits} inscrit{session.nb_inscrits > 1 ? 's' : ''}
        </span>
      ) : session.inscrit ? (
        <div className="flex shrink-0 flex-col items-end">
          <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-bold text-success">Inscrit</span>
          <button
            type="button"
            onClick={onBasculer}
            disabled={busy}
            className="py-1 text-xs text-[#8A8B9B] underline hover:text-[#5A5C6E] disabled:opacity-50 transition-colors"
          >
            Se désinscrire
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onBasculer}
          disabled={busy || restantes === 0}
          className={`flex h-11 shrink-0 items-center gap-1 rounded-xl px-4 text-sm font-bold transition-colors ${
            restantes === 0 ? BOUTON_GRIS : 'border border-accent text-accent hover:bg-[#F3EEFD] disabled:opacity-50'
          }`}
        >
          {restantes === 0 ? (
            'Complet'
          ) : (
            <>
              Je viens · 1 <IconeAdn size={15} />
            </>
          )}
        </button>
      )}

      <Avatar url={session.animateur_avatar_url} pseudo={session.animateur_nom} size={32} className="shrink-0" fallbackClassName={AVATAR_VIOLET} />
    </div>
  )
}
