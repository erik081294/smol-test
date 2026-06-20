-- ============================================================================
-- HUISHOEK — 0018: Push-tokens (PLT-1, trap 2 — remote push)
-- ============================================================================
-- Expo push-tokens per gebruiker. Een gebruiker beheert alleen zijn eigen tokens
-- (RLS op profile_id = auth.uid()). Mede-leden lezen elkaars token NIET via RLS:
-- de Edge Function `notify` doet dat met de service-role (zie supabase/functions/notify).
-- ============================================================================

create table if not exists public.push_tokens (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  token       text not null,
  platform    text,
  updated_at  timestamptz not null default now(),
  primary key (profile_id, token)
);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_self on public.push_tokens;
create policy push_tokens_self on public.push_tokens for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
