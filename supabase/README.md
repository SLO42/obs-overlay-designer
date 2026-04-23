# Supabase backend (Task 22)

This folder holds the schema + Edge Functions that power the StreamTeam tip
pipeline. It is the only piece of the product that lives on Supabase — the
builder and overlay continue to run on Vercel and in the browser.

## Prerequisites

- Supabase account + a new empty project (note its `project-ref`).
- A Stripe account with Connect (Express) enabled.
- Node + pnpm already set up for the rest of the repo.
- Supabase CLI installed. Either of:

  ```
  npm i -g supabase
  # or run ad-hoc:
  pnpm dlx supabase --help
  ```

We do NOT vendor the CLI — see
<https://supabase.com/docs/guides/local-development> for install notes.

## One-time setup

1. `supabase login` — opens a browser to authenticate the CLI.
2. From the repo root:

   ```
   supabase link --project-ref <your-project-ref>
   ```

3. Push the schema:

   ```
   supabase db push
   ```

   This applies `supabase/migrations/20260422000000_initial.sql` to the cloud
   DB. Re-runs are idempotent (every DDL is `create … if not exists`).

4. (Optional) apply the dev seed for a couple of test rows:

   ```
   supabase db execute --file supabase/seed.sql
   ```

5. Deploy the Edge Functions:

   ```
   supabase functions deploy ensure-streamer
   supabase functions deploy create-connect-link
   supabase functions deploy get-connect-status
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook
   ```

   Or all at once with `supabase functions deploy`.

6. Set the function secrets:

   ```
   supabase secrets set \
     STRIPE_SECRET_KEY=sk_test_... \
     STRIPE_WEBHOOK_SECRET=whsec_... \
     APP_URL=https://<your-vercel-domain> \
     ALLOWED_ORIGINS=http://localhost:5173,https://<your-vercel-domain> \
     SUPABASE_URL=https://<ref>.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are pre-populated by the
   platform on every function invocation, but setting them explicitly makes
   local `supabase functions serve` work without extra flags.

7. In the Stripe dashboard:
   - Enable Connect → Express.
   - Configure the platform profile (name, statement descriptor, branding).
   - Create a webhook endpoint pointing at
     `https://<ref>.supabase.co/functions/v1/stripe-webhook`.
   - Subscribe it to `checkout.session.completed` and `account.updated`.
   - Copy the webhook's signing secret into `STRIPE_WEBHOOK_SECRET` from
     step 6.

8. In your Vercel project, add:

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

   These are safe to ship to the browser — they're the public keys.

## Local development

Run the stack locally with:

```
supabase start             # launches Postgres + auth + edge runtime
supabase functions serve   # hot-reloads the Edge Functions
```

For fee-math changes, there is a vitest twin in
`packages/supabase-client/src/fees.test.ts` you can run from the repo root
with `pnpm test`.

## File layout

```
supabase/
├── config.toml              minimum CLI config
├── migrations/              SQL migrations (idempotent)
├── seed.sql                 local-only seed data
└── functions/
    ├── _shared/             cors, stripe client, twitch validate, fees
    ├── ensure-streamer/     upsert the streamers row on Twitch login
    ├── create-connect-link/ issue a Stripe Express Account Link
    ├── get-connect-status/  cache + return Connect readiness
    ├── create-checkout-session/ public — starts a tip checkout
    └── stripe-webhook/      writes donations + broadcasts on tips:<slug>
```

## Decisions

- We do NOT use Supabase Auth. Streamers authenticate via Twitch OAuth
  Implicit Grant on the client; every Edge Function verifies the token via
  `id.twitch.tv/oauth2/validate`.
- The overlay never reads the `donations` table. It subscribes to a
  realtime broadcast channel (`tips:<slug>`) that the `stripe-webhook`
  function pushes to via `channel.send({ type: "broadcast", … })`.
- Idempotency is enforced at the DB layer via the UNIQUE constraint on
  `donations.stripe_payment_intent_id`. Duplicate webhook deliveries hit
  that constraint and are swallowed.
- Stripe API version is pinned in `functions/_shared/stripe.ts`. Bump
  deliberately.
