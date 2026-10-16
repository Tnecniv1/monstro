import IconeAdn from './IconeAdn'

// Solde de jetons ADN : icône + nombre (onglet Équipe, profil).
export default function SoldeJetons({ solde, className = '' }: { solde: number; className?: string }) {
  return (
    <span
      title="Jetons ADN : 1 jeton par inscription à un live"
      aria-label={`${solde} jeton${solde > 1 ? 's' : ''} ADN`}
      className={`inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-sm font-bold text-accent ${className}`}
    >
      <IconeAdn size={16} />
      {solde}
    </span>
  )
}
