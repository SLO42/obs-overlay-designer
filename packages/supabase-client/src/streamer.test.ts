import { describe, expect, it, vi } from "vitest";
import {
  callCreateCheckoutSession,
  callCreateConnectLink,
  callEnsureStreamer,
  callGetConnectStatus,
  type SupabaseFunctionsConfig,
} from "./streamer";

function makeFakeFetch(response: {
  ok: boolean;
  status?: number;
  body: unknown;
  statusText?: string;
}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fake = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      statusText: response.statusText ?? (response.ok ? "OK" : "Internal Error"),
      async json() {
        return response.body;
      },
      async text() {
        return JSON.stringify(response.body);
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fake, calls };
}

function baseCfg(fake: typeof fetch): SupabaseFunctionsConfig {
  return {
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon-test-key",
    fetchImpl: fake,
  };
}

describe("callEnsureStreamer", () => {
  it("POSTs to /functions/v1/ensure-streamer with the twitch token", async () => {
    const { fake, calls } = makeFakeFetch({
      ok: true,
      body: {
        streamer: {
          id: "s1",
          twitchUserId: "123",
          twitchLogin: "alice",
          displayName: "Alice",
          slug: "alice",
          stripeAccountId: null,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
        },
      },
    });
    const out = await callEnsureStreamer(baseCfg(fake), { twitchAccessToken: "tok" });
    expect(out.streamer.slug).toBe("alice");
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe("https://example.supabase.co/functions/v1/ensure-streamer");
    expect(call.init.method).toBe("POST");
    expect(call.init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer anon-test-key",
      apikey: "anon-test-key",
    });
    expect(JSON.parse(call.init.body as string)).toEqual({ twitchAccessToken: "tok" });
  });

  it("passes an explicit slug when provided", async () => {
    const { fake, calls } = makeFakeFetch({
      ok: true,
      body: {
        streamer: {
          id: "s1",
          twitchUserId: "123",
          twitchLogin: "alice",
          displayName: "Alice",
          slug: "alice-2",
          stripeAccountId: null,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
        },
      },
    });
    await callEnsureStreamer(baseCfg(fake), { twitchAccessToken: "tok", slug: "alice-2" });
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      twitchAccessToken: "tok",
      slug: "alice-2",
    });
  });

  it("throws with the response text when the gateway returns !ok", async () => {
    const { fake } = makeFakeFetch({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      body: { error: "bad token" },
    });
    await expect(callEnsureStreamer(baseCfg(fake), { twitchAccessToken: "bad" })).rejects.toThrow(
      /ensure-streamer failed: 401 Unauthorized/,
    );
  });
});

describe("callCreateConnectLink", () => {
  it("posts and returns the url", async () => {
    const { fake, calls } = makeFakeFetch({
      ok: true,
      body: { url: "https://connect.stripe.com/onboarding/xyz", accountId: "acct_123" },
    });
    const out = await callCreateConnectLink(baseCfg(fake), { twitchAccessToken: "tok" });
    expect(out.url).toContain("connect.stripe.com");
    expect(out.accountId).toBe("acct_123");
    expect(calls[0]!.url).toBe("https://example.supabase.co/functions/v1/create-connect-link");
  });
});

describe("callGetConnectStatus", () => {
  it("maps the response shape through", async () => {
    const { fake } = makeFakeFetch({
      ok: true,
      body: {
        status: "active",
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      },
    });
    const out = await callGetConnectStatus(baseCfg(fake), { twitchAccessToken: "tok" });
    expect(out.status).toBe("active");
    expect(out.chargesEnabled).toBe(true);
  });
});

describe("callCreateCheckoutSession", () => {
  it("posts the full tip body", async () => {
    const { fake, calls } = makeFakeFetch({
      ok: true,
      body: { url: "https://checkout.stripe.com/pay/cs_test_abc" },
    });
    const out = await callCreateCheckoutSession(baseCfg(fake), {
      slug: "alice",
      totalCents: 500,
      currency: "usd",
      viewerDisplayName: "Bob",
      message: "GL HF",
    });
    expect(out.url).toContain("checkout.stripe.com");
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body).toEqual({
      slug: "alice",
      totalCents: 500,
      currency: "usd",
      viewerDisplayName: "Bob",
      message: "GL HF",
    });
    expect(calls[0]!.url).toBe("https://example.supabase.co/functions/v1/create-checkout-session");
  });

  it("normalizes trailing slashes in the supabase url", async () => {
    const { fake, calls } = makeFakeFetch({ ok: true, body: { url: "x" } });
    await callCreateCheckoutSession(
      {
        supabaseUrl: "https://example.supabase.co///",
        anonKey: "anon",
        fetchImpl: fake,
      },
      { slug: "alice", totalCents: 100, currency: "usd" },
    );
    expect(calls[0]!.url).toBe("https://example.supabase.co/functions/v1/create-checkout-session");
  });
});
