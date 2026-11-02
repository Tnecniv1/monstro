// Numéros reçus de Twilio (« whatsapp:+33612345678 ») → chiffres seuls, au format stocké en base
// (33612345678). Volontairement permissif, contrairement à lib/telephone.ts : un parent peut écrire
// depuis un numéro étranger, qu'on enregistre tel quel plutôt que de le rejeter.
export function normaliserTelephone(s: string): string {
  const chiffres = s.replace(/^whatsapp:/i, '').replace(/\D/g, '')
  if (/^0\d{9}$/.test(chiffres)) return `33${chiffres.slice(1)}`
  return chiffres
}
