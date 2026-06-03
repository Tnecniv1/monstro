import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/getUser'
import { createClient } from '@/lib/supabase/server'
import { CoursChart } from './components/CoursChart'
import { PanneauConversion } from './components/PanneauConversion'
import { CatalogueMissions } from './components/CatalogueMissions'
import { HeaderMission } from './components/HeaderMission'

export default async function MissionPage() {
  const { user, profile } = await getUser()
  if (!user) redirect('/login')

  console.log('role utilisateur:', profile)

  const isAdmin = profile?.role === 'admin'

  const supabase = createClient()

  const [
    { data: missions },
    { data: historiqueTaux },
    { data: soldeData },
    { data: pixelsData },
    { data: achatsData },
  ] = await Promise.all([
    supabase
      .from('mission')
      .select('*')
      .eq('statut', 'active')
      .order('created_at', { ascending: true }),

    supabase
      .from('taux_conversion')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(30),

    supabase.rpc('solde_credits', { p_user_id: user.id }),

    supabase.rpc('pixels_convertibles', { p_user_id: user.id }),

    supabase
      .from('mission_achat')
      .select('mission_id')
      .eq('user_id', user.id)
      .in('statut', ['en_cours', 'validee']),
  ])

  const tauxActuel = historiqueTaux?.at(-1)
  const missionsAchetees = (achatsData ?? []).map((a: { mission_id: string }) => a.mission_id)

  const missionsExemple = [
    { id: 'ex-1', titre: 'Ramasser des déchets', statut: 'active' as const, description: 'Passe 30 min à ramasser des déchets dans ton quartier ou un parc.', type: 'argent' as const, cout_credits: 500, profit: '5 €', created_at: new Date().toISOString() },
    { id: 'ex-2', titre: 'Parler avec une personne âgée', statut: 'active' as const, description: 'Prends le temps d\'échanger avec un voisin ou un résident en EHPAD.', type: 'sagesse' as const, cout_credits: 300, profit: 'Badge Empathie', created_at: new Date().toISOString() },
    { id: 'ex-3', titre: 'Tondre la pelouse', statut: 'active' as const, description: 'Tonds et entretiens un jardin pour un voisin ou un proche.', type: 'argent' as const, cout_credits: 1200, profit: '20 €', created_at: new Date().toISOString() },
    { id: 'ex-4', titre: 'Lire un livre en entier', statut: 'active' as const, description: 'Lis un livre de ton choix et rédige un résumé de 5 lignes.', type: 'sagesse' as const, cout_credits: 800, profit: 'Badge Lecteur', created_at: new Date().toISOString() },
    { id: 'ex-5', titre: 'Cuisiner un plat pour sa famille', statut: 'active' as const, description: 'Prépare un repas complet de A à Z pour ta famille.', type: 'preuve' as const, cout_credits: 600, profit: '10 €', created_at: new Date().toISOString() },
    { id: 'ex-6', titre: 'Apprendre 20 mots d\'anglais', statut: 'active' as const, description: 'Mémorise 20 nouveaux mots en anglais et utilise-les dans une phrase.', type: 'sagesse' as const, cout_credits: 400, profit: 'Badge Polyglotte', created_at: new Date().toISOString() },
    { id: 'ex-7', titre: 'Réparer un objet cassé', statut: 'active' as const, description: 'Répare toi-même un objet du quotidien plutôt que de le jeter.', type: 'preuve' as const, cout_credits: 1000, profit: '15 €', created_at: new Date().toISOString() },
    { id: 'ex-8', titre: 'Planter des fleurs ou légumes', statut: 'active' as const, description: 'Plante et entretiens un pot de fleurs ou un carré potager.', type: 'argent' as const, cout_credits: 2000, profit: '30 €', created_at: new Date().toISOString() },
    { id: 'ex-9', titre: 'Aider un camarade à réviser', statut: 'active' as const, description: 'Organise une session de révision et explique un sujet à un camarade.', type: 'preuve' as const, cout_credits: 700, profit: 'Badge Mentor', created_at: new Date().toISOString() },
  ]

  const missionsFinales = (missions && missions.length > 0) ? missions : missionsExemple

  return (
    <div style={{ height: '100dvh', background: '#FFFFFF', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <HeaderMission isAdmin={isAdmin} />

      <div style={{ flex: '0 0 40%', display: 'flex', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
        <div style={{ flex: '0 0 65%', padding: '1rem 1.25rem', borderRight: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          {historiqueTaux && historiqueTaux.length > 0 ? (
            <CoursChart historique={historiqueTaux} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 14, color: '#888780' }}>
              Aucune donnée de cours disponible.
            </div>
          )}
        </div>

        <div style={{ width: 280, flexShrink: 0 }}>
          <PanneauConversion
            soldeCredits={soldeData ?? 0}
            pixelsConvertibles={pixelsData ?? 0}
            tauxActuel={tauxActuel?.taux ?? 100}
            tauxId={tauxActuel?.id ?? ''}
            userId={user.id}
          />
        </div>
      </div>

      <div style={{ flex: '0 0 60%', overflowY: 'auto', padding: '1.25rem' }}>
        <CatalogueMissions
          missions={missionsFinales}
          missionsAchetees={missionsAchetees}
          soldeCredits={soldeData ?? 0}
          userId={user.id}
        />
      </div>

    </div>
  )
}
