create table if not exists referent (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  relation text not null check (relation in ('parent', 'prof', 'autre')),
  telephone text not null,
  created_at timestamptz default now()
);

create table if not exists referent_eleve (
  id uuid primary key default gen_random_uuid(),
  referent_id uuid not null references referent(id) on delete cascade,
  eleve_id uuid not null references user_profile(id) on delete cascade,
  actif boolean not null default true,
  created_at timestamptz default now()
);

-- RLS : seuls les admins peuvent lire/écrire
alter table referent enable row level security;
alter table referent_eleve enable row level security;

create policy "admin_all_referent" on referent
  for all using (
    exists (
      select 1 from user_profile
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "admin_all_referent_eleve" on referent_eleve
  for all using (
    exists (
      select 1 from user_profile
      where id = auth.uid() and role = 'admin'
    )
  );
