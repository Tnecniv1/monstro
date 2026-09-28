'use client'

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

// Forme minimale nécessaire à l'affichage de la carte — le type concret
// (ForumScript ou ForumResource) est préservé via le générique T, pour que
// onSelect rende l'objet complet (ForumClient sait alors quel modal ouvrir).
interface CardVisual {
  id: string
  titre: string
  description: string | null
  cover_url: string | null
  ordre: number
}

interface Props<T extends CardVisual> {
  items: T[]
  onSelect: (item: T) => void
  // 'row' : bande horizontale scrollable (fiches, en haut de page).
  // 'grid' : grille qui wrap (ressources, dans le panneau principal).
  variant?: 'row' | 'grid'
  emptyMessage?: string
  // Préfixe le titre par "#{ordre}" — scripts uniquement, pas les ressources.
  showNumber?: boolean
}

export default function ScriptsRow<T extends CardVisual>({
  items,
  onSelect,
  variant = 'row',
  emptyMessage = 'Aucune fiche disponible pour l’instant.',
  showNumber = false,
}: Props<T>) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">{emptyMessage}</p>
  }

  const containerClass =
    variant === 'grid'
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
      : 'flex gap-3 overflow-x-auto pb-1 -mx-1 px-1'

  const cardClass =
    variant === 'grid'
      ? 'w-full text-left rounded-xl border border-border bg-surface overflow-hidden hover:border-border-strong transition-colors'
      : 'shrink-0 w-56 text-left rounded-xl border border-border bg-surface overflow-hidden hover:border-border-strong transition-colors'

  return (
    <div className={containerClass}>
      {items.map((item) => (
        <button key={item.id} onClick={() => onSelect(item)} className={cardClass}>
          {item.cover_url && (
            <div className="aspect-[16/9] w-full bg-surface-2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-4 space-y-2">
            {!item.cover_url && (
              <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center text-text-secondary">
                <DocIcon />
              </div>
            )}
            <p className="font-semibold text-text-primary text-sm leading-snug line-clamp-2">
              {showNumber ? `#${item.ordre} ${item.titre}` : item.titre}
            </p>
            {item.description && (
              <p className="text-xs text-text-secondary line-clamp-2">{item.description}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
