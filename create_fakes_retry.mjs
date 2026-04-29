import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const FEUILLES = [
  '74615a1f-fd46-44e7-a584-bf73c1ff2f78',
  '1ebdbd3c-dcb9-46b3-8508-5422677d6311',
  '3c060320-85f3-4ceb-b112-bca612527538',
  'a6cf5840-e208-4676-892c-cedd70a6733a',
  'e1e7992d-9210-4868-b7d5-6d6df61ad8f7',
  '27d0742a-c255-4084-acb7-0c4141baaa98',
  '9d66d09b-570d-41f2-a2db-29a5ab6e5b66'
]

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const fakes = [
  { email: "fake_Lea_Thomas@mathbank.internal", password: "Lea_m7g3", pseudo: "Léa_", prenom: "Léa", nom: "Thomas", score: 12 },
  { email: "fake_Chloe_Richard@mathbank.internal", password: "Chloe_h4e2", pseudo: "Chloé_", prenom: "Chloé", nom: "Richard", score: 8 },
  { email: "fake_Theo_Petit@mathbank.internal", password: "Theo_i7q9", pseudo: "Théo_", prenom: "Théo", nom: "Petit", score: 5 },
  { email: "fake_Ines_Moreau@mathbank.internal", password: "Ines_c8g7", pseudo: "Inès_", prenom: "Inès", nom: "Moreau", score: 0 },
  { email: "fake_Mamadou_Traore@mathbank.internal", password: "Mamadou_x4z6", pseudo: "Mamadou_", prenom: "Mamadou", nom: "Traoré", score: 3 },
  { email: "fake_Aminata_Kone@mathbank.internal", password: "Aminata_m4e8", pseudo: "Aminata_", prenom: "Aminata", nom: "Koné", score: 6 },
  { email: "fake_Youssef_El_Amrani@mathbank.internal", password: "Youssef_v3s6", pseudo: "Youssef_", prenom: "Youssef", nom: "El Amrani", score: 9 },
  { email: "fake_Anais_Lefevre@mathbank.internal", password: "Anais_c9v2", pseudo: "Anais_", prenom: "Anaïs", nom: "Lefèvre", score: 14 },
  { email: "fake_Enzo_Francois@mathbank.internal", password: "Enzo_p6m1", pseudo: "Enzo_", prenom: "Enzo", nom: "François", score: 7 },
  { email: "fake_Oceane_Lambert@mathbank.internal", password: "Oceane_i9a7", pseudo: "Oceane_", prenom: "Océane", nom: "Lambert", score: 11 },
  { email: "fake_Eleonore_Pierre@mathbank.internal", password: "Eleonore_g6r2", pseudo: "Eleonore_", prenom: "Eléonore", nom: "Pierre", score: 4 },
]

for (const u of fakes) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { pseudo: u.pseudo, prenom: u.prenom }
  })
  if (error) { console.error('ERREUR', u.email, error.message); continue }
  
  const uid = data.user.id
  await supabase.from('user_profile').insert({
    id: uid, pseudo: u.pseudo, prenom: u.prenom, nom: u.nom
  })
  
  const nbSucces = u.score
  const nbEchecs = Math.floor(nbSucces * 0.2)
  const total = nbSucces + nbEchecs
  
  for (let i = 0; i < total; i++) {
    const feuille = FEUILLES[i % FEUILLES.length]
    const ref_exo = (i % 6) + 1
    const etat = i < nbSucces ? 'succes' : 'echec'
    const daysAgo = randInt(1, 90)
    const date = new Date(Date.now() - daysAgo * 86400000)
    const dateStr = date.toISOString()
    
    const { data: ent } = await supabase
      .from('entrainement')
      .insert({ user_id: uid, feuille_id: feuille, ref_exo, statut: 'termine', date_creation: dateStr })
      .select('id').single()
    
    if (!ent) continue
    
    await supabase.from('session').insert({
      entrainement_id: ent.id, date: dateStr.split('T')[0], temps_min: randInt(20, 60)
    })
    await supabase.from('observation').insert({ entrainement_id: ent.id, etat })
  }
  
  console.log('OK', u.pseudo, `score=${u.score}`)
}
console.log('Terminé.')
