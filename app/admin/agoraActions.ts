'use server'

import { requireAdmin } from '@/lib/admin/requireAdmin'
import { getUserStatsForWeek, type UserStats } from '@/lib/stats/getUserStats'

export async function getRapportHebdoAction(eleveId: string, lundi: string): Promise<UserStats> {
  await requireAdmin()
  return getUserStatsForWeek(eleveId, lundi)
}
