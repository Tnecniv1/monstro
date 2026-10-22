'use client'

// Lien discret sous la carte Connexion/Inscription : défilement doux vers la
// section « Comment ça marche » (direct si prefers-reduced-motion est actif).
// Sans JavaScript, l'ancre suffit.
export default function LienCommentCaMarche() {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const cible = document.getElementById('comment-ca-marche')
    if (!cible) return
    e.preventDefault()
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    cible.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <a
      href="#comment-ca-marche"
      onClick={handleClick}
      className="inline-block text-base font-medium text-accent underline-offset-4 hover:underline"
    >
      Comment ça marche&nbsp;↓
    </a>
  )
}
