-- Task 22: Streamers + donations schema.
--
-- Design notes:
--   - All INSERTs and UPDATEs happen via Edge Functions using the service
--     role key (which bypasses RLS). Anon clients only SELECT from
--     `streamers` (for the public tip-page resolver) and connect to the
--     `tips:<slug>` realtime broadcast channel. They never touch the
--     `donations` table directly.
--   - `stripe-webhook` is the sole writer of `donations` rows. It also
--     triggers the realtime broadcast via `realtime.send()` inside the
--     function; we don't attach a postgres trigger for broadcasting so
--     service-role inserts can still drive explicit payload shapes.
--   - The donation unique constraint on `stripe_payment_intent_id` is our
--     idempotency key for duplicate webhook deliveries.

-- `pgcrypto` is on by default on Supabase projects, but be explicit for
-- self-hosted deploys.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- streamers
-- ---------------------------------------------------------------------------
create table if not exists public.streamers (
  id uuid primary key default gen_random_uuid(),
  twitch_user_id text not null unique,
  twitch_login text not null,
  display_name text not null,
  slug text not null unique,
  stripe_account_id text,
  stripe_charges_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists streamers_slug_idx on public.streamers (slug);
create index if not exists streamers_stripe_account_idx
  on public.streamers (stripe_account_id)
  where stripe_account_id is not null;

-- Keep `updated_at` honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists streamers_touch_updated_at on public.streamers;
create trigger streamers_touch_updated_at
  before update on public.streamers
  for each row
  execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- donations
-- ---------------------------------------------------------------------------
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  streamer_id uuid not null references public.streamers(id) on delete cascade,
  stripe_payment_intent_id text not null unique,
  stripe_checkout_session_id text,
  amount_net integer not null,       -- streamer net, minor units
  amount_paid integer not null,      -- total viewer charged, minor units
  stripe_fee integer not null default 0,
  platform_fee integer not null default 1,
  currency text not null default 'usd',
  viewer_display_name text,
  message text,
  covered_fees boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists donations_streamer_created_idx
  on public.donations (streamer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.streamers enable row level security;
alter table public.donations enable row level security;

-- Streamers are public-readable — the tip page looks them up by slug. The
-- service role bypasses RLS for all writes, so anon never gets INSERT /
-- UPDATE / DELETE here.
drop policy if exists "streamers readable by all" on public.streamers;
create policy "streamers readable by all" on public.streamers
  for select
  using (true);

-- Donations are deliberately not exposed to anon. The overlay subscribes to
-- the per-streamer realtime broadcast channel (`tips:<slug>`) rather than
-- reading rows directly. The builder's history view (future Task) will go
-- through an Edge Function that verifies the caller's Twitch token before
-- returning rows.
--
-- We intentionally do NOT add a SELECT policy for anon; RLS with no policy
-- rejects by default.

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------
-- We rely on `realtime.send()` inside the `stripe-webhook` function rather
-- than CDC-style row-level replication — this keeps the donations table
-- private while still fanning out to the overlay.
-- No `alter publication supabase_realtime add table …` lines on purpose.

comment on table public.streamers is
  'One row per Twitch user that has signed in. Mutations happen via Edge Functions using the service role.';
comment on table public.donations is
  'One row per successful tip. Written by the stripe-webhook Edge Function; stripe_payment_intent_id is the idempotency key.';
