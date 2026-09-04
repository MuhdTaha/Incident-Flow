-- Auth must not create public.users rows. Org membership is created by
-- POST /orgs/register (new workspace) and POST /orgs/invite (join existing).
-- The old trigger dumped every signup into Default Org as ENGINEER.

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
