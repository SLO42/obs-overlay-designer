import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  Icon,
  IconButton,
  Input,
  Panel,
  Stack,
  Tooltip,
} from "@obs/design-system";
import { readSupabasePublicConfig } from "@obs/supabase-client";
import { useStreamer } from "@obs/supabase-client/react";
import { useTwitchContext } from "../twitch/TwitchProvider";
import { useBootstrapError } from "../tips/TipsProvider";
import styles from "./PayoutsDialog.module.css";

interface PayoutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Builder-side panel for the "tips & payouts" flow. Accessed from the
 * Toolbar's Banknote IconButton. Shows the streamer's current Stripe
 * Connect status, offers the onboarding CTA, and — once charges are
 * enabled — surfaces the public tip URL with a one-click copy action.
 *
 * Refresh strategy: when the dialog opens we poll `useStreamer().refresh()`
 * every 3s for up to 60s, stopping as soon as status flips to "active".
 * This keeps the UI honest after the streamer returns from the Stripe
 * Connect onboarding flow without a hard-wired webhook subscription.
 */
export function PayoutsDialog({ open, onOpenChange }: PayoutsDialogProps) {
  const { connection } = useTwitchContext();
  const twitchConnected = connection.status === "active";
  // `TipsProvider` (the builder-side wrapper) only mounts the Supabase
  // context when `VITE_SUPABASE_*` is set. Call `useStreamer()` blind would
  // throw in that case — check the config here so we can render the
  // "not configured" branch cleanly. Memoized so the check only happens
  // once per mount.
  const supabaseConfigured = useMemo(() => readSupabasePublicConfig() !== null, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} width={520}>
      <Dialog.Title>Tips &amp; payouts</Dialog.Title>
      <Dialog.Description>
        Accept tips on a public page. We use Stripe Connect so every donation lands in your bank
        account.
      </Dialog.Description>
      <Dialog.Body>
        {!supabaseConfigured ? (
          <NotConfiguredState />
        ) : twitchConnected ? (
          <PayoutsBody open={open} />
        ) : (
          <TwitchRequired />
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}

function NotConfiguredState() {
  return (
    <Panel tone="nested" padding={5}>
      <Stack gap={3} align="center">
        <Icon name="TriangleAlert" size={28} />
        <p className={styles.body} style={{ textAlign: "center" }}>
          Tips aren&rsquo;t configured on this deployment. Ask the operator to set{" "}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
      </Stack>
    </Panel>
  );
}

function TwitchRequired() {
  return (
    <Panel tone="nested" padding={5}>
      <Stack gap={3} align="center">
        <Icon name="Radio" size={28} />
        <p className={styles.body} style={{ textAlign: "center" }}>
          Connect to Twitch first. We&rsquo;ll use your channel to set up your tip page.
        </p>
      </Stack>
    </Panel>
  );
}

function PayoutsBody({ open }: { open: boolean }) {
  const { slug, status, connectStripeUrl, refresh } = useStreamer();
  const bootstrapError = useBootstrapError();
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [ctaWorking, setCtaWorking] = useState(false);

  // Poll for status updates while the dialog is open. Stops when status
  // goes "active" or after 60s, whichever comes first. Total cost is
  // bounded and the Edge Function is cheap — roughly 20 invocations at
  // most per dialog-open cycle.
  useEffect(() => {
    if (!open) return;
    if (status.status === "active") return;
    // Kick off an immediate refresh so the dialog reflects reality as soon
    // as it opens (the outer provider already refreshed on mount but the
    // streamer may have completed Stripe onboarding in a different tab).
    void refresh().catch(() => {});
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (Date.now() - start > 60_000) {
        window.clearInterval(interval);
        return;
      }
      void refresh().catch(() => {});
    }, 3000);
    return () => window.clearInterval(interval);
  }, [open, status.status, refresh]);

  const onConnect = useCallback(async () => {
    setCtaError(null);
    setCtaWorking(true);
    try {
      const url = await connectStripeUrl();
      // Append a marker so we can reopen the dialog when the streamer
      // returns. Stripe preserves query params on the return URL (the Edge
      // Function sets that when creating the account link).
      window.location.assign(url);
    } catch (err) {
      setCtaError((err as Error).message);
      setCtaWorking(false);
    }
  }, [connectStripeUrl]);

  if (status.status === "active") {
    return <ActiveState slug={slug} />;
  }

  if (status.status === "pending") {
    return (
      <Panel tone="nested" padding={5}>
        <Stack gap={3}>
          <Stack direction="row" gap={2} align="center">
            <Icon name="Clock" size={18} />
            <h2 style={{ margin: 0, fontSize: 16 }}>Stripe needs a little more info</h2>
          </Stack>
          <p className={styles.body}>
            Your Stripe account is set up but verification is incomplete. Finish onboarding so
            viewers can tip you.
          </p>
          {ctaError ? <p className={styles.errorText}>{ctaError}</p> : null}
          <Button variant="primary" onClick={() => void onConnect()} disabled={ctaWorking}>
            {ctaWorking ? "Opening Stripe…" : "Resume onboarding"}
          </Button>
        </Stack>
      </Panel>
    );
  }

  return (
    <Panel tone="nested" padding={5}>
      <Stack gap={3}>
        <Stack direction="row" gap={2} align="center">
          <Icon name="Banknote" size={18} />
          <h2 style={{ margin: 0, fontSize: 16 }}>Accept tips on your channel</h2>
        </Stack>
        <p className={styles.body}>
          Viewers will see a simple tip page on your channel. Stripe handles card processing and
          payouts — funds land directly in your Stripe Express account.
        </p>
        <p className={styles.caption}>
          Viewers pay exactly what they type. Stripe (2.9% + $0.30) and a $0.01 platform fee come
          out of the tip — a $3.00 tip nets you $2.59.
        </p>
        {bootstrapError ? (
          <p role="alert" className={styles.errorText}>
            Couldn&rsquo;t register your streamer profile: {bootstrapError.message}
          </p>
        ) : null}
        {ctaError ? <p className={styles.errorText}>{ctaError}</p> : null}
        <Button variant="primary" onClick={() => void onConnect()} disabled={ctaWorking}>
          {ctaWorking ? "Opening Stripe…" : "Connect Stripe to accept tips"}
        </Button>
      </Stack>
    </Panel>
  );
}

function ActiveState({ slug }: { slug: string | null }) {
  const { status } = useStreamer();
  const tipUrl =
    slug && typeof window !== "undefined" ? `${window.location.origin}/tip/${slug}` : "";

  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onCopy = useCallback(async () => {
    if (!tipUrl) return;
    try {
      await navigator.clipboard?.writeText(tipUrl);
    } catch {
      // Fallback: select the Input text so the user can hit Ctrl/Cmd+C. This
      // covers insecure contexts (Clipboard API refuses to run over HTTP).
      const input = inputRef.current;
      if (input) {
        input.focus();
        input.select();
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [tipUrl]);

  return (
    <Panel tone="nested" padding={5}>
      <Stack gap={3}>
        <Stack direction="row" gap={2} align="center">
          <Icon name="CircleCheck" size={18} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You&rsquo;re set up to accept tips</h2>
        </Stack>

        <Stack gap={1}>
          <span className={styles.caption}>Your public tip URL</span>
          <div className={styles.tipUrlRow}>
            <Input ref={inputRef} readOnly value={tipUrl} aria-label="Tip URL" />
            <Tooltip content="Copy tip URL">
              <IconButton aria-label="Copy tip URL" onClick={() => void onCopy()}>
                <Icon name="Copy" />
              </IconButton>
            </Tooltip>
            {copied ? (
              <Icon name="Check" aria-label="Copied" />
            ) : (
              <span aria-hidden="true" style={{ width: 16 }} />
            )}
          </div>
        </Stack>

        <div className={styles.statusRow}>
          {status.chargesEnabled ? (
            <Badge variant="ok">Charges enabled</Badge>
          ) : (
            <Badge variant="warn">Charges disabled</Badge>
          )}
          {status.payoutsEnabled ? (
            <Badge variant="ok">Payouts enabled</Badge>
          ) : (
            <Badge variant="warn">Payouts disabled</Badge>
          )}
        </div>

        <div className={styles.linkList}>
          <a
            className={styles.link}
            href="https://dashboard.stripe.com/"
            target="_blank"
            rel="noreferrer"
          >
            Open Stripe dashboard &rarr;
          </a>
        </div>

        <p className={styles.caption}>
          Viewers pay exactly what they type. Stripe (2.9% + $0.30) and a $0.01 platform fee come
          out of the tip — a $3.00 tip nets you $2.59.
        </p>
      </Stack>
    </Panel>
  );
}
