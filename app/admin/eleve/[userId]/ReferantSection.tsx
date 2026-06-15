'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Referant {
  id: string
  referent_id: string
  nom: string
  relation: string
  telephone: string
}

interface Props {
  eleveId: string
  initial: Referant[]
}

const RELATION_LABELS: Record<string, string> = {
  parent: 'Parent',
  prof: 'Professeur',
  autre: 'Autre',
}

export default function ReferantSection({ eleveId, initial }: Props) {
  const supabase = createClient()
  const [referants, setReferants] = useState<Referant[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [nom, setNom] = useState('')
  const [relation, setRelation] = useState<'parent' | 'prof' | 'autre'>('parent')
  const [telephone, setTelephone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function recharger() {
    const { data } = await supabase
      .from('referent_eleve')
      .select('id, referent_id, referent(nom, relation, telephone)')
      .eq('eleve_id', eleveId)
      .eq('actif', true)
    if (data) {
      setReferants(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.map((r: any) => ({
          id: r.id,
          referent_id: r.referent_id,
          nom: r.referent.nom,
          relation: r.referent.relation,
          telephone: r.referent.telephone,
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
      .insert({ nom: nom.trim(), relation, telephone: telephone.trim() })
      .select('id')
      .single()

    if (e1 || !ref) {
      setError(e1?.message ?? 'Erreur création référant')
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

    setNom('')
    setRelation('parent')
    setTelephone('')
    setShowForm(false)
    setLoading(false)
    await recharger()
  }

  async function handleRetirer(referantEleveId: string) {
    setLoading(true)
    await supabase.from('referent_eleve').update({ actif: false }).eq('id', referantEleveId)
    setReferants((prev) => prev.filter((r) => r.id !== referantEleveId))
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
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Référants</h3>
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
          {showForm ? 'Annuler' : 'Ajouter un référant'}
        </button>
      </div>

      {/* Liste */}
      {referants.length === 0 && !showForm && (
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Aucun référant lié.</p>
      )}
      {referants.map((r) => (
        <div
          key={r.id}
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
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{r.nom}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {RELATION_LABELS[r.relation] ?? r.relation} · {r.telephone}
            </div>
          </div>
          <button
            onClick={() => handleRetirer(r.id)}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nom
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Jean Dupont"
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Relation
            </label>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value as 'parent' | 'prof' | 'autre')}
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
              <option value="parent">Parent</option>
              <option value="prof">Professeur</option>
              <option value="autre">Autre</option>
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
