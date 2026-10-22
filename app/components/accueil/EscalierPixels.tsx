'use client'

import { useEffect, useRef, useState } from 'react'

// Escalier de pixels : la colonne k (1 à `colonnes`) contient k carrés empilés
// depuis le bas. Les `remplies` premières colonnes sont violettes, les
// suivantes grises. `sommetVert` colore en vert le carré tout en haut à droite.
// `anime` : les carrés violets apparaissent un par un (de gauche à droite, de
// bas en haut) quand l'escalier entre dans l'écran, une seule fois ; état
// final direct si prefers-reduced-motion est actif.
const PAS = 10
const COTE = 9
const DELAI_MS = 60

export default function EscalierPixels({
  colonnes = 8,
  remplies,
  anime = false,
  sommetVert = false,
}: {
  colonnes?: number
  remplies: number
  anime?: boolean
  sommetVert?: boolean
}) {
  // Nombre de carrés violets dans l'ordre d'apparition : colonnes remplies 1..remplies.
  const totalViolets = (remplies * (remplies + 1)) / 2
  const [visibles, setVisibles] = useState(anime ? 0 : totalViolets)
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!anime) return
    const el = ref.current
    if (!el) return
    // Mouvement réduit, ou navigateur sans IntersectionObserver : état final direct.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setVisibles(totalViolets)
      return
    }
    let timer: ReturnType<typeof setInterval> | undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect()
        timer = setInterval(() => {
          setVisibles((v) => {
            if (v + 1 >= totalViolets) clearInterval(timer)
            return Math.min(v + 1, totalViolets)
          })
        }, DELAI_MS)
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      clearInterval(timer)
    }
  }, [anime, totalViolets])

  const taille = colonnes * PAS
  const carres: { x: number; y: number; classe: string; visible: boolean }[] = []
  let ordre = 0
  for (let c = 0; c < colonnes; c++) {
    for (let r = 0; r <= c; r++) {
      const violet = c < remplies
      const sommet = sommetVert && c === colonnes - 1 && r === c
      const classe = sommet ? 'fill-success' : violet ? 'fill-accent' : 'fill-gray-200'
      carres.push({
        x: c * PAS + (PAS - COTE) / 2,
        y: taille - (r + 1) * PAS + (PAS - COTE) / 2,
        classe,
        visible: !violet || ordre < visibles,
      })
      if (violet) ordre++
    }
  }

  return (
    <svg ref={ref} viewBox={`0 0 ${taille} ${taille}`} className="h-full w-full" aria-hidden="true">
      {carres.map(({ x, y, classe, visible }) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={COTE}
          height={COTE}
          rx={1.5}
          className={`${classe} transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
    </svg>
  )
}
