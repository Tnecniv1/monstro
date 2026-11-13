-- Exercices transcrits en texte (énoncé flottant : seulement l'exercice en cours).
-- À exécuter une fois dans l'éditeur SQL Supabase ; ce fichier sert ensuite de
-- documentation. Pas idempotent (create table / create policy).
--
-- Une feuille n'utilise ses exercices en texte que si exercices_publies est
-- vrai ; sinon (et pour un exercice absent de la table) le panneau garde le PDF.

-- 1. Feuille : exercices en texte publiés ou non
alter table public.feuille_entrainement
  add column exercices_publies boolean not null default false;

-- 2. Exercices : un par feuille + numéro (numero = entrainement.ref_exo)
create table public.exercice (
  id          uuid primary key default gen_random_uuid(),
  feuille_id  uuid not null references public.feuille_entrainement(id) on delete cascade,
  numero      int  not null check (numero >= 1),
  enonce      text not null,                 -- Markdown + formules $…$ / $$…$$ (KaTeX)
  correction  text,                          -- null : l'onglet Correction garde le PDF
  images      text[] not null default '{}',  -- chemins dans le bucket exercices
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (feuille_id, numero)
);

alter table public.exercice enable row level security;

-- Lecture réservée aux élèves qui ont accès au contenu (a_acces_contenu(),
-- même règle que les PDF) ; aucune écriture via l'API (imports faits dans
-- l'éditeur SQL).
create policy "exercice lecture plan valide" on public.exercice
  for select to authenticated using (a_acces_contenu());

-- 3. Bucket privé des figures : <feuille_id>/<numero>/<nom>.png, lu par URL signée
insert into storage.buckets (id, name, public)
values ('exercices', 'exercices', false);

create policy "exercices lecture plan valide" on storage.objects
  for select to authenticated using (bucket_id = 'exercices' and a_acces_contenu());

notify pgrst, 'reload schema';
