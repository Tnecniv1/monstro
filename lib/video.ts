// Vidéo d'un script du forum (forum_scripts.video_url) : lien → type de
// lecteur. Fonction pure, sans React ni Supabase : fichier copiable tel quel
// sur mobile.
//
// Règles :
// - YouTube (youtube.com/watch?v=<id>, youtu.be/<id>, youtube.com/shorts/<id>,
//   avec ou sans www. ou m.) → lecteur intégré youtube-nocookie.com/embed/<id>.
// - Lien direct vers un fichier .mp4, .webm ou .mov (paramètres après « ? »
//   ou « # » ignorés) → lecteur vidéo natif.
// - Tout autre lien http(s) → simple lien « Voir la vidéo ».
// - Un lien qui commence par youtube.com, youtu.be, m.youtube.com ou www.
//   (sans protocole) reçoit « https:// » devant avant l'analyse.
// - Champ vide, lien illisible ou autre protocole que http(s) → null (rien
//   n'est affiché).
//
// Exemples :
// 1. 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42'
//    → { type: 'youtube', id: 'dQw4w9WgXcQ',
//        embed: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }
// 2. 'https://youtu.be/dQw4w9WgXcQ' ou 'https://youtube.com/shorts/dQw4w9WgXcQ'
//    → { type: 'youtube', id: 'dQw4w9WgXcQ', embed: '…/embed/dQw4w9WgXcQ' }
// 3. 'https://exemple.supabase.co/storage/v1/object/public/videos/script1.mp4?v=2'
//    → { type: 'fichier', url: (le lien tel quel) }
// 4. 'https://vimeo.com/123456'
//    → { type: 'lien', url: 'https://vimeo.com/123456' }
// 5. 'youtu.be/dQw4w9WgXcQ' (sans https://) → analysé comme
//    'https://youtu.be/dQw4w9WgXcQ' → { type: 'youtube', id: 'dQw4w9WgXcQ', … } ;
//    'www.exemple.fr/cours.mp4' → { type: 'fichier', url: 'https://www.exemple.fr/cours.mp4' }

export type Video =
  | { type: 'youtube'; id: string; embed: string }
  | { type: 'fichier'; url: string }
  | { type: 'lien'; url: string }

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/
const HOTES_YOUTUBE = ['youtube.com', 'www.youtube.com', 'm.youtube.com']
const EXTENSIONS_VIDEO = ['.mp4', '.webm', '.mov']
// Débuts de lien sans protocole complétés par « https:// ».
const SANS_PROTOCOLE = /^(youtube\.com|youtu\.be|m\.youtube\.com|www\.)/i

function idYoutube(u: URL): string | null {
  const hote = u.hostname.toLowerCase()
  const segments = u.pathname.split('/').filter(Boolean)
  let id: string | null = null
  if (hote === 'youtu.be') id = segments[0] ?? null
  else if (HOTES_YOUTUBE.includes(hote)) {
    if (segments[0] === 'watch') id = u.searchParams.get('v')
    else if (segments[0] === 'shorts') id = segments[1] ?? null
  }
  return id && ID_YOUTUBE.test(id) ? id : null
}

export function analyserVideo(lien: string | null | undefined): Video | null {
  const saisi = (lien ?? '').trim()
  if (!saisi) return null
  const brut = SANS_PROTOCOLE.test(saisi) ? `https://${saisi}` : saisi
  let u: URL
  try {
    u = new URL(brut)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null

  const id = idYoutube(u)
  if (id) return { type: 'youtube', id, embed: `https://www.youtube-nocookie.com/embed/${id}` }

  const chemin = u.pathname.toLowerCase()
  if (EXTENSIONS_VIDEO.some((ext) => chemin.endsWith(ext))) return { type: 'fichier', url: brut }

  return { type: 'lien', url: brut }
}
