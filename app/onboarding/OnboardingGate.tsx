'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PUBLIC_PATHS, hasAppAccess, isVitrine } from '@/lib/access'
import { FocusModal } from './FocusEtape'
import { FOCUS_CHANGE_EVENT, chargerCategoriesEnFocus, etapeFocusValidee, type CategoriesFocus } from './focus'
import { SCRIPT1_OUVERT_EVENT, markCharteAcceptee, markFocusValide, markInvitationScript1Vue } from './profileWrites'
import { CHARTE, ERREUR_ENREGISTREMENT, INVITATION_SCRIPT1 } from './texts'

type OnboardingState = {
  userId: string
  charteAcceptee: boolean
  script1Ouvert: boolean
  invitationVue: boolean
  dateNaissance: string | null
  // Étape Focus déjà validée (focus_valide_at posé) : elle ne revient plus.
  focusValide: boolean
}

// Pages où le modal de l'étape Focus ne s'affiche pas : la Bibliothèque (son
// bandeau prend le relais) et la lecture d'une feuille, pour pouvoir
// feuilleter avant de choisir.
const PAGES_SANS_MODAL_FOCUS = new Set(['/bibliotheque', '/viewer'])

// Pages publiques : rien ne s'affiche et aucune requête n'est faite.
// '/' est exclu de la liste : c'est la landing pour un visiteur (pas
// d'utilisateur → rien ne s'affiche) mais le hub de l'app pour un élève.
function isPublicPage(pathname: string): boolean {
  if (pathname === '/') return false
  return pathname === '/login' || PUBLIC_PATHS.has(pathname) || isVitrine(pathname)
}

// Monté dans app/layout.tsx. Chargement côté client pour ne pas rendre
// dynamiques les pages statiques (mentions légales, vitrine…).
export default function OnboardingGate() {
  const pathname = usePathname() ?? '/'
  const publicPage = isPublicPage(pathname)

  const [state, setState] = useState<OnboardingState | null>(null)
  const [authVersion, setAuthVersion] = useState(0)
  // Étape Focus : catégories couvertes par les feuilles en Focus. null tant
  // que la lecture n'a pas abouti (rien ne s'affiche en attendant).
  const [categories, setCategories] = useState<CategoriesFocus | null>(null)
  const [focusVersion, setFocusVersion] = useState(0)
  // "Continuer" sur l'invitation au Script 1 ne la ferme que pour la page en
  // cours : l'état est remis à zéro à chaque changement de pathname (pendant
  // le rendu, pour ne pas afficher une frame sans modal), et n'est pas
  // persisté, donc elle revient aussi à chaque chargement.
  const [invitationFermee, setInvitationFermee] = useState(false)
  const [invitationPath, setInvitationPath] = useState(pathname)
  if (invitationPath !== pathname) {
    setInvitationPath(pathname)
    setInvitationFermee(false)
  }

  // Connexion / déconnexion sans rechargement (formulaire de la landing).
  useEffect(() => {
    const supabase = createClient()
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setAuthVersion((v) => v + 1)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (publicPage) return
    let cancelled = false
    const supabase = createClient()

    async function charger() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setState(null)
        return
      }
      const { data: profile } = await supabase
        .from('user_profile')
        .select('role, plan, charte_acceptee_at, script1_ouvert_at, invitation_script1_vue_at, date_naissance, focus_valide_at')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      // Admin ou sans abonnement actif : pas d'onboarding.
      if (!profile || profile.role === 'admin' || !hasAppAccess(profile.role, profile.plan)) {
        setState(null)
        return
      }
      setState({
        userId: user.id,
        charteAcceptee: profile.charte_acceptee_at != null,
        script1Ouvert: profile.script1_ouvert_at != null,
        invitationVue: profile.invitation_script1_vue_at != null,
        dateNaissance: profile.date_naissance ?? null,
        focusValide: profile.focus_valide_at != null,
      })
    }

    charger()
    return () => {
      cancelled = true
    }
  }, [publicPage, authVersion])

  // Script 1 ouvert depuis le forum (modal 3) : l'invitation ne doit plus revenir.
  useEffect(() => {
    function onScript1Ouvert() {
      setState((prev) => (prev ? { ...prev, script1Ouvert: true } : prev))
    }
    window.addEventListener(SCRIPT1_OUVERT_EVENT, onScript1Ouvert)
    return () => window.removeEventListener(SCRIPT1_OUVERT_EVENT, onScript1Ouvert)
  }, [])

  // Étape Focus : ne concerne que l'élève qui a accepté la charte, n'a pas
  // encore ouvert le Script 1 et ne l'a pas déjà validée. Les Focus sont relus
  // à chaque changement de page et à chaque mise en Focus ou retrait dans la
  // Bibliothèque. Dès que la condition est remplie, la date est écrite (une
  // seule fois) et l'étape est acquise : retirer une feuille ne la rouvre pas.
  const userId = state?.userId ?? null
  const enEtapeFocus = state != null && state.charteAcceptee && !state.script1Ouvert && !state.focusValide
  useEffect(() => {
    function onFocusChange() {
      setFocusVersion((v) => v + 1)
    }
    window.addEventListener(FOCUS_CHANGE_EVENT, onFocusChange)
    return () => window.removeEventListener(FOCUS_CHANGE_EVENT, onFocusChange)
  }, [])
  useEffect(() => {
    if (publicPage) return
    if (!userId || !enEtapeFocus) {
      setCategories(null)
      return
    }
    let cancelled = false
    chargerCategoriesEnFocus(createClient(), userId).then((c) => {
      if (cancelled || !c) return
      setCategories(c)
      if (etapeFocusValidee(c)) {
        markFocusValide(userId)
        setState((prev) => (prev ? { ...prev, focusValide: true } : prev))
      }
    })
    return () => {
      cancelled = true
    }
  }, [publicPage, userId, enEtapeFocus, pathname, focusVersion])

  // "Continuer" du modal 2 : la fermeture ne change pas ; la date du premier
  // clic est écrite en arrière-plan, une seule fois (marquée tout de suite
  // pour qu'un second clic n'écrive pas une seconde fois).
  function fermerInvitation() {
    setInvitationFermee(true)
    if (state && !state.invitationVue) {
      setState((prev) => (prev ? { ...prev, invitationVue: true } : prev))
      markInvitationScript1Vue(state.userId)
    }
  }

  if (publicPage || !state) return null

  if (!state.charteAcceptee) {
    return (
      <CharteModal
        userId={state.userId}
        onAccepted={() => setState((prev) => (prev ? { ...prev, charteAcceptee: true } : prev))}
      />
    )
  }

  if (!state.script1Ouvert) {
    // Étape Focus, avant l'invitation au Script 1.
    if (!state.focusValide) {
      if (!categories) return null
      if (!etapeFocusValidee(categories)) {
        if (PAGES_SANS_MODAL_FOCUS.has(pathname)) return null
        return <FocusModal categories={categories} dateNaissance={state.dateNaissance} />
      }
    }
    // Étape validée dans la Bibliothèque : son bandeau propose « Continuer »
    // vers l'accueil, l'invitation n'apparaît qu'ensuite.
    if (!invitationFermee && pathname !== '/forum' && pathname !== '/bibliotheque') {
      return <InvitationScript1Modal onContinuer={fermerInvitation} />
    }
  }

  return null
}

// Overlay commun, au-dessus des modals des pages (z-50). Pas de fermeture au
// clic extérieur : l'overlay n'a pas de onClick.
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      {children}
    </div>
  )
}

// Modal 1 — bloquant : ni croix, ni clic extérieur, ni Échap.
function CharteModal({ userId, onAccepted }: { userId: string; onAccepted: () => void }) {
  const [coche, setCoche] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinuer() {
    setSaving(true)
    setError(null)
    const result = await markCharteAcceptee(userId)
    setSaving(false)
    if (!result.ok) {
      setError(ERREUR_ENREGISTREMENT)
      return
    }
    onAccepted()
  }

  return (
    <Overlay>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="charte-titre"
        className="relative z-10 w-full max-w-lg max-h-[85vh] bg-surface rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border shrink-0">
          <h2 id="charte-titre" className="font-semibold text-text-primary">{CHARTE.titre}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm text-text-primary leading-relaxed">
          {CHARTE.sections.map((section) => (
            <section key={section.intitule} className="space-y-1.5">
              <h3 className="font-bold">{section.intitule}</h3>
              {section.texte && <p>{section.texte}</p>}
              {section.liste && (
                <ul className="list-disc pl-5 space-y-1">
                  {section.liste.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-border shrink-0 space-y-3">
          <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={coche}
              onChange={(e) => setCoche(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            {CHARTE.case}
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            onClick={handleContinuer}
            disabled={!coche || saving}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Enregistrement…' : CHARTE.bouton}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// Modal 2 — invitation au Script 1. Seul "Continuer" le ferme (ni croix, ni
// clic extérieur, ni Échap).
function InvitationScript1Modal({ onContinuer }: { onContinuer: () => void }) {
  return (
    <Overlay>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invitation-titre"
        className="relative z-10 w-full max-w-md bg-surface rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        <div className="px-6 pt-5 pb-2">
          <h2 id="invitation-titre" className="font-semibold text-text-primary">{INVITATION_SCRIPT1.titre}</h2>
        </div>
        <p className="px-6 pb-5 text-sm text-text-primary leading-relaxed">{INVITATION_SCRIPT1.texte}</p>
        <div className="px-6 py-4 border-t border-border">
          <button
            onClick={onContinuer}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            {INVITATION_SCRIPT1.bouton}
          </button>
        </div>
      </div>
    </Overlay>
  )
}
