import Link from 'next/link'
import { getUser } from '@/lib/supabase/getUser'
import { createClient } from '@/lib/supabase/server'
import AgoraPersonalView, { type PersonalReferent } from './AgoraPersonalView'

export default async function AgoraPage() {
  const { user } = await getUser()
  const supabase = createClient()

  const { data: referentRows } = await supabase
    .from('referent_eleve')
    .select('id, referent_id, referent(prenom, nom, relation, telephone)')
    .eq('eleve_id', user.id)
    .eq('actif', true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const referents: PersonalReferent[] = (referentRows ?? []).map((r: any) => ({
    linkId: r.id,
    referentId: r.referent_id,
    prenom: r.referent?.prenom ?? '',
    nom: r.referent?.nom ?? '',
    relation: r.referent?.relation ?? 'autre',
    telephone: r.referent?.telephone ?? '',
  }))

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EE' }}>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Agora</h1>
        <AgoraPersonalView eleveId={user.id} initial={referents} />
      </div>
    </div>
  )
}
