-- Onboarding, étape Focus : feuilles recommandées selon la catégorie, l'âge et le niveau.
-- À exécuter une fois, en un seul bloc, dans l'éditeur SQL Supabase.
-- Les lignes se modifient ensuite depuis le dashboard (aucune écriture via l'API).

begin;

-- 1. Table
create table recommandation_focus (
  id uuid primary key default gen_random_uuid(),
  categorie text not null check (categorie in ('chaotique', 'mecanique')),
  -- Tranche d'âge, bornes incluses. age_max = 99 : « et plus ».
  age_min int not null,
  age_max int not null,
  niveau text not null check (niveau in ('fragile', 'moyen', 'fort')),
  -- null = pas encore de feuille recommandée pour cette case
  feuille_id uuid references feuille_entrainement(id) on delete set null,
  check (age_max >= age_min),
  unique (categorie, age_min, niveau)
);

alter table recommandation_focus enable row level security;

-- Lecture pour tout utilisateur connecté. Aucune policy d'écriture : insert,
-- update et delete sont refusés par la RLS pour les rôles de l'API.
create policy "lecture_recommandation_focus" on recommandation_focus
  for select to authenticated using (true);

-- 2. Données initiales. Les feuilles sont retrouvées par leur titre exact
--    (espaces de bord ignorés) ; t = null laisse la case vide.
create temp table _reco (categorie text, age_min int, age_max int, niveau text, t text) on commit drop;

insert into _reco (categorie, age_min, age_max, niveau, t) values
  ('chaotique', 10, 12, 'fragile', 'Problèmes de la Vie, part 1'),
  ('chaotique', 10, 12, 'moyen',   'Problèmes de la Vie, part 1'),
  ('chaotique', 10, 12, 'fort',    'Problèmes Exeter, niveau 1.1'),
  ('chaotique', 13, 17, 'fragile', 'Problèmes Exeter, niveau 1.1'),
  ('chaotique', 13, 17, 'moyen',   'Problèmes Exeter, niveau 1.1'),
  ('chaotique', 13, 17, 'fort',    'Problèmes Exeter, niveau 1.1'),
  ('chaotique', 18, 99, 'fragile', 'Problèmes Exeter, niveau 1.1'),
  ('chaotique', 18, 99, 'moyen',   'Problèmes Exeter, niveau 1.1'),
  ('chaotique', 18, 99, 'fort',    'Problème classe préparatoire, volume 1'),

  ('mecanique', 10, 12, 'fragile', null),
  ('mecanique', 10, 12, 'moyen',   null),
  ('mecanique', 10, 12, 'fort',    'Livret sur les pourcentages, les ratios et les échelles'),
  ('mecanique', 13, 14, 'fragile', 'Livret sur les pourcentages, les ratios et les échelles'),
  ('mecanique', 13, 14, 'moyen',   'Livret sur les pourcentages, les ratios et les échelles'),
  ('mecanique', 13, 14, 'fort',    'Livret un sur la géométrie dans l''espace'),
  ('mecanique', 15, 15, 'fragile', 'Livret sur les pourcentages, les ratios et les échelles'),
  ('mecanique', 15, 15, 'moyen',   'livret niveau un'),
  ('mecanique', 15, 15, 'fort',    'livret niveau un'),
  ('mecanique', 16, 16, 'fragile', 'livret niveau un'),
  ('mecanique', 16, 16, 'moyen',   'livret niveau un'),
  ('mecanique', 16, 16, 'fort',    'livret niveau deux'),
  ('mecanique', 17, 17, 'fragile', 'livret niveau un'),
  ('mecanique', 17, 17, 'moyen',   'livret niveau deux'),
  ('mecanique', 17, 17, 'fort',    'livret niveau trois'),
  ('mecanique', 18, 99, 'fragile', 'livret niveau deux'),
  ('mecanique', 18, 99, 'moyen',   'livret niveau trois'),
  -- Feuille du nœud « Cours d'analyse de Terence Tao » ; son titre n'a pas de préfixe.
  ('mecanique', 18, 99, 'fort',    'Les entiers naturels');

-- Garde-fou : chaque titre doit désigner exactement une feuille.
do $$
declare
  v_probleme text;
begin
  select string_agg(format('« %s » : %s feuille(s)', r.t, r.nb), ' ; ') into v_probleme
    from (select d.t, (select count(*) from feuille_entrainement f where btrim(f.titre) = d.t) as nb
            from (select distinct t from _reco where t is not null) d) r
   where r.nb <> 1;
  if v_probleme is not null then
    raise exception 'Titres introuvables ou ambigus : %', v_probleme;
  end if;
end $$;

insert into recommandation_focus (categorie, age_min, age_max, niveau, feuille_id)
select r.categorie, r.age_min, r.age_max, r.niveau, f.id
  from _reco r
  left join feuille_entrainement f on btrim(f.titre) = r.t;             -- attendu : INSERT 0 27

commit;

-- Contrôle (lecture seule) : 27 lignes, dont 2 sans feuille (mecanique 10-12, fragile et moyen).
-- select r.categorie, r.age_min, r.age_max, r.niveau, f.titre
--   from recommandation_focus r left join feuille_entrainement f on f.id = r.feuille_id
--  order by r.categorie, r.age_min, array_position(array['fragile', 'moyen', 'fort'], r.niveau);
