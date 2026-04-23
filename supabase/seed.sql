-- Seeds for local dev only. Safe to re-run (`on conflict do nothing`).
-- Production should NOT apply this file.

insert into public.streamers (twitch_user_id, twitch_login, display_name, slug)
values
  ('dev-001', 'saucyenchiladas', 'Saucy Enchiladas', 'saucy'),
  ('dev-002', 'psaucybot',       'PsaucyBot',        'psaucy')
on conflict (twitch_user_id) do nothing;
