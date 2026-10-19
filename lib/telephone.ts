// Numéros de téléphone des suiveurs : saisie libre au format français, stockage en base sous la
// forme 33 + 9 chiffres (ex. 33612345678, sans espace ni « + »). Pur TypeScript : partagé par les
// formulaires (navigateur) et par l'envoi WhatsApp (serveur).

export type TelephoneNormalise = { ok: true; numero: string } | { ok: false; erreur: string }

export const MESSAGE_TELEPHONE_INVALIDE =
  'Numéro de téléphone invalide : saisis un numéro français à 10 chiffres, par exemple 06 12 34 56 78 ou +33 6 12 34 56 78.'

/**
 * « 06 12 34 56 78 », « 0612345678 », « +33 6 12 34 56 78 », « 0033 6 12 34 56 78 » ou déjà
 * « 33612345678 » → « 33612345678 ». Refusé si, une fois nettoyé, le numéro n'a pas exactement
 * 10 chiffres commençant par 0 (hors 00), ou 33 + 9 chiffres ne commençant pas par 0.
 */
export function normaliserTelephone(saisie: string): TelephoneNormalise {
  let chiffres = saisie.replace(/\D/g, '')
  if (chiffres.startsWith('0033')) chiffres = chiffres.slice(2)
  if (/^0[1-9]\d{8}$/.test(chiffres)) return { ok: true, numero: `33${chiffres.slice(1)}` }
  if (/^33[1-9]\d{8}$/.test(chiffres)) return { ok: true, numero: chiffres }
  return { ok: false, erreur: MESSAGE_TELEPHONE_INVALIDE }
}

/** Numéro stocké (33612345678) → « 06 12 34 56 78 » ; tout autre format est affiché tel quel. */
export function formaterTelephone(stocke: string | null | undefined): string {
  const valeur = stocke ?? ''
  if (!/^33[1-9]\d{8}$/.test(valeur)) return valeur
  return `0${valeur.slice(2)}`.replace(/(\d{2})(?=\d)/g, '$1 ')
}
