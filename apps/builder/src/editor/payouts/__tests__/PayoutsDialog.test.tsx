import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@obs/design-system";
import { TwitchConnection, TwitchConnectionProvider, type ConnectionStatus } from "@obs/twitch";
import type { ConnectStatus, StreamerPublic } from "@obs/supabase-client";
import type { UseStreamerResult } from "@obs/supabase-client/react";

/**
 * Shared mutable state between the test body and mocks. Tests populate
 * this before render() so the mock hooks read the right values.
 */
const state: {
  connection: TwitchConnection;
  streamer: UseStreamerResult;
  env: { url: string; anonKey: string } | null;
  bootstrapError: Error | null;
} = {
  connection: buildConnection("idle"),
  streamer: buildStreamerResult({
    status: { status: "not_connected" } satisfies ConnectStatus,
  }),
  env: { url: "https://test.supabase.co", anonKey: "anon" },
  bootstrapError: null,
};

vi.mock("@obs/supabase-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@obs/supabase-client")>();
  return {
    ...actual,
    readSupabasePublicConfig: () => state.env,
  };
});

vi.mock("@obs/supabase-client/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@obs/supabase-client/react")>();
  return {
    ...actual,
    useStreamer: () => state.streamer,
  };
});

// Replace the builder's Twitch provider with a test-controlled one. We
// still mount the real `TwitchConnectionProvider` so any inner package
// hooks that rely on it keep working.
vi.mock("../../twitch/TwitchProvider", () => {
  const Ctx = React.createContext<{ connection: TwitchConnection } | null>(null);
  const TwitchProvider = ({ children }: { children: React.ReactNode }) => (
    <Ctx.Provider value={{ connection: state.connection }}>
      <TwitchConnectionProvider connection={state.connection}>{children}</TwitchConnectionProvider>
    </Ctx.Provider>
  );
  const useTwitchContext = () => {
    const ctx = React.useContext(Ctx);
    if (!ctx) throw new Error("test TwitchContext missing");
    return ctx;
  };
  return { TwitchProvider, useTwitchContext };
});

vi.mock("../../tips/TipsProvider", () => {
  return {
    useBootstrapError: () => state.bootstrapError,
    TipsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import { PayoutsDialog } from "../PayoutsDialog";
import { TwitchProvider } from "../../twitch/TwitchProvider";

function buildConnection(status: ConnectionStatus): TwitchConnection {
  const conn = new TwitchConnection();
  conn.status = status;
  conn.token = status === "active" ? "tok" : null;
  conn.userId = status === "active" ? "u-1" : null;
  conn.userLogin = status === "active" ? "ninja" : null;
  conn.channelLogin = status === "active" ? "ninja" : null;
  conn.channelUserId = status === "active" ? "u-1" : null;
  return conn;
}

function buildStreamer(overrides: Partial<StreamerPublic> = {}): StreamerPublic {
  return {
    id: "streamer-1",
    twitchUserId: "u-1",
    twitchLogin: "ninja",
    displayName: "Ninja",
    slug: "ninja",
    stripeAccountId: null,
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
    ...overrides,
  };
}

function buildStreamerResult(
  over: Partial<UseStreamerResult> & { status?: ConnectStatus },
): UseStreamerResult {
  return {
    slug: over.slug ?? null,
    streamer: over.streamer ?? null,
    status: over.status ?? { status: "not_connected" },
    bootstrap: over.bootstrap ?? vi.fn(async () => undefined),
    connectStripeUrl: over.connectStripeUrl ?? vi.fn(async () => "https://stripe.example/link"),
    refresh: over.refresh ?? vi.fn(async () => undefined),
  };
}

function renderDialog() {
  return render(
    <TooltipProvider>
      <TwitchProvider>
        <PayoutsDialog open onOpenChange={() => {}} />
      </TwitchProvider>
    </TooltipProvider>,
  );
}

beforeEach(() => {
  state.connection = buildConnection("idle");
  state.streamer = buildStreamerResult({
    status: { status: "not_connected" } satisfies ConnectStatus,
  });
  state.env = { url: "https://test.supabase.co", anonKey: "anon" };
  state.bootstrapError = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PayoutsDialog", () => {
  it("shows the Twitch-required prompt when the connection is idle", () => {
    state.connection = buildConnection("idle");
    renderDialog();
    expect(screen.getByText(/connect to twitch first/i)).toBeTruthy();
  });

  it("shows the Connect Stripe CTA when status is not_connected", () => {
    state.connection = buildConnection("active");
    state.streamer = buildStreamerResult({
      status: { status: "not_connected" } satisfies ConnectStatus,
    });
    renderDialog();
    expect(screen.getByRole("button", { name: /connect stripe to accept tips/i })).toBeTruthy();
  });

  it("calls connectStripeUrl and redirects the window when Connect is clicked", async () => {
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { ...window.location, assign: assignMock } as unknown as Location,
    });
    const connectStripeUrl = vi.fn(async () => "https://stripe.example/onboarding-link");
    state.connection = buildConnection("active");
    state.streamer = buildStreamerResult({
      status: { status: "not_connected" } satisfies ConnectStatus,
      connectStripeUrl,
    });

    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: /connect stripe to accept tips/i }));

    await waitFor(() => {
      expect(connectStripeUrl).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith("https://stripe.example/onboarding-link");
    });
  });

  it("renders the tip URL and Copy button when status is active", () => {
    state.connection = buildConnection("active");
    state.streamer = buildStreamerResult({
      slug: "ninja",
      streamer: buildStreamer({ slug: "ninja", stripeChargesEnabled: true }),
      status: {
        status: "active",
        chargesEnabled: true,
        payoutsEnabled: true,
      } satisfies ConnectStatus,
    });
    renderDialog();
    const input = screen.getByRole("textbox", { name: /tip url/i }) as HTMLInputElement;
    expect(input.value).toMatch(/\/tip\/ninja$/);
    expect(screen.getByRole("button", { name: /copy tip url/i })).toBeTruthy();
  });

  it("Copy button writes the tip URL to navigator.clipboard", async () => {
    state.connection = buildConnection("active");
    state.streamer = buildStreamerResult({
      slug: "ninja",
      streamer: buildStreamer({ slug: "ninja", stripeChargesEnabled: true }),
      status: {
        status: "active",
        chargesEnabled: true,
        payoutsEnabled: true,
      } satisfies ConnectStatus,
    });
    const writeText = vi.fn(async () => undefined);
    // happy-dom ships a Clipboard stub with its own writeText; override on
    // the instance so our spy intercepts the call. `configurable: true` is
    // required because the original prop is non-configurable in some
    // happy-dom versions.
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      writable: true,
      value: writeText,
    });

    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: /copy tip url/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const calls = writeText.mock.calls as unknown as string[][];
    const arg = calls[0]?.[0];
    expect(arg).toMatch(/\/tip\/ninja$/);
  });

  it("renders the 'not configured' state when Supabase env is missing", () => {
    state.env = null;
    state.connection = buildConnection("active");
    renderDialog();
    expect(screen.getByText(/tips aren.?t configured/i)).toBeTruthy();
  });
});
