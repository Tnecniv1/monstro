'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type Noeud = {
  id: string
  parent_id: string | null
  nom: string
  ordre: number
}

type Feuille = {
  id: string
  titre: string
  volume: number
  pdf_url: string | null
  ordre: number
}

// ── Input compact réutilisable ──────────────────────────────────────
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black"
    />
  )
}

// ── Formulaire inline ajout nœud enfant ────────────────────────────
function FormulaireNoeudEnfant({
  parentId,
  onCancel,
  onSuccess,
}: {
  parentId: string | null
  onCancel: () => void
  onSuccess: () => void
}) {
  const supabase = createClient()
  const [nom, setNom] = useState('')
  const [ordre, setOrdre] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.from('noeud').insert({ parent_id: parentId, nom, ordre })
    if (error) { setError(error.message); setLoading(false); return }
    onSuccess()
  }

  return (
    <div className="bg-gray-50 border-l-2 border-black px-3 py-3 space-y-2">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <Input
          type="text"
          placeholder="Nom du nœud"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
          autoFocus
          className="w-40"
        />
        <Input
          type="number"
          placeholder="Ordre"
          value={ordre}
          min={1}
          onChange={(e) => setOrdre(Number(e.target.value))}
          required
          className="w-16"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-2 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? '…' : 'Créer'}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">
          Annuler
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ── Formulaire inline ajout feuille ────────────────────────────────
function FormulaireFeuille({
  noeudId,
  defaultOrdre,
  onSuccess,
}: {
  noeudId: string
  defaultOrdre: number
  onSuccess: () => void
}) {
  const supabase = createClient()
  const [titre, setTitre] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [volume, setVolume] = useState(6)
  const [ordre, setOrdre] = useState(defaultOrdre)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fichierNom, setFichierNom] = useState<string | null>(null)

  function titreFromFilename(filename: string): string {
    return filename
      .replace(/\.pdf$/i, '')
      .replace(/_/g, ' ')
  }

  function sanitizeFileName(name: string): string {
    return name
      .replace(/é|è|ê|ë/g, 'e')
      .replace(/à|â|ä/g, 'a')
      .replace(/ù|û|ü/g, 'u')
      .replace(/î|ï/g, 'i')
      .replace(/ô|ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/É|È|Ê|Ë/g, 'E')
      .replace(/À|Â|Ä/g, 'A')
      .replace(/Ù|Û|Ü/g, 'U')
      .replace(/Î|Ï/g, 'I')
      .replace(/Ô|Ö/g, 'O')
      .replace(/Ç/g, 'C')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
  }

  async function uploadPdf(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Seuls les fichiers PDF sont acceptés.')
      return
    }
    setUploading(true)
    setError(null)
    const safeName = sanitizeFileName(file.name)
    const path = `entrainements/${Date.now()}_${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(path, file, { contentType: 'application/pdf', upsert: false })
    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(path)
    setPdfUrl(urlData.publicUrl)
    if (!titre) setTitre(titreFromFilename(file.name))
    setFichierNom(file.name)
    setUploading(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadPdf(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadPdf(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.from('feuille_entrainement').insert({
      noeud_id: noeudId,
      titre,
      pdf_url: pdfUrl || null,
      volume,
      ordre,
    })
    if (error) { setError(error.message); setLoading(false); return }
    setTitre('')
    setPdfUrl('')
    setVolume(6)
    setFichierNom(null)
    onSuccess()
  }

  return (
    <div className="bg-gray-50 border-l-2 border-black px-3 py-3 space-y-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nouvelle feuille</p>

      {/* Zone drag & drop */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-black bg-gray-100'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          className="sr-only"
        />
        {uploading ? (
          <p className="text-xs text-gray-400">Upload en cours…</p>
        ) : fichierNom ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-green-600">✓ {fichierNom}</p>
            <p className="text-xs text-gray-400">Cliquer pour changer</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Glissez un PDF ici ou <span className="underline">cliquez pour sélectionner</span>
          </p>
        )}
      </label>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Input
            type="text"
            placeholder="Titre"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            required
            className="flex-1 min-w-40"
          />
          <Input
            type="text"
            placeholder="https://… (PDF)"
            value={pdfUrl}
            onChange={(e) => setPdfUrl(e.target.value)}
            className="flex-1 min-w-48"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-500">Vol.</label>
          <Input
            type="number"
            value={volume}
            min={1}
            onChange={(e) => setVolume(Number(e.target.value))}
            required
            className="w-14"
          />
          <label className="text-xs text-gray-500">Ordre</label>
          <Input
            type="number"
            value={ordre}
            min={1}
            onChange={(e) => setOrdre(Number(e.target.value))}
            required
            className="w-14"
          />
          <button
            type="submit"
            disabled={loading || uploading}
            className="rounded bg-black px-3 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? '…' : 'Ajouter'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </div>
  )
}

// ── Nœud accordéon récursif ─────────────────────────────────────────
function NoeudAccordeon({
  noeud,
  profondeur,
  allNoeuds,
  openSiblingId,
  setOpenSiblingId,
  onMutation,
}: {
  noeud: Noeud
  profondeur: number
  allNoeuds: Noeud[]
  openSiblingId: string | null
  setOpenSiblingId: (id: string | null) => void
  onMutation: () => void
}) {
  const supabase = createClient()
  const isOpen = openSiblingId === noeud.id

  // Enfants directs (triés par ordre)
  const enfants = allNoeuds
    .filter((n) => n.parent_id === noeud.id)
    .sort((a, b) => a.ordre - b.ordre)

  // État local de l'enfant ouvert dans CE nœud
  const [openChildId, setOpenChildId] = useState<string | null>(null)

  // Feuilles chargées à l'ouverture
  const [feuilles, setFeuilles] = useState<Feuille[] | null>(null)
  const [feuillesLoading, setFeuillesLoading] = useState(false)

  // Actions
  const [showEnfantForm, setShowEnfantForm] = useState(false)
  const [suppression, setSuppression] = useState(false)

  async function chargerFeuilles() {
    setFeuillesLoading(true)
    const { data } = await supabase
      .from('feuille_entrainement')
      .select('id, titre, volume, pdf_url, ordre')
      .eq('noeud_id', noeud.id)
      .order('ordre')
    setFeuilles((data as Feuille[]) ?? [])
    setFeuillesLoading(false)
  }

  async function rechargerFeuilles() {
    const { data } = await supabase
      .from('feuille_entrainement')
      .select('id, titre, volume, pdf_url, ordre')
      .eq('noeud_id', noeud.id)
      .order('ordre')
    setFeuilles((data as Feuille[]) ?? [])
  }

  function toggle() {
    if (isOpen) {
      setOpenSiblingId(null)
    } else {
      setOpenSiblingId(noeud.id)
      if (feuilles === null) chargerFeuilles()
    }
  }

  async function handleDeleteFeuille(id: string, titre: string) {
    if (!confirm(`Supprimer "${titre}" ?`)) return
    const { error } = await supabase
      .from('feuille_entrainement')
      .delete()
      .eq('id', id)
    if (error) {
      alert('Erreur : ' + error.message)
    } else {
      rechargerFeuilles()
    }
  }

  async function handleDelete() {
    const { count: feuilleCount } = await supabase
      .from('feuille_entrainement')
      .select('id', { count: 'exact', head: true })
      .eq('noeud_id', noeud.id)
    if ((feuilleCount ?? 0) > 0) {
      alert('Ce nœud possède des feuilles liées — suppression impossible.')
      return
    }
    if (enfants.length > 0) {
      alert('Ce nœud possède des enfants — suppression impossible.')
      return
    }
    setSuppression(true)
    await supabase.from('noeud').delete().eq('id', noeud.id)
    onMutation()
  }

  const indent = profondeur * 16

  return (
    <div style={{ paddingLeft: indent }}>
      {/* Ligne nœud */}
      <div
        className="group flex items-center justify-between border-b border-gray-100 last:border-0"
        style={{ padding: '10px 12px', paddingLeft: 0 }}
      >
        {/* Nom cliquable */}
        <button
          onClick={toggle}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <span className="text-xs text-gray-300 shrink-0 w-3">
            {isOpen ? '▾' : '▸'}
          </span>
          <span
            className={`text-sm truncate ${
              profondeur === 0
                ? 'font-semibold text-gray-900'
                : profondeur === 1
                ? 'font-medium text-gray-700'
                : 'text-gray-600'
            }`}
          >
            {noeud.nom}
          </span>
          <span className="text-xs text-gray-300 shrink-0">#{noeud.ordre}</span>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); setShowEnfantForm((p) => !p) }}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            + Enfant
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete() }}
            disabled={suppression}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
          >
            Suppr.
          </button>
        </div>
      </div>

      {/* Formulaire ajout enfant */}
      {showEnfantForm && (
        <div className="ml-3 mb-1">
          <FormulaireNoeudEnfant
            parentId={noeud.id}
            onCancel={() => setShowEnfantForm(false)}
            onSuccess={() => { setShowEnfantForm(false); onMutation() }}
          />
        </div>
      )}

      {/* Contenu ouvert */}
      {isOpen && (
        <div className="ml-3 space-y-0">
          {/* Enfants récursifs */}
          {enfants.map((enfant) => (
            <NoeudAccordeon
              key={enfant.id}
              noeud={enfant}
              profondeur={profondeur + 1}
              allNoeuds={allNoeuds}
              openSiblingId={openChildId}
              setOpenSiblingId={setOpenChildId}
              onMutation={onMutation}
            />
          ))}

          {/* Feuilles existantes */}
          {feuillesLoading && (
            <p className="text-xs text-gray-400 px-3 py-2">Chargement…</p>
          )}
          {feuilles && feuilles.length > 0 && (
            <div className="bg-gray-50 divide-y divide-gray-100">
              {feuilles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between px-3 py-2 gap-2"
                >
                  <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{f.titre}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400">{f.volume} ex.</span>
                    {f.pdf_url && (
                      <a
                        href={f.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-gray-700"
                        title="Voir le PDF"
                      >
                        PDF↗
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteFeuille(f.id, f.titre)
                      }}
                      className="text-gray-300 hover:text-red-500 transition-colors text-sm ml-auto"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulaire ajout feuille */}
          {feuilles !== null && (
            <FormulaireFeuille
              noeudId={noeud.id}
              defaultOrdre={(feuilles?.length ?? 0) + 1}
              onSuccess={rechargerFeuilles}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Composant principal ─────────────────────────────────────────────
export default function AdminClient({ noeuds: initial }: { noeuds: Noeud[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [noeuds, setNoeuds] = useState<Noeud[]>(initial)
  const [openRootId, setOpenRootId] = useState<string | null>(null)
  const [showRacineForm, setShowRacineForm] = useState(false)

  const racines = noeuds
    .filter((n) => n.parent_id === null)
    .sort((a, b) => a.ordre - b.ordre)

  async function rechargerNoeuds() {
    const { data } = await supabase
      .from('noeud')
      .select('id, parent_id, nom, ordre')
      .order('ordre')
    setNoeuds((data as Noeud[]) ?? [])
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Scope — Arbre nœuds</h2>
        <button
          onClick={() => setShowRacineForm((p) => !p)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          + Nœud racine
        </button>
      </div>

      {/* Formulaire nœud racine */}
      {showRacineForm && (
        <FormulaireNoeudEnfant
          parentId={null}
          onCancel={() => setShowRacineForm(false)}
          onSuccess={() => { setShowRacineForm(false); rechargerNoeuds() }}
        />
      )}

      {/* Arbre */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {racines.length === 0 ? (
          <p className="text-sm text-gray-400 px-4 py-6">Aucun nœud.</p>
        ) : (
          <div className="divide-y divide-gray-100 px-4">
            {racines.map((n) => (
              <NoeudAccordeon
                key={n.id}
                noeud={n}
                profondeur={0}
                allNoeuds={noeuds}
                openSiblingId={openRootId}
                setOpenSiblingId={setOpenRootId}
                onMutation={rechargerNoeuds}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
