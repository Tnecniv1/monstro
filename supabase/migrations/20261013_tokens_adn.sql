-- Jetons « ADN » : monnaie dépensée pour s'inscrire aux lives (onglet Équipe).
-- À exécuter une fois dans l'éditeur SQL Supabase (idempotent), après les migrations live_sessions.
--
-- Gains    : +12 à chaque facture d'abonnement payée (Edge Function abonnement-webhook),
--            +1 tous les 25 QCM réussis pour la première fois (trigger).
-- Dépense  : 1 jeton par inscription à un live, remboursé si l'élève se désinscrit avant le
--            début ou si la session est supprimée avant son début. Les admins ne paient pas.
-- Plafond  : 15. Un crédit qui ferait dépasser 15 est tronqué.
--
-- Le solde n'est stocké nulle part : c'est la somme de l'historique token_mouvement.
-- Le système de crédits des missions (credit_transaction) n'est pas réutilisé : il porte une
-- autre monnaie (conversion de pixels à un taux variable, achats de missions).

-- 1. Historique
create table if not exists token_mouvement (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profile(id) on delete cascade,
  delta integer not null,
  motif text not null check (
    motif in ('abonnement', 'qcm', 'inscription_live', 'remboursement_live', 'ajustement_admin')
  ),
  -- abonnement : id de facture Stripe. qcm : 'palier-<n>'.
  -- inscription_live / remboursement_live : '<session_id>:<inscription_id>'.
  -- ajustement_admin : id de l'admin.
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists token_mouvement_user on token_mouvement (user_id, created_at);

-- Un même événement ne crédite ni ne débite jamais deux fois
create unique index if not exists token_mouvement_evenement_unique
  on token_mouvement (user_id, motif, reference)
  where motif <> 'ajustement_admin';

alter table token_mouvement enable row level security;

-- Lecture : chacun son historique, un admin tous. Aucune écriture directe.
drop policy if exists "lecture_token_mouvement" on token_mouvement;
create policy "lecture_token_mouvement" on token_mouvement
  for select using (
    user_id = auth.uid()
    or exists (select 1 from user_profile where id = auth.uid() and role = 'admin')
  );

-- 2. Première réussite de chaque QCM par élève (une ligne, jamais retirée) : base du
--    compteur « tous les 25 QCM ». Pas de clé étrangère : le trigger ne doit jamais
--    faire échouer la validation d'une réponse.
create table if not exists qcm_premiere_reussite (
  user_id uuid not null,
  question_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table qcm_premiere_reussite enable row level security;

drop policy if exists "lecture_qcm_premiere_reussite" on qcm_premiere_reussite;
create policy "lecture_qcm_premiere_reussite" on qcm_premiere_reussite
  for select using (
    user_id = auth.uid()
    or exists (select 1 from user_profile where id = auth.uid() and role = 'admin')
  );

-- QCM déjà réussis avant cette migration : comptés, mais sans jeton rétroactif
-- (le prochain jeton tombe au prochain multiple de 25).
insert into qcm_premiere_reussite (user_id, question_id)
select user_id, question_id
  from qcm_progression_question
 where statut in ('reussie', 'corrige')
on conflict do nothing;

-- 3. Solde d'un utilisateur : le sien, ou celui de n'importe qui pour un admin
--    (et pour le webhook, qui n'a pas de auth.uid()).
create or replace function token_solde(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is not null
     and auth.uid() <> p_user_id
     and not exists (select 1 from user_profile where id = auth.uid() and role = 'admin') then
    raise exception 'Accès réservé à l''administrateur';
  end if;
  return (select coalesce(sum(delta), 0)::integer from token_mouvement where user_id = p_user_id);
end;
$$;

-- 4. Écriture d'un mouvement. Seul point d'entrée : applique le verrou par utilisateur,
--    l'unicité de l'événement, le plafond de 15 et le plancher de 0.
--    Renvoie le delta réellement appliqué, ou null si l'événement a déjà été traité.
--    Réservée au serveur (webhook) et aux fonctions ci-dessous : pas de droit pour les élèves.
create or replace function token_appliquer(p_user_id uuid, p_delta integer, p_motif text, p_reference text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_solde integer;
  v_delta integer;
begin
  -- Les mouvements d'un même utilisateur passent l'un après l'autre
  perform pg_advisory_xact_lock(hashtext('token:' || p_user_id::text));

  if p_motif <> 'ajustement_admin'
     and exists (
       select 1 from token_mouvement
        where user_id = p_user_id and motif = p_motif and reference = p_reference
     ) then
    return null;
  end if;

  select coalesce(sum(delta), 0) into v_solde from token_mouvement where user_id = p_user_id;

  if p_delta > 0 then
    v_delta := greatest(least(p_delta, 15 - v_solde), 0);
  else
    v_delta := greatest(p_delta, -v_solde);
  end if;

  -- Un crédit tronqué à 0 est quand même enregistré : l'événement est marqué comme traité.
  insert into token_mouvement (user_id, delta, motif, reference)
  values (p_user_id, v_delta, p_motif, p_reference);

  return v_delta;
end;
$$;

-- 5. État de l'élève connecté : solde et nombre de QCM réussis pour la première fois.
create or replace function token_etat()
returns table (solde integer, qcm_reussis integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select coalesce(sum(delta), 0)::integer from token_mouvement where user_id = auth.uid()),
         (select count(*)::integer from qcm_premiere_reussite where user_id = auth.uid());
$$;

-- 6. Ajustement par un admin (delta positif ou négatif). Renvoie le nouveau solde.
create or replace function ajuster_tokens(p_user_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from user_profile where id = auth.uid() and role = 'admin') then
    raise exception 'Accès réservé à l''administrateur';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'Le nombre de jetons doit être différent de 0';
  end if;

  perform token_appliquer(p_user_id, p_delta, 'ajustement_admin', auth.uid()::text);
  return token_solde(p_user_id);
end;
$$;

-- 7. QCM : +1 jeton tous les 25 QCM réussis pour la première fois. Calculé en base, à
--    chaque changement de statut d'une question (écrit par qcm_valider_reponse).
create or replace function qcm_compter_reussite()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_total integer;
begin
  if new.statut not in ('reussie', 'corrige') then
    return new;
  end if;

  -- Une erreur ici ne doit pas empêcher l'élève de valider sa réponse.
  begin
    -- Verrou avant l'insertion : deux réponses simultanées du même élève sont comptées
    -- l'une après l'autre, sans sauter un palier.
    perform pg_advisory_xact_lock(hashtext('token:' || new.user_id::text));

    insert into qcm_premiere_reussite (user_id, question_id)
    values (new.user_id, new.question_id)
    on conflict do nothing;

    if found then
      select count(*) into v_total from qcm_premiere_reussite where user_id = new.user_id;
      if v_total % 25 = 0 then
        perform token_appliquer(new.user_id, 1, 'qcm', 'palier-' || v_total);
      end if;
    end if;
  exception when others then
    raise warning 'qcm_compter_reussite : %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists qcm_compter_reussite on qcm_progression_question;
create trigger qcm_compter_reussite
  after insert or update of statut on qcm_progression_question
  for each row execute function qcm_compter_reussite();

-- 8. Inscription à un live : 1 jeton, débité dans la même transaction que l'inscription.
--    Remplace la version de 20261012_live_sessions.sql (mêmes contrôles, plus le jeton).
create or replace function inscrire_live(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session live_session%rowtype;
  v_admin boolean;
  v_inscription_id uuid;
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

  -- Jeton : les admins n'en ont pas besoin
  v_admin := exists (select 1 from user_profile where id = auth.uid() and role = 'admin');
  if not v_admin then
    perform pg_advisory_xact_lock(hashtext('token:' || auth.uid()::text));
    if token_solde(auth.uid()) < 1 then
      raise exception 'Il te faut 1 jeton ADN pour t''inscrire. Réussis des QCM pour en gagner !';
    end if;
  end if;

  insert into live_inscription (session_id, user_id)
  values (p_session_id, auth.uid())
  returning id into v_inscription_id;

  if not v_admin then
    perform token_appliquer(auth.uid(), -1, 'inscription_live', p_session_id::text || ':' || v_inscription_id::text);
  end if;
end;
$$;

-- Rembourse le jeton d'une inscription, si elle en avait coûté un.
create or replace function token_rembourser_inscription(p_user_id uuid, p_session_id uuid, p_inscription_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_reference text := p_session_id::text || ':' || p_inscription_id::text;
begin
  if exists (
       select 1 from token_mouvement
        where user_id = p_user_id and motif = 'inscription_live' and reference = v_reference and delta < 0
     ) then
    perform token_appliquer(p_user_id, 1, 'remboursement_live', v_reference);
  end if;
end;
$$;

-- 9. Désinscription : possible jusqu'au début de la session, et le jeton est remboursé.
create or replace function desinscrire_live(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_inscription_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if exists (select 1 from live_session where id = p_session_id and debut <= now()) then
    raise exception 'Cette session a déjà commencé';
  end if;

  delete from live_inscription
   where session_id = p_session_id and user_id = auth.uid()
  returning id into v_inscription_id;

  if v_inscription_id is not null then
    perform token_rembourser_inscription(auth.uid(), p_session_id, v_inscription_id);
  end if;
end;
$$;

-- 10. Session supprimée par un admin avant son début : les inscrits sont remboursés.
create or replace function live_session_rembourser_inscrits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_inscription record;
begin
  if old.debut > now() then
    for v_inscription in select id, user_id from live_inscription where session_id = old.id loop
      perform token_rembourser_inscription(v_inscription.user_id, old.id, v_inscription.id);
    end loop;
  end if;
  return old;
end;
$$;

drop trigger if exists live_session_rembourser_inscrits on live_session;
create trigger live_session_rembourser_inscrits
  before delete on live_session
  for each row execute function live_session_rembourser_inscrits();

-- 11. Droits
revoke execute on function token_solde(uuid) from public, anon;
revoke execute on function token_appliquer(uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function token_etat() from public, anon;
revoke execute on function ajuster_tokens(uuid, integer) from public, anon;
revoke execute on function token_rembourser_inscription(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function qcm_compter_reussite() from public, anon, authenticated;
revoke execute on function live_session_rembourser_inscrits() from public, anon, authenticated;
revoke execute on function inscrire_live(uuid) from public, anon;
revoke execute on function desinscrire_live(uuid) from public, anon;

grant execute on function token_solde(uuid) to authenticated, service_role;
grant execute on function token_appliquer(uuid, integer, text, text) to service_role;
grant execute on function token_etat() to authenticated, service_role;
grant execute on function ajuster_tokens(uuid, integer) to authenticated, service_role;
grant execute on function inscrire_live(uuid) to authenticated, service_role;
grant execute on function desinscrire_live(uuid) to authenticated, service_role;

-- L'API (PostgREST) recharge sa liste de fonctions tout de suite
notify pgrst, 'reload schema';

-- 12. Optionnel — solde de départ. Sans cela, tout le monde commence à 0 et ne peut s'inscrire
--     à un live qu'après sa prochaine facture ou 25 QCM. Pour donner 12 jetons aux élèves
--     actuels (abonnés, essai, classe), décommenter puis exécuter une seule fois :
-- insert into token_mouvement (user_id, delta, motif, reference)
-- select id, 12, 'ajustement_admin', 'solde-de-depart'
--   from user_profile
--  where plan in ('abonne', 'essai', 'classe') and role <> 'admin';
