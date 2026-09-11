// Seule notion d'admin dans l'app : le rôle 'admin' de user_profile, comme
// lib/admin/requireAdmin.ts. Le bouton "Nouveau ticket" est masqué sur les
// topics de sens pour tout le monde sauf ce rôle.
export function isForumAdmin(role: string | null | undefined): boolean {
  return role === 'admin'
}
