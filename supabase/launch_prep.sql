-- launch_prep.sql — run this in the Supabase SQL Editor before going live.
--
-- Creates / replaces the delete_my_account() RPC required by Apple Guideline
-- 5.1.1(v). The app calls it via supabase.rpc('delete_my_account').

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer          -- runs as the DB owner, can delete auth.users
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  -- Guard: must be called by a signed-in user.
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Delete app data. Order matters for FK constraints; adjust if your schema
  -- has different constraint directions.
  delete from messages        where sender_id    = uid or recipient_id = uid;
  delete from check_ins       where user_id      = uid;
  delete from presence        where user_id      = uid;
  delete from trips           where user_id      = uid;
  delete from emergency_contacts where user_id   = uid;
  delete from calendar_shares where owner_id     = uid or viewer_id   = uid;
  delete from events          where user_id      = uid;
  delete from reports         where user_id      = uid;
  -- Circle edges: rows where this user is either side of the relationship.
  delete from circle          where user_id      = uid or friend_id    = uid;
  delete from profiles        where id           = uid;

  -- Finally, remove the Supabase auth user. This invalidates all sessions.
  delete from auth.users where id = uid;
end;
$$;

-- Grant execute to authenticated users only.
revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
