-- Onglet « Équipe » : vue semaine. À exécuter une fois dans l'éditeur SQL Supabase (idempotent),
-- après 20261012_live_sessions.sql.
--
-- get_live_sessions(p_lundi) renvoie toutes les sessions d'une semaine (du lundi au dimanche,
-- heure de Paris), passées comprises : la vue semaine permet de revenir en arrière.
-- Elle remplace l'ancienne version sans paramètre (sessions à venir uniquement).

drop function if exists public.get_live_sessions();

create or replace function get_live_sessions(p_lundi date)
returns table (
  id uuid,
  debut timestamptz,
  duree_minutes integer,
  places integer,
  animateur_nom text,
  nb_inscrits integer,
  inscrit boolean,
  lien text,
  inscrits jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with moi as (
    select auth.uid() as uid,
           exists (select 1 from user_profile where id = auth.uid() and role = 'admin') as admin
  )
  select s.id,
         s.debut,
         s.duree_minutes,
         s.places,
         coalesce(nullif(trim(a.prenom), ''), a.pseudo, '—') as animateur_nom,
         (select count(*)::integer from live_inscription i where i.session_id = s.id) as nb_inscrits,
         exists (select 1 from live_inscription i where i.session_id = s.id and i.user_id = moi.uid) as inscrit,
         case
           when moi.admin
                or exists (select 1 from live_inscription i where i.session_id = s.id and i.user_id = moi.uid)
           then s.lien
         end as lien,
         case when moi.admin then (
           select coalesce(
                    jsonb_agg(jsonb_build_object('prenom', p.prenom, 'nom', p.nom, 'pseudo', p.pseudo) order by i.created_at),
                    '[]'::jsonb
                  )
             from live_inscription i
             join user_profile p on p.id = i.user_id
            where i.session_id = s.id
         ) end as inscrits
    from live_session s
    cross join moi
    join user_profile a on a.id = s.animateur_id
   where moi.uid is not null
     and s.debut >= (p_lundi::timestamp at time zone 'Europe/Paris')
     and s.debut <  ((p_lundi + 7)::timestamp at time zone 'Europe/Paris')
   order by s.debut;
$$;

revoke execute on function get_live_sessions(date) from public, anon;
grant execute on function get_live_sessions(date) to authenticated, service_role;

-- Rappel des droits de la première migration (sans effet s'ils sont déjà en place)
grant execute on function inscrire_live(uuid) to authenticated, service_role;
grant execute on function desinscrire_live(uuid) to authenticated, service_role;

-- L'API (PostgREST) recharge sa liste de fonctions tout de suite
notify pgrst, 'reload schema';
