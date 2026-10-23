import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/getUser'
import { isForumAdmin } from '../../../adminGate'
import { filtreDepuis } from '../../../types'
import ProblemeClient from './ProblemeClient'

// Page d'un problème du forum (feuille + numéro) : énoncé (lien vers le PDF de
// la feuille, l'énoncé seul n'existant pas en base), question, fil.
export default async function ProblemePage({
  params,
  searchParams,
}: {
  params: { feuilleId: string; numero: string }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const numero = Number(params.numero)
  if (!/^[0-9a-f-]{36}$/i.test(params.feuilleId) || !Number.isInteger(numero) || numero < 1) notFound()

  const { user, profile } = await getUser()
  const { data: feuille } = await createClient()
    .from('feuille_entrainement')
    .select('id, titre, pdf_url')
    .eq('id', params.feuilleId)
    .maybeSingle()
  if (!feuille) notFound()

  // ?depuis= : filtre de la grille d'où l'on vient. Toujours explicite dans
  // l'URL du retour, pour rouvrir l'onglet Problèmes.
  const depuis = filtreDepuis(searchParams.depuis)

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[760px] space-y-5 px-4 py-5">
        <Link
          href={`/forum?filtre=${encodeURIComponent(depuis)}`}
          className="-ml-2 inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          ‹ Tous les problèmes
        </Link>

        <ProblemeClient
          feuille={feuille as { id: string; titre: string; pdf_url: string | null }}
          numero={numero}
          userId={user.id}
          isAdmin={isForumAdmin(profile?.role)}
        />
      </div>
    </div>
  )
}
