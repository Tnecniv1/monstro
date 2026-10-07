-- Retour arrière de 20261007_livret_niveau_zero.sql, à partir du schéma « sauvegarde ».
-- À n'exécuter qu'en cas de besoin, en un seul bloc, dans l'éditeur SQL Supabase.
--   - recrée les 61 anciennes feuilles (mêmes id, même nœud) ;
--   - remet chaque entraînement sauvegardé sur sa feuille et son numéro d'origine ;
--   - remet les Focus sauvegardés sur leur feuille d'origine.
-- Limites : les entraînements créés sur le livret après la migration ne sont pas
-- touchés ; un entraînement ou un Focus supprimé depuis n'est pas recréé (sauf les
-- Focus supprimés par la migration elle-même) ; les nœuds des sous-thèmes doivent
-- encore exister. Les tables de sauvegarde sont conservées.

begin;

-- 0. Garde-fous
do $$
begin
  if to_regclass('sauvegarde.livret_zero_feuilles') is null
     or to_regclass('sauvegarde.livret_zero_entrainements') is null
     or to_regclass('sauvegarde.livret_zero_focus') is null then
    raise exception 'Tables de sauvegarde introuvables : rien à restaurer';
  end if;
  if exists (select 1 from sauvegarde.livret_zero_feuilles s join feuille_entrainement f on f.id = s.id) then
    raise exception 'Des anciennes feuilles existent déjà : restauration déjà faite ?';
  end if;
  if exists (select 1 from sauvegarde.livret_zero_feuilles s
              where not exists (select 1 from noeud n where n.id = s.noeud_id)) then
    raise exception 'Un nœud d''origine a été supprimé : le recréer avant de restaurer';
  end if;
end $$;

-- 1. Anciennes feuilles, à l'identique
insert into feuille_entrainement
select * from sauvegarde.livret_zero_feuilles;                                     -- attendu : INSERT 0 61

-- 2. Entraînements : feuille et numéro d'origine
update entrainement e
   set feuille_id = s.feuille_id, ref_exo = s.ref_exo
  from sauvegarde.livret_zero_entrainements s
 where e.id = s.id;                                                                -- attendu : UPDATE 512

-- 3. Focus : ceux déplacés vers le livret reviennent sur leur feuille d'origine…
update feuille_focus ff
   set feuille_id = s.feuille_id
  from sauvegarde.livret_zero_focus s
 where ff.id = s.id
   and ff.feuille_id = 'dcd68b23-8fde-4c66-9728-53060b61146c';                     -- attendu : UPDATE 3
-- … et ceux que la migration a supprimés en cascade (doublons par élève) sont recréés.
-- Un Focus que l'élève a lui-même retiré du livret depuis est donc recréé aussi.
insert into feuille_focus
select s.* from sauvegarde.livret_zero_focus s
 where not exists (select 1 from feuille_focus ff where ff.id = s.id)
on conflict do nothing;                                                            -- attendu : INSERT 0 0

-- 4. Contrôle : tout écart annule la transaction
do $$
begin
  if exists (select 1 from sauvegarde.livret_zero_entrainements s
              join entrainement e on e.id = s.id
             where e.feuille_id <> s.feuille_id or e.ref_exo <> s.ref_exo) then
    raise exception 'Des entraînements ne sont pas revenus à leur état d''origine';
  end if;
  if (select count(*) from feuille_entrainement f join sauvegarde.livret_zero_feuilles s on s.id = f.id)
     <> (select count(*) from sauvegarde.livret_zero_feuilles) then
    raise exception 'Toutes les feuilles n''ont pas été recréées';
  end if;
end $$;

commit;
