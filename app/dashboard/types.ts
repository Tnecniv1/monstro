export interface EnrichedProfile {
  id: string
  pseudo: string | null
  prenom: string | null
  nom: string | null
  avatar_url: string | null
  actif: boolean
  tempsTotal: number
}

export interface RegulariteRow {
  user_id: string
  pseudo: string
  avatar_url: string | null
  jour_semaine: number
  indice: number
  feuille_id: string | null
  feuille_titre: string | null
  ref_exercice: number | null
  note: string | null
  obj_global_feuille_id: string | null
  obj_global_feuille_titre: string | null
  obj_global_ref_exercice: number | null
  obj_global_note: string | null
  jours_actifs_total: number
}

export interface ObjGlobal {
  feuille_id: string | null
  feuille_titre: string | null
  ref_exercice: number | null
  note: string | null
}

export interface UserRegularite {
  user_id: string
  pseudo: string
  avatar_url: string | null
  jours_actifs_total: number
  jours: Record<number, {
    indice: number
    feuille_id: string | null
    feuille_titre: string | null
    ref_exercice: number | null
    note: string | null
  }>
  obj_global: ObjGlobal
}
