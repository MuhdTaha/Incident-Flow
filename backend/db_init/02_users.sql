-- 1. Create the Function
-- This function will run every time a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    -- Extract full_name from the metadata sent by the frontend, 
    -- or fallback to the email address if missing.
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'ENGINEER' -- Default Role
  )
  -- Safety: If we manually created this user before, update the link instead of crashing
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- 2. Create the Trigger
-- This tells Postgres: "Watch the auth.users table. When a row is inserted, run the function above."
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();