import { describe, expect, it, vi } from "vitest";
import type { HelixClient } from "../../helix";
import { createRewardsClient } from "../client";

/**
 * Canonical shape of a Helix custom-reward payload. Keeping a single fixture
 * near the tests so each one asserts against the same "realistic" record
 * without duplicating field spellings.
 */
function rawReward(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "rew-1",
    broadcaster_id: "123",
    broadcaster_login: "ninja",
    broadcaster_name: "Ninja",
    title: "Change background",
    prompt: "Why?",
    cost: 500,
    image: { url_1x: "https://1x", url_2x: "https://2x", url_4x: "https://4x" },
    default_image: { url_1x: "https://d1x", url_2x: "https://d2x", url_4x: "https://d4x" },
    background_color: "#9147ff",
    is_enabled: true,
    is_user_input_required: false,
    max_per_stream_setting: { is_enabled: true, max_per_stream: 5 },
    max_per_user_per_stream_setting: { is_enabled: false, max_per_user_per_stream: 0 },
    global_cooldown_setting: { is_enabled: true, global_cooldown_seconds: 30 },
    is_paused: false,
    is_in_stock: true,
    should_redemptions_skip_request_queue: false,
    redemptions_redeemed_current_stream: 0,
    cooldown_expires_at: null,
    ...overrides,
  };
}

/**
 * Build a mock `HelixClient` whose methods are spies. Tests inspect the
 * spies to verify URLs / bodies + can stub responses per-test.
 */
function mockHelix(): HelixClient & {
  _calls: { get: unknown[][]; post: unknown[][]; patch: unknown[][]; delete: unknown[][] };
} {
  const calls = {
    get: [] as unknown[][],
    post: [] as unknown[][],
    patch: [] as unknown[][],
    delete: [] as unknown[][],
  };
  const client: HelixClient = {
    get: vi.fn(async (path, query) => {
      calls.get.push([path, query]);
      return { data: [rawReward()] } as never;
    }),
    post: vi.fn(async (path, body) => {
      calls.post.push([path, body]);
      return { data: [rawReward()] } as never;
    }),
    patch: vi.fn(async (path, body) => {
      calls.patch.push([path, body]);
      return { data: [rawReward()] } as never;
    }),
    delete: vi.fn(async (path) => {
      calls.delete.push([path]);
    }),
  };
  return Object.assign(client, { _calls: calls });
}

describe("createRewardsClient", () => {
  it("list() maps snake_case Helix fields to the flat camelCase reward shape", async () => {
    const helix = mockHelix();
    const client = createRewardsClient(helix, "123", "client-id");

    const rewards = await client.list();

    expect(rewards).toHaveLength(1);
    const [r] = rewards;
    expect(r).toMatchObject({
      id: "rew-1",
      broadcasterId: "123",
      broadcasterLogin: "ninja",
      title: "Change background",
      cost: 500,
      prompt: "Why?",
      isEnabled: true,
      isPaused: false,
      isInStock: true,
      isUserInputRequired: false,
      backgroundColor: "#9147ff",
      shouldRedemptionsSkipRequestQueue: false,
      globalCooldownSeconds: 30,
      maxPerStream: 5,
      maxPerUserPerStream: null,
      imageUrlX1: "https://1x",
      imageUrlX2: "https://2x",
      imageUrlX4: "https://4x",
      defaultImageUrlX1: "https://d1x",
    });
    // Passed broadcaster_id in query.
    expect(helix._calls.get[0]![1]).toEqual({ broadcaster_id: "123" });
  });

  it("list() flags every reward as ownedByApp=false until an explicit create()", async () => {
    const helix = mockHelix();
    const client = createRewardsClient(helix, "123", "client-id");
    const rewards = await client.list();
    for (const r of rewards) {
      expect(r.ownedByApp).toBe(false);
    }
  });

  it("create() converts camelCase body to Helix snake_case + toggles enabled flags", async () => {
    const helix = mockHelix();
    const client = createRewardsClient(helix, "123", "client-id");

    await client.create({
      title: "Test",
      cost: 100,
      prompt: "hi",
      isEnabled: true,
      backgroundColor: "#112233",
      isUserInputRequired: true,
      globalCooldownSeconds: 60,
      maxPerStream: 5,
      maxPerUserPerStream: 0,
    });

    const firstPost = helix._calls.post[0] as [string, Record<string, unknown>];
    const path = firstPost[0];
    const body = firstPost[1];
    // Path carries broadcaster_id.
    expect(path).toBe("channel_points/custom_rewards?broadcaster_id=123");
    // Snake_case keys.
    expect(body).toMatchObject({
      title: "Test",
      cost: 100,
      prompt: "hi",
      is_enabled: true,
      background_color: "#112233",
      is_user_input_required: true,
      is_global_cooldown_enabled: true,
      global_cooldown_seconds: 60,
      is_max_per_stream_enabled: true,
      max_per_stream: 5,
      // 0 disables the max-per-user cap.
      is_max_per_user_per_stream_enabled: false,
      max_per_user_per_stream: 0,
    });
  });

  it("create() sets ownedByApp=true on the returned reward", async () => {
    const helix = mockHelix();
    const client = createRewardsClient(helix, "123", "client-id");
    const created = await client.create({ title: "Test", cost: 100 });
    expect(created.ownedByApp).toBe(true);
  });

  it("update() hits the PATCH URL with broadcaster_id + id in the query string", async () => {
    const helix = mockHelix();
    const client = createRewardsClient(helix, "123", "client-id");
    await client.update("rew-1", { cost: 999, isPaused: true });
    const firstPatch = helix._calls.patch[0] as [string, Record<string, unknown>];
    const path = firstPatch[0];
    const body = firstPatch[1];
    expect(path).toBe("channel_points/custom_rewards?broadcaster_id=123&id=rew-1");
    expect(body).toMatchObject({ cost: 999, is_paused: true });
  });

  it("remove() delegates to helix.delete with the correct URL", async () => {
    const helix = mockHelix();
    const client = createRewardsClient(helix, "123", "client-id");
    await client.remove("rew-1");
    expect(helix._calls.delete[0]![0]).toBe(
      "channel_points/custom_rewards?broadcaster_id=123&id=rew-1",
    );
  });

  it("list() normalizes a disabled cooldown + disabled per-stream cap to null", async () => {
    const helix = mockHelix();
    (helix.get as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => ({
      data: [
        rawReward({
          global_cooldown_setting: { is_enabled: false, global_cooldown_seconds: 0 },
          max_per_stream_setting: { is_enabled: false, max_per_stream: 0 },
        }),
      ],
    }));
    const client = createRewardsClient(helix, "123", "client-id");
    const list = await client.list();
    const r = list[0]!;
    expect(r.globalCooldownSeconds).toBeNull();
    expect(r.maxPerStream).toBeNull();
  });
});
