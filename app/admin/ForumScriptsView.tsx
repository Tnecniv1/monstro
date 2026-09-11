'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MathText from '../components/MathText'
import type { ForumScript } from '../forum/types'

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

function ScriptForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: ForumScript
  onCancel: () => void
  onSaved: () => void
}) {
  const supabase = createClient()

  const [titre, setTitre] = useState(initial?.titre ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [contenu, setContenu] = useState(initial?.contenu ?? '')
  const [pdfUrl, setPdfUrl] = useState(initial?.pdf_url ?? '')
  const [ordre, setOrdre] = useState(initial?.ordre ?? 1)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fichierNom, setFichierNom] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function uploadPdf(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Seuls les fichiers PDF sont acceptés.')
      return
    }
    setUploading(true)
    setError(null)
    const safeName = sanitizeFileName(file.name)
    const path = `forum/${Date.now()}_${safeName}`
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

    const payload = {
      titre: titre.trim(),
      description: description.trim(),
      contenu,
      pdf_url: pdfUrl.trim() || null,
      ordre,
    }

    const { error } = initial
      ? await supabase.from('forum_scripts').update(payload).eq('id', initial.id)
      : await supabase.from('forum_scripts').insert(payload)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
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
        <label className="block text-xs font-medium text-text-secondary">Description courte</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* PDF — champ principal : la fiche s'affiche désormais comme un PDF direct (ScriptPdfModal). */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-text-secondary">PDF</label>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-border-strong hover:bg-surface'
          }`}
        >
          <input type="file" accept=".pdf" onChange={handleFileInput} className="sr-only" />
          {uploading ? (
            <p className="text-xs text-text-muted">Upload en cours…</p>
          ) : fichierNom ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-success">✓ {fichierNom}</p>
              <p className="text-xs text-text-muted">Cliquer pour changer</p>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              Glissez un PDF ici ou <span className="underline">cliquez pour sélectionner</span>
            </p>
          )}
        </label>

        <input
          type="text"
          value={pdfUrl}
          onChange={(e) => setPdfUrl(e.target.value)}
          required
          placeholder="https://… (rempli automatiquement après upload)"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-text-secondary">
          Contenu texte (optionnel, non affiché pour l&apos;instant)
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 pt-1">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-secondary">Contenu ($...$ pour les maths)</label>
            <textarea
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-secondary">Aperçu</label>
            <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary whitespace-pre-wrap leading-relaxed h-full min-h-[180px] overflow-y-auto">
              {contenu ? <MathText text={contenu} /> : <span className="text-text-muted">…</span>}
            </div>
          </div>
        </div>
      </details>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading || uploading}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </form>
  )
}

export default function ForumScriptsView() {
  const supabase = createClient()

  const [scripts, setScripts] = useState<ForumScript[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function charger() {
    setLoading(true)
    const { data } = await supabase
      .from('forum_scripts')
      .select('id, titre, description, contenu, pdf_url, ordre')
      .order('ordre')
    setScripts((data as ForumScript[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDelete(script: ForumScript) {
    if (!confirm(`Supprimer la fiche "${script.titre}" ? Cette action est irréversible.`)) return
    const { error } = await supabase.from('forum_scripts').delete().eq('id', script.id)
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    charger()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Forum — Fiches</h2>
        <button
          onClick={() => { setShowCreate((v) => !v); setEditingId(null) }}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2 transition-colors"
        >
          + Nouvelle fiche
        </button>
      </div>

      {showCreate && (
        <ScriptForm onCancel={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); charger() }} />
      )}

      {loading && <p className="text-sm text-text-muted">Chargement…</p>}

      {!loading && scripts.length === 0 && !showCreate && (
        <p className="text-sm text-text-muted">Aucune fiche pour l&apos;instant.</p>
      )}

      <div className="space-y-2">
        {scripts.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">#{s.ordre} — {s.titre}</p>
                <p className="text-xs text-text-muted truncate">{s.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                <button
                  onClick={() => { setEditingId((id) => (id === s.id ? null : s.id)); setShowCreate(false) }}
                  className="text-text-secondary hover:text-accent transition-colors"
                >
                  Modifier
                </button>
                <button onClick={() => handleDelete(s)} className="text-danger hover:opacity-70 transition-opacity">
                  Supprimer
                </button>
              </div>
            </div>
            {editingId === s.id && (
              <div className="border-t border-border p-4">
                <ScriptForm
                  initial={s}
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
