export type MissionType = 'argent' | 'sagesse' | 'preuve'
export type MissionStatut = 'active' | 'archivee'
export type MissionAchatStatut = 'en_cours' | 'validee' | 'expiree'

export interface Mission {
  id: string
  titre: string
  description: string | null
  type: MissionType
  cout_credits: number
  profit: string | null
  statut: MissionStatut
  created_at: string
}

export interface TauxConversion {
  id: string
  taux: number
  source: 'init' | 'demande' | 'evenement'
  evenement_marche_id: string | null
  created_at: string
}

export interface MissionAchat {
  id: string
  user_id: string
  mission_id: string
  credit_transaction_id: string
  statut: MissionAchatStatut
  created_at: string
  updated_at: string
}
