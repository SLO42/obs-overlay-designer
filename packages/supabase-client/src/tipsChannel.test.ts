import { describe, expect, it, vi } from "vitest";
import {
  isTipBroadcastPayload,
  subscribeTipsChannel,
  tipsChannelName,
  type TipBroadcastPayload,
} from "./tipsChannel";

/**
 * Fake supabase client: records the channel name, stashes the broadcast
 * listener, and exposes a `fire()` helper so tests can drive a broadcast
 * through the normal callback path. Mirrors the surface actually used in
 * `subscribeTipsChannel` — nothing more.
 */
function makeFakeClient() {
  let capturedListener: ((msg: unknown) => void) | null = null;
  let channelName: string | null = null;
  const removeChannel = vi.fn();
  const subscribe = vi.fn();
  const on = vi
    .fn()
    .mockImplementation((_type: string, _filter: unknown, cb: (msg: unknown) => void) => {
      capturedListener = cb;
      return { on, subscribe };
    });
  const channel = vi.fn().mockImplementation((name: string) => {
    channelName = name;
    return { on, subscribe };
  });
  return {
    client: { channel, removeChannel } as unknown as Parameters<typeof subscribeTipsChannel>[0],
    subscribe,
    removeChannel,
    on,
    fire(payload: unknown) {
      if (!capturedListener) throw new Error("no listener captured yet");
      capturedListener({ payload });
    },
    get channelName() {
      return channelName;
    },
  };
}

const samplePayload: TipBroadcastPayload = {
  id: "uuid-1",
  source: "streamteam-tip",
  user: { displayName: "Alice", login: null },
  amount: 300,
  currency: "USD",
  message: "GL HF",
  feeAmount: 41,
  coveredFees: true,
  receivedAt: 1_700_000_000_000,
};

describe("tipsChannelName", () => {
  it("formats as tips:<slug>", () => {
    expect(tipsChannelName("hello-world")).toBe("tips:hello-world");
  });
});

describe("subscribeTipsChannel", () => {
  it("subscribes to the per-slug broadcast channel and forwards payloads", () => {
    const fake = makeFakeClient();
    const listener = vi.fn();
    const cleanup = subscribeTipsChannel(fake.client, "test-slug", listener);
    expect(fake.channelName).toBe("tips:test-slug");
    expect(fake.on).toHaveBeenCalledWith("broadcast", { event: "donation" }, expect.any(Function));
    expect(fake.subscribe).toHaveBeenCalledOnce();

    fake.fire(samplePayload);
    expect(listener).toHaveBeenCalledWith(samplePayload);

    cleanup();
    expect(fake.removeChannel).toHaveBeenCalledOnce();
  });

  it("ignores malformed broadcast payloads", () => {
    const fake = makeFakeClient();
    const listener = vi.fn();
    subscribeTipsChannel(fake.client, "test-slug", listener);
    // Missing required fields.
    fake.fire({ foo: "bar" });
    // Wrong source.
    fake.fire({ ...samplePayload, source: "streamlabs" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("swallows listener exceptions so the channel stays healthy", () => {
    const fake = makeFakeClient();
    const err = new Error("kaboom");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      subscribeTipsChannel(fake.client, "test-slug", () => {
        throw err;
      });
      expect(() => fake.fire(samplePayload)).not.toThrow();
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("cleanup is idempotent", () => {
    const fake = makeFakeClient();
    const cleanup = subscribeTipsChannel(fake.client, "slug", () => {});
    cleanup();
    cleanup();
    expect(fake.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty slug", () => {
    const fake = makeFakeClient();
    expect(() => subscribeTipsChannel(fake.client, "", () => {})).toThrow();
  });
});

describe("isTipBroadcastPayload", () => {
  it("accepts a full valid payload", () => {
    expect(isTipBroadcastPayload(samplePayload)).toBe(true);
  });

  it("accepts user === null (anonymous)", () => {
    expect(isTipBroadcastPayload({ ...samplePayload, user: null })).toBe(true);
  });

  it("rejects bad types on optional fields", () => {
    expect(isTipBroadcastPayload({ ...samplePayload, message: 42 })).toBe(false);
    expect(isTipBroadcastPayload({ ...samplePayload, feeAmount: "lots" })).toBe(false);
    expect(isTipBroadcastPayload({ ...samplePayload, coveredFees: "yes" })).toBe(false);
  });

  it("rejects non-streamteam-tip sources", () => {
    expect(isTipBroadcastPayload({ ...samplePayload, source: "kofi" })).toBe(false);
  });

  it("rejects primitives and null", () => {
    expect(isTipBroadcastPayload(null)).toBe(false);
    expect(isTipBroadcastPayload("nope")).toBe(false);
    expect(isTipBroadcastPayload(42)).toBe(false);
  });
});
