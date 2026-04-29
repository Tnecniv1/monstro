import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const fakes = [
  {
    "email": "fake_Lucas_Martin@mathbank.internal",
    "password": "Lucas_u2a5",
    "pseudo": "Lucas_",
    "prenom": "Lucas",
    "nom": "Martin",
    "score_initial": 7
  },
  {
    "email": "fake_Emma_Bernard@mathbank.internal",
    "password": "Emma_x2v9",
    "pseudo": "Emma_",
    "prenom": "Emma",
    "nom": "Bernard",
    "score_initial": 21
  },
  {
    "email": "fake_Nathan_Dubois@mathbank.internal",
    "password": "Nathan_b1c4",
    "pseudo": "Nathan_",
    "prenom": "Nathan",
    "nom": "Dubois",
    "score_initial": 14
  },
  {
    "email": "fake_Léa_Thomas@mathbank.internal",
    "password": "Léa_a9g9",
    "pseudo": "Léa_",
    "prenom": "Léa",
    "nom": "Thomas",
    "score_initial": 12
  },
  {
    "email": "fake_Hugo_Robert@mathbank.internal",
    "password": "Hugo_s5z1",
    "pseudo": "Hugo_",
    "prenom": "Hugo",
    "nom": "Robert",
    "score_initial": 1
  },
  {
    "email": "fake_Chloé_Richard@mathbank.internal",
    "password": "Chloé_w7k5",
    "pseudo": "Chloé_",
    "prenom": "Chloé",
    "nom": "Richard",
    "score_initial": 10
  },
  {
    "email": "fake_Théo_Petit@mathbank.internal",
    "password": "Théo_d2m2",
    "pseudo": "Théo_",
    "prenom": "Théo",
    "nom": "Petit",
    "score_initial": 10
  },
  {
    "email": "fake_Camille_Durand@mathbank.internal",
    "password": "Camille_t5z1",
    "pseudo": "Camille_",
    "prenom": "Camille",
    "nom": "Durand",
    "score_initial": 4
  },
  {
    "email": "fake_Mathis_Leroy@mathbank.internal",
    "password": "Mathis_d7c9",
    "pseudo": "Mathis_",
    "prenom": "Mathis",
    "nom": "Leroy",
    "score_initial": 14
  },
  {
    "email": "fake_Inès_Moreau@mathbank.internal",
    "password": "Inès_l4w2",
    "pseudo": "Inès_",
    "prenom": "Inès",
    "nom": "Moreau",
    "score_initial": 18
  },
  {
    "email": "fake_Antoine_Simon@mathbank.internal",
    "password": "Antoine_y5c4",
    "pseudo": "Antoine_",
    "prenom": "Antoine",
    "nom": "Simon",
    "score_initial": 3
  },
  {
    "email": "fake_Manon_Laurent@mathbank.internal",
    "password": "Manon_i8u6",
    "pseudo": "Manon_",
    "prenom": "Manon",
    "nom": "Laurent",
    "score_initial": 10
  },
  {
    "email": "fake_Karim_Benali@mathbank.internal",
    "password": "Karim_g5w2",
    "pseudo": "Karim_",
    "prenom": "Karim",
    "nom": "Benali",
    "score_initial": 7
  },
  {
    "email": "fake_Yasmine_Hadj@mathbank.internal",
    "password": "Yasmine_r4f8",
    "pseudo": "Yasmine_",
    "prenom": "Yasmine",
    "nom": "Hadj",
    "score_initial": 13
  },
  {
    "email": "fake_Mohamed_Ait@mathbank.internal",
    "password": "Mohamed_h6y1",
    "pseudo": "Mohamed_",
    "prenom": "Mohamed",
    "nom": "Ait",
    "score_initial": 5
  },
  {
    "email": "fake_Fatima_Meziane@mathbank.internal",
    "password": "Fatima_z6m5",
    "pseudo": "Fatima_",
    "prenom": "Fatima",
    "nom": "Meziane",
    "score_initial": 24
  },
  {
    "email": "fake_Axel_Nguyen@mathbank.internal",
    "password": "Axel_w6g8",
    "pseudo": "Axel_",
    "prenom": "Axel",
    "nom": "Nguyen",
    "score_initial": 12
  },
  {
    "email": "fake_Linh_Tran@mathbank.internal",
    "password": "Linh_e5e4",
    "pseudo": "Linh_",
    "prenom": "Linh",
    "nom": "Tran",
    "score_initial": 4
  },
  {
    "email": "fake_Kevin_Pham@mathbank.internal",
    "password": "Kevin_i7s7",
    "pseudo": "Kevin_",
    "prenom": "Kevin",
    "nom": "Pham",
    "score_initial": 7
  },
  {
    "email": "fake_Jade_Vo@mathbank.internal",
    "password": "Jade_q8c1",
    "pseudo": "Jade_",
    "prenom": "Jade",
    "nom": "Vo",
    "score_initial": 1
  },
  {
    "email": "fake_Ibrahima_Diallo@mathbank.internal",
    "password": "Ibrahima_u3z7",
    "pseudo": "Ibrahima_",
    "prenom": "Ibrahima",
    "nom": "Diallo",
    "score_initial": 11
  },
  {
    "email": "fake_Aissatou_Bah@mathbank.internal",
    "password": "Aissatou_m8q5",
    "pseudo": "Aissatou_",
    "prenom": "Aissatou",
    "nom": "Bah",
    "score_initial": 0
  },
  {
    "email": "fake_Mamadou_Traoré@mathbank.internal",
    "password": "Mamadou_v2v9",
    "pseudo": "Mamadou_",
    "prenom": "Mamadou",
    "nom": "Traore",
    "score_initial": 2
  },
  {
    "email": "fake_Aminata_Koné@mathbank.internal",
    "password": "Aminata_d5n3",
    "pseudo": "Aminata_",
    "prenom": "Aminata",
    "nom": "Kone",
    "score_initial": 9
  },
  {
    "email": "fake_Carlos_Fernandez@mathbank.internal",
    "password": "Carlos_q3q2",
    "pseudo": "Carlos_",
    "prenom": "Carlos",
    "nom": "Fernandez",
    "score_initial": 2
  },
  {
    "email": "fake_Sofia_Garcia@mathbank.internal",
    "password": "Sofia_u9t4",
    "pseudo": "Sofia_",
    "prenom": "Sofia",
    "nom": "Garcia",
    "score_initial": 7
  },
  {
    "email": "fake_Diego_Martinez@mathbank.internal",
    "password": "Diego_r9a6",
    "pseudo": "Diego_",
    "prenom": "Diego",
    "nom": "Martinez",
    "score_initial": 6
  },
  {
    "email": "fake_Lucia_Lopez@mathbank.internal",
    "password": "Lucia_l5h1",
    "pseudo": "Lucia_",
    "prenom": "Lucia",
    "nom": "Lopez",
    "score_initial": 14
  },
  {
    "email": "fake_Nikita_Petrov@mathbank.internal",
    "password": "Nikita_c2x8",
    "pseudo": "Nikita_",
    "prenom": "Nikita",
    "nom": "Petrov",
    "score_initial": 4
  },
  {
    "email": "fake_Anya_Volkov@mathbank.internal",
    "password": "Anya_y3e8",
    "pseudo": "Anya_",
    "prenom": "Anya",
    "nom": "Volkov",
    "score_initial": 1
  },
  {
    "email": "fake_Ivan_Sokolov@mathbank.internal",
    "password": "Ivan_i9t7",
    "pseudo": "Ivan_",
    "prenom": "Ivan",
    "nom": "Sokolov",
    "score_initial": 4
  },
  {
    "email": "fake_Katia_Morozov@mathbank.internal",
    "password": "Katia_y4w5",
    "pseudo": "Katia_",
    "prenom": "Katia",
    "nom": "Morozov",
    "score_initial": 10
  },
  {
    "email": "fake_Youssef_El Amrani@mathbank.internal",
    "password": "Youssef_o9o2",
    "pseudo": "Youssef_",
    "prenom": "Youssef",
    "nom": "El Amrani",
    "score_initial": 6
  },
  {
    "email": "fake_Nour_Benkirane@mathbank.internal",
    "password": "Nour_k1s9",
    "pseudo": "Nour_",
    "prenom": "Nour",
    "nom": "Benkirane",
    "score_initial": 8
  },
  {
    "email": "fake_Amine_Chakroun@mathbank.internal",
    "password": "Amine_a2w1",
    "pseudo": "Amine_",
    "prenom": "Amine",
    "nom": "Chakroun",
    "score_initial": 5
  },
  {
    "email": "fake_Rim_Mansouri@mathbank.internal",
    "password": "Rim_k2q4",
    "pseudo": "Rim_",
    "prenom": "Rim",
    "nom": "Mansouri",
    "score_initial": 12
  },
  {
    "email": "fake_Ethan_Dupont@mathbank.internal",
    "password": "Ethan_g9e8",
    "pseudo": "Ethan_",
    "prenom": "Ethan",
    "nom": "Dupont",
    "score_initial": 12
  },
  {
    "email": "fake_Anaïs_Lefèvre@mathbank.internal",
    "password": "Anais_z7g2",
    "pseudo": "Anais_",
    "prenom": "Anais",
    "nom": "Lefevre",
    "score_initial": 21
  },
  {
    "email": "fake_Baptiste_Mercier@mathbank.internal",
    "password": "Baptiste_l7n8",
    "pseudo": "Baptiste_",
    "prenom": "Baptiste",
    "nom": "Mercier",
    "score_initial": 0
  },
  {
    "email": "fake_Pauline_Bonnet@mathbank.internal",
    "password": "Pauline_v2b7",
    "pseudo": "Pauline_",
    "prenom": "Pauline",
    "nom": "Bonnet",
    "score_initial": 0
  },
  {
    "email": "fake_Rayan_Saidi@mathbank.internal",
    "password": "Rayan_h4g9",
    "pseudo": "Rayan_",
    "prenom": "Rayan",
    "nom": "Saidi",
    "score_initial": 11
  },
  {
    "email": "fake_Lina_Bouzid@mathbank.internal",
    "password": "Lina_f5o4",
    "pseudo": "Lina_",
    "prenom": "Lina",
    "nom": "Bouzid",
    "score_initial": 0
  },
  {
    "email": "fake_Mehdi_Hamid@mathbank.internal",
    "password": "Mehdi_o9d1",
    "pseudo": "Mehdi_",
    "prenom": "Mehdi",
    "nom": "Hamid",
    "score_initial": 13
  },
  {
    "email": "fake_Sara_Khalil@mathbank.internal",
    "password": "Sara_a2y4",
    "pseudo": "Sara_",
    "prenom": "Sara",
    "nom": "Khalil",
    "score_initial": 12
  },
  {
    "email": "fake_Tom_Blanc@mathbank.internal",
    "password": "Tom_p4m1",
    "pseudo": "Tom_",
    "prenom": "Tom",
    "nom": "Blanc",
    "score_initial": 5
  },
  {
    "email": "fake_Alice_Rousseau@mathbank.internal",
    "password": "Alice_m5z8",
    "pseudo": "Alice_",
    "prenom": "Alice",
    "nom": "Rousseau",
    "score_initial": 13
  },
  {
    "email": "fake_Maxime_Faure@mathbank.internal",
    "password": "Maxime_v8e4",
    "pseudo": "Maxime_",
    "prenom": "Maxime",
    "nom": "Faure",
    "score_initial": 5
  },
  {
    "email": "fake_Clara_Garnier@mathbank.internal",
    "password": "Clara_s9b6",
    "pseudo": "Clara_",
    "prenom": "Clara",
    "nom": "Garnier",
    "score_initial": 24
  },
  {
    "email": "fake_Enzo_François@mathbank.internal",
    "password": "Enzo_p9q3",
    "pseudo": "Enzo_",
    "prenom": "Enzo",
    "nom": "Francois",
    "score_initial": 23
  },
  {
    "email": "fake_Océane_Lambert@mathbank.internal",
    "password": "Oceane_c3c2",
    "pseudo": "Oceane_",
    "prenom": "Oceane",
    "nom": "Lambert",
    "score_initial": 8
  },
  {
    "email": "fake_Tristan_Muller@mathbank.internal",
    "password": "Tristan_m2s4",
    "pseudo": "Tristan_",
    "prenom": "Tristan",
    "nom": "Muller",
    "score_initial": 5
  },
  {
    "email": "fake_Marine_Henry@mathbank.internal",
    "password": "Marine_t2n9",
    "pseudo": "Marine_",
    "prenom": "Marine",
    "nom": "Henry",
    "score_initial": 9
  },
  {
    "email": "fake_Valentin_Boyer@mathbank.internal",
    "password": "Valentin_g6h5",
    "pseudo": "Valentin_",
    "prenom": "Valentin",
    "nom": "Boyer",
    "score_initial": 9
  },
  {
    "email": "fake_Romane_Nguyen@mathbank.internal",
    "password": "Romane_o6y2",
    "pseudo": "Romane_",
    "prenom": "Romane",
    "nom": "Nguyen",
    "score_initial": 24
  },
  {
    "email": "fake_Adrien_Gerard@mathbank.internal",
    "password": "Adrien_s2c9",
    "pseudo": "Adrien_",
    "prenom": "Adrien",
    "nom": "Gerard",
    "score_initial": 9
  },
  {
    "email": "fake_Eléonore_Pierre@mathbank.internal",
    "password": "Eleonore_e6c4",
    "pseudo": "Eleonore_",
    "prenom": "Eleonore",
    "nom": "Pierre",
    "score_initial": 7
  }
]

const FEUILLES = ["74615a1f-fd46-44e7-a584-bf73c1ff2f78", "1ebdbd3c-dcb9-46b3-8508-5422677d6311", "3c060320-85f3-4ceb-b112-bca612527538", "a6cf5840-e208-4676-892c-cedd70a6733a", "432975df-dbba-40dc-9c19-1b9fc70e1261", "e1e7992d-9210-4868-b7d5-6d6df61ad8f7", "27d0742a-c255-4084-acb7-0c4141baaa98", "9d66d09b-570d-41f2-a2db-29a5ab6e5b66"]

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

for (const u of fakes) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { pseudo: u.pseudo, prenom: u.prenom }
  })
  if (error) {
    console.error('ERREUR', u.email, error.message)
    continue
  }
  
  const uid = data.user.id
  
  // Créer le profil
  await supabase.from('user_profile').insert({
    id: uid, pseudo: u.pseudo, prenom: u.prenom, nom: u.nom
  })
  
  // Créer les entraînements initiaux (score_initial succès)
  const nbSucces = u.score_initial
  const nbEchecs = Math.floor(nbSucces * 0.2) // 20% d'échecs
  const total = nbSucces + nbEchecs
  
  for (let i = 0; i < total; i++) {
    const feuille = FEUILLES[i % FEUILLES.length]
    const ref_exo = (i % 6) + 1
    const etat = i < nbSucces ? 'succes' : 'echec'
    
    // Date aléatoire dans les 90 derniers jours
    const daysAgo = randInt(1, 90)
    const date = new Date(Date.now() - daysAgo * 86400000)
    const dateStr = date.toISOString()
    
    const { data: ent } = await supabase
      .from('entrainement')
      .insert({
        user_id: uid,
        feuille_id: feuille,
        ref_exo: ref_exo,
        statut: 'termine',
        date_creation: dateStr
      })
      .select('id').single()
    
    if (!ent) continue
    
    // Session
    await supabase.from('session').insert({
      entrainement_id: ent.id,
      date: dateStr.split('T')[0],
      temps_min: randInt(20, 60)
    })
    
    // Observation
    await supabase.from('observation').insert({
      entrainement_id: ent.id,
      etat: etat
    })
  }
  
  console.log('OK', u.pseudo, `score=${nbSucces} succès, ${nbEchecs} échecs`)
}
console.log('Terminé.')
