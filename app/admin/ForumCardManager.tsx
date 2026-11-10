'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSignedPdfUrl } from '@/lib/getSignedPdfUrl'
import VideoScript from '../components/VideoScript'
import { analyserVideo } from '@/lib/video'
import MathText from '../components/MathText'
import { CATEGORIES_COURS, CATEGORIE_COURS_LABEL, type CategorieCours } from '../bibliotheque/cours'

// Même normalisation que AdminClient.tsx (FormulaireFeuille) — évite les
// caractères spéciaux dans le chemin de stockage.
function sanitizeFileName(name: string): string {
  return name
    .replace(/é|è|ê|ë/g, 'e').replace(/à|â|ä/g, 'a').replace(/ù|û|ü/g, 'u')
    .replace(/î|ï/g, 'i').replace(/ô|ö/g, 'o').replace(/ç/g, 'c')
    .replace(/É|È|Ê|Ë/g, 'E').replace(/À|Â|Ä/g, 'A').replace(/Ù|Û|Ü/g, 'U')
    .replace(/Î|Ï/g, 'I').replace(/Ô|Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

// Chemin dans le bucket pdfs d'une URL enregistrée (même extraction que
// CorrectionsClient) ; null pour une URL externe, jamais supprimée.
function cheminPdf(url: string | null | undefined): string | null {
  return url?.match(/\/storage\/v1\/object\/public\/pdfs\/(.+)/)?.[1] ?? null
}

// Nom lisible du fichier : dernier segment du chemin, sans le préfixe horodaté.
function nomPdf(url: string): string {
  const nom = (cheminPdf(url) ?? url).split('/').pop() ?? url
  return decodeURIComponent(nom).replace(/^\d+_/, '')
}

// Renvoie le message d'erreur du Storage, ou null.
async function supprimerPdf(supabase: ReturnType<typeof createClient>, url: string | null | undefined): Promise<string | null> {
  const path = cheminPdf(url)
  if (!path) return null
  const { error } = await supabase.storage.from('pdfs').remove([path])
  return error?.message ?? null
}

function formatDateAjout(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

type CardEtape = { titre: string; description: string }

// Forme commune à forum_scripts et forum_resources (colonnes partagées).
// citation/etapes n'existent que sur forum_scripts, pdf_url et categorie
// (cours de la Bibliothèque) que sur forum_resources (côté formulaire — la
// colonne pdf_url existe toujours en base sur forum_scripts mais n'est plus
// lue/écrite depuis cet écran). created_at n'est lu que pour les cours.
type CardItem = {
  id: string
  titre: string
  description: string | null
  citation?: string | null
  etapes?: CardEtape[]
  pdf_url?: string | null
  categorie?: CategorieCours
  cover_url: string | null
  // Scripts seulement : vidéo affichée en haut du script (lib/video.ts).
  video_url?: string | null
  ordre: number
  created_at?: string
}

type CardTable = 'forum_scripts' | 'forum_resources'

function EtapePreview({ citation, etapes }: { citation: string; etapes: CardEtape[] }) {
  if (!citation.trim() && etapes.length === 0) return null

  return (
    <details open className="rounded-lg border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-text-secondary">
        Aperçu
      </summary>
      <div className="p-4 space-y-4">
        {citation.trim() && (
          <>
            <blockquote className="border-l-2 border-border-strong pl-4 italic text-text-secondary text-sm">
              <MathText text={citation} />
            </blockquote>
            {etapes.length > 0 && <hr className="border-border" />}
          </>
        )}
        {etapes.map((etape, i) => (
          <div key={i}>
            <p className="text-sm font-bold text-text-primary">
              <span className="text-accent">{`E_${i + 1} `}</span>
              <MathText text={etape.titre || '…'} />
            </p>
            <div className="text-sm text-text-primary mt-1 leading-relaxed">
              <MathText text={etape.description || '…'} />
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}

function CardForm({
  table,
  initial,
  onCancel,
  onSaved,
}: {
  table: CardTable
  initial?: CardItem
  onCancel: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const isScript = table === 'forum_scripts'

  const [titre, setTitre] = useState(initial?.titre ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [citation, setCitation] = useState(initial?.citation ?? '')
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? '')
  const [etapes, setEtapes] = useState<CardEtape[]>(initial?.etapes ?? [])
  const [pdfUrl, setPdfUrl] = useState(initial?.pdf_url ?? '')
  const [categorie, setCategorie] = useState<CategorieCours>(initial?.categorie ?? 'introduction')
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url ?? '')
  const [ordre, setOrdre] = useState(initial?.ordre ?? 1)
  const [loading, setLoading] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [dragOverPdf, setDragOverPdf] = useState(false)
  const [dragOverCover, setDragOverCover] = useState(false)
  const [fichierNom, setFichierNom] = useState<string | null>(null)
  const [coverNom, setCoverNom] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function uploadPdf(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Seuls les fichiers PDF sont acceptés.')
      return
    }
    setUploadingPdf(true)
    setError(null)
    const safeName = sanitizeFileName(file.name)
    const path = `forum/${Date.now()}_${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(path, file, { contentType: 'application/pdf', upsert: false })
    if (uploadError) {
      setError(uploadError.message)
      setUploadingPdf(false)
      return
    }
    // PDF déposé plus tôt dans ce formulaire, jamais enregistré : remplacé, donc retiré.
    if (pdfUrl && pdfUrl !== initial?.pdf_url) void supprimerPdf(supabase, pdfUrl)
    const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(path)
    setPdfUrl(urlData.publicUrl)
    setFichierNom(file.name)
    setUploadingPdf(false)
  }

  async function uploadCover(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Seules les images sont acceptées pour la couverture.')
      return
    }
    setUploadingCover(true)
    setError(null)
    const safeName = sanitizeFileName(file.name)
    const path = `${Date.now()}_${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('forum-covers')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) {
      setError(uploadError.message)
      setUploadingCover(false)
      return
    }
    const { data: urlData } = supabase.storage.from('forum-covers').getPublicUrl(path)
    setCoverUrl(urlData.publicUrl)
    setCoverNom(file.name)
    setUploadingCover(false)
  }

  function handleDropPdf(e: React.DragEvent) {
    e.preventDefault()
    setDragOverPdf(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadPdf(file)
  }

  function handleFileInputPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadPdf(file)
  }

  function handleDropCover(e: React.DragEvent) {
    e.preventDefault()
    setDragOverCover(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadCover(file)
  }

  function handleFileInputCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadCover(file)
  }

  function addEtape() {
    setEtapes((prev) => [...prev, { titre: '', description: '' }])
  }

  function removeEtape(i: number) {
    setEtapes((prev) => prev.filter((_, idx) => idx !== i))
  }

  function moveEtape(i: number, dir: -1 | 1) {
    setEtapes((prev) => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function updateEtape(i: number, field: keyof CardEtape, value: string) {
    setEtapes((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)))
  }

  // Annuler un cours : le PDF déposé mais pas enregistré ne sert à aucune ligne.
  function annuler() {
    if (!isScript && pdfUrl && pdfUrl !== initial?.pdf_url) void supprimerPdf(supabase, pdfUrl)
    onCancel()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isScript && !pdfUrl) {
      setError('Dépose le PDF du cours.')
      return
    }
    setLoading(true)
    setError(null)

    const payload: Record<string, unknown> = {
      titre: titre.trim(),
      ordre,
    }
    if (isScript) {
      payload.description = description.trim()
      payload.cover_url = coverUrl.trim() || null
      payload.citation = citation.trim() || null
      payload.video_url = videoUrl.trim() || null
      payload.etapes = etapes
        .map((et) => ({ titre: et.titre.trim(), description: et.description.trim() }))
        .filter((et) => et.titre || et.description)
    } else {
      // Cours : pas de couverture (la Bibliothèque ne l'affiche pas), description facultative.
      payload.description = description.trim() || null
      payload.pdf_url = pdfUrl
      payload.categorie = categorie
    }

    const requete = initial
      ? supabase.from(table).update(payload).eq('id', initial.id)
      : supabase.from(table).insert(payload)
    // Cours : on vérifie qu'une ligne a bien été écrite avant de toucher au Storage.
    const { data, error } = isScript ? await requete : await requete.select('id')

    if (error || (!isScript && !data?.length)) {
      setError(error?.message ?? 'Aucune ligne enregistrée (droits insuffisants ?).')
      setLoading(false)
      return
    }

    // Remplacement du PDF : l'ancien fichier n'est retiré qu'une fois la ligne à jour.
    if (!isScript && initial?.pdf_url && initial.pdf_url !== pdfUrl) {
      const erreurFichier = await supprimerPdf(supabase, initial.pdf_url)
      if (erreurFichier) alert(`Cours enregistré, mais l'ancien PDF n'a pas pu être supprimé du Storage : ${erreurFichier}`)
    }

    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 space-y-1">
          <label className="block text-xs font-medium text-text-secondary">Titre</label>
          <input
            type="text"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            required
            autoFocus
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="w-24 space-y-1">
          <label className="block text-xs font-medium text-text-secondary">Ordre</label>
          <input
            type="number"
            min={1}
            value={ordre}
            onChange={(e) => setOrdre(Number(e.target.value))}
            required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-text-secondary">
          Description courte{!isScript && ' (optionnel)'}
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required={isScript}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Cover — optionnelle, affichée en image de fond de carte (ScriptsRow). */}
      {isScript && (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-text-secondary">Image de couverture (optionnel)</label>

          <label
            onDragOver={(e) => { e.preventDefault(); setDragOverCover(true) }}
            onDragLeave={() => setDragOverCover(false)}
            onDrop={handleDropCover}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors ${
              dragOverCover ? 'border-accent bg-accent/5' : 'border-border hover:border-border-strong hover:bg-surface'
            }`}
          >
            <input type="file" accept="image/*" onChange={handleFileInputCover} className="sr-only" />
            {uploadingCover ? (
              <p className="text-xs text-text-muted">Upload en cours…</p>
            ) : coverUrl ? (
              <div className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverUrl} alt="" className="mx-auto h-16 rounded-md object-cover" />
                {coverNom && <p className="text-xs font-medium text-success">✓ {coverNom}</p>}
                <p className="text-xs text-text-muted">Cliquer pour changer</p>
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                Glissez une image ici ou <span className="underline">cliquez pour sélectionner</span>
              </p>
            )}
          </label>
        </div>
      )}

      {isScript ? (
        <>
          {/* Vidéo — facultative, affichée en haut du script (ScriptTextModal, onboarding). */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-secondary">Vidéo (lien, optionnel)</label>
            <input
              type="text"
              inputMode="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="YouTube, ou lien direct .mp4 / .webm / .mov"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {videoUrl.trim() && !analyserVideo(videoUrl) ? (
              <p className="text-xs text-danger">Lien non reconnu (il doit commencer par https://, youtube.com, youtu.be ou www.) : rien ne sera affiché.</p>
            ) : (
              <VideoScript url={videoUrl} titre={titre} />
            )}
          </div>

          {/* Citation — affichée en haut de ScriptTextModal. */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-secondary">Citation (optionnel)</label>
            <textarea
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              rows={2}
              placeholder="Citation affichée en haut de la fiche ($...$ pour les maths)"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          {/* Étapes — ajouter/supprimer/réordonner, chaque étape = titre + description. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-text-secondary">Étapes</label>
              <button
                type="button"
                onClick={addEtape}
                className="text-xs font-medium text-accent hover:opacity-80 transition-opacity"
              >
                + Ajouter une étape
              </button>
            </div>

            {etapes.length === 0 && (
              <p className="text-xs text-text-muted">Aucune étape pour l&apos;instant.</p>
            )}

            <div className="space-y-3">
              {etapes.map((etape, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-accent">{`E_${i + 1}`}</span>
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => moveEtape(i, -1)}
                        disabled={i === 0}
                        aria-label="Monter"
                        className="px-1.5 text-text-muted hover:text-text-secondary disabled:opacity-30 transition-colors"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveEtape(i, 1)}
                        disabled={i === etapes.length - 1}
                        aria-label="Descendre"
                        className="px-1.5 text-text-muted hover:text-text-secondary disabled:opacity-30 transition-colors"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEtape(i)}
                        className="px-1.5 text-danger hover:opacity-70 transition-opacity"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={etape.titre}
                    onChange={(e) => updateEtape(i, 'titre', e.target.value)}
                    placeholder="Titre de l'étape"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <textarea
                    value={etape.description}
                    onChange={(e) => updateEtape(i, 'description', e.target.value)}
                    rows={2}
                    placeholder="Description ($...$ pour les maths)"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <EtapePreview citation={citation} etapes={etapes} />
        </>
      ) : (
        <>
          {/* Catégorie — pastille et filtre de la vue « Cours » de la Bibliothèque. */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-secondary">Catégorie</label>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as CategorieCours)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {CATEGORIES_COURS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIE_COURS_LABEL[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-secondary">PDF</label>

            <label
              onDragOver={(e) => { e.preventDefault(); setDragOverPdf(true) }}
              onDragLeave={() => setDragOverPdf(false)}
              onDrop={handleDropPdf}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors ${
                dragOverPdf ? 'border-accent bg-accent/5' : 'border-border hover:border-border-strong hover:bg-surface'
              }`}
            >
              <input type="file" accept=".pdf" onChange={handleFileInputPdf} className="sr-only" />
              {uploadingPdf ? (
                <p className="text-xs text-text-muted">Upload en cours…</p>
              ) : fichierNom ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-success">✓ {fichierNom}</p>
                  <p className="text-xs text-text-muted">Cliquer pour changer</p>
                </div>
              ) : pdfUrl ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-text-secondary">PDF actuel : {nomPdf(pdfUrl)}</p>
                  <p className="text-xs text-text-muted">Cliquer pour remplacer</p>
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  Glissez un PDF ici ou <span className="underline">cliquez pour sélectionner</span>
                </p>
              )}
            </label>
          </div>
        </>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={annuler}
          className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading || uploadingPdf || uploadingCover || (!isScript && !pdfUrl)}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </form>
  )
}

interface Props {
  table: CardTable
  createLabel: string
  itemLabelSingular: string
  // Accord des messages : « le cours », « Aucun cours » (par défaut : « la fiche »).
  masculin?: boolean
}

export default function ForumCardManager({ table, createLabel, itemLabelSingular, masculin = false }: Props) {
  const supabase = createClient()
  const isScript = table === 'forum_scripts'

  const [items, setItems] = useState<CardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function charger() {
    setLoading(true)
    const columns = isScript
      ? 'id, titre, description, citation, etapes, cover_url, video_url, ordre'
      : 'id, titre, description, pdf_url, categorie, cover_url, ordre, created_at'
    const { data } = await supabase.from(table).select(columns).order('ordre')
    setItems((data as unknown as CardItem[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])

  async function handleDelete(item: CardItem) {
    if (!confirm(`Supprimer ${masculin ? 'le' : 'la'} ${itemLabelSingular} "${item.titre}" ? Cette action est irréversible.`)) return
    const requete = supabase.from(table).delete().eq('id', item.id)
    const { data, error } = isScript ? await requete : await requete.select('id')
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    // Cours : le PDF n'est supprimé qu'une fois la ligne effacée, jamais de ligne vers un fichier absent.
    if (!isScript) {
      if (!data?.length) {
        alert('Erreur : cours non supprimé (droits insuffisants ?).')
        return
      }
      const erreurFichier = await supprimerPdf(supabase, item.pdf_url)
      if (erreurFichier) alert(`Cours supprimé, mais le PDF n'a pas pu être retiré du Storage : ${erreurFichier}`)
    }
    charger()
  }

  // Bucket privé : URL signée (1 h) générée au clic. L'onglet est ouvert avant
  // l'attente pour ne pas être bloqué par le navigateur.
  async function ouvrirPdf(url: string) {
    const onglet = window.open('', '_blank')
    const signed = await getSignedPdfUrl(url)
    if (signed && onglet) {
      onglet.opener = null
      onglet.location.href = signed
    } else {
      onglet?.close()
      alert("Impossible d'ouvrir le PDF.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => { setShowCreate((v) => !v); setEditingId(null) }}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2 transition-colors"
        >
          {createLabel}
        </button>
      </div>

      {showCreate && (
        <CardForm
          table={table}
          onCancel={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); charger() }}
        />
      )}

      {loading && <p className="text-sm text-text-muted">Chargement…</p>}

      {!loading && items.length === 0 && !showCreate && (
        <p className="text-sm text-text-muted">{masculin ? 'Aucun' : 'Aucune'} {itemLabelSingular} pour l&apos;instant.</p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                {item.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">#{item.ordre} — {item.titre}</p>
                  <p className="text-xs text-text-muted truncate">
                    {isScript
                      ? item.description
                      : [
                          item.categorie && CATEGORIE_COURS_LABEL[item.categorie],
                          item.created_at && `ajouté le ${formatDateAjout(item.created_at)}`,
                          item.description,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                {!isScript && item.pdf_url && (
                  <button
                    onClick={() => ouvrirPdf(item.pdf_url!)}
                    className="text-text-secondary hover:text-accent transition-colors"
                  >
                    Ouvrir le PDF
                  </button>
                )}
                <button
                  onClick={() => { setEditingId((id) => (id === item.id ? null : item.id)); setShowCreate(false) }}
                  className="text-text-secondary hover:text-accent transition-colors"
                >
                  Modifier
                </button>
                <button onClick={() => handleDelete(item)} className="text-danger hover:opacity-70 transition-opacity">
                  Supprimer
                </button>
              </div>
            </div>
            {editingId === item.id && (
              <div className="border-t border-border p-4">
                <CardForm
                  table={table}
                  initial={item}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => { setEditingId(null); charger() }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
