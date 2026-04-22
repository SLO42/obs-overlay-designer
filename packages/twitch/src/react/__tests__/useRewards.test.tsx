import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { ConnectionStatus, TwitchConnection } from "../../connection";
import type { CustomReward } from "../../rewards/types";
import type { RewardsClient } from "../../rewards/client";
import { TwitchConnectionProvider } from "../context";
import { useRewards } from "../useRewards";

/**
 * Minimal stand-in for TwitchConnection. Only exposes the fields the hook
 * touches so we can flip status / scopes without wiring up the full auth
 * pipeline.
 */
class StubConnection {
  status: ConnectionStatus;
  token: string | null;
  channelUserId: string | null;
  scopes: string[];
  private listeners = new Set<(s: ConnectionStatus) => void>();

  constructor(init: Partial<StubConnection> = {}) {
    this.status = init.status ?? "idle";
    this.token = init.token ?? null;
    this.channelUserId = init.channelUserId ?? null;
    this.scopes = init.scopes ?? [];
  }
  onStatusChange(fn: (s: ConnectionStatus) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  setStatus(s: ConnectionStatus) {
    this.status = s;
    for (const l of [...this.listeners]) l(s);
  }
}

function fakeReward(overrides: Partial<CustomReward> = {}): CustomReward {
  return {
    id: "rew-1",
    broadcasterId: "123",
    broadcasterLogin: "ninja",
    title: "Hydrate",
    cost: 100,
    prompt: "",
    isEnabled: true,
    isPaused: false,
    isInStock: true,
    isUserInputRequired: false,
    backgroundColor: "#9147ff",
    shouldRedemptionsSkipRequestQueue: false,
    globalCooldownSeconds: null,
    cooldownExpiresAt: null,
    maxPerStream: null,
    maxPerUserPerStream: null,
    ownedByApp: false,
    ...overrides,
  };
}

function makeWrapper(
  connection: StubConnection,
  rewardsClient: RewardsClient | null,
): (props: { children: ReactNode }) => JSX.Element {
  // eslint-disable-next-line react/display-name
  return ({ children }) => (
    <TwitchConnectionProvider
      connection={connection as unknown as TwitchConnection}
      clientId="test-client"
      rewardsClientFactory={() => rewardsClient}
    >
      {children}
    </TwitchConnectionProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useRewards", () => {
  it("is unavailable and returns null rewards when the connection is idle", async () => {
    const conn = new StubConnection({ status: "idle" });
    const { result } = renderHook(() => useRewards(), {
      wrapper: makeWrapper(conn, null),
    });
    expect(result.current.available).toBe(false);
    expect(result.current.rewards).toBeNull();
  });

  it("calls list() and populates rewards when the connection becomes active with read scope", async () => {
    const conn = new StubConnection({
      status: "idle",
      token: "tok",
      channelUserId: "123",
      scopes: ["channel:read:redemptions"],
    });
    const list = vi.fn(async (): Promise<CustomReward[]> => [fakeReward()]);
    const rc: RewardsClient = {
      list,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const { result } = renderHook(() => useRewards(), {
      wrapper: makeWrapper(conn, rc),
    });

    // Flip the connection to active to trigger the auto-load.
    act(() => {
      conn.setStatus("active");
    });

    await waitFor(() => {
      expect(result.current.rewards).not.toBeNull();
    });
    expect(list).toHaveBeenCalledTimes(1);
    expect(result.current.rewards).toHaveLength(1);
    expect(result.current.available).toBe(true);
    expect(result.current.canManage).toBe(false);
  });

  it("after create(), auto-reloads and exposes the new reward in rewards", async () => {
    const conn = new StubConnection({
      status: "active",
      token: "tok",
      channelUserId: "123",
      scopes: ["channel:read:redemptions", "channel:manage:redemptions"],
    });
    let listings = [fakeReward({ id: "rew-1", title: "existing" })];
    const rc: RewardsClient = {
      list: vi.fn(async () => listings),
      create: vi.fn(async (body) => {
        const created = fakeReward({ id: "rew-2", title: body.title, ownedByApp: true });
        listings = [...listings, created];
        return created;
      }),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const { result } = renderHook(() => useRewards(), {
      wrapper: makeWrapper(conn, rc),
    });

    await waitFor(() => {
      expect(result.current.rewards).toHaveLength(1);
    });

    await act(async () => {
      await result.current.create({ title: "New reward", cost: 500 });
    });

    await waitFor(() => {
      expect(result.current.rewards).toHaveLength(2);
    });
    expect(result.current.rewards?.[1]?.title).toBe("New reward");
    expect(rc.create).toHaveBeenCalledWith({ title: "New reward", cost: 500 });
    // Post-create reload: list() is called on activation + after create.
    expect((rc.list as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("create/update/remove throw a readable error when the manage scope is missing", async () => {
    const conn = new StubConnection({
      status: "active",
      token: "tok",
      channelUserId: "123",
      // Note: no manage scope.
      scopes: ["channel:read:redemptions"],
    });
    const rc: RewardsClient = {
      list: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const { result } = renderHook(() => useRewards(), {
      wrapper: makeWrapper(conn, rc),
    });

    // Wait for the initial load.
    await waitFor(() => {
      expect(result.current.available).toBe(true);
    });

    await expect(result.current.create({ title: "x", cost: 10 })).rejects.toThrow(
      /channel:manage:redemptions/,
    );
    await expect(result.current.update("rew-1", { title: "x" })).rejects.toThrow(
      /channel:manage:redemptions/,
    );
    await expect(result.current.remove("rew-1")).rejects.toThrow(/channel:manage:redemptions/);
    // Read remains fine.
    expect(rc.create).not.toHaveBeenCalled();
    expect(rc.update).not.toHaveBeenCalled();
    expect(rc.remove).not.toHaveBeenCalled();
  });
});
