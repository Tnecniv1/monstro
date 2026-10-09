-- « Préparation Examen » : les 12 feuilles rattachées directement à la racine passent dans
-- ses sous-catégories « Type brevet » (5) et « Type bac » (7). L'ordre d'affichage actuel
-- est conservé dans chaque sous-catégorie (renuméroté à partir de 1), et le titre
-- « Exam - Tyoe bac 2025 » est corrigé en « Exam - Type bac 2025 ». L'espace final de
-- « Type bac, restreint à la géométrie vectorielle » est retiré, et les sous-catégories
-- sont ordonnées : « Type brevet » 1, « Type bac » 2 (toutes deux à 1 auparavant).
-- À exécuter une fois, en un seul bloc, dans l'éditeur SQL Supabase.
-- Tout écart avec l'état attendu annule la transaction.
--
-- État de départ (noeud_id = racine 6ea71c8e-a819-4e15-9368-bd4033369ea0), pour un retour arrière :
--   ordre 1 à 5  : Exam - Type brevet 2021 à 2025
--   ordre 6      : Type bac, restreint à la géométrie vectorielle
--   ordre 7 à 10 : Exam - Type bac 2021 à 2024
--   ordre 11     : Exam - Tyoe bac 2025
--   ordre 12     : V1 - Préparation bac

--
-- Contrôle avant/après : l'éditeur n'affiche que le résultat de la dernière instruction.
-- Lancer d'abord, seul, le SELECT de la fin du fichier (état AVANT), puis tout le bloc
-- (qui se termine par ce même SELECT : état APRÈS).

begin;

-- 1. Cible de chaque feuille (les titres sont comparés sans les espaces de fin :
--    « Type bac, restreint à la géométrie vectorielle » en a un en base)
create temp table _cible on commit drop as
select f.id as feuille_id, f.ordre, st.id as noeud_id
  from feuille_entrainement f
  join noeud r on r.id = f.noeud_id and r.parent_id is null and r.nom = 'Préparation Examen'
  join (values
    ('Exam - Type brevet 2021', 'Type brevet'),
    ('Exam - Type brevet 2022', 'Type brevet'),
    ('Exam - Type brevet 2023', 'Type brevet'),
    ('Exam - Type brevet 2024', 'Type brevet'),
    ('Exam - Type brevet 2025', 'Type brevet'),
    ('Exam - Type bac 2021', 'Type bac'),
    ('Exam - Type bac 2022', 'Type bac'),
    ('Exam - Type bac 2023', 'Type bac'),
    ('Exam - Type bac 2024', 'Type bac'),
    ('Exam - Tyoe bac 2025', 'Type bac'),
    ('Type bac, restreint à la géométrie vectorielle', 'Type bac'),
    ('V1 - Préparation bac', 'Type bac')
  ) as v (titre, sous_categorie) on v.titre = btrim(f.titre)
  join noeud st on st.parent_id = r.id and st.nom = v.sous_categorie;      -- attendu : SELECT 12

-- 0. Garde-fous
do $$
begin
  if (select count(*) from _cible) <> 12 then
    raise exception 'Feuilles à déplacer : % au lieu de 12', (select count(*) from _cible);
  end if;
  if exists (select 1 from feuille_entrainement f
              join noeud st on st.id = f.noeud_id
              join noeud r on r.id = st.parent_id
             where r.parent_id is null and r.nom = 'Préparation Examen'
               and st.nom in ('Type brevet', 'Type bac')) then
    raise exception 'Les sous-catégories contiennent déjà des feuilles : ordre à revoir';
  end if;
end $$;

-- 2. Déplacement, ordre renuméroté dans chaque sous-catégorie selon l'ordre actuel
with numerote as (
  select feuille_id, noeud_id,
         row_number() over (partition by noeud_id order by ordre) as rang
    from _cible
)
update feuille_entrainement f
   set noeud_id = n.noeud_id, ordre = n.rang
  from numerote n
 where f.id = n.feuille_id;                                                -- attendu : UPDATE 12

-- 3. Correction du titre
update feuille_entrainement
   set titre = 'Exam - Type bac 2025'
 where titre = 'Exam - Tyoe bac 2025'
   and id in (select feuille_id from _cible);                              -- attendu : UPDATE 1

-- 4. Espace en fin de titre (« Type bac, restreint à la géométrie vectorielle »)
update feuille_entrainement
   set titre = btrim(titre)
 where titre <> btrim(titre)
   and id in (select feuille_id from _cible);                              -- attendu : UPDATE 1

-- 5. Ordre des sous-catégories (toutes deux à 1 jusqu'ici) : brevet puis bac
update noeud st
   set ordre = case st.nom when 'Type brevet' then 1 else 2 end
  from noeud r
 where r.id = st.parent_id and r.parent_id is null and r.nom = 'Préparation Examen'
   and st.nom in ('Type brevet', 'Type bac');                              -- attendu : UPDATE 2

-- 6. Contrôle : tout écart annule la transaction
do $$
declare
  v_obtenu text;
begin
  select string_agg(n.nom || '=' || t.nb, ', ' order by n.nom) into v_obtenu
    from (select noeud_id, count(*) as nb from feuille_entrainement
           where id in (select feuille_id from _cible) group by noeud_id) t
    join noeud n on n.id = t.noeud_id;
  if v_obtenu is distinct from 'Type bac=7, Type brevet=5' then
    raise exception 'Répartition inattendue : %', v_obtenu;
  end if;
  if exists (select 1 from feuille_entrainement f join noeud r on r.id = f.noeud_id
              where r.parent_id is null and r.nom = 'Préparation Examen') then
    raise exception 'Des feuilles sont encore rattachées directement à Préparation Examen';
  end if;
  if exists (select 1 from feuille_entrainement where titre ilike '%Tyoe%') then
    raise exception 'Le titre « Tyoe » existe encore';
  end if;
  if exists (select 1 from feuille_entrainement
              where id in (select feuille_id from _cible) and titre <> btrim(titre)) then
    raise exception 'Un titre a encore un espace en début ou en fin';
  end if;
  if (select string_agg(st.nom || '=' || st.ordre, ', ' order by st.ordre, st.nom)
        from noeud st join noeud r on r.id = st.parent_id
       where r.parent_id is null and r.nom = 'Préparation Examen')
     is distinct from 'Type brevet=1, Type bac=2' then
    raise exception 'Ordre des sous-catégories inattendu';
  end if;
end $$;

commit;

-- Contrôle (lecture seule) : parent, ordre, titre (entre crochets : espaces visibles)
select coalesce(r.nom || ' > ', '') || n.nom as parent, n.ordre as ordre_parent,
       f.ordre, '[' || f.titre || ']' as titre
  from feuille_entrainement f
  join noeud n on n.id = f.noeud_id
  left join noeud r on r.id = n.parent_id
 where 'Préparation Examen' in (n.nom, r.nom)
 order by n.parent_id nulls first, n.ordre, n.nom, f.ordre;
