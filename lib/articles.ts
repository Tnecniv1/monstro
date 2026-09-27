// Articles Markdown des sections vitrine, rédigés dans Obsidian (coffre = content/).
// Lu côté serveur au build uniquement. Toute erreur de contenu fait échouer le build
// avec un message indiquant le fichier (et la ligne quand elle est connue).
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Image, Root, Text } from 'mdast'

// Même liste que scripts/copy-article-images.mjs
export const SECTIONS = ['philosophie', 'problemes'] as const
export type Section = (typeof SECTIONS)[number]

export const SECTION_LABELS: Record<Section, string> = {
  philosophie: 'Philosophie',
  problemes: 'Problèmes',
}

export type Article = {
  section: Section
  slug: string
  titre: string
  description: string
  /** 'YYYY-MM-DD' */
  date: string
  /** URL publique de l'image de couverture (/articles/<section>/…), ou null */
  image: string | null
  html: string
}

const CONTENT_DIR = path.join(process.cwd(), 'content')

class ArticleError extends Error {
  constructor(fichier: string, message: string, ligne?: number) {
    const lieu = ligne ? `${fichier}:${ligne}` : fichier
    super(`[articles] ${lieu} — ${message}`)
    this.name = 'ArticleError'
  }
}

// "Pourquoi raisonner ?" → "pourquoi-raisonner"
export function slugify(texte: string): string {
  return texte
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'Oe')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'Ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// "2026-10-12" → "12 octobre 2026"
export function formatDateLongue(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function champTexte(data: Record<string, unknown>, champ: string, fichier: string): string {
  const valeur = data[champ]
  if (typeof valeur !== 'string' || !valeur.trim()) {
    throw new ArticleError(fichier, `champ obligatoire « ${champ} » manquant ou vide dans l'en-tête`)
  }
  return valeur.trim()
}

// YAML convertit une date non quotée en objet Date, en « corrigeant » silencieusement
// les dates impossibles (2026-02-30 → 2 mars) : on valide donc le texte brut de l'en-tête.
function champDate(data: Record<string, unknown>, enteteBrut: string, fichier: string): string {
  if (data.date === undefined || data.date === null || data.date === '') {
    throw new ArticleError(fichier, "champ obligatoire « date » manquant dans l'en-tête")
  }
  const brut =
    data.date instanceof Date
      ? enteteBrut.match(/^date:\s*['"]?([^'"\s#]+)/m)?.[1]
      : String(data.date).trim()
  const valide =
    !!brut &&
    /^\d{4}-\d{2}-\d{2}$/.test(brut) &&
    new Date(`${brut}T00:00:00Z`).toISOString().slice(0, 10) === brut
  if (!valide) {
    throw new ArticleError(fichier, `date invalide « ${brut ?? data.date} » (format attendu : AAAA-MM-JJ)`)
  }
  return brut
}

// Chemin relatif Obsidian (images/x.png, éventuellement encodé %20) → URL publique.
// L'image doit exister et se trouver dans content/<section>/images/ (seul dossier copié dans public/).
function urlImage(section: Section, cheminRelatif: string, fichier: string, ligne?: number): string {
  let decode: string
  try {
    decode = decodeURI(cheminRelatif)
  } catch {
    decode = cheminRelatif
  }
  const dossierImages = path.join(CONTENT_DIR, section, 'images')
  const absolu = path.resolve(CONTENT_DIR, section, decode)
  const relatif = path.relative(dossierImages, absolu)

  if (relatif.startsWith('..') || path.isAbsolute(relatif)) {
    throw new ArticleError(fichier, `image « ${cheminRelatif} » hors de content/${section}/images/`, ligne)
  }
  if (!fs.existsSync(absolu) || !fs.statSync(absolu).isFile()) {
    throw new ArticleError(fichier, `image introuvable « ${cheminRelatif} »`, ligne)
  }
  return encodeURI(`/articles/${section}/${relatif.split(path.sep).join('/')}`)
}

function estCheminRelatif(url: string): boolean {
  return !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url)
}

// Plugin remark : refuse les wikilinks Obsidian et réécrit les images relatives du corps.
// Travaille sur l'arbre Markdown, donc ignore le code et les formules (ex. $[[1,n]]$).
function remarkObsidian(options: { section: Section; fichier: string; decalage: number }) {
  const { section, fichier, decalage } = options
  return (tree: Root) => {
    visit(tree, 'text', (node: Text) => {
      const wikilink = node.value.match(/!?\[\[[^\]]*\]\]/)
      if (wikilink) {
        const ligne = node.position ? node.position.start.line + decalage : undefined
        throw new ArticleError(
          fichier,
          `lien Obsidian « ${wikilink[0]} » non supporté : utilise la syntaxe Markdown ![](images/…) ou [texte](…) ` +
            '(Paramètres Obsidian → Fichiers et liens → désactiver « Utiliser les [[Wikilinks]] »)',
          ligne,
        )
      }
    })
    visit(tree, 'image', (node: Image) => {
      if (!estCheminRelatif(node.url)) return
      const ligne = node.position ? node.position.start.line + decalage : undefined
      node.url = urlImage(section, node.url, fichier, ligne)
    })
  }
}

function lireArticle(section: Section, nomFichier: string): Article | null {
  const fichier = `content/${section}/${nomFichier}`
  const source = fs.readFileSync(path.join(CONTENT_DIR, section, nomFichier), 'utf8')
  let parsed: matter.GrayMatterFile<string>
  try {
    parsed = matter(source)
  } catch (e) {
    // Erreur YAML : js-yaml numérote depuis la fin de la ligne « --- » d'ouverture (0), d'où le +1
    const err = e as { reason?: string; message?: string; mark?: { line: number } }
    throw new ArticleError(
      fichier,
      `en-tête YAML invalide (${err.reason ?? err.message}). ` +
        'Astuce : mettre la valeur entre guillemets si elle contient « : » (ex. description: "Titre : sous-titre")',
      err.mark ? err.mark.line + 1 : undefined,
    )
  }
  const { data, content, matter: enteteBrut } = parsed

  // Brouillon : exclu du site, sans validation (il peut être incomplet)
  if (data.brouillon === true) return null

  const titre = champTexte(data, 'titre', fichier)
  const description = champTexte(data, 'description', fichier)
  const date = champDate(data, enteteBrut, fichier)
  const image =
    data.image === undefined || data.image === null || data.image === ''
      ? null
      : urlImage(section, String(data.image), fichier)
  const slug = data.slug ? slugify(String(data.slug)) : slugify(nomFichier.replace(/\.md$/i, ''))
  if (!slug) throw new ArticleError(fichier, 'slug vide (nom de fichier ou champ « slug » sans lettre ni chiffre)')

  // Numéro de ligne dans le fichier = ligne dans le corps + lignes de l'en-tête
  const decalage = source.split('\n').length - content.split('\n').length

  const html = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkObsidian, { section, fichier, decalage })
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .processSync(content)
    .toString()

  return { section, slug, titre, description, date, image, html }
}

const cache = new Map<Section, Article[]>()

/** Articles publiés (hors brouillons) d'une section, du plus récent au plus ancien. */
export function getArticles(section: Section): Article[] {
  const enCache = cache.get(section)
  if (enCache) return enCache

  const dossier = path.join(CONTENT_DIR, section)
  const fichiers = fs.existsSync(dossier)
    ? fs.readdirSync(dossier).filter((f) => f.toLowerCase().endsWith('.md'))
    : []

  const articles: Article[] = []
  const parSlug = new Map<string, string>()
  for (const nomFichier of fichiers) {
    const article = lireArticle(section, nomFichier)
    if (!article) continue
    const doublon = parSlug.get(article.slug)
    if (doublon) {
      throw new ArticleError(
        `content/${section}/${nomFichier}`,
        `slug « ${article.slug} » déjà utilisé par content/${section}/${doublon}`,
      )
    }
    parSlug.set(article.slug, nomFichier)
    articles.push(article)
  }

  articles.sort((a, b) => b.date.localeCompare(a.date) || a.titre.localeCompare(b.titre, 'fr'))
  cache.set(section, articles)
  return articles
}

export function getArticle(section: Section, slug: string): Article | undefined {
  return getArticles(section).find((a) => a.slug === slug)
}
