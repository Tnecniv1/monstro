// Page /voyage : un seul fichier Markdown fixe du coffre Obsidian, rendu par le pipeline des articles.
import fs from 'node:fs'
import path from 'node:path'
import { SKIP, visit } from 'unist-util-visit'
import type { Root } from 'hast'
import { champTexte, lireEntete, rendreMarkdown } from './articles'

const FICHIER = 'content/voyage/introduction.md'

export type Voyage = {
  titre: string
  description: string
  /** Libellé du bouton final, ou null (pas de bouton) */
  bouton: string | null
  html: string
}

// Espace insécable avant « ? », « ! », « : », « ; » ; espace fine insécable dans « 5 000 »
function typographier(texte: string): string {
  return texte
    .replace(/ (?=[?!:;])/g, ' ')
    .replace(/(?<!\d)\d{1,3}(?: \d{3})+(?!\d)/g, (nombre) => nombre.replace(/ /g, ' '))
}

// Plugin rehype : typographie des nœuds texte, hors code et maths (<code>, <pre>)
function rehypeTypographie() {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (node.type === 'element' && (node.tagName === 'code' || node.tagName === 'pre')) return SKIP
      if (node.type === 'text') node.value = typographier(node.value)
    })
  }
}

/** Contenu de la page, ou null si le fichier est absent ou en brouillon. */
export function getVoyage(): Voyage | null {
  const chemin = path.join(process.cwd(), FICHIER)
  if (!fs.existsSync(chemin)) return null

  const source = fs.readFileSync(chemin, 'utf8')
  const { data, content } = lireEntete(FICHIER, source)
  if (data.brouillon === true) return null

  const bouton = typeof data.bouton === 'string' ? data.bouton.trim() : ''
  return {
    titre: typographier(champTexte(data, 'titre', FICHIER)),
    description: typographier(champTexte(data, 'description', FICHIER)),
    bouton: bouton ? typographier(bouton) : null,
    html: rendreMarkdown('voyage', FICHIER, source, content, [rehypeTypographie]),
  }
}
