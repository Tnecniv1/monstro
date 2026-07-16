import { InlineMath } from 'react-katex'

interface Props {
  text: string
}

export default function MathText({ text }: Props) {
  // \$ (dollar littéral échappé) ne compte jamais comme délimiteur d'ouverture/fermeture
  const segments = text.split(/(\$(?:\\\$|[^$])+\$)/g)

  return (
    <>
      {segments.map((seg, i) =>
        seg.startsWith('$') && seg.endsWith('$') ? (
          <InlineMath key={i} math={seg.slice(1, -1)} />
        ) : (
          <span key={i}>{seg}</span>
        )
      )}
    </>
  )
}
