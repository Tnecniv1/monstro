-- Onglet « Équipe » : carte vedette. À exécuter une fois dans l'éditeur SQL Supabase (idempotent),
-- après 20261012_live_sessions_semaine.sql.
--
-- get_live_sessions(p_lundi) gagne trois colonnes, renvoyées à tout utilisateur authentifié :
--   animateur_avatar_url : photo de profil de l'animateur (ou null) ;
--   inscrits_initiales   : première lettre du prénom des 5 premiers inscrits ;
--   inscrits_avatars     : leur photo de profil (ou null), dans le même ordre.
-- Le lien reste réservé aux inscrits et aux admins, la liste nominative aux admins.
-- Le type de retour change : la fonction doit être supprimée puis recréée.

drop function if exists public.get_live_sessions(date);

create function get_live_sessions(p_lundi date)
returns table (
  id uuid,
  debut timestamptz,
  duree_minutes integer,
  places integer,
  animateur_nom text,
  animateur_avatar_url text,
  nb_inscrits integer,
  inscrit boolean,
  lien text,
  inscrits jsonb,
  inscrits_initiales text[],
  inscrits_avatars text[]
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
         a.avatar_url as animateur_avatar_url,
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
         ) end as inscrits,
         coalesce(premiers.initiales, '{}') as inscrits_initiales,
         coalesce(premiers.avatars, '{}') as inscrits_avatars
    from live_session s
    cross join moi
    join user_profile a on a.id = s.animateur_id
    -- Les 5 premiers inscrits, dans l'ordre d'inscription
    left join lateral (
      select array_agg(x.initiale order by x.rang) as initiales,
             array_agg(x.avatar_url order by x.rang) as avatars
        from (
          select upper(left(coalesce(nullif(trim(p.prenom), ''), p.pseudo, '?'), 1)) as initiale,
                 p.avatar_url,
                 row_number() over (order by i.created_at, i.id) as rang
            from live_inscription i
            join user_profile p on p.id = i.user_id
           where i.session_id = s.id
           order by i.created_at, i.id
           limit 5
        ) x
    ) premiers on true
   where moi.uid is not null
     and s.debut >= (p_lundi::timestamp at time zone 'Europe/Paris')
     and s.debut <  ((p_lundi + 7)::timestamp at time zone 'Europe/Paris')
   order by s.debut;
$$;

revoke execute on function get_live_sessions(date) from public, anon;
grant execute on function get_live_sessions(date) to authenticated, service_role;

-- L'API (PostgREST) recharge sa liste de fonctions tout de suite
notify pgrst, 'reload schema';
