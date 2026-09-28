'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { createClient } from '@/lib/supabase/client'
import RapportCard from '@/app/profil/RapportCard'
import { HEURES_ENVOI, JOURS_SEMAINE } from '@/lib/agora/planning'
import { getRapportHebdoAction } from './agoraActions'
import { envoyerRapportWhatsAppAction } from './whatsappActions'

// ── Types ────────────────────────────────────────────────────────────────────

export type EleveAgora = {
  id: string
  pseudo: string | null
  prenom: string | null
  nom: string | null
  is_fake: boolean
}

interface ReferentEntry {
  linkId: string    // referent_eleve.id
  id: string        // referent.id
  prenom: string
  nom: string
  telephone: string
  mode: 'whatsapp' | 'sms'
}
type ReferentsMap = Record<string, ReferentEntry[]>

interface RapportRow {
  id: string
  eleve_id: string
  mois: string // date du lundi de la semaine du rapport (colonne conservée telle quelle, dette technique)
  problemes_travailles: number
  problemes_travailles_prev: number
  minutes_concentration: number
  minutes_concentration_prev: number
  taux_reussite: number
  taux_reussite_prev: number
  problemes_reussis: number
  note: string | null
  image_path: string | null
  envoye_le: string | null
}

interface Reglage {
  jour_semaine: number
  heure: string // 'HH:MM'
  actif: boolean
  dernier_envoi_auto: string | null
}

interface HistoriqueEntry {
  cle: string
  date: string
  semaine: string
  suiveur: string
  canal: 'whatsapp' | 'sms' | null
  declenchement: 'manuel' | 'auto' | null
  statut: 'succes' | 'echec'
  erreur: string | null
}

type StatutEnvoi = 'envoye' | 'erreur' | 'attente'

interface Props {
  eleves: EleveAgora[]
}

// ── Helpers semaine ─────────────────────────────────────────────────────────

/** Lundi ISO (YYYY-MM-DD) de la semaine précédant la semaine en cours. */
function defaultLundi(): string {
  const now = new Date()
  const jour = now.getDay() // 0=dim..6=sam
  const diffAuLundi = jour === 0 ? -6 : 1 - jour
  const lundiCourant = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffAuLundi)
  const lundiPrecedent = new Date(lundiCourant.getFullYear(), lundiCourant.getMonth(), lundiCourant.getDate() - 7)
  return toISODate(lundiPrecedent)
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftSemaine(lundi: string, deltaSemaines: number): string {
  const [y, m, d] = lundi.split('-').map(Number)
  return toISODate(new Date(y, m - 1, d + deltaSemaines * 7))
}

function formatSemaineCourt(lundi: string): string {
  const [, m, d] = lundi.split('-').map(Number)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

function formatSemaineLabel(lundi: string): string {
  return `Semaine du ${formatSemaineCourt(lundi)}`
}

function referentLabel(r: { prenom?: string | null; nom?: string | null }): string {
  return [r.prenom, r.nom].filter(Boolean).join(' ') || '—'
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits.slice(1)
  if (digits.startsWith('0')) return '33' + digits.slice(1)
  return digits
}

function nomEleve(e: EleveAgora): string {
  const fullName = `${e.prenom ?? ''} ${e.nom ?? ''}`.trim()
  return fullName || e.pseudo || '—'
}

// Relation Supabase embarquée : objet ou tableau selon l'inférence
function premier<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined)
}

// Table absente = migration 20260928_agora_envoi_auto.sql pas encore appliquée
function tableAbsente(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? ''))
}

const STATUTS: Record<StatutEnvoi, { label: string; color: string; background: string }> = {
  envoye: { label: 'Envoyé', color: '#15803d', background: '#dcfce7' },
  erreur: { label: 'Erreur', color: '#b91c1c', background: '#fee2e2' },
  attente: { label: 'En attente', color: '#6b7280', background: '#f3f4f6' },
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function AgoraAdminView({ eleves }: Props) {
  const supabase = createClient()

  const [lundi, setLundi] = useState(defaultLundi())

  const [referentsMap, setReferentsMap] = useState<ReferentsMap>({})
  const [rapports, setRapports] = useState<Record<string, RapportRow>>({})
  const [envoisMap, setEnvoisMap] = useState<Record<string, number>>({}) // rapport_mensuel.id → n envois réussis
  const [derniersEnvois, setDerniersEnvois] = useState<Record<string, 'succes' | 'echec'>>({}) // rapport_mensuel.id → dernière tentative
  const [loadingTable, setLoadingTable] = useState(true)
  const [migrationManquante, setMigrationManquante] = useState(false)

  // Réglage global de l'envoi automatique
  const [reglage, setReglage] = useState<Reglage | null>(null)
  const [reglageSaving, setReglageSaving] = useState(false)
  const [reglageMessage, setReglageMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  // Panneau latéral
  const [panneau, setPanneau] = useState<{ eleveId: string; pseudo: string } | null>(null)
  const [panneauRapport, setPanneauRapport] = useState<RapportRow | null>(null)
  const [panneauLoading, setPanneauLoading] = useState(false)
  const [note, setNote] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  // État d'envoi WhatsApp par suiveur (referent.id)
  const [envois, setEnvois] = useState<Record<string, { statut: 'envoi' | 'ok' | 'erreur'; message?: string }>>({})
  const [historique, setHistorique] = useState<HistoriqueEntry[]>([])
  const [historiqueLoading, setHistoriqueLoading] = useState(false)

  // Formulaire ajout suiveur (dans le panneau)
  const [openFormEleveId, setOpenFormEleveId] = useState<string | null>(null)
  const [formPrenom, setFormPrenom] = useState('')
  const [formNom, setFormNom] = useState('')
  const [formTelephone, setFormTelephone] = useState('')
  const [formMode, setFormMode] = useState<'whatsapp' | 'sms'>('whatsapp')
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)

  // ── Chargement données ─────────────────────────────────────────────────────

  const charger = useCallback(async () => {
    setLoadingTable(true)
    const [{ data: refRows }, { data: rapportRows }] = await Promise.all([
      supabase
        .from('referent_eleve')
        .select('id, eleve_id, referent(id, prenom, nom, telephone, mode)')
        .eq('actif', true),
      supabase.from('rapport_mensuel').select('*').eq('mois', lundi),
    ])

    const map: ReferentsMap = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (refRows ?? []) as any[]) {
      if (!r.referent) continue
      if (!map[r.eleve_id]) map[r.eleve_id] = []
      map[r.eleve_id].push({
        linkId: r.id,
        id: r.referent.id,
        prenom: r.referent.prenom ?? '',
        nom: r.referent.nom ?? '',
        telephone: r.referent.telephone,
        mode: (r.referent.mode ?? 'whatsapp') as 'whatsapp' | 'sms',
      })
    }
    setReferentsMap(map)

    const rMap: Record<string, RapportRow> = {}
    for (const r of (rapportRows ?? []) as RapportRow[]) rMap[r.eleve_id] = r
    setRapports(rMap)

    // Compteurs d'envois réussis + dernière tentative (journal) par rapport_mensuel.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rapportIds = (rapportRows ?? []).map((r: any) => r.id).filter(Boolean) as string[]
    if (rapportIds.length > 0) {
      const [{ data: envoisRows }, { data: logRows, error: logError }] = await Promise.all([
        supabase.from('rapport_envoi').select('rapport_id').in('rapport_id', rapportIds),
        supabase
          .from('rapport_envoi_log')
          .select('rapport_id, statut, created_at')
          .in('rapport_id', rapportIds)
          .order('created_at', { ascending: false }),
      ])
      const eMap: Record<string, number> = {}
      for (const e of (envoisRows ?? []) as { rapport_id: string }[]) {
        eMap[e.rapport_id] = (eMap[e.rapport_id] ?? 0) + 1
      }
      setEnvoisMap(eMap)

      if (tableAbsente(logError)) setMigrationManquante(true)
      const dMap: Record<string, 'succes' | 'echec'> = {}
      for (const l of (logRows ?? []) as { rapport_id: string; statut: 'succes' | 'echec' }[]) {
        if (!dMap[l.rapport_id]) dMap[l.rapport_id] = l.statut // trié du plus récent au plus ancien
      }
      setDerniersEnvois(dMap)
    } else {
      setEnvoisMap({})
      setDerniersEnvois({})
    }
    setLoadingTable(false)
  }, [lundi])

  useEffect(() => {
    charger()
  }, [charger])

  // Réglage global (une seule ligne)
  useEffect(() => {
    supabase
      .from('agora_settings')
      .select('jour_semaine, heure, actif, dernier_envoi_auto')
      .eq('id', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (tableAbsente(error)) {
          setMigrationManquante(true)
          return
        }
        if (data) setReglage({ ...data, heure: String(data.heure).slice(0, 5) } as Reglage)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fermer le panneau et le formulaire si on change de semaine
  useEffect(() => {
    setPanneau(null)
    setPanneauRapport(null)
    setNote('')
    setOpenFormEleveId(null)
    setFormError(null)
  }, [lundi])

  async function sauvegarderReglage() {
    if (!reglage) return
    setReglageSaving(true)
    setReglageMessage(null)
    const { error } = await supabase
      .from('agora_settings')
      .update({
        jour_semaine: reglage.jour_semaine,
        heure: reglage.heure,
        actif: reglage.actif,
        updated_at: new Date().toISOString(),
      })
      .eq('id', true)
    setReglageMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: 'Réglage enregistré.' })
    setReglageSaving(false)
  }

  // ── Historique des envois d'un élève (journal + anciens envois de rapport_envoi) ──

  const chargerHistorique = useCallback(async (eleveId: string) => {
    setHistoriqueLoading(true)
    const [{ data: logs, error: logError }, { data: anciens }] = await Promise.all([
      supabase
        .from('rapport_envoi_log')
        .select('id, rapport_id, referent_id, statut, erreur, canal, declenchement, created_at, referent(prenom, nom), rapport_mensuel!inner(mois, eleve_id)')
        .eq('rapport_mensuel.eleve_id', eleveId)
        .order('created_at', { ascending: false }),
      supabase
        .from('rapport_envoi')
        .select('rapport_id, referent_id, envoye_le, referent(prenom, nom), rapport_mensuel!inner(mois, eleve_id)')
        .eq('rapport_mensuel.eleve_id', eleveId),
    ])
    if (tableAbsente(logError)) setMigrationManquante(true)

    const entrees: HistoriqueEntry[] = []
    const succesJournalises = new Set<string>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const l of (logs ?? []) as any[]) {
      if (l.statut === 'succes') succesJournalises.add(`${l.rapport_id}|${l.referent_id}`)
      entrees.push({
        cle: l.id,
        date: l.created_at,
        semaine: premier(l.rapport_mensuel)?.mois ?? '',
        suiveur: l.referent_id ? referentLabel(premier(l.referent) ?? {}) : 'Suiveur supprimé',
        canal: l.canal,
        declenchement: l.declenchement,
        statut: l.statut,
        erreur: l.erreur,
      })
    }
    // Envois réussis antérieurs au journal : seulement dans rapport_envoi
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of (anciens ?? []) as any[]) {
      if (succesJournalises.has(`${a.rapport_id}|${a.referent_id}`)) continue
      entrees.push({
        cle: `ancien-${a.rapport_id}-${a.referent_id}`,
        date: a.envoye_le,
        semaine: premier(a.rapport_mensuel)?.mois ?? '',
        suiveur: referentLabel(premier(a.referent) ?? {}),
        canal: null,
        declenchement: null,
        statut: 'succes',
        erreur: null,
      })
    }
    entrees.sort((x, y) => y.date.localeCompare(x.date))
    setHistorique(entrees)
    setHistoriqueLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Gestion suiveurs ───────────────────────────────────────────────────────

  function ouvrirForm(eleveId: string) {
    setOpenFormEleveId(eleveId)
    setFormPrenom('')
    setFormNom('')
    setFormTelephone('')
    setFormMode('whatsapp')
    setFormError(null)
  }

  function fermerForm() {
    setOpenFormEleveId(null)
    setFormPrenom('')
    setFormNom('')
    setFormTelephone('')
    setFormMode('whatsapp')
    setFormError(null)
  }

  // Désactive le rattachement (referent_eleve.actif = false) : l'historique est conservé
  async function handleRetirer(eleveId: string, linkId: string) {
    await supabase.from('referent_eleve').update({ actif: false }).eq('id', linkId)
    setReferentsMap((prev) => ({
      ...prev,
      [eleveId]: (prev[eleveId] ?? []).filter((r) => r.linkId !== linkId),
    }))
  }

  async function handleAjouter(eleveId: string) {
    if (!formNom.trim() || !formTelephone.trim()) {
      setFormError('Nom et téléphone requis.')
      return
    }
    setFormSaving(true)
    setFormError(null)

    const { data: ref, error: e1 } = await supabase
      .from('referent')
      .insert({
        prenom: formPrenom.trim() || null,
        nom: formNom.trim(),
        telephone: normalizePhone(formTelephone.trim()),
        mode: formMode,
      })
      .select('id')
      .single()

    if (e1 || !ref) {
      setFormError(e1?.message ?? 'Erreur lors de la création du suiveur.')
      setFormSaving(false)
      return
    }

    const { error: e2 } = await supabase
      .from('referent_eleve')
      .insert({ referent_id: ref.id, eleve_id: eleveId, actif: true })

    if (e2) {
      setFormError(e2.message)
      setFormSaving(false)
      return
    }

    // Recharger les suiveurs de cet élève uniquement
    const { data: rows } = await supabase
      .from('referent_eleve')
      .select('id, referent(id, prenom, nom, telephone, mode)')
      .eq('eleve_id', eleveId)
      .eq('actif', true)

    setReferentsMap((prev) => ({
      ...prev,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [eleveId]: (rows ?? []).map((r: any) => ({
        linkId: r.id,
        id: r.referent.id,
        prenom: r.referent.prenom ?? '',
        nom: r.referent.nom ?? '',
        telephone: r.referent.telephone,
        mode: (r.referent.mode ?? 'whatsapp') as 'whatsapp' | 'sms',
      })),
    }))

    fermerForm()
    setFormSaving(false)
  }

  // ── Panneau ────────────────────────────────────────────────────────────────

  async function ouvrirPanneau(eleveId: string, pseudo: string) {
    setPanneau({ eleveId, pseudo })
    setPanneauLoading(true)
    setGenerateError(null)
    setEnvois({})
    setHistorique([])
    fermerForm()
    chargerHistorique(eleveId)

    let rapport = rapports[eleveId] ?? null

    if (!rapport) {
      const stats = await getRapportHebdoAction(eleveId, lundi)

      const newRowData = {
        eleve_id: eleveId,
        mois: lundi,
        problemes_travailles: stats.problemesTravailles,
        problemes_travailles_prev: stats.problemesTravaillesPrev,
        minutes_concentration: stats.minutesConcentration,
        minutes_concentration_prev: stats.minutesConcentrationPrev,
        taux_reussite: stats.tauxReussite,
        taux_reussite_prev: stats.tauxReussitePrev,
        problemes_reussis: stats.problemesReussis,
        note: null,
        image_path: null,
        envoye_le: null,
      }

      const { data: inserted } = await supabase
        .from('rapport_mensuel')
        .insert(newRowData)
        .select()
        .single()
      rapport = inserted as RapportRow
      setRapports((prev) => ({ ...prev, [eleveId]: rapport! }))
    }

    setPanneauRapport(rapport)
    setNote(rapport.note ?? '')
    setPanneauLoading(false)
  }

  function fermerPanneau() {
    setPanneau(null)
    setPanneauRapport(null)
    setNote('')
    setGenerateError(null)
    setEnvois({})
    setHistorique([])
    fermerForm()
  }

  async function sauvegarderNote() {
    if (!panneau || !panneauRapport) return
    setNoteSaving(true)
    await supabase
      .from('rapport_mensuel')
      .update({ note: note || null })
      .eq('eleve_id', panneau.eleveId)
      .eq('mois', lundi)
    const updated = { ...panneauRapport, note: note || null }
    setPanneauRapport(updated)
    setRapports((prev) => ({ ...prev, [panneau.eleveId]: updated }))
    setNoteSaving(false)
  }

  async function genererPng() {
    if (!cardRef.current || !panneau || !panneauRapport) return
    setGenerating(true)
    setGenerateError(null)

    try {
      await document.fonts.ready
      await new Promise<void>((r) => setTimeout(r, 300))
      const opts = {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#FAFAFA',
      }
      // 1ère passe ignorée — force le navigateur à terminer le layout/paint
      await toPng(cardRef.current, opts)
      // 2ème passe — résultat final
      const png = await toPng(cardRef.current, opts)

      const blob = await (await fetch(png)).blob()
      // Réutiliser le nom existant pour éviter les fichiers orphelins
      const path = panneauRapport.image_path
        ?? `progression_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.png`

      const { error: upErr } = await supabase.storage
        .from('rapports')
        .upload(path, blob, { upsert: true, contentType: 'image/png', cacheControl: '0' })

      if (upErr) throw new Error(upErr.message)

      await supabase
        .from('rapport_mensuel')
        .update({ image_path: path })
        .eq('eleve_id', panneau.eleveId)
        .eq('mois', lundi)

      const updated = { ...panneauRapport, image_path: path }
      setPanneauRapport(updated)
      setRapports((prev) => ({ ...prev, [panneau.eleveId]: updated }))
    } catch (err) {
      setGenerateError(String(err))
    }
    setGenerating(false)
  }

  async function envoyer(ref: ReferentEntry) {
    if (!panneau || !panneauRapport?.image_path) return
    const eleveId = panneau.eleveId
    const rapport = panneauRapport

    if (ref.mode === 'sms') {
      // SMS : inchangé, ouverture de l'application SMS avec le message pré-rempli
      const { data: publicData } = supabase.storage
        .from('rapports')
        .getPublicUrl(rapport.image_path!)
      const url = `${publicData.publicUrl}?v=${Date.now()}`
      const msg = `Bonjour, voici le rapport hebdomadaire de ${panneau.pseudo} pour la ${formatSemaineLabel(lundi).toLowerCase()} sur Monstro : ${url}`
      window.open(`sms:+${ref.telephone}?&body=${encodeURIComponent(msg)}`, '_blank')

      // Suivi côté client (le WhatsApp est suivi par le serveur)
      const envoye_le = new Date().toISOString()
      await supabase.from('rapport_mensuel').update({ envoye_le }).eq('id', rapport.id)
      await supabase
        .from('rapport_envoi')
        .upsert({ rapport_id: rapport.id, referent_id: ref.id, envoye_le }, { onConflict: 'rapport_id,referent_id' })
      await supabase.from('rapport_envoi_log').insert({
        rapport_id: rapport.id,
        referent_id: ref.id,
        canal: 'sms',
        declenchement: 'manuel',
        statut: 'succes',
      })
    } else {
      // WhatsApp : envoi via Twilio (Server Action) ; journal, rapport_envoi et envoye_le mis à jour côté serveur
      setEnvois((prev) => ({ ...prev, [ref.id]: { statut: 'envoi' } }))
      const res = await envoyerRapportWhatsAppAction(rapport.id, ref.id).catch(() => ({
        ok: false as const,
        erreur: 'Impossible de joindre le serveur : vérifie la connexion et réessaie.',
      }))
      setDerniersEnvois((prev) => ({ ...prev, [rapport.id]: res.ok ? 'succes' : 'echec' }))
      chargerHistorique(eleveId)
      if (!res.ok) {
        setEnvois((prev) => ({ ...prev, [ref.id]: { statut: 'erreur', message: res.erreur } }))
        return
      }
      setEnvois((prev) => ({ ...prev, [ref.id]: { statut: 'ok', message: 'Message accepté par Twilio.' } }))
    }

    if (ref.mode === 'sms') {
      setDerniersEnvois((prev) => ({ ...prev, [rapport.id]: 'succes' }))
      chargerHistorique(eleveId)
    }

    // Rafraîchir le compteur pour ce rapport
    const { count } = await supabase
      .from('rapport_envoi')
      .select('*', { count: 'exact', head: true })
      .eq('rapport_id', rapport.id)
    setEnvoisMap((prev) => ({ ...prev, [rapport.id]: count ?? 0 }))

    const updated = { ...rapport, envoye_le: new Date().toISOString() }
    setPanneauRapport(updated)
    setRapports((prev) => ({ ...prev, [eleveId]: updated }))
  }

  // ── Utils affichage ────────────────────────────────────────────────────────

  const profiles = eleves.filter((p) => !p.is_fake)

  function statutEnvoi(r: RapportRow | undefined): StatutEnvoi {
    if (!r) return 'attente'
    const dernier = derniersEnvois[r.id]
    if (dernier === 'echec') return 'erreur'
    if (dernier === 'succes' || (envoisMap[r.id] ?? 0) > 0) return 'envoye'
    return 'attente'
  }

  const panRefs = panneau ? (referentsMap[panneau.eleveId] ?? []) : []

  const inputStyle: React.CSSProperties = {
    fontSize: 13,
    borderRadius: 8,
    border: '1px solid #d1d5db',
    padding: '6px 9px',
    color: '#111827',
    background: '#fff',
    outline: 'none',
    minWidth: 0,
    flex: 1,
  }

  const navBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 600,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  }

  const sectionTitreStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: 0,
  }

  const heuresProposees = reglage && !HEURES_ENVOI.includes(reglage.heure) ? [reglage.heure, ...HEURES_ENVOI] : HEURES_ENVOI

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {migrationManquante && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 10,
            background: '#fef3c7',
            color: '#92400e',
            fontSize: 13,
          }}
        >
          Tables <code>agora_settings</code> / <code>rapport_envoi_log</code> absentes : exécuter la migration{' '}
          <code>supabase/migrations/20260928_agora_envoi_auto.sql</code> dans l&apos;éditeur SQL Supabase.
        </div>
      )}

      {/* Réglage global de l'envoi automatique */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          marginBottom: 20,
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          background: '#fff',
          fontSize: 13,
        }}
      >
        <span style={{ fontWeight: 700, color: '#111827' }}>Envoi automatique</span>
        {reglage ? (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#374151' }}>
              <input
                type="checkbox"
                checked={reglage.actif}
                onChange={(e) => setReglage({ ...reglage, actif: e.target.checked })}
              />
              Activé
            </label>
            <select
              value={reglage.jour_semaine}
              onChange={(e) => setReglage({ ...reglage, jour_semaine: Number(e.target.value) })}
              aria-label="Jour d'envoi"
              style={{ ...inputStyle, flex: '0 0 auto' }}
            >
              {JOURS_SEMAINE.map((jour, i) => (
                <option key={jour} value={i + 1}>{jour}</option>
              ))}
            </select>
            <select
              value={reglage.heure}
              onChange={(e) => setReglage({ ...reglage, heure: e.target.value })}
              aria-label="Heure d'envoi"
              style={{ ...inputStyle, flex: '0 0 auto' }}
            >
              {heuresProposees.map((h) => (
                <option key={h} value={h}>{h.replace(':', 'h')}</option>
              ))}
            </select>
            <button
              onClick={sauvegarderReglage}
              disabled={reglageSaving}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: reglageSaving ? '#9ca3af' : '#111827',
                color: '#fff',
                cursor: reglageSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {reglageSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <span style={{ color: '#9ca3af', fontSize: 12 }}>
              Heure de Paris · rapport de la semaine précédente · dernier envoi auto :{' '}
              {reglage.dernier_envoi_auto ? formatSemaineLabel(reglage.dernier_envoi_auto).toLowerCase() : 'jamais'}
            </span>
            {reglageMessage && (
              <span style={{ fontSize: 12, color: reglageMessage.ok ? '#16a34a' : '#dc2626' }}>{reglageMessage.texte}</span>
            )}
          </>
        ) : (
          <span style={{ color: '#9ca3af' }}>{migrationManquante ? 'Indisponible (migration à appliquer).' : 'Chargement…'}</span>
        )}
      </div>

      {/* Sélecteur de semaine */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => setLundi((l) => shiftSemaine(l, -1))} style={navBtnStyle} aria-label="Semaine précédente">
          ‹
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', minWidth: 150, textAlign: 'center' }}>
          {formatSemaineLabel(lundi)}
        </span>
        <button onClick={() => setLundi((l) => shiftSemaine(l, 1))} style={navBtnStyle} aria-label="Semaine suivante">
          ›
        </button>
      </div>

      {/* Grille de cartes élèves */}
      {loadingTable ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Chargement…</div>
      ) : profiles.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun élève.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {profiles.map((profile) => {
            const rapport = rapports[profile.id]
            const statut = STATUTS[statutEnvoi(rapport)]
            const nReferents = (referentsMap[profile.id] ?? []).length
            const nEnvoyes = rapport?.id ? (envoisMap[rapport.id] ?? 0) : 0
            const isOpen = panneau?.eleveId === profile.id
            return (
              <button
                key={profile.id}
                onClick={() => ouvrirPanneau(profile.id, profile.pseudo ?? nomEleve(profile))}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: `1px solid ${isOpen ? '#6D28D9' : '#e5e7eb'}`,
                  background: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{nomEleve(profile)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 999,
                      color: statut.color,
                      background: statut.background,
                    }}
                  >
                    {statut.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    {nReferents === 0 ? 'Aucun suiveur' : `${nEnvoyes}/${nReferents} suiveur${nReferents > 1 ? 's' : ''}`}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Panneau latéral (drawer fixe) */}
      {panneau && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={fermerPanneau}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }}
          />

          {/* Panneau */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: 520,
              maxWidth: '100vw',
              height: '100vh',
              background: '#fff',
              overflowY: 'auto',
              padding: '24px 24px 60px',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            }}
          >
            {/* En-tête */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                  {panneau.pseudo}
                </h2>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>
                  Rapport {formatSemaineLabel(lundi)}
                </p>
              </div>
              <button
                onClick={fermerPanneau}
                aria-label="Fermer"
                style={{
                  fontSize: 22,
                  color: '#9ca3af',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>

            {/* ── Rapport de la semaine ── */}
            {panneauLoading ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>
                Chargement…
              </div>
            ) : panneauRapport ? (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <RapportCard
                  problemesTravailles={panneauRapport.problemes_travailles}
                  problemesTravaillesPrev={panneauRapport.problemes_travailles_prev}
                  minutesConcentration={panneauRapport.minutes_concentration}
                  minutesConcentrationPrev={panneauRapport.minutes_concentration_prev}
                  tauxReussite={panneauRapport.taux_reussite}
                  tauxReussitePrev={panneauRapport.taux_reussite_prev}
                  problemesReussis={panneauRapport.problemes_reussis}
                  lundi={lundi}
                />

                {/* Note */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={sectionTitreStyle}>Note</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Ajouter une note…"
                    style={{
                      fontSize: 14,
                      color: '#111827',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      padding: '10px 12px',
                      resize: 'vertical',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    onClick={sauvegarderNote}
                    disabled={noteSaving}
                    style={{
                      alignSelf: 'flex-end',
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      background: '#fff',
                      color: '#374151',
                      cursor: noteSaving ? 'not-allowed' : 'pointer',
                      opacity: noteSaving ? 0.5 : 1,
                    }}
                  >
                    {noteSaving ? 'Sauvegarde…' : 'Sauvegarder'}
                  </button>
                </div>

                {/* Générer PNG */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    onClick={genererPng}
                    disabled={generating}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      padding: '10px 0',
                      borderRadius: 10,
                      border: 'none',
                      background: generating ? '#9ca3af' : '#111827',
                      color: '#fff',
                      cursor: generating ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {generating
                      ? 'Génération en cours…'
                      : panneauRapport.image_path
                        ? '↻ Regénérer le PNG'
                        : 'Générer le PNG'}
                  </button>
                  {generateError && (
                    <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{generateError}</p>
                  )}
                  {panneauRapport.image_path && !generateError && (
                    <p style={{ fontSize: 12, color: '#16a34a', margin: 0 }}>✓ Image enregistrée</p>
                  )}
                </div>

                {/* Envoi par suiveur (WhatsApp via Twilio, SMS via l'application) */}
                {panRefs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={sectionTitreStyle}>
                      Envoyer le rapport ({panRefs.length} suiveur{panRefs.length > 1 ? 's' : ''})
                    </p>

                    {panRefs.map((ref) => {
                      const hasImage = !!panneauRapport.image_path
                      const isWA = ref.mode !== 'sms'
                      const envoi = envois[ref.id]
                      const enCours = envoi?.statut === 'envoi'
                      return (
                        <div key={ref.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              background: '#f9fafb',
                              borderRadius: 10,
                              gap: 10,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                                {referentLabel(ref)}
                              </div>
                              <div style={{ fontSize: 12, color: '#9ca3af' }}>{ref.telephone}</div>
                            </div>

                            <button
                              onClick={() => envoyer(ref)}
                              disabled={!hasImage || enCours}
                              title={!hasImage ? "Générer le PNG d'abord" : undefined}
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                padding: '7px 14px',
                                borderRadius: 8,
                                border: 'none',
                                cursor: !hasImage ? 'not-allowed' : enCours ? 'wait' : 'pointer',
                                opacity: enCours ? 0.6 : 1,
                                flexShrink: 0,
                                background: !hasImage ? '#e5e7eb' : isWA ? '#25D366' : '#3b82f6',
                                color: hasImage ? '#fff' : '#9ca3af',
                              }}
                            >
                              {enCours ? 'Envoi…' : isWA ? 'Envoyer (WhatsApp)' : 'Envoyer (SMS)'}
                            </button>
                          </div>
                          {envoi && envoi.statut !== 'envoi' && (
                            <p
                              role={envoi.statut === 'erreur' ? 'alert' : 'status'}
                              style={{
                                fontSize: 12,
                                margin: 0,
                                padding: '0 14px',
                                color: envoi.statut === 'ok' ? '#16a34a' : '#dc2626',
                              }}
                            >
                              {envoi.statut === 'ok' ? '✓ ' : '✗ '}
                              {envoi.message}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {/* ── Suiveurs ── */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={sectionTitreStyle}>Suiveurs</p>
              {panRefs.length === 0 && (
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Aucun suiveur actif.</p>
              )}
              {panRefs.map((r) => (
                <div
                  key={r.linkId}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}
                >
                  <span style={{ fontWeight: 600 }}>{referentLabel(r)}</span>
                  <span style={{ color: '#9ca3af' }}>{r.telephone}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: r.mode === 'sms' ? '#dbeafe' : '#dcfce7',
                      color: r.mode === 'sms' ? '#1d4ed8' : '#15803d',
                    }}
                  >
                    {r.mode === 'sms' ? 'SMS' : 'WA'}
                  </span>
                  <button
                    onClick={() => handleRetirer(panneau.eleveId, r.linkId)}
                    title="Retirer ce suiveur (désactivé, historique conservé)"
                    style={{
                      marginLeft: 'auto',
                      fontSize: 12,
                      color: '#6b7280',
                      background: 'none',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '2px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    Retirer
                  </button>
                </div>
              ))}

              {openFormEleveId === panneau.eleveId ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="text" placeholder="Prénom" value={formPrenom} onChange={(e) => setFormPrenom(e.target.value)} style={inputStyle} />
                    <input type="text" placeholder="Nom *" value={formNom} onChange={(e) => setFormNom(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="tel"
                      placeholder="33698815992 — format international sans +"
                      value={formTelephone}
                      onChange={(e) => setFormTelephone(e.target.value)}
                      style={inputStyle}
                    />
                    <select
                      value={formMode}
                      onChange={(e) => setFormMode(e.target.value as 'whatsapp' | 'sms')}
                      style={{ ...inputStyle, flex: '0 0 auto' }}
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                    </select>
                  </div>
                  {formError && <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{formError}</p>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleAjouter(panneau.eleveId)}
                      disabled={formSaving}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: formSaving ? '#9ca3af' : '#111827',
                        color: '#fff',
                        cursor: formSaving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {formSaving ? '…' : 'Valider'}
                    </button>
                    <button
                      onClick={fermerForm}
                      disabled={formSaving}
                      style={{
                        fontSize: 13,
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        color: '#6b7280',
                        cursor: 'pointer',
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => ouvrirForm(panneau.eleveId)}
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: 12,
                    color: '#6b7280',
                    background: 'none',
                    border: '1px dashed #d1d5db',
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer',
                  }}
                >
                  + Ajouter un suiveur
                </button>
              )}
            </section>

            {/* ── Historique des envois ── */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={sectionTitreStyle}>Historique des envois</p>
              {historiqueLoading ? (
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Chargement…</p>
              ) : historique.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Aucun envoi pour le moment.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {historique.map((h) => (
                    <li
                      key={h.cle}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: h.statut === 'echec' ? '#fef2f2' : '#f9fafb',
                        fontSize: 12,
                        color: '#374151',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: h.statut === 'succes' ? '#16a34a' : '#dc2626' }}>
                          {h.statut === 'succes' ? '✓ Succès' : '✗ Échec'}
                        </span>
                        <span style={{ fontWeight: 600 }}>{h.suiveur}</span>
                        <span style={{ color: '#9ca3af' }}>
                          {new Date(h.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        {h.semaine && <span style={{ color: '#9ca3af' }}>· {formatSemaineLabel(h.semaine).toLowerCase()}</span>}
                        <span style={{ color: '#9ca3af' }}>
                          · {h.canal === 'sms' ? 'SMS' : h.canal === 'whatsapp' ? 'WhatsApp' : 'antérieur au journal'}
                          {h.declenchement === 'auto' ? ' (auto)' : ''}
                        </span>
                      </div>
                      {h.erreur && <p style={{ margin: '4px 0 0', color: '#b91c1c' }}>{h.erreur}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Div hors-écran pour capture PNG : simple conteneur de positionnement, pas de taille imposée */}
      {panneauRapport && (
        <div style={{ position: 'fixed', left: -10000, top: 0 }}>
          <RapportCard
            ref={cardRef}
            problemesTravailles={panneauRapport.problemes_travailles}
            problemesTravaillesPrev={panneauRapport.problemes_travailles_prev}
            minutesConcentration={panneauRapport.minutes_concentration}
            minutesConcentrationPrev={panneauRapport.minutes_concentration_prev}
            tauxReussite={panneauRapport.taux_reussite}
            tauxReussitePrev={panneauRapport.taux_reussite_prev}
            problemesReussis={panneauRapport.problemes_reussis}
            lundi={lundi}
            captureWidth={1080}
          />
        </div>
      )}
    </div>
  )
}
