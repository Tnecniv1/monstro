'use client'

import { useEffect, useRef, useState } from 'react'
import { getSignedPdfUrl } from '@/lib/getSignedPdfUrl'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf'

// Affichage d'un PDF du bucket pdfs, page par page, dessiné avec pdf.js
// (Safari iPhone affiche mal un PDF en iframe). Ce module n'est chargé qu'à
// l'ouverture du panneau (next/dynamic dans EnonceFlottant), et pdf.js
// lui-même seulement au premier document demandé.

type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf')

let pdfjsPromesse: Promise<Pdfjs> | null = null
function chargerPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromesse) {
    pdfjsPromesse = import('pdfjs-dist/legacy/build/pdf').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.js',
        import.meta.url
      ).toString()
      return pdfjs
    })
  }
  return pdfjsPromesse
}

// Un téléchargement par document pendant la visite (panneau ↔ plein écran,
// Énoncé ↔ Correction) ; une erreur est oubliée pour pouvoir réessayer.
const documents = new Map<string, Promise<PDFDocumentProxy>>()
function chargerDocument(pdfUrl: string): Promise<PDFDocumentProxy> {
  let p = documents.get(pdfUrl)
  if (!p) {
    p = (async () => {
      const [pdfjs, signee] = await Promise.all([chargerPdfjs(), getSignedPdfUrl(pdfUrl)])
      if (!signee) throw new Error('Lien du document indisponible.')
      return pdfjs.getDocument({ url: signee }).promise
    })()
    p.catch(() => documents.delete(pdfUrl))
    documents.set(pdfUrl, p)
  }
  return p
}

export function useDocumentPdf(pdfUrl: string | null) {
  const [etat, setEtat] = useState<{ doc: PDFDocumentProxy | null; erreur: string | null }>({ doc: null, erreur: null })
  const [essai, setEssai] = useState(0)
  useEffect(() => {
    if (!pdfUrl) return
    let actif = true
    setEtat({ doc: null, erreur: null })
    chargerDocument(pdfUrl).then(
      (doc) => actif && setEtat({ doc, erreur: null }),
      (e: Error) => {
        console.error('[énoncé flottant] pdf', e)
        if (actif) setEtat({ doc: null, erreur: 'Impossible d’afficher le document.' })
      }
    )
    return () => {
      actif = false
    }
  }, [pdfUrl, essai])
  return { ...etat, reessayer: () => setEssai((n) => n + 1) }
}

// Largeur disponible d'un élément (suivie au redimensionnement).
function useLargeur<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [largeur, setLargeur] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setLargeur(el.clientWidth))
    ro.observe(el)
    setLargeur(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return { ref, largeur }
}

// Une page dessinée à la largeur donnée, en haute résolution (écran Retina,
// et un peu de marge pour le zoom).
export function PagePdf({ doc, numero, largeur }: { doc: PDFDocumentProxy; numero: number; largeur: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hauteur, setHauteur] = useState<number | null>(null)

  useEffect(() => {
    if (largeur <= 0) return
    let tache: RenderTask | null = null
    let annule = false
    doc.getPage(numero).then((page) => {
      if (annule || !canvasRef.current) return
      const base = page.getViewport({ scale: 1 })
      const echelleCss = largeur / base.width
      const densite = Math.min(3, (window.devicePixelRatio || 1) * 1.5)
      const vue = page.getViewport({ scale: echelleCss * densite })
      const canvas = canvasRef.current
      canvas.width = Math.floor(vue.width)
      canvas.height = Math.floor(vue.height)
      setHauteur(base.height * echelleCss)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      tache = page.render({ canvasContext: ctx, viewport: vue })
      tache.promise.catch(() => {})
    })
    return () => {
      annule = true
      tache?.cancel()
    }
  }, [doc, numero, largeur])

  return (
    <canvas
      ref={canvasRef}
      className="block bg-white shadow-sm"
      style={{ width: largeur, height: hauteur ?? largeur * 1.414 }}
      aria-label={`Page ${numero}`}
    />
  )
}

// Toutes les pages l'une sous l'autre (panneau). Légende « page x / N » :
// page la plus visible. pageInitiale : page affichée à l'ouverture.
export function PagesDefilantes({
  doc,
  pageInitiale = 1,
  onPageVisible,
}: {
  doc: PDFDocumentProxy
  pageInitiale?: number
  onPageVisible: (page: number) => void
}) {
  const { ref, largeur } = useLargeur<HTMLDivElement>()
  const pages = Array.from({ length: doc.numPages }, (_, i) => i + 1)
  const pagesRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const racine = ref.current?.parentElement
    if (!racine) return
    const visibles = new Map<number, number>()
    const io = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) visibles.set(Number((e.target as HTMLElement).dataset.page), e.intersectionRatio)
        let meilleure = 1
        let ratio = -1
        visibles.forEach((r, p) => {
          if (r > ratio) {
            ratio = r
            meilleure = p
          }
        })
        onPageVisible(meilleure)
      },
      { root: racine, threshold: [0, 0.25, 0.5, 0.75, 1] }
    )
    pagesRef.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [doc, largeur, onPageVisible, ref])

  useEffect(() => {
    if (pageInitiale > 1 && largeur > 0) pagesRef.current[pageInitiale - 1]?.scrollIntoView({ block: 'start' })
    // Une seule fois par document, à la première mesure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, largeur > 0])

  return (
    <div ref={ref} className="space-y-3">
      {largeur > 0 &&
        pages.map((n) => (
          <div key={n} data-page={n} ref={(el) => { pagesRef.current[n - 1] = el }}>
            <PagePdf doc={doc} numero={n} largeur={largeur} />
          </div>
        ))}
    </div>
  )
}

// Une seule page à la largeur du conteneur (plein écran).
export function PageSeule({ doc, numero }: { doc: PDFDocumentProxy; numero: number }) {
  const { ref, largeur } = useLargeur<HTMLDivElement>()
  return (
    <div ref={ref} className="mx-auto w-full max-w-3xl">
      {largeur > 0 && <PagePdf doc={doc} numero={numero} largeur={largeur} />}
    </div>
  )
}
