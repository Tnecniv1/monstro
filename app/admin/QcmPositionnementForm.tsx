'use client'

import { useState } from 'react'
import QcmTexte from '../components/QcmTexte'
import { btnPrimaire, btnSecondaire, champ, etiquette, type QcmPositionnement } from './parcoursObjectifTypes'

export type ValeursQcm = Pick<QcmPositionnement, 'chapitre' | 'enonce' | 'choix' | 'reponses_correctes' | 'image_url'>

type Choix = { texte: string; correct: boolean }

// id d'un choix d'après sa position : a, b, c…
function idChoix(i: number): string {
  return String.fromCharCode(97 + i)
}

// Création ou modification d'une question du test de positionnement.
// Les ids des choix sont regénérés dans l'ordre (a, b, c…) à
// l'enregistrement : retirer un choix décale les suivants, et les bonnes
// réponses suivent leur choix.
export default function QcmPositionnementForm({
  initial,
  chapitres,
  enCours,
  onAnnuler,
  onEnregistrer,
}: {
  initial: QcmPositionnement | null
  // Chapitres déjà utilisés dans la feuille (suggestions).
  chapitres: string[]
  enCours: boolean
  onAnnuler: () => void
  onEnregistrer: (v: ValeursQcm) => void
}) {
  const [chapitre, setChapitre] = useState(initial?.chapitre ?? '')
  const [enonce, setEnonce] = useState(initial?.enonce ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [choix, setChoix] = useState<Choix[]>(() => {
    if (!initial) return [{ texte: '', correct: false }, { texte: '', correct: false }]
    const bonnes = new Set(initial.reponses_correctes)
    return initial.choix.map((c) => ({ texte: c.texte, correct: bonnes.has(c.id) }))
  })
  const [erreur, setErreur] = useState<string | null>(null)
  const listeId = `chapitres-${initial?.id ?? 'nouvelle'}`

  function majChoix(i: number, champs: Partial<Choix>) {
    setChoix((l) => l.map((c, j) => (j === i ? { ...c, ...champs } : c)))
  }

  function valider() {
    setErreur(null)
    if (!enonce.trim()) return setErreur('L’énoncé est obligatoire.')
    if (choix.length < 2) return setErreur('Il faut au moins deux choix.')
    if (choix.some((c) => !c.texte.trim())) return setErreur('Chaque choix doit avoir un texte.')
    if (!choix.some((c) => c.correct)) return setErreur('Coche au moins une bonne réponse.')
    const ids = choix.map((_, i) => idChoix(i))
    onEnregistrer({
      chapitre: chapitre.trim() || null,
      enonce: enonce.trim(),
      choix: choix.map((c, i) => ({ id: ids[i], texte: c.texte.trim() })),
      reponses_correctes: choix.flatMap((c, i) => (c.correct ? [ids[i]] : [])),
      image_url: imageUrl.trim() || null,
    })
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-text-primary">{initial ? 'Modifier la question' : 'Nouvelle question'}</p>

      <label className="block space-y-1">
        <span className={etiquette}>Chapitre (facultatif)</span>
        <input
          type="text"
          value={chapitre}
          onChange={(e) => setChapitre(e.target.value)}
          list={listeId}
          className={champ}
          placeholder="Fractions, équations…"
        />
        <datalist id={listeId}>
          {chapitres.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <div className="space-y-1">
        <label className="block space-y-1">
          <span className={etiquette}>Énoncé (LaTeX entre $…$)</span>
          <textarea
            value={enonce}
            onChange={(e) => setEnonce(e.target.value)}
            rows={3}
            className={`${champ} resize-y font-mono text-xs`}
          />
        </label>
        {enonce.trim() && (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-sm text-text-primary">
            <QcmTexte text={enonce} />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <span className={etiquette}>Choix (cocher les bonnes réponses)</span>
        <ul className="space-y-2">
          {choix.map((c, i) => (
            <li key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.correct}
                  onChange={(e) => majChoix(i, { correct: e.target.checked })}
                  aria-label={`Choix ${idChoix(i)} correct`}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
                <span className="w-4 shrink-0 text-xs font-bold uppercase text-text-muted">{idChoix(i)}</span>
                <input
                  type="text"
                  value={c.texte}
                  onChange={(e) => majChoix(i, { texte: e.target.value })}
                  className={`${champ} font-mono text-xs`}
                />
                <button
                  type="button"
                  onClick={() => setChoix((l) => l.filter((_, j) => j !== i))}
                  disabled={choix.length <= 2}
                  aria-label={`Retirer le choix ${idChoix(i)}`}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-red-50 disabled:opacity-30"
                >
                  Retirer
                </button>
              </div>
              {c.texte.trim() && (
                <div className={`ml-12 text-sm ${c.correct ? 'font-semibold text-success' : 'text-text-secondary'}`}>
                  <QcmTexte text={c.texte} />
                </div>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setChoix((l) => [...l, { texte: '', correct: false }])}
          disabled={choix.length >= 26}
          className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
        >
          + Choix
        </button>
      </div>

      <div className="space-y-1">
        <label className="block space-y-1">
          <span className={etiquette}>Image (URL, facultative)</span>
          <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={champ} />
        </label>
        {imageUrl.trim() && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl.trim()} alt="" className="max-h-40 rounded-lg border border-border" />
        )}
      </div>

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
