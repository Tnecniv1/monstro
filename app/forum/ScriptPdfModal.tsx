'use client'

import { useEffect, useRef, useState } from 'react'
import { getSignedPdfUrl } from '@/lib/getSignedPdfUrl'
import { googleDocsViewerUrl } from '@/lib/googleDocsViewerUrl'
import type { PdfPreviewItem } from './types'

interface Props {
  script: PdfPreviewItem
  onClose: () => void
}

export default function ScriptPdfModal({ script, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fullscreenSupported, setFullscreenSupported] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    setFullscreenSupported(typeof document !== 'undefined' && document.fullscreenEnabled)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function charger() {
      if (!script.pdf_url) {
        setLoading(false)
        return
      }
      setLoading(true)
      const url = await getSignedPdfUrl(script.pdf_url)
      if (!cancelled) {
        setSignedUrl(url)
        setLoading(false)
      }
    }

    charger()
    return () => {
      cancelled = true
    }
  }, [script.pdf_url])

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  async function toggleFullscreen() {
    if (document.fullscreenElement === containerRef.current) {
      await document.exitFullscreen()
    } else {
      await containerRef.current?.requestFullscreen()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-3xl h-[85vh] bg-surface rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border shrink-0 bg-surface">
          <h2 className="font-semibold text-text-primary truncate">{script.titre}</h2>
          <div className="flex items-center gap-1 shrink-0">
            {fullscreenSupported && signedUrl && (
              <button
                onClick={toggleFullscreen}
                className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors px-2.5 py-1.5 rounded-lg hover:bg-surface-2"
              >
                {isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
              </button>
            )}
            {signedUrl && (
              <a
                href={signedUrl}
                download={`${script.titre}.pdf`}
                className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors px-2.5 py-1.5 rounded-lg hover:bg-surface-2"
              >
                Télécharger
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="text-text-muted hover:text-text-secondary transition-colors text-2xl leading-none p-2 -mr-1"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 bg-surface-2 overflow-hidden">
          {loading && (
            <div className="h-full flex items-center justify-center text-sm text-text-muted">Chargement…</div>
          )}
          {!loading && !script.pdf_url && (
            <div className="h-full flex items-center justify-center text-sm text-text-muted px-6 text-center">
              Aucun PDF disponible pour cette fiche.
            </div>
          )}
          {!loading && script.pdf_url && !signedUrl && (
            <div className="h-full flex items-center justify-center text-sm text-danger px-6 text-center">
              Impossible de charger le PDF.
            </div>
          )}
          {!loading && signedUrl && (
            <iframe src={googleDocsViewerUrl(signedUrl)} className="w-full h-full border-none" title={script.titre} />
          )}
        </div>
      </div>
    </div>
  )
}
