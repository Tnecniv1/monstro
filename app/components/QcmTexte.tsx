import { BlockMath, InlineMath } from 'react-katex'

// Texte d'un QCM (énoncé, choix) avec LaTeX : $…$ en ligne, $$…$$ et \[…\]
// en bloc, retours à la ligne conservés. `compact` rend les blocs en ligne
// (aperçu tronqué). Une formule invalide s'affiche en texte brut.
// MathText (forum) ne gère que $…$ : ne pas l'utiliser pour la banque QCM.
const MOTIF = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$(?:\\\$|[^$])+\$)/g

function brut(source: string) {
  return () => source
}

function Texte({ texte }: { texte: string }) {
  const lignes = texte.replace(/\\\$/g, '$').split('\n')
  return (
    <>
      {lignes.map((l, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {l}
        </span>
      ))}
    </>
  )
}

export default function QcmTexte({ text, compact = false }: { text: string; compact?: boolean }) {
  const segments = text.split(MOTIF)

  return (
    <>
      {segments.map((seg, i) => {
        if (!seg) return null
        let bloc: string | null = null
        if (seg.startsWith('$$') && seg.endsWith('$$') && seg.length > 4) bloc = seg.slice(2, -2)
        else if (seg.startsWith('\\[') && seg.endsWith('\\]')) bloc = seg.slice(2, -2)
        if (bloc != null) {
          return compact ? (
            <InlineMath key={i} math={bloc} renderError={brut(seg)} />
          ) : (
            <BlockMath key={i} math={bloc} renderError={brut(seg)} />
          )
        }
        if (seg.length > 1 && seg.startsWith('$') && seg.endsWith('$')) {
          return <InlineMath key={i} math={seg.slice(1, -1)} renderError={brut(seg)} />
        }
        return <Texte key={i} texte={seg} />
      })}
    </>
  )
}
