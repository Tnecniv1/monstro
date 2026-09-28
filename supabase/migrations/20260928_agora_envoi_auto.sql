-- Agora : envoi automatique hebdomadaire des rapports + journal des envois.
-- À exécuter une fois dans l'éditeur SQL Supabase (idempotent).

-- 1. Réglage global de l'envoi automatique (une seule ligne, id = true)
create table if not exists agora_settings (
  id boolean primary key default true check (id),
  -- 1 = lundi … 7 = dimanche (ISO), heure de Paris
  jour_semaine smallint not null default 1 check (jour_semaine between 1 and 7),
  heure time not null default '08:00',
  -- Désactivé par défaut : rien ne part tant que l'admin ne l'a pas activé
  actif boolean not null default false,
  -- Lundi (Paris) de la semaine déjà traitée par l'envoi automatique (idempotence)
  dernier_envoi_auto date,
  updated_at timestamptz not null default now()
);

insert into agora_settings (id) values (true) on conflict (id) do nothing;

alter table agora_settings enable row level security;

drop policy if exists "admin_all_agora_settings" on agora_settings;
create policy "admin_all_agora_settings" on agora_settings
  for all using (
    exists (select 1 from user_profile where id = auth.uid() and role = 'admin')
  );

-- 2. Journal de toutes les tentatives d'envoi (succès et échecs, manuels et automatiques).
--    rapport_envoi reste inchangée (un succès par couple rapport/suiveur).
create table if not exists rapport_envoi_log (
  id uuid primary key default gen_random_uuid(),
  rapport_id uuid not null references rapport_mensuel(id) on delete cascade,
  referent_id uuid references referent(id) on delete set null,
  canal text not null default 'whatsapp' check (canal in ('whatsapp', 'sms')),
  declenchement text not null default 'manuel' check (declenchement in ('manuel', 'auto')),
  statut text not null check (statut in ('succes', 'echec')),
  erreur text,
  twilio_sid text,
  created_at timestamptz not null default now()
);

create index if not exists rapport_envoi_log_rapport_idx on rapport_envoi_log (rapport_id, created_at desc);

alter table rapport_envoi_log enable row level security;

drop policy if exists "admin_all_rapport_envoi_log" on rapport_envoi_log;
create policy "admin_all_rapport_envoi_log" on rapport_envoi_log
  for all using (
    exists (select 1 from user_profile where id = auth.uid() and role = 'admin')
  );
