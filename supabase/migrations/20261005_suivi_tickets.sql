-- Suivi : tickets d'accompagnement (frictions à résoudre), calculés à partir des données.
-- À exécuter une fois dans l'éditeur SQL Supabase (idempotent).
--
-- La table s'appelle suivi_ticket et non ticket : « ticket » désigne déjà les
-- questions du forum (forum_tickets), auxquelles question_id renvoie.

-- 1. Table
create table if not exists suivi_ticket (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profile(id) on delete cascade,
  type text not null check (type in ('question', 'bloque_init', 'inactif', 'irregulier')),
  -- Type question uniquement : la question du forum restée sans réponse
  question_id uuid references forum_tickets(id) on delete cascade,
  -- Type bloque_init uniquement : première étape non faite (1 à 8)
  etape_bloquee smallint check (etape_bloquee between 1 and 8),
  etat text not null default 'a_faire' check (etat in ('a_faire', 'action_faite', 'resolu', 'remplace')),
  ouvert_le timestamptz not null default now(),
  action_faite_le timestamptz,
  ferme_le timestamptz,
  check ((type = 'question') = (question_id is not null)),
  check ((type = 'bloque_init') = (etape_bloquee is not null)),
  check ((etat in ('resolu', 'remplace')) = (ferme_le is not null))
);

-- Un seul ticket de suivi (bloque_init, inactif ou irregulier) ouvert par élève
create unique index if not exists suivi_ticket_un_suivi_par_eleve
  on suivi_ticket (user_id)
  where type <> 'question' and etat in ('a_faire', 'action_faite');

-- Un seul ticket ouvert par question
create unique index if not exists suivi_ticket_un_par_question
  on suivi_ticket (question_id)
  where type = 'question' and etat in ('a_faire', 'action_faite');

alter table suivi_ticket enable row level security;

drop policy if exists "admin_all_suivi_ticket" on suivi_ticket;
create policy "admin_all_suivi_ticket" on suivi_ticket
  for all using (
    exists (select 1 from user_profile where id = auth.uid() and role = 'admin')
  );

-- 2. Recalcul des tickets. Idempotent : crée ceux dont la condition est vraie,
--    ferme ceux dont elle est devenue fausse, remplace inactif par irregulier.
--    Appelée par un admin (onglet Tickets) ou par pg_cron (pas de auth.uid()).
create or replace function refresh_tickets()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_now   timestamptz := now();
  v_paris timestamp := now() at time zone 'Europe/Paris';
  v_jour  date := (now() at time zone 'Europe/Paris')::date;
  -- Dernier passage de 17h00, heure de Paris
  v_17h   timestamptz;
begin
  if auth.uid() is not null
     and not exists (select 1 from user_profile where id = auth.uid() and role = 'admin') then
    raise exception 'Accès réservé à l''administrateur';
  end if;

  -- Deux recalculs simultanés s'exécutent l'un après l'autre.
  perform pg_advisory_xact_lock(hashtext('refresh_tickets'));

  v_17h := ((case when v_paris::time >= time '17:00' then v_jour else v_jour - 1 end) + time '17:00')
           at time zone 'Europe/Paris';

  -- A. Questions sans réponse : question ouverte dont le premier message
  --    d'élève resté sans réponse d'un admin date d'avant le dernier 17h00.
  --    (On part du premier message en attente et non du dernier : une relance
  --    de l'élève ne doit pas refermer le ticket.)
  drop table if exists pg_temp._questions_voulues;
  create temp table _questions_voulues on commit drop as
  select q.id as question_id,
         q.user_id,
         -- Premier 17h00 (Paris) qui suit le message en attente
         ((a.paris::date + case when a.paris::time < time '17:00' then 0 else 1 end) + time '17:00')
           at time zone 'Europe/Paris' as depuis
    from forum_tickets q
    join user_profile au on au.id = q.user_id
    left join lateral (
      select max(m.created_at) as t
        from forum_messages m
        join user_profile p on p.id = m.user_id
       where m.ticket_id = q.id
         and p.role = 'admin'
    ) rep on true
    cross join lateral (
      select coalesce(
               (select min(m.created_at)
                  from forum_messages m
                 where m.ticket_id = q.id
                   and (rep.t is null or m.created_at > rep.t)),
               -- Question sans aucun message : sa propre date
               case when not exists (select 1 from forum_messages m where m.ticket_id = q.id)
                    then q.created_at end
             ) as t
    ) att
    cross join lateral (select att.t at time zone 'Europe/Paris' as paris) a
   where q.statut = 'ouvert'
     and q.topic_id is null
     and au.role <> 'admin'
     and au.plan in ('abonne', 'essai', 'classe')
     and att.t < v_17h;

  update suivi_ticket t
     set etat = 'resolu', ferme_le = v_now
   where t.type = 'question'
     and t.etat in ('a_faire', 'action_faite')
     and not exists (select 1 from _questions_voulues v where v.question_id = t.question_id);

  insert into suivi_ticket (user_id, type, question_id, ouvert_le)
  select v.user_id, 'question', v.question_id, least(v.depuis, v_now)
    from _questions_voulues v
   where not exists (
           select 1 from suivi_ticket t
            where t.type = 'question'
              and t.question_id = v.question_id
              and t.etat in ('a_faire', 'action_faite')
         )
  on conflict do nothing;

  -- B, C, D. Au plus un ticket de suivi par élève.
  drop table if exists pg_temp._suivis_voulus;
  create temp table _suivis_voulus on commit drop as
  with etapes as (
    -- Dates des étapes 1 à 8, chacune évaluée indépendamment (mêmes sources
    -- que get_parcours_admin(), sans la règle linéaire).
    select up.id,
           up.parcours_debut_at as debut,
           array[
             coalesce(up.charte_acceptee_at, case when up.parcours_legacy then up.parcours_debut_at end),
             coalesce(up.invitation_script1_vue_at, up.script1_ouvert_at, case when up.parcours_legacy then up.parcours_debut_at end),
             coalesce(up.script1_ouvert_at, case when up.parcours_legacy then up.parcours_debut_at end),
             coalesce(up.script1_ouvert_at, case when up.parcours_legacy then up.parcours_debut_at end),
             up.premier_focus_at,
             (select min(e.date_creation) from entrainement e where e.user_id = up.id),
             (select min((s.date::timestamp) at time zone 'Europe/Paris')
                from session s
                join entrainement e on e.id = s.entrainement_id
               where e.user_id = up.id),
             (select min(e.termine_at) from entrainement e where e.user_id = up.id)
           ] as d
      from user_profile up
     where up.plan in ('abonne', 'essai', 'classe')
       and up.role <> 'admin'
  ),
  sessions as (
    -- Jours distincts avec session, fenêtres glissantes en jours de Paris
    select e.user_id,
           count(distinct s.date) filter (where s.date > v_jour - 7)  as jours_7,
           count(distinct s.date) filter (where s.date > v_jour - 14) as jours_14,
           max(s.date) as derniere
      from session s
      join entrainement e on e.id = s.entrainement_id
     where s.date <= v_jour
     group by e.user_id
  ),
  etat as (
    select et.id,
           -- Première étape non faite ; 9 = initialisation terminée
           coalesce(array_position(et.d, null), 9) as courante,
           -- Dernière étape franchie, ou souscription si aucune
           greatest(et.debut, (select max(x) from unnest(et.d) as x)) as derniere_etape,
           coalesce(se.jours_7, 0) as jours_7,
           coalesce(se.jours_14, 0) as jours_14,
           se.derniere as derniere_session
      from etapes et
      left join sessions se on se.user_id = et.id
  )
  select e.id as user_id,
         case
           when e.courante <= 8 then 'bloque_init'
           when e.derniere_etape <= v_now - interval '14 days' and e.jours_14 <= 2 then 'irregulier'
           else 'inactif'
         end as type,
         case when e.courante <= 8 then e.courante end as etape_bloquee,
         case
           when e.courante <= 8 then e.derniere_etape + interval '3 days'
           -- Irrégulier : pas de date exacte, on prend le moment du recalcul
           when e.derniere_etape <= v_now - interval '14 days' and e.jours_14 <= 2 then v_now
           else greatest(
                  e.derniere_etape + interval '7 days',
                  ((e.derniere_session + 7)::timestamp) at time zone 'Europe/Paris'
                )
         end as depuis
    from etat e
   where (e.courante <= 8 and e.derniere_etape < v_now - interval '3 days')
      or (e.courante = 9 and e.derniere_etape <= v_now - interval '14 days' and e.jours_14 <= 2)
      or (e.courante = 9 and e.derniere_etape <= v_now - interval '7 days' and e.jours_7 = 0);

  -- Ferme les tickets qui ne correspondent plus à la situation de l'élève.
  -- Un ticket bloque_init est aussi fermé quand l'étape bloquante a changé.
  update suivi_ticket t
     set etat = case
                  when t.type = 'inactif'
                       and exists (select 1 from _suivis_voulus v where v.user_id = t.user_id and v.type = 'irregulier')
                  then 'remplace'
                  else 'resolu'
                end,
         ferme_le = v_now
   where t.type <> 'question'
     and t.etat in ('a_faire', 'action_faite')
     and not exists (
           select 1 from _suivis_voulus v
            where v.user_id = t.user_id
              and v.type = t.type
              and v.etape_bloquee is not distinct from t.etape_bloquee
         );

  insert into suivi_ticket (user_id, type, etape_bloquee, ouvert_le)
  select v.user_id, v.type, v.etape_bloquee, least(v.depuis, v_now)
    from _suivis_voulus v
   where not exists (
           select 1 from suivi_ticket t
            where t.user_id = v.user_id
              and t.type <> 'question'
              and t.etat in ('a_faire', 'action_faite')
         )
  on conflict do nothing;
end;
$$;

revoke execute on function refresh_tickets() from public, anon;
grant execute on function refresh_tickets() to authenticated, service_role;

-- 3. Optionnel : recalcul toutes les heures, pour que les dates d'ouverture et
--    les résolutions ne dépendent pas de l'ouverture de l'onglet.
--    Pour s'en passer : select cron.unschedule('refresh-tickets');
select cron.schedule('refresh-tickets', '5 * * * *', 'select public.refresh_tickets()');
