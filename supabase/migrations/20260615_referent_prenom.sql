-- Ajouter prenom (nullable) à la table referent
alter table referent add column if not exists prenom text;
