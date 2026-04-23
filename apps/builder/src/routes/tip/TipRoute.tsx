import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Button,
  Input,
  InspectorField,
  NumberField,
  Panel,
  Stack,
  Switch,
  TooltipProvider,
} from "@obs/design-system";
import {
  callCreateCheckoutSession,
  computeCoveredFees,
  computeSharedFees,
  createSupabaseClient,
  readSupabasePublicConfig,
  type SupabaseFunctionsConfig,
} from "@obs/supabase-client";
import styles from "./TipRoute.module.css";

/**
 * Shape of the streamer row the tip page needs. We only SELECT the columns
 * we render — RLS already allows anon reads on `public.streamers`.
 */
interface TipStreamer {
  slug: string;
  twitch_login: string;
  display_name: string;
  stripe_charges_enabled: boolean;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "ready"; streamer: TipStreamer };

const MIN_NET_CENTS = 100;
const MAX_NET_CENTS = 1_000_00;
const MAX_MESSAGE_LEN = 200;
const MAX_NAME_LEN = 40;

/** Format minor-unit integers as "$X.XX" for display. */
function formatUSD(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}$${whole}.${frac.toString().padStart(2, "0")}`;
}

/**
 * Public tip page. Mounted at `/tip/:slug`. No auth, no editor providers —
 * a viewer on the open internet should be able to load this without a
 * Twitch login. Env gating: if `VITE_SUPABASE_*` isn't set, we render a
 * "Tips aren't configured" message so local-dev builds (without creds)
 * stay functional.
 */
export function TipRoute() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status");

  const config = useMemo<SupabaseFunctionsConfig | null>(() => {
    const cfg = readSupabasePublicConfig();
    if (!cfg) return null;
    return { supabaseUrl: cfg.url, anonKey: cfg.anonKey };
  }, []);

  if (!config) {
    return <NotConfigured />;
  }

  if (!slug) {
    return (
      <div className={styles.page}>
        <Panel tone="raised" padding={5}>
          <Stack gap={2}>
            <h1 className={styles.title}>Streamer not found</h1>
            <p className={styles.subtitle}>This tip link is missing a streamer slug.</p>
          </Stack>
        </Panel>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <TipRouteInner
        slug={slug}
        config={config}
        statusParam={statusParam}
        clearStatus={() => {
          const next = new URLSearchParams(searchParams);
          next.delete("status");
          setSearchParams(next, { replace: true });
        }}
      />
    </TooltipProvider>
  );
}

interface TipRouteInnerProps {
  slug: string;
  config: SupabaseFunctionsConfig;
  statusParam: string | null;
  clearStatus: () => void;
}

function TipRouteInner({ slug, config, statusParam, clearStatus }: TipRouteInnerProps) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });

  // Fetch the streamer row from Supabase. RLS allows anon SELECTs on
  // `public.streamers`, so a plain client with the anon key is enough.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = createSupabaseClient(config.supabaseUrl, config.anonKey);
      const { data, error } = await client
        .from("streamers")
        .select("slug,twitch_login,display_name,stripe_charges_enabled")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoad({ kind: "not_found" });
        return;
      }
      setLoad({ kind: "ready", streamer: data as TipStreamer });
    })().catch((err) => {
      if (cancelled) return;
      console.warn("[tip] streamer lookup failed", err);
      setLoad({ kind: "not_found" });
    });
    return () => {
      cancelled = true;
    };
  }, [slug, config.supabaseUrl, config.anonKey]);

  if (load.kind === "loading") {
    return (
      <div className={styles.page}>
        <Panel tone="raised" padding={5}>
          <p className={styles.subtitle}>Loading…</p>
        </Panel>
      </div>
    );
  }

  if (load.kind === "not_found") {
    return (
      <div className={styles.page}>
        <Panel tone="raised" padding={5}>
          <Stack gap={2}>
            <h1 className={styles.title}>Streamer not found</h1>
            <p className={styles.subtitle}>
              We couldn&rsquo;t find a streamer with the slug <code>{slug}</code>.
            </p>
          </Stack>
        </Panel>
      </div>
    );
  }

  const { streamer } = load;

  if (!streamer.stripe_charges_enabled) {
    return (
      <div className={styles.page}>
        <Panel tone="raised" padding={5}>
          <Stack gap={2}>
            <h1 className={styles.title}>@{streamer.twitch_login}</h1>
            <p className={styles.subtitle}>
              This streamer isn&rsquo;t accepting tips yet. Check back soon.
            </p>
          </Stack>
        </Panel>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {statusParam === "success" ? (
          <SuccessBanner streamerLogin={streamer.twitch_login} onDismiss={clearStatus} />
        ) : null}
        {statusParam === "cancelled" ? <CancelBanner /> : null}
        {statusParam === "success" ? null : (
          <TipForm slug={streamer.slug} twitchLogin={streamer.twitch_login} config={config} />
        )}
      </div>
    </div>
  );
}

function SuccessBanner({
  streamerLogin,
  onDismiss,
}: {
  streamerLogin: string;
  onDismiss: () => void;
}) {
  return (
    <div className={styles.successBanner} role="status">
      <h2 className={styles.title} style={{ fontSize: 18 }}>
        Thanks for supporting @{streamerLogin}!
      </h2>
      <p className={styles.subtitle} style={{ color: "inherit" }}>
        Your tip is on the way.{" "}
        <button type="button" className={styles.linkButton} onClick={onDismiss}>
          Send another?
        </button>
      </p>
    </div>
  );
}

function CancelBanner() {
  return (
    <div className={styles.cancelBanner} role="status">
      No charge made.
    </div>
  );
}

interface TipFormProps {
  slug: string;
  twitchLogin: string;
  config: SupabaseFunctionsConfig;
}

function TipForm({ slug, twitchLogin, config }: TipFormProps) {
  // Track cents internally; the NumberField renders dollars.
  const [netCents, setNetCents] = useState<number>(300);
  const [coverFees, setCoverFees] = useState<boolean>(true);
  const [viewerDisplayName, setViewerDisplayName] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // All fee math is pure — compute on every render.
  const feePreview = useMemo(() => {
    if (coverFees) {
      // Viewer covers fees: they pay `total`, streamer nets `netCents`.
      try {
        const covered = computeCoveredFees(netCents);
        return {
          totalCents: covered.amountTotalCents,
          netCents,
          stripeFeeCents: covered.stripeFeeCents,
          platformFeeCents: covered.platformFeeCents,
        };
      } catch {
        return null;
      }
    }
    // Shared mode: viewer pays `netCents`, streamer receives whatever's left.
    const shared = computeSharedFees(netCents);
    return {
      totalCents: netCents,
      netCents: shared.amountNetCents,
      stripeFeeCents: shared.stripeFeeCents,
      platformFeeCents: shared.platformFeeCents,
    };
  }, [netCents, coverFees]);

  const trimmedName = viewerDisplayName.trim();
  const nameTooLong = trimmedName.length > MAX_NAME_LEN;
  const messageTooLong = message.length > MAX_MESSAGE_LEN;
  const amountTooLow = netCents < MIN_NET_CENTS;
  const amountTooHigh = netCents > MAX_NET_CENTS;
  const disabled =
    submitting || amountTooLow || amountTooHigh || nameTooLong || messageTooLong || !feePreview;

  const handleSubmit = async () => {
    if (disabled) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const response = await callCreateCheckoutSession(config, {
        slug,
        netCents,
        currency: "usd",
        coverFees,
        viewerDisplayName: trimmedName || undefined,
        message: message.trim() || undefined,
      });
      window.location.assign(response.url);
    } catch (err) {
      setSubmitError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <Panel tone="raised" padding={5}>
      <Stack gap={4}>
        <Stack gap={1}>
          <h1 className={styles.title}>Tip @{twitchLogin}</h1>
          <p className={styles.subtitle}>Send a tip directly. Powered by Stripe.</p>
        </Stack>

        <InspectorField
          label="Amount you'd like them to get"
          htmlFor="tip-amount"
          description={amountTooLow ? "Minimum tip is $1.00." : undefined}
        >
          <div className={styles.amountRow}>
            <span className={styles.currencyPrefix}>$</span>
            <NumberField
              id="tip-amount"
              value={netCents / 100}
              min={MIN_NET_CENTS / 100}
              max={MAX_NET_CENTS / 100}
              step={1}
              precision={2}
              onChange={(next) => {
                if (!Number.isFinite(next)) return;
                setNetCents(Math.round(next * 100));
              }}
              invalid={amountTooLow || amountTooHigh}
            />
          </div>
        </InspectorField>

        <div className={styles.toggleRow}>
          <Switch
            aria-label="Cover processing and platform fees"
            checked={coverFees}
            onChange={setCoverFees}
          />
          <div className={styles.toggleBody}>
            <label className={styles.toggleLabel}>
              Cover processing + platform fees so they get the full {formatUSD(netCents)}
            </label>
            {feePreview ? (
              <p className={styles.caption}>
                {coverFees
                  ? `${formatUSD(feePreview.stripeFeeCents)} Stripe processing · ${formatUSD(
                      feePreview.platformFeeCents,
                    )} platform`
                  : `${formatUSD(feePreview.stripeFeeCents)} Stripe + ${formatUSD(
                      feePreview.platformFeeCents,
                    )} platform deducted from streamer`}
              </p>
            ) : null}
          </div>
        </div>

        <InspectorField
          label="Your display name (optional)"
          htmlFor="tip-name"
          description={nameTooLong ? `Too long — max ${MAX_NAME_LEN} characters.` : undefined}
        >
          <Input
            id="tip-name"
            value={viewerDisplayName}
            onChange={(event) => setViewerDisplayName(event.target.value)}
            placeholder="Anonymous"
            maxLength={MAX_NAME_LEN + 10}
            invalid={nameTooLong}
          />
        </InspectorField>

        <InspectorField
          label={`Message (optional, ${MAX_MESSAGE_LEN} chars max)`}
          htmlFor="tip-message"
          description={
            messageTooLong
              ? `Too long — ${message.length}/${MAX_MESSAGE_LEN} characters.`
              : `${message.length}/${MAX_MESSAGE_LEN}`
          }
          error={
            messageTooLong
              ? `Message is ${message.length - MAX_MESSAGE_LEN} over limit.`
              : undefined
          }
        >
          <textarea
            id="tip-message"
            className={styles.textarea}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Say something nice"
            aria-invalid={messageTooLong || undefined}
          />
        </InspectorField>

        {feePreview ? (
          <p className={styles.totals} data-testid="tip-totals">
            You&apos;ll be charged {formatUSD(feePreview.totalCents)} · Streamer gets{" "}
            {formatUSD(feePreview.netCents)}
          </p>
        ) : null}

        {submitError ? (
          <p role="alert" className={styles.errorText}>
            {submitError}
          </p>
        ) : null}

        <Button variant="primary" disabled={disabled} onClick={() => void handleSubmit()}>
          {submitting ? "Redirecting to Stripe…" : "Pay with card"}
        </Button>
      </Stack>
    </Panel>
  );
}

function NotConfigured() {
  return (
    <div className={styles.page}>
      <Panel tone="raised" padding={5}>
        <Stack gap={3}>
          <h1 className={styles.title}>Tips aren&rsquo;t configured yet</h1>
          <p className={styles.subtitle}>
            This deployment of the builder is missing Supabase credentials. Tips require a live
            Supabase project and Stripe Connect account on the operator side.
          </p>
          <p className={styles.caption}>
            Operator: set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in
            your environment, then redeploy.
          </p>
        </Stack>
      </Panel>
    </div>
  );
}
