import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@obs/design-system";
import {
  TwitchConnection,
  TwitchConnectionProvider,
  type ConnectionStatus,
  type CustomReward,
  type RewardsClient,
} from "@obs/twitch";
import { RewardsDialog } from "../RewardsDialog";
import { TwitchProvider } from "../../twitch/TwitchProvider";

/**
 * Mutable state shared between the test body and the mocked provider.
 * Tests populate this before calling `render()` so the mock reads the
 * right connection + stub rewards client.
 */
const testState: {
  connection: TwitchConnection;
  stubClient: RewardsClient | null;
} = {
  connection: buildConnection("idle", []),
  stubClient: null,
};

/**
 * Replace the builder's `TwitchProvider` with one that:
 *   - Uses `testState.connection` as the `useTwitchContext()` return.
 *   - Mounts the real `TwitchConnectionProvider` from `@obs/twitch`, with
 *     a `rewardsClientFactory` that returns the test's stub.
 *
 * This lets us exercise the real RewardsDialog + real useRewards hook
 * without patching either.
 */
vi.mock("../../twitch/TwitchProvider", () => {
  const TwitchContext = React.createContext<{ connection: TwitchConnection } | null>(null);

  const TwitchProvider = ({ children }: { children: React.ReactNode }) => {
    return (
      <TwitchContext.Provider value={{ connection: testState.connection }}>
        <TwitchConnectionProvider
          connection={testState.connection}
          rewardsClientFactory={() => testState.stubClient}
        >
          {children}
        </TwitchConnectionProvider>
      </TwitchContext.Provider>
    );
  };

  const useTwitchContext = () => {
    const ctx = React.useContext(TwitchContext);
    if (!ctx) throw new Error("mocked TwitchContext missing — wrap tests in <TwitchProvider>");
    return ctx;
  };

  return { TwitchProvider, useTwitchContext };
});

/**
 * Renders the dialog wrapped in the (mocked) TwitchProvider so the real
 * `useTwitchContext` + `useRewards` hooks resolve to our test state.
 */
function renderDialog(): ReturnType<typeof render> {
  return render(
    <TooltipProvider>
      <TwitchProvider>
        <RewardsDialog open onOpenChange={() => {}} />
      </TwitchProvider>
    </TooltipProvider>,
  );
}

function buildConnection(status: ConnectionStatus, scopes: string[]): TwitchConnection {
  const conn = new TwitchConnection();
  conn.status = status;
  conn.scopes = scopes;
  conn.token = status === "active" ? "tok" : null;
  conn.userId = status === "active" ? "123" : null;
  conn.userLogin = status === "active" ? "ninja" : null;
  conn.channelLogin = status === "active" ? "ninja" : null;
  conn.channelUserId = status === "active" ? "123" : null;
  return conn;
}

function reward(overrides: Partial<CustomReward> = {}): CustomReward {
  return {
    id: "rew-1",
    broadcasterId: "123",
    broadcasterLogin: "ninja",
    title: "Pick a song",
    cost: 500,
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
    ownedByApp: true,
    ...overrides,
  };
}

beforeEach(() => {
  testState.connection = buildConnection("idle", []);
  testState.stubClient = null;
});

afterEach(() => {
  cleanup();
});

describe("RewardsDialog", () => {
  it("shows the connect-to-Twitch prompt when the connection is idle", async () => {
    testState.connection = buildConnection("idle", []);
    renderDialog();
    expect(await screen.findByText(/connect to twitch to manage rewards/i)).toBeTruthy();
  });

  it("renders the loading state while rewards are being fetched", async () => {
    testState.connection = buildConnection("active", [
      "channel:read:redemptions",
      "channel:manage:redemptions",
    ]);
    let resolveList: (rewards: CustomReward[]) => void = () => {};
    testState.stubClient = {
      list: vi.fn(
        () =>
          new Promise<CustomReward[]>((resolve) => {
            resolveList = resolve;
          }),
      ),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    renderDialog();

    expect(await screen.findByText(/loading rewards/i)).toBeTruthy();
    await act(async () => {
      resolveList([]);
    });
  });

  it("lists rewards with their title and cost when populated", async () => {
    testState.connection = buildConnection("active", [
      "channel:read:redemptions",
      "channel:manage:redemptions",
    ]);
    testState.stubClient = {
      list: vi.fn(async () => [reward({ title: "Hydrate", cost: 250, id: "rew-a" })]),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    renderDialog();

    await waitFor(() => {
      expect(screen.getByText("Hydrate")).toBeTruthy();
    });
    expect(screen.getByText(/250 pts/i)).toBeTruthy();
  });

  it("Create button opens an empty form; Save triggers create() with the collected values", async () => {
    testState.connection = buildConnection("active", [
      "channel:read:redemptions",
      "channel:manage:redemptions",
    ]);
    const createSpy = vi.fn(async (body: { title: string; cost: number }) =>
      reward({ ...body, id: "rew-new" }),
    );
    testState.stubClient = {
      list: vi.fn(async () => []),
      create: createSpy as unknown as RewardsClient["create"],
      update: vi.fn(),
      remove: vi.fn(),
    };
    renderDialog();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create reward/i })).toBeTruthy();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create reward/i }));

    const titleInput = (await screen.findByPlaceholderText(/my reward/i)) as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, "New shiny");

    const saveBtn = screen.getByRole("button", { name: /^create$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
    const body = createSpy.mock.calls[0]![0];
    expect(body).toMatchObject({ title: "New shiny" });
    expect(body.cost).toBeGreaterThanOrEqual(1);
  });
});
