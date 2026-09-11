// Google Docs Viewer rend le PDF en HTML paginé, scrollable au toucher sur iOS
// Safari — un <iframe src="..."> pointant directement sur le PDF est bloqué
// par le plugin PDF natif d'iOS (pas de scroll tactile). Utilisé par
// app/viewer/page.tsx et app/forum/ScriptPdfModal.tsx : ne pas dupliquer
// cette construction d'URL ailleurs.
export function googleDocsViewerUrl(pdfUrl: string): string {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`
}
