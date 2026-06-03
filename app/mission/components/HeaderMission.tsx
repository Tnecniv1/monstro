'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminValidationPanel } from './AdminValidationPanel'

interface HeaderMissionProps {
  isAdmin: boolean
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '0.5px solid rgba(0,0,0,0.15)',
  background: '#fff',
  fontSize: 14,
  color: '#1a1a1a',
  outline: 'none',
  boxSizing: 'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#888780',
  marginBottom: 4,
  display: 'block',
}

type Onglet = 'creer' | 'valider'

export function HeaderMission({ isAdmin }: HeaderMissionProps) {
  const router = useRouter()
  const supabase = createClient()

  const [modale, setModale] = useState(false)
  const [onglet, setOnglet] = useState<Onglet>('creer')
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [form, setForm] = useState({
    titre: '',
    description: '',
    type: 'argent' as 'argent' | 'sagesse' | 'preuve',
    cout_credits: '',
    profit: '',
  })

  function updateForm(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function ouvrirModale() {
    setOnglet('creer')
    setErreur(null)
    setModale(true)
  }

  async function handleCreer() {
    if (!form.titre.trim() || !form.cout_credits) {
      setErreur('Le titre et le coût sont obligatoires.')
      return
    }
    setLoading(true)
    setErreur(null)

    const { error } = await supabase.from('mission').insert({
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      type: form.type,
      cout_credits: parseInt(form.cout_credits, 10),
      profit: form.profit.trim() || null,
      statut: 'active',
    })

    if (error) {
      setErreur('Erreur lors de la création. Réessaie.')
      setLoading(false)
      return
    }

    setForm({ titre: '', description: '', type: 'argent', cout_credits: '', profit: '' })
    setModale(false)
    router.refresh()
    setLoading(false)
  }

  function ongletStyle(actif: boolean): React.CSSProperties {
    return {
      fontSize: 13,
      fontWeight: 500,
      padding: '6px 14px',
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      background: actif ? '#EDEAE3' : 'transparent',
      color: actif ? '#1a1a1a' : '#888780',
      transition: 'background 0.15s, color 0.15s',
    }
  }

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '0.5px solid rgba(0,0,0,0.08)',
        background: '#F5F3EE',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ fontSize: 13, color: '#888780', textDecoration: 'none' }}>
            ← Monstro
          </Link>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>Missions</span>
        </div>

        {isAdmin && (
          <button
            onClick={ouvrirModale}
            style={{
              fontSize: 12,
              padding: '5px 12px',
              borderRadius: 8,
              border: '0.5px solid rgba(0,0,0,0.15)',
              background: '#EDEAE3',
              color: '#1a1a1a',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Gérer les missions ⚙
          </button>
        )}
      </div>

      {modale && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => !loading && setModale(false)}
        >
          <div
            style={{
              background: '#F5F3EE',
              border: '0.5px solid rgba(0,0,0,0.1)',
              borderRadius: 16,
              padding: 24,
              width: '90vw',
              maxWidth: 1024,
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Onglets */}
            <div style={{ display: 'flex', gap: 4, background: '#F5F3EE', borderRadius: 10, padding: 2 }}>
              <button style={ongletStyle(onglet === 'creer')} onClick={() => { setOnglet('creer'); setErreur(null) }}>
                Créer
              </button>
              <button style={ongletStyle(onglet === 'valider')} onClick={() => setOnglet('valider')}>
                Valider
              </button>
            </div>

            {/* Contenu onglet Créer */}
            {onglet === 'creer' && (
              <>
                <p style={{ fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Nouvelle mission
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={LABEL_STYLE}>Titre *</label>
                    <input
                      type="text"
                      value={form.titre}
                      onChange={(e) => updateForm('titre', e.target.value)}
                      placeholder="Ex : Ramasser des déchets"
                      style={INPUT_STYLE}
                    />
                  </div>

                  <div>
                    <label style={LABEL_STYLE}>Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => updateForm('description', e.target.value)}
                      placeholder="Détails de la mission…"
                      rows={3}
                      style={{ ...INPUT_STYLE, resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={LABEL_STYLE}>Type *</label>
                    <select
                      value={form.type}
                      onChange={(e) => updateForm('type', e.target.value)}
                      style={INPUT_STYLE}
                    >
                      <option value="argent">💵 Argent</option>
                      <option value="sagesse">🪷 Sagesse</option>
                      <option value="preuve">🧨 Preuve</option>
                    </select>
                  </div>

                  <div>
                    <label style={LABEL_STYLE}>Coût en tokens *</label>
                    <input
                      type="number"
                      value={form.cout_credits}
                      onChange={(e) => updateForm('cout_credits', e.target.value)}
                      placeholder="Ex : 500"
                      min={0}
                      style={INPUT_STYLE}
                    />
                  </div>

                  <div>
                    <label style={LABEL_STYLE}>Profit</label>
                    <input
                      type="text"
                      value={form.profit}
                      onChange={(e) => updateForm('profit', e.target.value)}
                      placeholder="Ex : 50 € ou Badge Mentor"
                      style={INPUT_STYLE}
                    />
                  </div>
                </div>

                {erreur && (
                  <p style={{ fontSize: 12, color: '#E24B4A', textAlign: 'center' }}>{erreur}</p>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setModale(false)}
                    disabled={loading}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 14, border: '0.5px solid rgba(0,0,0,0.15)', background: 'transparent', color: '#1a1a1a', cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreer}
                    disabled={loading}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 14, background: '#1a1a1a', color: '#fff', border: 'none', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
                  >
                    {loading ? 'Création…' : 'Créer la mission'}
                  </button>
                </div>
              </>
            )}

            {/* Contenu onglet Valider */}
            {onglet === 'valider' && (
              <>
                <p style={{ fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Missions en attente
                </p>
                <AdminValidationPanel />
                <button
                  onClick={() => setModale(false)}
                  style={{ padding: '8px', borderRadius: 8, fontSize: 14, border: '0.5px solid rgba(0,0,0,0.15)', background: 'transparent', color: '#1a1a1a', cursor: 'pointer' }}
                >
                  Fermer
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
