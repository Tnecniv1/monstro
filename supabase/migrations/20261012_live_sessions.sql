-- Forum, onglet « Équipe » : sessions en direct (visio) et inscriptions des élèves.
-- À exécuter une fois dans l'éditeur SQL Supabase (idempotent).
--
-- Le lien de visio ne doit être vu que par les inscrits et les admins : la table
-- live_session n'est donc lisible directement que par les admins, et tout le monde
-- lit les sessions via get_live_sessions(), qui masque le lien.
-- Les inscriptions ne s'écrivent que par inscrire_live() / desinscrire_live(), qui
-- contrôlent les places et l'heure de début côté base.

-- 1. Tables
create table if not exists live_session (
  id uuid primary key default gen_random_uuid(),
  animateur_id uuid not null references user_profile(id) on delete cascade,
  debut timestamptz not null,
  duree_minutes integer not null default 45 check (duree_minutes > 0),
  places integer not null check (places > 0),
  -- Lien Meet, ouvert tel quel par le bouton « Rejoindre »
  lien text not null check (lien ~ '^https://'),
  created_at timestamptz not null default now()
);

create index if not exists live_session_debut on live_session (debut);

create table if not exists live_inscription (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_session(id) on delete cascade,
  user_id uuid not null references user_profile(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index if not exists live_inscription_user on live_inscription (user_id);

-- 2. RLS
alter table live_session enable row level security;
alter table live_inscription enable row level security;

-- Sessions : lecture et écriture directes réservées aux admins
drop policy if exists "admin_all_live_session" on live_session;
create policy "admin_all_live_session" on live_session
  for all using (
    exists (select 1 from user_profile where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from user_profile where id = auth.uid() and role = 'admin')
  );

-- Inscriptions : chacun lit les siennes, un admin les lit toutes.
-- Aucune policy d'écriture : création et suppression passent par les fonctions ci-dessous.
drop policy if exists "lecture_live_inscription" on live_inscription;
create policy "lecture_live_inscription" on live_inscription
  for select using (
    user_id = auth.uid()
    or exists (select 1 from user_profile where id = auth.uid() and role = 'admin')
  );

-- 3. Sessions à venir ou en cours, de la plus proche à la plus lointaine.
--    lien : renseigné seulement pour un inscrit ou un admin.
--    inscrits : liste (prénom, nom, pseudo) pour un admin, null sinon.
create or replace function get_live_sessions()
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
     and s.debut + make_interval(mins => s.duree_minutes) > now()
   order by s.debut;
$$;

-- 4. Inscription de l'élève connecté. Refusée si la session est complète ou commencée.
create or replace function inscrire_live(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session live_session%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if not exists (
       select 1 from user_profile where id = auth.uid() and plan in ('abonne', 'essai', 'classe')
     ) then
    raise exception 'Les sessions en direct sont réservées aux élèves';
  end if;

  -- Verrou sur la session : deux inscriptions simultanées à la dernière place
  -- passent l'une après l'autre.
  select * into v_session from live_session where id = p_session_id for update;
  if not found then
    raise exception 'Cette session n''existe plus';
  end if;
  if v_session.debut <= now() then
    raise exception 'Cette session a déjà commencé';
  end if;

  -- Déjà inscrit : rien à faire
  if exists (select 1 from live_inscription where session_id = p_session_id and user_id = auth.uid()) then
    return;
  end if;

  if (select count(*) from live_inscription where session_id = p_session_id) >= v_session.places then
    raise exception 'Cette session est complète';
  end if;

  insert into live_inscription (session_id, user_id) values (p_session_id, auth.uid());
end;
$$;

-- 5. Désinscription de l'élève connecté, possible jusqu'au début de la session.
create or replace function desinscrire_live(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if exists (select 1 from live_session where id = p_session_id and debut <= now()) then
    raise exception 'Cette session a déjà commencé';
  end if;

  delete from live_inscription where session_id = p_session_id and user_id = auth.uid();
end;
$$;

revoke execute on function get_live_sessions() from public, anon;
revoke execute on function inscrire_live(uuid) from public, anon;
revoke execute on function desinscrire_live(uuid) from public, anon;
grant execute on function get_live_sessions() to authenticated, service_role;
grant execute on function inscrire_live(uuid) to authenticated, service_role;
grant execute on function desinscrire_live(uuid) to authenticated, service_role;
