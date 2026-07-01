import { createClient } from '@/lib/supabase/client'

// Extracts the storage path from a public URL — same regex as the remove helpers in AdminClient/CorrectionsClient.
const PATH_REGEX = /\/storage\/v1\/object\/public\/pdfs\/(.+)/

export async function getSignedPdfUrl(urlOrPath: string): Promise<string | null> {
  const match = urlOrPath.match(PATH_REGEX)
  const path = match ? match[1] : urlOrPath

  const supabase = createClient()
  const { data, error } = await supabase.storage.from('pdfs').createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    console.error('[getSignedPdfUrl]', error?.message ?? 'no signed URL returned')
    return null
  }

  return data.signedUrl
}
