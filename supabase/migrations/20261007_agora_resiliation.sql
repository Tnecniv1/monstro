-- Agora : coupure pour les abonnements résiliés.
-- À exécuter une fois dans l'éditeur SQL Supabase (idempotent), AVANT de redéployer
-- la fonction abonnement-webhook.

-- Résiliation programmée : l'abonnement est encore « active » chez Stripe jusqu'à la fin
-- de la période payée, mais ne se renouvellera pas (cancel_at_period_end ou cancel_at).
-- Renseignée par la fonction abonnement-webhook.
alter table abonnement
  add column if not exists resiliation_programmee boolean not null default false;
