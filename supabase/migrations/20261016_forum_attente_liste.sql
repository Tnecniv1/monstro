-- Forum : liste des questions en attente (source unique de l'état « en attente »)
-- et compteur réécrit par-dessus. Déjà appliqué en base (éditeur SQL Supabase) :
-- ce fichier sert de documentation. Idempotent (create or replace).

-- Liste des questions en attente pour l'utilisateur connecté (règle unique)
create or replace function public.forum_tickets_en_attente()
returns table (ticket_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with moi as (
    select auth.uid() as uid,
           exists (select 1 from user_profile p
                   where p.id = auth.uid() and p.role = 'admin') as admin
  )
  select t.id
  from forum_tickets t
  cross join moi
  left join forum_lecture l
    on l.ticket_id = t.id and l.user_id = moi.uid
  where t.topic_id is null
    and t.statut = 'ouvert'
    and (moi.admin or t.user_id = moi.uid)
    and (
      (moi.admin and not exists (
         select 1 from forum_messages m
         where m.ticket_id = t.id
           and m.user_id <> t.user_id))
      or exists (
         select 1 from forum_messages m
         where m.ticket_id = t.id
           and m.user_id <> moi.uid
           and m.created_at > coalesce(l.lu_le, '-infinity'::timestamptz))
    );
$$;

revoke execute on function public.forum_tickets_en_attente() from public, anon;
grant execute on function public.forum_tickets_en_attente() to authenticated;

-- Le compteur s'appuie désormais sur la liste
create or replace function public.forum_compteur_attente()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.forum_tickets_en_attente();
$$;

notify pgrst, 'reload schema';
