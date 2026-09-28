'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface PersonalReferent {
  linkId: string   // referent_eleve.id
  referentId: string
  prenom: string
  nom: string
  relation: string
  telephone: string
}

interface Props {
  eleveId: string
  initial: PersonalReferent[]
  /** Profil de l'élève, pour pré-remplir le suiveur « Moi » */
  profil: { prenom: string; nom: string; telephone: string }
}

type Relation =
  | 'moi'
  | 'pere'
  | 'mere'
  | 'frere'
  | 'soeur'
  | 'parrain'
  | 'marraine'
  | 'ami'
  | 'oncle'
  | 'tante'
  | 'coach_sport'

const RELATION_OPTIONS: { value: Relation; label: string }[] = [
  { value: 'moi', label: 'Moi' }, // l'élève reçoit lui-même son rapport hebdomadaire
  { value: 'pere', label: 'Père' },
  { value: 'mere', label: 'Mère' },
  { value: 'frere', label: 'Frère' },
  { value: 'soeur', label: 'Sœur' },
  { value: 'parrain', label: 'Parrain' },
  { value: 'marraine', label: 'Marraine' },
  { value: 'ami', label: 'Ami' },
  { value: 'oncle', label: 'Oncle' },
  { value: 'tante', label: 'Tante' },
  { value: 'coach_sport', label: 'Coach de sport' },
]

// Anciennes valeurs encore présentes en base (formulaire pré-refonte) — gardées
// uniquement pour l'affichage, retirées du <select> pour les nouveaux ajouts.
const RELATION_LABELS_LEGACY: Record<string, string> = {
  parent: 'Parent',
  prof: 'Professeur',
  autre: 'Autre',
}

const RELATION_LABELS: Record<string, string> = {
  ...RELATION_LABELS_LEGACY,
  ...Object.fromEntries(RELATION_OPTIONS.map((o) => [o.value, o.label])),
}

function referentLabel(r: PersonalReferent): string {
  return [r.prenom, r.nom].filter(Boolean).join(' ') || '—'
}

export default function AgoraPersonalView({ eleveId, initial, profil }: Props) {
  const supabase = createClient()
  const [referents, setReferents] = useState<PersonalReferent[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [relation, setRelation] = useState<Relation>('pere')
  const [telephone, setTelephone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function normalizePhone(raw: string): string {
    const digits = raw.replace(/[^\d+]/g, '')
    if (digits.startsWith('+')) return digits.slice(1)
    if (digits.startsWith('0')) return '33' + digits.slice(1)
    return digits
  }

  // « Moi » : pré-remplit avec le profil de l'élève les champs encore vides (modifiables ensuite)
  function changerRelation(valeur: Relation) {
    setRelation(valeur)
    if (valeur !== 'moi') return
    if (!telephone.trim() && profil.telephone) setTelephone(profil.telephone)
    if (!prenom.trim() && profil.prenom) setPrenom(profil.prenom)
    if (!nom.trim() && profil.nom) setNom(profil.nom)
  }

  async function recharger() {
    const { data } = await supabase
      .from('referent_eleve')
      .select('id, referent_id, referent(prenom, nom, relation, telephone)')
      .eq('eleve_id', eleveId)
      .eq('actif', true)
    if (data) {
      setReferents(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.map((r: any) => ({
          linkId: r.id,
          referentId: r.referent_id,
          prenom: r.referent?.prenom ?? '',
          nom: r.referent?.nom ?? '',
          relation: r.referent?.relation ?? 'autre',
          telephone: r.referent?.telephone ?? '',
        })),
      )
    }
  }

  async function handleAjouter() {
    if (!nom.trim() || !telephone.trim()) {
      setError('Nom et téléphone requis.')
      return
    }
    setLoading(true)
    setError(null)

    const { data: ref, error: e1 } = await supabase
      .from('referent')
      .insert({
        prenom: prenom.trim() || null,
        nom: nom.trim(),
        relation,
        telephone: normalizePhone(telephone.trim()),
        mode: 'whatsapp',
      })
      .select('id')
      .single()

    if (e1 || !ref) {
      setError(e1?.message ?? 'Erreur lors de la création du suiveur.')
      setLoading(false)
      return
    }

    const { error: e2 } = await supabase
      .from('referent_eleve')
      .insert({ referent_id: ref.id, eleve_id: eleveId, actif: true })

    if (e2) {
      setError(e2.message)
      setLoading(false)
      return
    }

    setPrenom('')
    setNom('')
    setRelation('pere')
    setTelephone('')
    setShowForm(false)
    setLoading(false)
    await recharger()
  }

  async function handleRetirer(linkId: string) {
    setLoading(true)
    await supabase.from('referent_eleve').update({ actif: false }).eq('id', linkId)
    setReferents((prev) => prev.filter((r) => r.linkId !== linkId))
    setLoading(false)
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #e5e7eb',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Mes suiveurs</h2>
        <button
          onClick={() => { setShowForm((v) => !v); setError(null) }}
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#374151',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Annuler' : 'Ajouter un suiveur'}
        </button>
      </div>

      <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
        Les suiveurs reçoivent ton rapport de progression hebdomadaire par WhatsApp ou SMS.
      </p>

      {/* Liste */}
      {referents.length === 0 && !showForm && (
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Aucun suiveur pour le moment.</p>
      )}
      {referents.map((r) => (
        <div
          key={r.linkId}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px',
            background: '#f9fafb',
            borderRadius: 10,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{referentLabel(r)}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {RELATION_LABELS[r.relation] ?? r.relation} · {r.telephone}
            </div>
          </div>
          <button
            onClick={() => handleRetirer(r.linkId)}
            disabled={loading}
            style={{
              fontSize: 12,
              color: '#ef4444',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 6,
              flexShrink: 0,
            }}
          >
            Retirer
          </button>
        </div>
      ))}

      {/* Formulaire inline */}
      {showForm && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '14px 16px',
            background: '#fafafa',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Prénom
              </label>
              <input
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Jean"
                style={{
                  fontSize: 14,
                  color: '#111827',
                  background: '#fff',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  padding: '8px 12px',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nom
              </label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Dupont"
                style={{
                  fontSize: 14,
                  color: '#111827',
                  background: '#fff',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  padding: '8px 12px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Relation
            </label>
            <select
              value={relation}
              onChange={(e) => changerRelation(e.target.value as Relation)}
              style={{
                fontSize: 14,
                color: '#111827',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                padding: '8px 12px',
                outline: 'none',
              }}
            >
              {RELATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Téléphone (format international sans +)
            </label>
            <input
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="33612345678"
              style={{
                fontSize: 14,
                color: '#111827',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                padding: '8px 12px',
                outline: 'none',
              }}
            />
            {relation === 'moi' && (
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                {profil.telephone
                  ? 'Numéro de ton compte pré-rempli : modifie-le si besoin.'
                  : 'Aucun numéro enregistré sur ton compte : saisis-le ici.'}
              </p>
            )}
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{error}</p>
          )}

          <button
            onClick={handleAjouter}
            disabled={loading}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: loading ? '#9ca3af' : '#111827',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4,
            }}
          >
            {loading ? 'Enregistrement…' : 'Confirmer'}
          </button>
        </div>
      )}
    </div>
  )
}
