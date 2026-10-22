-- Vue Global : part des abonnés actifs par jour.
-- À exécuter une fois dans l'éditeur SQL Supabase (idempotent).
--
-- Le plan n'a pas d'historique en base (user_profile.plan est écrasé à chaque
-- changement) : on prend chaque soir une photo des élèves qui ont accès, et le
-- ratio se calcule sur ces photos. Pas de photo = pas de ratio ce jour-là.

-- 1. Photo quotidienne des élèves ayant accès. Accès uniquement par les
--    fonctions SECURITY DEFINER ci-dessous (RLS activé, aucune policy).
create table if not exists acces_jour (
  jour    date not null,
  user_id uuid not null references user_profile(id) on delete cascade,
  plan    text not null,
  primary key (jour, user_id)
);

alter table acces_jour enable row level security;

-- 2. Photo du jour (date de Paris). Relançable : une photo déjà prise pour un
--    élève ce jour-là n'est pas remplacée.
--    Exclus : le compte admin et les comptes de test (email dans auth.users).
create or replace function snapshot_acces_jour()
returns void
language sql
security definer
set search_path = public, auth
as $$
  insert into acces_jour (jour, user_id, plan)
  select (now() at time zone 'Europe/Paris')::date, up.id, up.plan
    from user_profile up
    join auth.users au on au.id = up.id
   where up.plan in ('abonne', 'essai', 'classe')
     and up.id <> '1ce5a258-ad0c-42db-8cbd-074040af1fcf'
     and au.email not like 'fake_%@%.internal'
  on conflict do nothing;
$$;

revoke execute on function snapshot_acces_jour() from public, anon, authenticated;
grant execute on function snapshot_acces_jour() to service_role;

-- 3. Photo chaque soir à 21:50 UTC : 23:50 (heure d'été) ou 22:50 (heure
--    d'hiver) à Paris, donc toujours le même jour civil.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'snapshot-acces-jour') then
    perform cron.unschedule('snapshot-acces-jour');
  end if;
end;
$$;

select cron.schedule('snapshot-acces-jour', '50 21 * * *', 'select public.snapshot_acces_jour()');

-- 4. Ratio par jour de calendrier, du jour J-(jours-1) à aujourd'hui (Paris).
--    abonnes  : élèves de la photo du jour ;
--    actifs   : élèves de la photo du jour ayant au moins une session à cette date ;
--    ratio    : actifs / abonnes, null sans photo ;
--    ratio_7j : somme des actifs / somme des abonnes sur les 7 jours de calendrier
--               se terminant ce jour (les jours sans photo comptent pour 0 des
--               deux côtés, donc ne pèsent pas), null si aucune photo.
create or replace function get_ratio_acces_par_jour(jours int default 180)
returns table (jour date, abonnes integer, actifs integer, ratio double precision, ratio_7j double precision)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_fin   date := (now() at time zone 'Europe/Paris')::date;
  v_debut date := v_fin - (greatest(jours, 1) - 1);
begin
  if not exists (select 1 from user_profile where id = auth.uid() and role = 'admin') then
    raise exception 'Accès réservé à l''administrateur';
  end if;

  return query
  with calendrier as (
    -- 6 jours de plus en amont, pour la moyenne 7 jours du début de période.
    select g::date as jour
      from generate_series(v_debut - 6, v_fin, interval '1 day') as g
  ),
  photos as (
    select a.jour, count(*)::integer as abonnes
      from acces_jour a
     where a.jour between v_debut - 6 and v_fin
     group by a.jour
  ),
  presents as (
    select a.jour, count(distinct a.user_id)::integer as actifs
      from acces_jour a
     where a.jour between v_debut - 6 and v_fin
       and exists (
         select 1
           from session s
           join entrainement e on e.id = s.entrainement_id
          where e.user_id = a.user_id
            and s.date = a.jour
       )
     group by a.jour
  ),
  par_jour as (
    select c.jour,
           coalesce(p.abonnes, 0) as abonnes,
           coalesce(x.actifs, 0)  as actifs
      from calendrier c
      left join photos p   on p.jour = c.jour
      left join presents x on x.jour = c.jour
  ),
  fenetres as (
    select pj.jour,
           pj.abonnes,
           pj.actifs,
           sum(pj.actifs)  over w as actifs_7j,
           sum(pj.abonnes) over w as abonnes_7j
      from par_jour pj
    window w as (order by pj.jour rows between 6 preceding and current row)
  )
  select f.jour,
         f.abonnes,
         f.actifs,
         case when f.abonnes > 0 then f.actifs::double precision / f.abonnes end,
         case when f.abonnes_7j > 0 then f.actifs_7j::double precision / f.abonnes_7j end
    from fenetres f
   where f.jour >= v_debut
   order by f.jour;
end;
$$;

revoke execute on function get_ratio_acces_par_jour(int) from public, anon;
grant execute on function get_ratio_acces_par_jour(int) to authenticated;

-- 5. Première photo : aujourd'hui.
select snapshot_acces_jour();
