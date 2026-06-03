-- Ajout de obj_global_pdf_url et telephone dans get_regularite_dashboard.
-- DROP obligatoire car le type de retour change.
-- À exécuter manuellement dans Supabase SQL Editor.

DROP FUNCTION IF EXISTS get_regularite_dashboard();

CREATE OR REPLACE FUNCTION get_regularite_dashboard()
RETURNS TABLE (
  user_id                  uuid,
  pseudo                   text,
  avatar_url               text,
  telephone                text,
  jour_semaine             int,
  indice                   numeric,
  feuille_id               uuid,
  feuille_titre            text,
  ref_exercice             int,
  note                     text,
  obj_global_feuille_id    uuid,
  obj_global_feuille_titre text,
  obj_global_ref_exercice  int,
  obj_global_note          text,
  obj_global_pdf_url       text,
  jours_actifs_total       int,
  is_fake                  boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH
  date_range AS (
    SELECT generate_series(
      (CURRENT_DATE - INTERVAL '89 days')::date,
      CURRENT_DATE,
      '1 day'::interval
    )::date AS d
  ),
  weekday_totals AS (
    SELECT
      ((EXTRACT(DOW FROM d)::int + 6) % 7)::int AS jour,
      COUNT(*)::int AS total
    FROM date_range
    GROUP BY jour
  ),
  user_active_days AS (
    SELECT DISTINCT
      user_id,
      date,
      ((EXTRACT(DOW FROM date)::int + 6) % 7)::int AS jour
    FROM session
    WHERE date BETWEEN CURRENT_DATE - INTERVAL '89 days' AND CURRENT_DATE
  ),
  user_weekday_counts AS (
    SELECT user_id, jour, COUNT(*)::int AS active_count
    FROM user_active_days
    GROUP BY user_id, jour
  ),
  jours_actifs_total AS (
    SELECT e.user_id, COUNT(DISTINCT s.date)::int AS nb
    FROM session s
    JOIN entrainement e ON e.id = s.entrainement_id
    WHERE s.date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY e.user_id
  ),
  user_jour AS (
    SELECT up.id AS user_id, j.jour_semaine
    FROM user_profile up
    CROSS JOIN (SELECT generate_series(0, 6)::int AS jour_semaine) j
  )
  SELECT
    uj.user_id,
    up.pseudo::text,
    up.avatar_url::text,
    up.telephone::text,
    uj.jour_semaine,
    ROUND(
      COALESCE(uwc.active_count, 0)::numeric / NULLIF(wt.total, 0),
      2
    ) AS indice,
    objr.feuille_id,
    fe.titre::text             AS feuille_titre,
    objr.ref_exercice,
    objr.note::text,
    objg.feuille_id            AS obj_global_feuille_id,
    fe2.titre::text            AS obj_global_feuille_titre,
    objg.ref_exercice          AS obj_global_ref_exercice,
    objg.note::text            AS obj_global_note,
    fe2.pdf_url::text          AS obj_global_pdf_url,
    COALESCE(jat.nb, 0)::int   AS jours_actifs_total,
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = uj.user_id
        AND au.email LIKE 'fake_%@%.internal'
    ) AS is_fake
  FROM user_jour uj
  JOIN  user_profile           up   ON up.id             = uj.user_id
  LEFT JOIN user_weekday_counts uwc ON uwc.user_id       = uj.user_id
                                    AND uwc.jour         = uj.jour_semaine
  LEFT JOIN weekday_totals      wt  ON wt.jour           = uj.jour_semaine
  LEFT JOIN objectif_regularite objr ON objr.user_id     = uj.user_id
                                    AND objr.jour_semaine = uj.jour_semaine
  LEFT JOIN feuille_entrainement fe  ON fe.id            = objr.feuille_id
  LEFT JOIN objectif_global     objg ON objg.user_id     = uj.user_id
  LEFT JOIN feuille_entrainement fe2 ON fe2.id           = objg.feuille_id
  LEFT JOIN jours_actifs_total   jat ON jat.user_id      = uj.user_id
  ORDER BY up.pseudo, uj.jour_semaine
$$;

GRANT EXECUTE ON FUNCTION get_regularite_dashboard() TO authenticated;
