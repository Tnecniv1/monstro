import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'
import type { createClient } from '@/lib/supabase/server'

type Client = ReturnType<typeof createClient>

// Exercices transcrits en texte (table exercice, une ligne par feuille +
// numéro), utilisés seulement quand la feuille a exercices_publies. Le texte
// est du Markdown avec formules $…$ / $$…$$, rendu ici côté serveur avec la
// même chaîne que les articles et que la vérification de monstro-agent
// (remark-gfm, remark-math, rehype-katex). Le HTML brut éventuel du Markdown
// est ignoré (remark-rehype sans allowDangerousHtml).
// Figures : bucket privé « exercices », chemins <feuille_id>/<numero>/<nom> listés
// dans exercice.images ; le Markdown les cite par leur nom (![…](nom.png)),
// remplacé ici par une URL signée.

export type ExerciceTexte = {
  enonceHtml: string
  correctionHtml: string | null
}

// Durée des URL signées des figures (comme les PDF).
const DUREE_URL_SIGNEE = 3600

export function rendreExercice(markdown: string, urlsImages: Map<string, string>): string {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(() => (arbre: Root) => {
      visit(arbre, 'element', (el: Element) => {
        if (el.tagName !== 'img' || typeof el.properties?.src !== 'string') return
        const url = urlsImages.get(el.properties.src)
        if (url) el.properties.src = url
      })
    })
    .use(rehypeKatex)
    .use(rehypeStringify)
    .processSync(markdown)
    .toString()
}

// Exercice en texte si sa feuille est publiée ; null sinon, s'il est absent
// (le panneau garde alors le PDF) ou en cas d'erreur. La publication est lue
// à part : une erreur ici (colonne ou table pas encore créées) ne doit pas
// empêcher de charger l'exercice en cours.
export async function chargerExerciceTexte(
  supabase: Client,
  feuilleId: string,
  numero: number
): Promise<ExerciceTexte | null> {
  const { data: feuille, error: erreurFeuille } = await supabase
    .from('feuille_entrainement')
    .select('exercices_publies')
    .eq('id', feuilleId)
    .maybeSingle()
  if (erreurFeuille) {
    console.error('[exercice texte] publication', erreurFeuille)
    return null
  }
  if (!(feuille as { exercices_publies: boolean | null } | null)?.exercices_publies) return null

  const { data, error } = await supabase
    .from('exercice')
    .select('enonce, correction, images')
    .eq('feuille_id', feuilleId)
    .eq('numero', numero)
    .maybeSingle()
  if (error) {
    console.error('[exercice texte]', error)
    return null
  }
  if (!data) return null
  const ligne = data as { enonce: string; correction: string | null; images: string[] | null }

  // Figures : nom du fichier → URL signée.
  const urls = new Map<string, string>()
  const chemins = ligne.images ?? []
  if (chemins.length > 0) {
    const { data: signees, error: erreurUrls } = await supabase.storage
      .from('exercices')
      .createSignedUrls(chemins, DUREE_URL_SIGNEE)
    if (erreurUrls) console.error('[exercice texte] images', erreurUrls)
    for (const s of signees ?? []) {
      if (s.path && s.signedUrl) urls.set(s.path.split('/').pop()!, s.signedUrl)
    }
  }

  try {
    return {
      enonceHtml: rendreExercice(ligne.enonce, urls),
      correctionHtml: ligne.correction ? rendreExercice(ligne.correction, urls) : null,
    }
  } catch (e) {
    console.error('[exercice texte] rendu', e)
    return null
  }
}
