-- Forum : lecture des questions et compteur de la pastille de l'onglet Questions.
-- Déjà appliqué en base (éditeur SQL Supabase) : ce fichier sert de documentation.
-- Pas idempotent (create table / create trigger sans if not exists) : ne pas
-- le réexécuter tel quel.

-- Trace de lecture des questions du forum
create table public.forum_lecture (
  user_id   uuid not null references auth.users(id) on delete cascade,
  ticket_id uuid not null references public.forum_tickets(id) on delete cascade,
  lu_le     timestamptz not null default now(),
  primary key (user_id, ticket_id)
);

alter table public.forum_lecture enable row level security;

create policy "lecture_select_own" on public.forum_lecture
  for select using (user_id = auth.uid());
create policy "lecture_insert_own" on public.forum_lecture
  for insert with check (user_id = auth.uid());
create policy "lecture_update_own" on public.forum_lecture
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- lu_le toujours fixé par le serveur
create or replace function public.forum_lecture_now()
returns trigger
language plpgsql
as $$
begin
  new.lu_le := now();
  return new;
end;
$$;

create trigger forum_lecture_set_now
before insert or update on public.forum_lecture
for each row execute function public.forum_lecture_now();

-- Compteur de la pastille de l'onglet Questions
create or replace function public.forum_compteur_attente()
returns integer
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
  select count(*)::int
  from forum_tickets t
  cross join moi
  left join forum_lecture l
    on l.ticket_id = t.id and l.user_id = moi.uid
  where t.topic_id is null
    and t.statut = 'ouvert'
    and (moi.admin or t.user_id = moi.uid)
    and (
      (moi.admin and not exists (
         select 1 from forum_messages m where m.ticket_id = t.id))
      or exists (
         select 1 from forum_messages m
         where m.ticket_id = t.id
           and m.user_id <> moi.uid
           and m.created_at > coalesce(l.lu_le, '-infinity'::timestamptz))
    );
$$;

grant execute on function public.forum_compteur_attente() to authenticated;

notify pgrst, 'reload schema';
