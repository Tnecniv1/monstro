-- Contrôle de la partition des feuilles (lecture seule) : nombre de feuilles par nœud,
-- dans l'ordre de l'arbre. À lancer avant et après 20261006_partition_feuilles.sql.
--
-- Attendu après migration (113 feuilles) :
--   Problèmes Chaotiques > Problèmes Exeter 10, > Problèmes de CPGE 1, > Problèmes de la Vie 1
--   Exercices Mécaniques 9
--   Entrainement et Défi > Puzzles de Logiques 1, > Problèmes de Dénombrements 1,
--     > Tout et Parties 15, > Facteurs et Partages 20, > Mesures et Comparaisons 5,
--     > Sachant Que 2, > Données et Relations 18, > Calcul 1, > Algèbre 2, > Géométrie 3,
--     > Arithmétique 1, > Exercice en Vrac 2, > Analyse Différentielle 7, > Trigonométrie 1
--   Préparation Examen 12
--   Mécaniques - Niveau 3 > Géométrie Vectorielle 1

with recursive arbre as (
  select id, array[ordre] as tri, nom::text as racine, nom::text as chemin from noeud where parent_id is null
  union all
  select n.id, a.tri || n.ordre, a.racine, a.chemin || ' > ' || n.nom
    from noeud n join arbre a on n.parent_id = a.id
)
select a.chemin, count(f.id) as feuilles
  from arbre a left join feuille_entrainement f on f.noeud_id = a.id
 group by a.chemin, a.tri
having count(f.id) > 0
 order by a.tri;
