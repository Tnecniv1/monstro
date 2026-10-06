-- Partition des feuilles d'entraînement : nouvelles racines « Exercices Mécaniques »,
-- « Entrainement et Défi » (avec un niveau de sous-thèmes) et « Préparation Examen ».
-- « Problèmes Chaotiques » est inchangé. Les anciennes racines « Mécaniques - Niveau X »
-- sont conservées (avec les feuilles qui ne correspondent à aucune règle).
-- À exécuter une fois, en un seul bloc, dans l'éditeur SQL Supabase.
-- Tout écart avec les comptages attendus annule la transaction.

begin;

-- 0. Garde-fou : ne pas rejouer la migration
do $$
begin
  if exists (select 1 from noeud
              where parent_id is null
                and nom in ('Exercices Mécaniques', 'Entrainement et Défi', 'Préparation Examen')) then
    raise exception 'Migration déjà appliquée : les nouvelles racines existent';
  end if;
end $$;

-- 1. Racines : Problèmes Chaotiques garde l'ordre 1, les anciennes passent de 2-5 à 5-8
update noeud set ordre = ordre + 3
 where parent_id is null and nom like 'Mécaniques - Niveau %';          -- attendu : UPDATE 4

insert into noeud (parent_id, nom, ordre) values
  (null, 'Exercices Mécaniques', 2),
  (null, 'Entrainement et Défi', 3),
  (null, 'Préparation Examen', 4);                                       -- attendu : INSERT 0 3

-- 2. Classement des feuilles des anciennes racines (première règle vraie, sans casse)
create temp table _classement on commit drop as
with recursive arbre as (
  select id, array[ordre] as tri, nom::text as racine from noeud where parent_id is null
  union all
  select n.id, a.tri || n.ordre, a.racine from noeud n join arbre a on n.parent_id = a.id
)
select f.id as feuille_id, f.titre, f.ordre, a.tri,
       btrim(n.nom) as sous_theme,
       case
         when f.titre ~* '(bac|brevet)' then 'Préparation Examen'
         when f.titre ~* '^livret' or n.nom = 'Cours d''analyse de Terence Tao' then 'Exercices Mécaniques'
         when f.titre ~* '^(V[0-9]+|défi|100|introduction aux)' then 'Entrainement et Défi'
       end as categorie                                                  -- null = reste en place
  from feuille_entrainement f
  join arbre a on a.id = f.noeud_id
  join noeud n on n.id = f.noeud_id
 where a.racine like 'Mécaniques - Niveau %';                            -- attendu : SELECT 101

-- 3. Sous-thèmes d'Entrainement et Défi : nœud actuel de chaque feuille
--    (même nom dans deux niveaux = un seul sous-thème)
insert into noeud (parent_id, nom, ordre)
select r.id, c.sous_theme, row_number() over (order by min(c.tri))
  from _classement c
  join noeud r on r.parent_id is null and r.nom = 'Entrainement et Défi'
 where c.categorie = 'Entrainement et Défi'
 group by r.id, c.sous_theme;                                            -- attendu : INSERT 0 14

-- 4. Déplacement des feuilles, ordre renuméroté dans chaque nœud d'arrivée
with cible as (
  select c.feuille_id, c.tri, c.ordre, c.titre,
         case when c.categorie = 'Entrainement et Défi' then st.id else r.id end as noeud_id
    from _classement c
    join noeud r on r.parent_id is null and r.nom = c.categorie
    left join noeud st on st.parent_id = r.id and st.nom = c.sous_theme
   where c.categorie is not null
),
numerote as (
  select feuille_id, noeud_id,
         row_number() over (partition by noeud_id order by tri, ordre, titre) as rang
    from cible
)
update feuille_entrainement f
   set noeud_id = n.noeud_id, ordre = n.rang
  from numerote n
 where f.id = n.feuille_id;                                              -- attendu : UPDATE 100

-- 5. Contrôle : tout écart annule la transaction
do $$
declare
  v_obtenu text;
  v_attendu text := 'Entrainement et Défi=79, Exercices Mécaniques=9, Mécaniques - Niveau 1=0, '
                 || 'Mécaniques - Niveau 2=0, Mécaniques - Niveau 3=1, Mécaniques - Niveau 4=0, '
                 || 'Problèmes Chaotiques=12, Préparation Examen=12';
begin
  with recursive arbre as (
    select id, nom::text as racine from noeud where parent_id is null
    union all
    select n.id, a.racine from noeud n join arbre a on n.parent_id = a.id
  )
  select string_agg(racine || '=' || nb, ', ' order by racine collate "C") into v_obtenu
    from (select a.racine, count(f.id) as nb
            from arbre a left join feuille_entrainement f on f.noeud_id = a.id
           group by a.racine) t;

  if v_obtenu is distinct from v_attendu then
    raise exception 'Comptages inattendus : %', v_obtenu;
  end if;
  if (select count(*) from noeud st join noeud r on r.id = st.parent_id
       where r.parent_id is null and r.nom = 'Entrainement et Défi') <> 14 then
    raise exception 'Nombre de sous-thèmes inattendu';
  end if;
  if exists (select 1 from feuille_entrainement f join noeud r on r.id = f.noeud_id
              where r.parent_id is null and r.nom = 'Entrainement et Défi') then
    raise exception 'Des feuilles sont rattachées directement à Entrainement et Défi';
  end if;
end $$;

commit;
