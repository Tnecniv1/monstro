'use client'

import { useState } from 'react'
import FeuillePicker from './FeuillePicker'
import {
  CLASSES_EXAMEN,
  btnPrimaire,
  btnSecondaire,
  champ,
  cheminFeuille,
  etiquette,
  type ClasseExamen,
  type Etape,
  type FeuilleChoix,
} from './parcoursObjectifTypes'

export type ValeursEtape = Omit<Etape, 'id' | 'parcours_id' | 'ordre'>

// Création ou modification d'une étape. Feuille : feuille obligatoire, plage
// d'exercices optionnelle (vide = toute la feuille ; une seule borne remplie
// est complétée par 1 ou par le volume). Examen : libellé et classe obligatoires.
export default function ParcoursEtapeForm({
  type,
  initial,
  feuilles,
  feuilleParId,
  enCours,
  onAnnuler,
  onEnregistrer,
}: {
  type: 'feuille' | 'examen'
  initial: Etape | null
  feuilles: FeuilleChoix[]
  feuilleParId: Map<string, FeuilleChoix>
  enCours: boolean
  onAnnuler: () => void
  onEnregistrer: (v: ValeursEtape) => void
}) {
  const [feuilleId, setFeuilleId] = useState<string | null>(initial?.feuille_id ?? null)
  const [choixOuvert, setChoixOuvert] = useState(!initial?.feuille_id)
  const [debut, setDebut] = useState(initial?.exo_debut?.toString() ?? '')
  const [fin, setFin] = useState(initial?.exo_fin?.toString() ?? '')
  const [libelle, setLibelle] = useState(initial?.libelle ?? '')
  const [classe, setClasse] = useState<ClasseExamen | ''>(initial?.classe_examen ?? '')
  const [erreur, setErreur] = useState<string | null>(null)

  const feuille = feuilleId ? feuilleParId.get(feuilleId) ?? null : null
  const volume = feuille?.volume ?? 0

  function choisir(f: FeuilleChoix) {
    if (f.id !== feuilleId) {
      setDebut('')
      setFin('')
    }
    setFeuilleId(f.id)
    setChoixOuvert(false)
  }

  function valider() {
    setErreur(null)
    if (type === 'examen') {
      if (!libelle.trim()) return setErreur('Le libellé est obligatoire.')
      if (!classe) return setErreur('La classe est obligatoire.')
      onEnregistrer({
        type: 'examen',
        libelle: libelle.trim(),
        classe_examen: classe,
        feuille_id: null,
        exo_debut: null,
        exo_fin: null,
      })
      return
    }

    if (!feuilleId) return setErreur('Choisis une feuille.')
    let d: number | null = debut ? parseInt(debut, 10) : null
    let f: number | null = fin ? parseInt(fin, 10) : null
    if (d != null || f != null) {
      d = d ?? 1
      f = f ?? (volume || d)
      if (d > f) return setErreur('Le premier exercice doit précéder le dernier.')
    }
    onEnregistrer({
      type: 'feuille',
      feuille_id: feuilleId,
      exo_debut: d,
      exo_fin: f,
      libelle: null,
      classe_examen: null,
    })
  }

  const numeros = Array.from({ length: volume }, (_, i) => i + 1)

  return (
    <div
      className="space-y-4 rounded-xl border p-4"
      style={type === 'examen' ? { background: '#F0FDF4', borderColor: '#BBF7D0' } : { background: '#FFFFFF' }}
    >
      <p className="text-sm font-semibold text-text-primary">
        {initial ? 'Modifier l’étape' : type === 'examen' ? 'Nouvel examen' : 'Nouvelle feuille'}
      </p>

      {type === 'feuille' ? (
        <>
          <div className="space-y-1">
            <p className={etiquette}>Feuille</p>
            {feuille && !choixOuvert ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                <div>
                  <p className="text-sm text-text-primary">{feuille.titre}</p>
                  <p className="text-xs text-text-muted">
                    {cheminFeuille(feuille) || 'Sans catégorie'} · {volume} exercices
                  </p>
                </div>
                <button type="button" onClick={() => setChoixOuvert(true)} className={btnSecondaire}>
                  Changer
                </button>
              </div>
            ) : (
              <FeuillePicker feuilles={feuilles} selectionId={feuilleId} onChoisir={choisir} />
            )}
          </div>

          {feuille && (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className={etiquette}>Du exercice</span>
                <select value={debut} onChange={(e) => setDebut(e.target.value)} className={champ}>
                  <option value="">Début de la feuille</option>
                  {numeros.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={etiquette}>Au exercice</span>
                <select value={fin} onChange={(e) => setFin(e.target.value)} className={champ}>
                  <option value="">Fin de la feuille</option>
                  {numeros.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
          <label className="space-y-1">
            <span className={etiquette}>Libellé</span>
            <input
              type="text"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Brevet blanc, bac de français…"
              className={champ}
            />
          </label>
          <label className="space-y-1">
            <span className={etiquette}>Classe</span>
            <select value={classe} onChange={(e) => setClasse(e.target.value as ClasseExamen | '')} className={champ}>
              <option value="">—</option>
              {CLASSES_EXAMEN.map((c) => (
                <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onAnnuler} className={btnSecondaire} disabled={enCours}>
          Annuler
        </button>
        <button type="button" onClick={valider} className={btnPrimaire} disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
