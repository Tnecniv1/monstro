-- NB : user_profile n'a pas de colonne email (elle vit dans auth.users) ;
-- on rejoint auth.users pour filtrer les fake users, comme get_fake_user_ids().
CREATE OR REPLACE FUNCTION get_sessions_uniques_par_jour(jours int DEFAULT 180)
RETURNS TABLE (jour date, nb_sessions_uniques bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT s.date AS jour, COUNT(DISTINCT e.user_id) AS nb_sessions_uniques
  FROM session s
  JOIN entrainement e ON e.id = s.entrainement_id
  JOIN auth.users au ON au.id = e.user_id
  WHERE s.date >= CURRENT_DATE - (jours || ' days')::interval
    AND au.email NOT LIKE 'fake_%@%.internal'
  GROUP BY s.date
  ORDER BY s.date;
$$;

GRANT EXECUTE ON FUNCTION get_sessions_uniques_par_jour(int) TO authenticated;
