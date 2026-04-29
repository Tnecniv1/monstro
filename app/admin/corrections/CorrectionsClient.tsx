'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type NoeudBase = { id: string; nom: string; parent_id: string | null }
type Noeud = NoeudBase & {
  parent: (NoeudBase & { grandparent: NoeudBase | null }) | null
}
export type FeuilleRow = {
  id: string
  titre: string
  ordre: number
  noeud: Noeud | null
  correction: { id: string; pdf_url: string }[] | null
}

function getAncestorChain(feuille: FeuilleRow): NoeudBase[] {
  const n = feuille.noeud
  if (!n) return []
  const chain: NoeudBase[] = []
  if (n.parent?.grandparent) chain.push(n.parent.grandparent)
  if (n.parent) chain.push(n.parent)
  chain.push(n)
  return chain
}

function cheminFeuille(feuille: FeuilleRow): string {
  return getAncestorChain(feuille).map((n) => n.nom).join(' › ')
}

function hasCorrection(f: FeuilleRow): boolean {
  return Array.isArray(f.correction)
    ? f.correction.length > 0
    : !!f.correction
}

function getCorrectionUrl(f: FeuilleRow): string | null {
  return Array.isArray(f.correction)
    ? f.correction[0]?.pdf_url ?? null
    : (f.correction as any)?.pdf_url ?? null
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/é|è|ê|ë/g, 'e').replace(/à|â|ä/g, 'a').replace(/ù|û|ü/g, 'u')
    .replace(/î|ï/g, 'i').replace(/ô|ö/g, 'o').replace(/ç/g, 'c')
    .replace(/É|È|Ê|Ë/g, 'E').replace(/À|Â|Ä/g, 'A').replace(/Ù|Û|Ü/g, 'U')
    .replace(/Î|Ï/g, 'I').replace(/Ô|Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

function PillsRow({
  options,
  activeId,
  onSelect,
}: {
  options: NoeudBase[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeId === opt.id
              ? 'bg-black text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {opt.nom}
        </button>
      ))}
    </div>
  )
}

function UploadForm({
  feuilleId,
  onSuccess,
  onCancel,
}: {
  feuilleId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const supabase = createClient()
  const [pdfUrl, setPdfUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fichierNom, setFichierNom] = useState<string | null>(null)

  async function uploadPdf(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Seuls les fichiers PDF sont acceptés.')
      return
    }
    setUploading(true)
    setError(null)
    const safeName = sanitizeFileName(file.name)
    const path = `corrections/${feuilleId}/${Date.now()}_${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(path, file, { contentType: 'application/pdf', upsert: false })
    if (uploadError) { setError(uploadError.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(path)
    setPdfUrl(urlData.publicUrl)
    setFichierNom(file.name)
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pdfUrl) { setError('URL ou PDF requis.'); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase
      .from('correction')
      .upsert({ feuille_id: feuilleId, pdf_url: pdfUrl }, { onConflict: 'feuille_id' })
    if (error) { setError(error.message); setLoading(false); return }
    onSuccess()
  }

  return (
    <div className="space-y-2 w-72">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false)
          const f = e.dataTransfer.files[0]; if (f) uploadPdf(f)
        }}
        className={`flex items-center justify-center rounded-lg border-2 border-dashed px-3 py-3 text-center cursor-pointer transition-colors text-xs ${
          dragOver ? 'border-black bg-gray-100' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f) }}
          className="sr-only"
        />
        {uploading ? (
          <span className="text-gray-400">Upload…</span>
        ) : fichierNom ? (
          <span className="text-green-600 truncate max-w-full">✓ {fichierNom}</span>
        ) : (
          <span className="text-gray-400">
            Glisser PDF ou <span className="underline">cliquer</span>
          </span>
        )}
      </label>
      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          type="text"
          placeholder="https://…"
          value={pdfUrl}
          onChange={(e) => setPdfUrl(e.target.value)}
          className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black"
        />
        <button
          type="submit"
          disabled={loading || uploading || !pdfUrl}
          className="rounded bg-black px-2 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50 shrink-0"
        >
          {loading ? '…' : 'Associer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
        >
          Annuler
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default function CorrectionsClient({ feuilles = [] }: { feuilles: FeuilleRow[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [chemin, setChemin] = useState<string[]>([])
  const [sansCorrectionOnly, setSansCorrectionOnly] = useState(false)
  const [openFormId, setOpenFormId] = useState<string | null>(null)

  function optionsAtDepth(depth: number): NoeudBase[] {
    const seen = new Set<string>()
    const result: NoeudBase[] = []
    feuilles.forEach((f) => {
      const chain = getAncestorChain(f)
      for (let d = 0; d < depth; d++) {
        if (chain[d]?.id !== chemin[d]) return
      }
      const node = chain[depth]
      if (node && !seen.has(node.id)) {
        seen.add(node.id)
        result.push(node)
      }
    })
    return result.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const depth0Options = useMemo(() => optionsAtDepth(0), [feuilles])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const depth1Options = useMemo(() => (chemin[0] ? optionsAtDepth(1) : []), [feuilles, chemin[0]])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const depth2Options = useMemo(() => (chemin[1] ? optionsAtDepth(2) : []), [feuilles, chemin[0], chemin[1]])

  function select(depth: number, id: string) {
    setChemin((prev) =>
      prev[depth] === id ? prev.slice(0, depth) : [...prev.slice(0, depth), id]
    )
  }

  const feuillesFiltrees = useMemo(() => {
    return feuilles.filter((f) => {
      const ids = getAncestorChain(f).map((n) => n.id)
      const matchChemin = chemin.every((id) => ids.includes(id))
      return matchChemin && (!sansCorrectionOnly || !hasCorrection(f))
    })
  }, [feuilles, chemin, sansCorrectionOnly])

  const sansCorrectionCount = useMemo(
    () => feuilles.filter((f) => !hasCorrection(f)).length,
    [feuilles]
  )

  async function handleDeleteCorrection(correctionId: string) {
    if (!confirm('Supprimer cette correction ?')) return
    const { error } = await supabase.from('correction').delete().eq('id', correctionId)
    if (error) {
      alert('Erreur : ' + error.message)
    } else {
      router.refresh()
    }
  }

  const n = feuillesFiltrees.length

  return (
    <div className="space-y-4">
      {/* Filtres en cascade */}
      {depth0Options.length > 0 && (
        <PillsRow options={depth0Options} activeId={chemin[0] ?? null} onSelect={(id) => select(0, id)} />
      )}
      {chemin[0] && depth1Options.length > 0 && (
        <PillsRow options={depth1Options} activeId={chemin[1] ?? null} onSelect={(id) => select(1, id)} />
      )}
      {chemin[1] && depth2Options.length > 0 && (
        <PillsRow options={depth2Options} activeId={chemin[2] ?? null} onSelect={(id) => select(2, id)} />
      )}

      {/* Toggle sans correction */}
      <button
        onClick={() => setSansCorrectionOnly((v) => !v)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          sansCorrectionOnly
            ? 'bg-orange-100 text-orange-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        ● Sans correction
      </button>

      {/* Compteur */}
      <p className="text-xs text-gray-400">
        {n} feuille{n > 1 ? 's' : ''} — {sansCorrectionCount} sans correction
      </p>

      {/* Tableau */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {feuillesFiltrees.length === 0 ? (
          <p className="text-sm text-gray-400 px-4 py-6">Aucune feuille.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {feuillesFiltrees.map((f) => {
              const correctionUrl = getCorrectionUrl(f)
              const correctionId = Array.isArray(f.correction) ? (f.correction[0]?.id ?? null) : null
              const chemin = cheminFeuille(f)
              return (
                <div key={f.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.titre}</p>
                    {chemin && <p className="text-xs text-gray-400">{chemin}</p>}
                  </div>
                  <div className="shrink-0">
                    {hasCorrection(f) && correctionUrl ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={correctionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-600 hover:text-gray-900"
                        >
                          📄 Voir
                        </a>
                        {correctionId && (
                          <button
                            onClick={() => handleDeleteCorrection(correctionId)}
                            className="text-gray-300 hover:text-red-500 transition-colors text-sm"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ) : openFormId === f.id ? (
                      <UploadForm
                        feuilleId={f.id}
                        onSuccess={() => { setOpenFormId(null); router.refresh() }}
                        onCancel={() => setOpenFormId(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setOpenFormId(f.id)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        Ajouter
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
