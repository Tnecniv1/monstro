'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { createClient } from '@/lib/supabase/client'
import RapportCard from '@/app/profil/RapportCard'
import type { EnrichedProfile } from './types'

// ── Types ────────────────────────────────────────────────────────────────────

interface ReferentEntry {
  linkId: string    // referent_eleve.id
  id: string        // referent.id
  prenom: string
  nom: string
  relation: string
  telephone: string
  mode: 'whatsapp' | 'sms'
}
type ReferentsMap = Record<string, ReferentEntry[]>

interface RapportRow {
  id: string
  eleve_id: string
  mois: string
  problemes_reussis: number
  minutes_concentration: number
  minutes_concentration_prev: number
  score_total: number
  score_variation: number
  feuilles_fait: number
  feuilles_en_cours: number
  feuilles_non_fait: number
  note: string | null
  image_path: string | null
  envoye_le: string | null
}

interface Props {
  enriched: EnrichedProfile[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function prevMonthStr(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function inputToMois(m: string): string {
  return `${m}-01`
}

function formatMoisLabel(mois: string): string {
  const [y, mo] = mois.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
}

function formatMoisCourt(mois: string): string {
  const [y, mo] = mois.split('-').map(Number)
  return `${String(mo).padStart(2, '0')}/${y}`
}

function referentLabel(r: ReferentEntry): string {
  return [r.prenom, r.nom].filter(Boolean).join(' ') || '—'
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits.slice(1)
  if (digits.startsWith('0')) return '33' + digits.slice(1)
  return digits
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function CommunicationView({ enriched }: Props) {
  const supabase = createClient()

  const [moisInput, setMoisInput] = useState(prevMonthStr())
  const mois = inputToMois(moisInput)

  const [referentsMap, setReferentsMap] = useState<ReferentsMap>({})
  const [rapports, setRapports] = useState<Record<string, RapportRow>>({})
  const [envoisMap, setEnvoisMap] = useState<Record<string, number>>({}) // rapport_mensuel.id → n envois
  const [loadingTable, setLoadingTable] = useState(true)

  // Panneau latéral
  const [panneau, setPanneau] = useState<{ eleveId: string; pseudo: string } | null>(null)
  const [panneauRapport, setPanneauRapport] = useState<RapportRow | null>(null)
  const [panneauLoading, setPanneauLoading] = useState(false)
  const [note, setNote] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Formulaire ajout référent (inline dans la cellule Parents)
  const [openFormEleveId, setOpenFormEleveId] = useState<string | null>(null)
  const [formPrenom, setFormPrenom] = useState('')
  const [formNom, setFormNom] = useState('')
  const [formRelation, setFormRelation] = useState<'parent' | 'prof' | 'autre'>('parent')
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
        .select('id, eleve_id, referent(id, prenom, nom, relation, telephone, mode)')
        .eq('actif', true),
      supabase.from('rapport_mensuel').select('*').eq('mois', mois),
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
        relation: r.referent.relation,
        telephone: r.referent.telephone,
        mode: (r.referent.mode ?? 'whatsapp') as 'whatsapp' | 'sms',
      })
    }
    setReferentsMap(map)

    const rMap: Record<string, RapportRow> = {}
    for (const r of (rapportRows ?? []) as RapportRow[]) rMap[r.eleve_id] = r
    setRapports(rMap)

    // Compteurs d'envoi par rapport_mensuel.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rapportIds = (rapportRows ?? []).map((r: any) => r.id).filter(Boolean) as string[]
    if (rapportIds.length > 0) {
      const { data: envoisRows } = await supabase
        .from('rapport_envoi')
        .select('rapport_id')
        .in('rapport_id', rapportIds)
      const eMap: Record<string, number> = {}
      for (const e of (envoisRows ?? []) as { rapport_id: string }[]) {
        eMap[e.rapport_id] = (eMap[e.rapport_id] ?? 0) + 1
      }
      setEnvoisMap(eMap)
    } else {
      setEnvoisMap({})
    }
    setLoadingTable(false)
  }, [mois])

  useEffect(() => {
    charger()
  }, [charger])

  // Fermer le panneau et le formulaire si on change de mois
  useEffect(() => {
    setPanneau(null)
    setPanneauRapport(null)
    setNote('')
    setOpenFormEleveId(null)
    setFormError(null)
  }, [mois])

  // ── Gestion référents (colonne Parents) ────────────────────────────────────

  function ouvrirForm(eleveId: string) {
    setOpenFormEleveId(eleveId)
    setFormPrenom('')
    setFormNom('')
    setFormRelation('parent')
    setFormTelephone('')
    setFormMode('whatsapp')
    setFormError(null)
  }

  function fermerForm() {
    setOpenFormEleveId(null)
    setFormPrenom('')
    setFormNom('')
    setFormRelation('parent')
    setFormTelephone('')
    setFormMode('whatsapp')
    setFormError(null)
  }

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
        relation: formRelation,
        telephone: normalizePhone(formTelephone.trim()),
        mode: formMode,
      })
      .select('id')
      .single()

    if (e1 || !ref) {
      setFormError(e1?.message ?? 'Erreur lors de la création du référent.')
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

    // Recharger les référents de cette ligne uniquement
    const { data: rows } = await supabase
      .from('referent_eleve')
      .select('id, referent(id, prenom, nom, relation, telephone, mode)')
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
        relation: r.referent.relation,
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

    let rapport = rapports[eleveId] ?? null

    if (!rapport) {
      const { data: rpcData } = await supabase.rpc('get_rapport_data', {
        p_eleve: eleveId,
        p_mois: mois,
      })
      const row = Array.isArray(rpcData) ? rpcData[0] : (rpcData ?? {})

      const newRowData = {
        eleve_id: eleveId,
        mois,
        problemes_reussis: (row as RapportRow)?.problemes_reussis ?? 0,
        minutes_concentration: (row as RapportRow)?.minutes_concentration ?? 0,
        minutes_concentration_prev: (row as RapportRow)?.minutes_concentration_prev ?? 0,
        score_total: (row as RapportRow)?.score_total ?? 0,
        score_variation: (row as RapportRow)?.score_variation ?? 0,
        feuilles_fait: (row as RapportRow)?.feuilles_fait ?? 0,
        feuilles_en_cours: (row as RapportRow)?.feuilles_en_cours ?? 0,
        feuilles_non_fait: (row as RapportRow)?.feuilles_non_fait ?? 0,
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
  }

  async function sauvegarderNote() {
    if (!panneau || !panneauRapport) return
    setNoteSaving(true)
    await supabase
      .from('rapport_mensuel')
      .update({ note: note || null })
      .eq('eleve_id', panneau.eleveId)
      .eq('mois', mois)
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
      console.log('[genererPng] props =', {
        problemes_reussis: panneauRapport.problemes_reussis,
        minutes_concentration: panneauRapport.minutes_concentration,
        minutes_concentration_prev: panneauRapport.minutes_concentration_prev,
        score_total: panneauRapport.score_total,
        score_variation: panneauRapport.score_variation,
        feuilles_fait: panneauRapport.feuilles_fait,
        feuilles_en_cours: panneauRapport.feuilles_en_cours,
        feuilles_non_fait: panneauRapport.feuilles_non_fait,
        note,
      })
      await document.fonts.ready
      await new Promise<void>((r) => setTimeout(r, 300))
      const opts = {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#F5F3EE',
      }
      // 1ère passe ignorée — force le navigateur à terminer le layout/paint
      await toPng(cardRef.current, opts)
      // 2ème passe — résultat final
      const png = await toPng(cardRef.current, opts)
      console.log('[genererPng] dataUrl.length =', png.length)

      const blob = await (await fetch(png)).blob()
      // Réutiliser le nom existant pour éviter les fichiers orphelins
      const path = panneauRapport.image_path
        ?? `progression_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.png`

      const { error: upErr } = await supabase.storage
        .from('rapports')
        .upload(path, blob, { upsert: true, contentType: 'image/png' })

      if (upErr) throw new Error(upErr.message)

      await supabase
        .from('rapport_mensuel')
        .update({ image_path: path })
        .eq('eleve_id', panneau.eleveId)
        .eq('mois', mois)

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

    const { data: publicData } = supabase.storage
      .from('rapports')
      .getPublicUrl(panneauRapport.image_path)

    const url = publicData.publicUrl
    const msg = `Bonjour, voici le rapport mensuel de ${panneau.pseudo} pour ${formatMoisLabel(mois)} sur Monstro : ${url}`
    const tel = ref.telephone

    if (ref.mode === 'sms') {
      window.open(`sms:+${tel}?&body=${encodeURIComponent(msg)}`, '_blank')
    } else {
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
    }

    const envoye_le = new Date().toISOString()
    await supabase
      .from('rapport_mensuel')
      .update({ envoye_le })
      .eq('eleve_id', panneau.eleveId)
      .eq('mois', mois)

    // Suivi par référent
    await supabase
      .from('rapport_envoi')
      .upsert(
        { rapport_id: panneauRapport.id, referent_id: ref.id },
        { onConflict: 'rapport_id,referent_id' },
      )

    // Rafraîchir le compteur pour ce rapport
    const { count } = await supabase
      .from('rapport_envoi')
      .select('*', { count: 'exact', head: true })
      .eq('rapport_id', panneauRapport.id)
    setEnvoisMap((prev) => ({ ...prev, [panneauRapport.id]: count ?? 0 }))

    const updated = { ...panneauRapport, envoye_le }
    setPanneauRapport(updated)
    setRapports((prev) => ({ ...prev, [panneau.eleveId]: updated }))
  }

  // ── Utils affichage ────────────────────────────────────────────────────────

  const profiles = enriched.filter((p) => !p.is_fake)

  function statutRapport(r: RapportRow | undefined): { label: string; color: string } {
    if (!r) return { label: 'À générer', color: '#9ca3af' }
    if (r.envoye_le)
      return {
        label: `Envoyé le ${new Date(r.envoye_le).toLocaleDateString('fr-FR')}`,
        color: '#16a34a',
      }
    if (r.image_path) return { label: 'Image générée', color: '#2563eb' }
    return { label: 'Données chargées', color: '#d97706' }
  }

  const panRefs = panneau ? (referentsMap[panneau.eleveId] ?? []) : []

  // Styles réutilisables pour le mini-formulaire
  const cellInputStyle: React.CSSProperties = {
    fontSize: 12,
    borderRadius: 6,
    border: '1px solid #d1d5db',
    padding: '4px 7px',
    color: '#111827',
    background: '#fff',
    outline: 'none',
    minWidth: 0,
    flex: 1,
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Sélecteur de mois */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Mois :</span>
        <input
          type="month"
          value={moisInput}
          onChange={(e) => setMoisInput(e.target.value)}
          style={{
            fontSize: 14,
            borderRadius: 8,
            border: '1px solid #d1d5db',
            padding: '6px 10px',
            color: '#111827',
            outline: 'none',
          }}
        />
      </div>

      {/* Tableau */}
      <div
        style={{
          overflowX: 'auto',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          background: '#fff',
        }}
      >
        {loadingTable ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            Chargement…
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Étudiant', 'Parents', `Rapport ${formatMoisCourt(mois)}`, 'Envoyés', ''].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: i === 4 ? 'right' : 'left',
                      padding: '10px 16px',
                      color: '#6b7280',
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const fullName = `${profile.prenom ?? ''} ${profile.nom ?? ''}`.trim()
                const pseudo = profile.pseudo ?? (fullName || '—')
                const refs = referentsMap[profile.id] ?? []
                const rapport = rapports[profile.id]
                const { label, color } = statutRapport(rapport)
                const isOpen = panneau?.eleveId === profile.id
                const formOpen = openFormEleveId === profile.id
                const nReferents = (referentsMap[profile.id] ?? []).length
                const nEnvoyes = rapport?.id ? (envoisMap[rapport.id] ?? 0) : 0
                const tousEnvoyes = nReferents > 0 && nEnvoyes === nReferents

                return (
                  <tr
                    key={profile.id}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: isOpen ? '#f0f9ff' : 'transparent',
                    }}
                  >
                    {/* Étudiant */}
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#111827', verticalAlign: 'top' }}>
                      {pseudo}
                    </td>

                    {/* Parents — gestion inline */}
                    <td style={{ padding: '10px 16px', verticalAlign: 'top', minWidth: 220 }}>
                      {/* Liste des référents actifs */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: refs.length > 0 || formOpen ? 6 : 0 }}>
                        {refs.map((r) => (
                          <div key={r.linkId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 13, color: '#374151' }}>
                              {referentLabel(r)}
                            </span>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: r.mode === 'sms' ? '#dbeafe' : '#dcfce7',
                              color: r.mode === 'sms' ? '#1d4ed8' : '#15803d',
                              flexShrink: 0,
                            }}>
                              {r.mode === 'sms' ? 'SMS' : 'WA'}
                            </span>
                            <button
                              onClick={() => handleRetirer(profile.id, r.linkId)}
                              title="Retirer ce référent"
                              style={{
                                fontSize: 15,
                                lineHeight: 1,
                                color: '#9ca3af',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0 2px',
                                flexShrink: 0,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Mini-formulaire ou bouton + Ajouter */}
                      {formOpen ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <input
                              type="text"
                              placeholder="Prénom"
                              value={formPrenom}
                              onChange={(e) => setFormPrenom(e.target.value)}
                              style={cellInputStyle}
                            />
                            <input
                              type="text"
                              placeholder="Nom *"
                              value={formNom}
                              onChange={(e) => setFormNom(e.target.value)}
                              style={cellInputStyle}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <select
                              value={formRelation}
                              onChange={(e) => setFormRelation(e.target.value as 'parent' | 'prof' | 'autre')}
                              style={{ ...cellInputStyle, flex: '0 0 auto' }}
                            >
                              <option value="parent">Parent</option>
                              <option value="prof">Professeur</option>
                              <option value="autre">Autre</option>
                            </select>
                            <input
                              type="tel"
                              placeholder="33698815992 — format international sans +"
                              value={formTelephone}
                              onChange={(e) => setFormTelephone(e.target.value)}
                              style={cellInputStyle}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <select
                              value={formMode}
                              onChange={(e) => setFormMode(e.target.value as 'whatsapp' | 'sms')}
                              style={{ ...cellInputStyle, flex: '0 0 auto' }}
                            >
                              <option value="whatsapp">WhatsApp</option>
                              <option value="sms">SMS</option>
                            </select>
                          </div>
                          {formError && (
                            <p style={{ fontSize: 11, color: '#dc2626', margin: 0 }}>{formError}</p>
                          )}
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button
                              onClick={() => handleAjouter(profile.id)}
                              disabled={formSaving}
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                padding: '4px 10px',
                                borderRadius: 6,
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
                                fontSize: 12,
                                padding: '4px 10px',
                                borderRadius: 6,
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
                          onClick={() => ouvrirForm(profile.id)}
                          style={{
                            fontSize: 12,
                            color: '#6b7280',
                            background: 'none',
                            border: '1px dashed #d1d5db',
                            borderRadius: 6,
                            padding: '3px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          + Ajouter
                        </button>
                      )}
                    </td>

                    {/* Rapport */}
                    <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color }}>{label}</span>
                    </td>

                    {/* Envoyés */}
                    <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                      {nReferents === 0 ? (
                        <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 600, color: tousEnvoyes ? '#16a34a' : '#9ca3af' }}>
                          {nEnvoyes}/{nReferents}
                        </span>
                      )}
                    </td>

                    {/* Ouvrir/Fermer */}
                    <td style={{ padding: '10px 16px', textAlign: 'right', verticalAlign: 'top' }}>
                      <button
                        onClick={() => (isOpen ? fermerPanneau() : ouvrirPanneau(profile.id, pseudo))}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '5px 12px',
                          borderRadius: 7,
                          border: '1px solid #e5e7eb',
                          background: isOpen ? '#111827' : '#fff',
                          color: isOpen ? '#fff' : '#374151',
                          cursor: 'pointer',
                        }}
                      >
                        {isOpen ? 'Fermer' : 'Ouvrir'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {profiles.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}
                  >
                    Aucun élève.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

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
              gap: 20,
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
                  Rapport {formatMoisLabel(mois)}
                </p>
              </div>
              <button
                onClick={fermerPanneau}
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

            {panneauLoading ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>
                Chargement…
              </div>
            ) : panneauRapport ? (
              <>
                {/* RapportCard */}
                <RapportCard
                  problemesReussis={panneauRapport.problemes_reussis}
                  minutesConcentration={panneauRapport.minutes_concentration}
                  minutesConcentrationPrev={panneauRapport.minutes_concentration_prev}
                  scoreTotal={panneauRapport.score_total}
                  scoreVariation={panneauRapport.score_variation}
                  feuillesFait={panneauRapport.feuilles_fait}
                  feuillesEnCours={panneauRapport.feuilles_en_cours}
                  feuillesNonFait={panneauRapport.feuilles_non_fait}
                  note={note || null}
                />

                {/* Note */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Note
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
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

                {/* Envoi par référent (WhatsApp + SMS) */}
                {panRefs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Envoyer le rapport
                    </div>

                    {panRefs.map((ref) => {
                      const hasImage = !!panneauRapport.image_path
                      const isWA = ref.mode !== 'sms'
                      return (
                        <div
                          key={ref.id}
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
                            disabled={!hasImage}
                            title={!hasImage ? "Générer le PNG d'abord" : undefined}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 13,
                              fontWeight: 600,
                              padding: '7px 14px',
                              borderRadius: 8,
                              border: 'none',
                              cursor: hasImage ? 'pointer' : 'not-allowed',
                              flexShrink: 0,
                              background: !hasImage ? '#e5e7eb' : isWA ? '#25D366' : '#3b82f6',
                              color: hasImage ? '#fff' : '#9ca3af',
                            }}
                          >
                            {isWA ? (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            ) : (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                            )}
                            {isWA ? 'Envoyer (WhatsApp)' : 'Envoyer (SMS)'}
                          </button>
                        </div>
                      )
                    })}

                    {panneauRapport.envoye_le && (
                      <p style={{ fontSize: 12, color: '#16a34a', margin: 0 }}>
                        ✓ Envoyé le{' '}
                        {new Date(panneauRapport.envoye_le).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Div hors-écran pour capture PNG (945×858) */}
      {/* Div hors-écran pour capture PNG : simple conteneur de positionnement, pas de taille imposée */}
      {panneauRapport && (
        <div style={{ position: 'fixed', left: -10000, top: 0 }}>
          <RapportCard
            ref={cardRef}
            problemesReussis={panneauRapport.problemes_reussis}
            minutesConcentration={panneauRapport.minutes_concentration}
            minutesConcentrationPrev={panneauRapport.minutes_concentration_prev}
            scoreTotal={panneauRapport.score_total}
            scoreVariation={panneauRapport.score_variation}
            feuillesFait={panneauRapport.feuilles_fait}
            feuillesEnCours={panneauRapport.feuilles_en_cours}
            feuillesNonFait={panneauRapport.feuilles_non_fait}
            note={note || null}
            captureWidth={945}
          />
        </div>
      )}
    </div>
  )
}
