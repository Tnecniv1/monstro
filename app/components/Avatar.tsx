// Avatar rond d'un utilisateur : sa photo de profil (user_profile.avatar_url,
// URL publique du bucket « avatars »), sinon l'initiale de son pseudo.
// `fallbackClassName` : couleurs du rond à initiale (gris par défaut).
export default function Avatar({
  url,
  pseudo,
  size,
  className = '',
  fallbackClassName = 'bg-surface-2 font-semibold text-text-secondary',
}: {
  url?: string | null
  pseudo: string
  size: number
  className?: string
  fallbackClassName?: string
}) {
  const initial = pseudo ? pseudo[0].toUpperCase() : '?'
  if (url) {
    return (
      <img
        src={url}
        alt={pseudo}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full ${fallbackClassName} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  )
}
