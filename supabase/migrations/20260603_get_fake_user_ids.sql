-- Fonction utilitaire : retourne les user_profile.id des fake users
-- identifiés par leur email (fake_*@mathbank.internal dans auth.users).
-- Utilisée côté serveur pour construire le Set fakeUserIds dans page.tsx.
CREATE OR REPLACE FUNCTION get_fake_user_ids()
RETURNS TABLE (user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT up.id
  FROM user_profile up
  JOIN auth.users au ON au.id = up.id
  WHERE au.email LIKE 'fake_%@%.internal'
$$;

GRANT EXECUTE ON FUNCTION get_fake_user_ids() TO authenticated;
