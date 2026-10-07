-- « Livret niveau zéro » remplace les 61 feuilles des sous-thèmes « Tout et Parties »,
-- « Facteurs et Partages », « Mesures et Comparaisons », « Sachant Que », « Données et
-- Relations » et « Problèmes de Dénombrements » (sous « Entrainement et Défi »).
--   - leurs entraînements sont rattachés au livret, avec un numéro d'exercice distinct par
--     élève, attribué depuis la fin du livret : premier entraînement = exo 366, puis 365… ;
--   - les Focus posés sur ces feuilles sont déplacés vers le livret ;
--   - les anciennes feuilles sont supprimées.
-- Les lignes modifiées ou supprimées sont d'abord copiées dans le schéma « sauvegarde »
-- (hors API). Retour arrière : 20261007_livret_niveau_zero_restauration.sql.
-- À exécuter une fois, en un seul bloc, dans l'éditeur SQL Supabase. Tout écart annule
-- la transaction. Non traité ici : les 6 sous-thèmes restent (vides) et les PDF des
-- anciennes feuilles restent dans le stockage « pdfs ».

begin;

create schema if not exists sauvegarde;

-- Feuilles à remplacer
create temp table _cible on commit drop as
select f.id
  from feuille_entrainement f
  join noeud n on n.id = f.noeud_id
  join noeud r on r.id = n.parent_id
 where r.parent_id is null and r.nom = 'Entrainement et Défi'
   and n.nom in ('Tout et Parties', 'Facteurs et Partages', 'Mesures et Comparaisons',
                 'Sachant Que', 'Données et Relations', 'Problèmes de Dénombrements');

-- État de départ, pour le contrôle final
create temp table _avant on commit drop as
select (select count(*) from _cible) as feuilles,
       (select count(*) from entrainement where feuille_id in (select id from _cible)) as entrainements,
       (select count(*) from session) as sessions,
       (select count(*) from observation) as observations;

-- 0. Garde-fous
do $$
declare
  v_zero uuid := 'dcd68b23-8fde-4c66-9728-53060b61146c';
begin
  if not exists (select 1 from feuille_entrainement
                  where id = v_zero and titre = 'Livret niveau zéro' and volume = 366) then
    raise exception 'Livret niveau zéro introuvable, ou son volume n''est plus 366';
  end if;
  if (select feuilles from _avant) <> 61 then
    raise exception 'Nombre de feuilles inattendu : %', (select feuilles from _avant);
  end if;
  if exists (select 1 from entrainement where feuille_id = v_zero) then
    raise exception 'Le livret a déjà des entraînements : numérotation à revoir';
  end if;
  if (select max(nb) from (select count(*) as nb from entrainement
                            where feuille_id in (select id from _cible) group by user_id) t) > 366 then
    raise exception 'Un élève a plus d''entraînements que le livret n''a d''exercices';
  end if;
end $$;

-- 1. Sauvegarde des lignes modifiées ou supprimées (échoue si elle existe déjà :
--    la migration ne se rejoue pas)
create table sauvegarde.livret_zero_feuilles as
  select * from feuille_entrainement where id in (select id from _cible);          -- attendu : SELECT 61
create table sauvegarde.livret_zero_entrainements as
  select * from entrainement where feuille_id in (select id from _cible);          -- attendu : SELECT 512
create table sauvegarde.livret_zero_focus as
  select * from feuille_focus where feuille_id in (select id from _cible);         -- attendu : SELECT 3

-- 2. Entraînements : rattachés au livret. Par élève, dans l'ordre chronologique,
--    en partant de la fin : ref_exo = volume - n + 1 (366, 365, 364…)
with numerote as (
  select e.id, row_number() over (partition by e.user_id order by e.date_creation, e.id) as n
    from entrainement e
   where e.feuille_id in (select id from _cible)
)
update entrainement e
   set feuille_id = 'dcd68b23-8fde-4c66-9728-53060b61146c',
       ref_exo = 366 - n.n + 1
  from numerote n
 where e.id = n.id;                                                                -- attendu : UPDATE 512

-- 3. Focus : un par élève déplacé vers le livret (un éventuel second Focus du même
--    élève sur ces feuilles part en cascade à l'étape 4)
update feuille_focus ff
   set feuille_id = 'dcd68b23-8fde-4c66-9728-53060b61146c'
 where ff.id in (select distinct on (user_id) id from feuille_focus
                  where feuille_id in (select id from _cible)
                  order by user_id, created_at)
   and not exists (select 1 from feuille_focus z
                    where z.user_id = ff.user_id
                      and z.feuille_id = 'dcd68b23-8fde-4c66-9728-53060b61146c');  -- attendu : UPDATE 3

-- 4. Suppression des anciennes feuilles (échoue s'il reste un entraînement dessus)
delete from feuille_entrainement where id in (select id from _cible);              -- attendu : DELETE 61

-- 5. Contrôle : tout écart annule la transaction
do $$
declare
  v_zero uuid := 'dcd68b23-8fde-4c66-9728-53060b61146c';
begin
  if (select count(*) from entrainement where feuille_id = v_zero) <> (select entrainements from _avant) then
    raise exception 'Entraînements rattachés : % au lieu de %',
      (select count(*) from entrainement where feuille_id = v_zero), (select entrainements from _avant);
  end if;
  if exists (select 1 from entrainement where feuille_id = v_zero and ref_exo not between 1 and 366) then
    raise exception 'Un numéro d''exercice sort de l''intervalle 1 à 366';
  end if;
  if (select count(*) from session) <> (select sessions from _avant)
     or (select count(*) from observation) <> (select observations from _avant) then
    raise exception 'Des sessions ou des observations ont disparu';
  end if;
  if exists (select 1 from sauvegarde.livret_zero_feuilles s
              join feuille_entrainement f on f.id = s.id) then
    raise exception 'Des anciennes feuilles existent encore';
  end if;
end $$;

commit;

-- Contrôle après coup (lecture seule) : répartition des numéros attribués.
-- select count(*) as entrainements, count(distinct user_id) as eleves,
--        min(ref_exo) as ref_min, max(ref_exo) as ref_max
--   from entrainement where feuille_id = 'dcd68b23-8fde-4c66-9728-53060b61146c';
-- Attendu : 512 entraînements, 54 élèves, ref_min 335, ref_max 366.
