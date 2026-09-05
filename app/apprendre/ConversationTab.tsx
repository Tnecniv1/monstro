'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConversationDetail from './ConversationDetail'
import GridTile, { GRID_CONTAINER_CLASS, type EtatTuile } from './GridTile'

export type ConversationSujet = {
  id: string
  niveau: number
  titre: string
  categorie: string
  sujet: string
  regles: string
  objectif: string
  ordre: number
}

export type ConversationSoumission = {
  id: string
  user_id: string
  sujet_id: string
  lien: string
  resultat: 'succes' | 'echec' | null
  soumis_le: string
}

interface Props {
  userId: string
}

function statutCarte(soumission: ConversationSoumission | undefined) {
  if (soumission?.resultat === 'succes') return { label: 'Succès ✓', className: 'text-success font-semibold' }
  if (soumission?.resultat === 'echec') return { label: 'Échec', className: 'text-text-secondary font-medium' }
  return { label: 'Pas encore tenté', className: 'text-text-secondary' }
}

export default function ConversationTab({ userId }: Props) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [sujets, setSujets] = useState<ConversationSujet[]>([])
  const [soumissions, setSoumissions] = useState<Record<string, ConversationSoumission>>({})
  const [sujetActif, setSujetActif] = useState<ConversationSujet | null>(null)
  const [niveauSelectionne, setNiveauSelectionne] = useState<number | null>(null)

  useEffect(() => {
    let annule = false

    async function charger() {
      setLoading(true)
      const [{ data: sujetsData }, { data: soumissionsData }] = await Promise.all([
        supabase
          .from('conversation_sujet')
          .select('id, niveau, titre, categorie, sujet, regles, objectif, ordre')
          .order('niveau')
          .order('ordre'),
        supabase
          .from('conversation_soumission')
          .select('id, user_id, sujet_id, lien, resultat, soumis_le')
          .eq('user_id', userId),
      ])

      if (annule) return

      const sujetsCharges = (sujetsData ?? []) as ConversationSujet[]
      setSujets(sujetsCharges)
      setNiveauSelectionne((prev) => prev ?? sujetsCharges[0]?.niveau ?? null)

      const map: Record<string, ConversationSoumission> = {}
      for (const s of (soumissionsData ?? []) as ConversationSoumission[]) {
        map[s.sujet_id] = s
      }
      setSoumissions(map)
      setLoading(false)
    }

    charger()
    return () => {
      annule = true
    }
  }, [userId])

  function majSoumission(soumission: ConversationSoumission) {
    setSoumissions((prev) => ({ ...prev, [soumission.sujet_id]: soumission }))
  }

  if (sujetActif) {
    return (
      <ConversationDetail
        userId={userId}
        sujet={sujetActif}
        soumission={soumissions[sujetActif.id] ?? null}
        onSaved={majSoumission}
        onExit={() => setSujetActif(null)}
      />
    )
  }

  if (loading) {
    return <p className="text-center text-sm text-gray-400 py-12">Chargement…</p>
  }

  if (sujets.length === 0) {
    return <p className="text-center text-sm text-gray-400 py-12">Aucun sujet disponible pour l&apos;instant.</p>
  }

  const niveaux = Array.from(new Set(sujets.map((s) => s.niveau))).sort((a, b) => a - b)
  const sujetsNiveau = sujets.filter((s) => s.niveau === niveauSelectionne)
  const categories = Array.from(new Set(sujetsNiveau.map((s) => s.categorie)))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {niveaux.map((n) => (
          <button
            key={n}
            onClick={() => setNiveauSelectionne(n)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              n === niveauSelectionne
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700'
            }`}
          >
            Niveau {n}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {categories.map((categorie) => {
          const sujetsCategorie = sujetsNiveau.filter((s) => s.categorie === categorie)
          const indexCourant = sujetsCategorie.findIndex((s) => soumissions[s.id]?.resultat !== 'succes')
          return (
            <div key={categorie} className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500">{categorie}</h2>
              <div className={GRID_CONTAINER_CLASS}>
                {sujetsCategorie.map((s, i) => {
                  const termine = soumissions[s.id]?.resultat === 'succes'
                  const etat: EtatTuile = termine ? 'terminee' : i === indexCourant ? 'disponible' : 'verrouille'
                  const statut = statutCarte(soumissions[s.id])
                  return (
                    <GridTile key={s.id} onClick={() => setSujetActif(s)} etat={etat}>
                      <span className="font-bold font-display text-base">{s.titre}</span>
                      <span className="italic font-display text-sm">{s.categorie}</span>
                      <span className={`mt-1.5 text-xs ${statut.className}`}>{statut.label}</span>
                    </GridTile>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
