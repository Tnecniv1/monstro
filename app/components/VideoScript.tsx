import { analyserVideo } from '@/lib/video'

// Vidéo d'un script (forum_scripts.video_url), selon lib/video.ts : lecteur
// YouTube intégré (youtube-nocookie, 16:9), lecteur natif pour un fichier
// vidéo, sinon bouton « Voir la vidéo » (nouvel onglet). Rien si le lien est
// vide ou illisible.
export default function VideoScript({ url, titre }: { url: string | null | undefined; titre?: string }) {
  const video = analyserVideo(url)
  if (!video) return null

  if (video.type === 'lien') {
    return (
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-surface-2"
      >
        Voir la vidéo
      </a>
    )
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
      {video.type === 'youtube' ? (
        <iframe
          src={video.embed}
          title={titre ?? 'Vidéo'}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <video src={video.url} controls playsInline preload="metadata" className="h-full w-full" />
      )}
    </div>
  )
}
