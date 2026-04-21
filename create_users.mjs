import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // clé service_role, pas anon
)

const users = [
  { email: "rima7478@gmail.com", password: "Rima_u2a5", pseudo: "Rima_", prenom: "Rima" },
  { email: "tizi.family.admi@gmail.com", password: "Tizi_h4e2", pseudo: "Tizi_", prenom: "Tizi" },
  { email: "marielaurence.berthelier@sfr.fr", password: "Mariel_v9c7", pseudo: "MarieL_", prenom: "MarieL" },
  { email: "lucasjuliette14@gmail.com", password: "Lucasj_b1c4", pseudo: "LucasJ_", prenom: "LucasJ" },
  { email: "celinengombe78730@yahoo.fr", password: "Celine_h9t1", pseudo: "Celine_", prenom: "Celine" },
  { email: "flugera@gmail.com", password: "Flugera_r4w9", pseudo: "Flugera_", prenom: "Flugera" },
  { email: "brewen_@mathbank.internal", password: "Brewen_n4o5", pseudo: "Brewen_", prenom: "Brewen" },
  { email: "rose_@mathbank.internal", password: "Rose_z1y3", pseudo: "Rose_", prenom: "Rose" },
  { email: "hanae_@mathbank.internal", password: "Hanae_w7k5", pseudo: "Hanae_", prenom: "Hanae" },
  { email: "myriam_@mathbank.internal", password: "Myriam_e4y6", pseudo: "Myriam_", prenom: "Myriam" },
  { email: "liam_@mathbank.internal", password: "Liam_d2m2", pseudo: "Liam_", prenom: "Liam" },
  { email: "max_mathbank@sanderson.pm", password: "Max_l6t5", pseudo: "Max_", prenom: "Max" },
]

for (const u of users) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { pseudo: u.pseudo, prenom: u.prenom }
  })
  if (error) {
    console.error('ERREUR', u.email, error.message)
  } else {
    console.log('OK', u.email, data.user.id)
    // Insérer le profil
    await supabase.from('user_profile').insert({
      id: data.user.id,
      pseudo: u.pseudo,
      prenom: u.prenom,
    })
  }
}
console.log('Terminé.')
