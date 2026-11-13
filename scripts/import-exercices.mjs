// Prépare l'import des exercices transcrits d'une feuille (sortie de
// monstro-agent) dans la table exercice : écrit un fichier .sql à exécuter
// dans l'éditeur SQL Supabase. Ne se connecte à rien.
//
//   node scripts/import-exercices.mjs <dossier de sortie> "<titre de la feuille>" <fichier.sql>
//
// Seuls les exercices validés dans la page de relecture de l'agent
// (exNN.json → validation.decision = "valide") sont importés. Un exercice
// retranscrit perd sa validation : il n'est réimporté qu'une fois revalidé.
// Relançable : insert … on conflict (feuille_id, numero) do update. La
// correction n'est jamais touchée ici. Ne publie pas la feuille
// (feuille_entrainement.exercices_publies) : c'est une étape à part.
// Figures ([FIGURE n : …]) : pas encore gérées, l'exercice est écarté.

import fs from 'node:fs'
import path from 'node:path'

const [dossier, titreFeuille, sortie] = process.argv.slice(2)
if (!dossier || !titreFeuille || !sortie) {
  console.error('Usage : node scripts/import-exercices.mjs <dossier> "<titre de la feuille>" <fichier.sql>')
  process.exit(1)
}

const lireJson = (f) => JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8'))
const numeros = fs
  .readdirSync(dossier)
  .map((f) => /^ex(\d+)\.md$/.exec(f))
  .filter(Boolean)
  .map((m) => Number(m[1]))
  .sort((a, b) => a - b)

const importes = []
const ecartes = { nonRelus: [], refuses: [], figures: [], sansInfos: [] }

for (const n of numeros) {
  const base = `ex${String(n).padStart(2, '0')}`
  if (!fs.existsSync(path.join(dossier, `${base}.json`))) {
    ecartes.sansInfos.push(n)
    continue
  }
  const decision = lireJson(`${base}.json`).validation?.decision
  if (decision !== 'valide') {
    ;(decision === 'refuse' ? ecartes.refuses : ecartes.nonRelus).push(n)
    continue
  }
  const enonce = fs.readFileSync(path.join(dossier, `${base}.md`), 'utf8').replace(/\r\n/g, '\n').trim()
  if (/\[FIGURE\b/.test(enonce)) {
    ecartes.figures.push(n)
    continue
  }
  // Le texte est placé entre $exo$ … $exo$ (aucun échappement) dans un bloc $imp$.
  if (enonce.includes('$exo$') || enonce.includes('$imp$')) {
    console.error(`${base} contient $exo$ ou $imp$ : impossible à citer, arrêt.`)
    process.exit(1)
  }
  importes.push({ n, enonce })
}

const titreSql = titreFeuille.replace(/'/g, "''")
const lignes = importes.map(({ n, enonce }) => `    (fid, ${n}, $exo$${enonce}$exo$)`).join(',\n')

const sql = `-- Import des exercices en texte : « ${titreFeuille} »
-- Généré le ${new Date().toISOString()} par scripts/import-exercices.mjs
-- Exercices importés (${importes.length}) : ${importes.map((e) => e.n).join(', ') || 'aucun'}
-- Relançable : met à jour l'énoncé des exercices déjà présents.

do $imp$
declare
  fid uuid;
  nb  int;
begin
  select count(*) into nb from public.feuille_entrainement where titre = '${titreSql}';
  if nb <> 1 then
    raise exception 'Feuille « ${titreSql} » : % ligne(s) trouvée(s), 1 attendue', nb;
  end if;
  select id into fid from public.feuille_entrainement where titre = '${titreSql}';
${
  importes.length
    ? `
  insert into public.exercice (feuille_id, numero, enonce)
  values
${lignes}
  on conflict (feuille_id, numero) do update
    set enonce = excluded.enonce,
        updated_at = now();
`
    : ''
}end
$imp$;

-- Publication (à part, quand tu le décides) :
-- update public.feuille_entrainement set exercices_publies = true where titre = '${titreSql}';
`

fs.writeFileSync(sortie, sql, 'utf8')
console.log(`${sortie} : ${importes.length} exercice(s) importé(s) sur ${numeros.length}.`)
const resume = (t, l) => l.length && console.log(`  ${t} (${l.length}) : ${l.join(', ')}`)
resume('non relus', ecartes.nonRelus)
resume('refusés', ecartes.refuses)
resume('avec figure (non gérés)', ecartes.figures)
resume('sans exNN.json', ecartes.sansInfos)
