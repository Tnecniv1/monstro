-- Table conversation_message : historique des échanges de la conversation
-- socratique en streaming (API Anthropic), qui remplace le flux manuel de
-- copier-coller vers claude.ai. Un enregistrement par tour (user ou
-- assistant), dans l'ordre chronologique, pour reconstituer l'historique
-- envoyé au modèle à chaque appel (app/api/socratique/message,
-- app/api/socratique/cloturer) et pour l'afficher côté front.
-- Le verdict final reste dans conversation_soumission (inchangée).

create table if not exists conversation_message (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profile(id) on delete cascade,
  sujet_id uuid not null references conversation_sujet(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  contenu text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_message_user_sujet_created_idx
  on conversation_message (user_id, sujet_id, created_at);

alter table conversation_message enable row level security;

create policy "conversation_message_select_own" on conversation_message
  for select using (auth.uid() = user_id);

create policy "conversation_message_insert_own" on conversation_message
  for insert with check (auth.uid() = user_id);
