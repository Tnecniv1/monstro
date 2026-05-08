'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ViewerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pdfUrl = searchParams.get('url') ?? ''

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 active:text-gray-500 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Retour
        </button>
      </div>
      {pdfUrl ? (
        <iframe
          src={pdfUrl}
          className="flex-1 w-full border-none"
          title="Document PDF"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Aucun document spécifié.
        </div>
      )}
    </div>
  )
}

export default function ViewerPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center text-gray-400 text-sm">
        Chargement…
      </div>
    }>
      <ViewerContent />
    </Suspense>
  )
}
