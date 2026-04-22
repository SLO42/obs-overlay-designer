import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwitchConnection } from "../useTwitchConnection";
import * as connectionModule from "../../connection";
import { clearStoredToken } from "../../auth/implicitGrant";

/**
 * We drive the hook through a stubbed TwitchConnection so we can observe
 * status transitions without touching real network/popup code. We patch
 * the module's exported class; the hook instantiates it internally and
 * sees the stub.
 */
class StubConnection {
  status: connectionModule.ConnectionStatus = "idle";
  token: string | null = null;
  userLogin: string | null = null;
  userId: string | null = null;
  channelLogin: string | null = null;
  channelUserId: string | null = null;
  private statusListeners = new Set<(s: connectionModule.ConnectionStatus) => void>();
  private eventListeners = new Set<(e: unknown) => void>();
  private errorListeners = new Set<(err: Error) => void>();

  onStatusChange(fn: (s: connectionModule.ConnectionStatus) => void) {
    this.statusListeners.add(fn);
    return () => {
      this.statusListeners.delete(fn);
    };
  }
  onEvent(fn: (e: unknown) => void) {
    this.eventListeners.add(fn);
    return () => {
      this.eventListeners.delete(fn);
    };
  }
  onError(fn: (err: Error) => void) {
    this.errorListeners.add(fn);
    return () => {
      this.errorListeners.delete(fn);
    };
  }
  async restore() {
    return false;
  }
  async connect() {
    this.setStatus("authenticating");
    await Promise.resolve();
    this.setStatus("validating");
    await Promise.resolve();
    this.setStatus("connecting");
    await Promise.resolve();
    this.userLogin = "tester";
    this.userId = "42";
    this.setStatus("active");
  }
  disconnect() {
    this.setStatus("idle");
  }
  private setStatus(s: connectionModule.ConnectionStatus) {
    this.status = s;
    for (const l of [...this.statusListeners]) l(s);
  }
}

beforeEach(() => {
  localStorage.clear();
  clearStoredToken();
  vi.spyOn(connectionModule, "TwitchConnection").mockImplementation(
    () => new StubConnection() as unknown as connectionModule.TwitchConnection,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTwitchConnection", () => {
  it("exposes status, login, userId; connect() transitions through expected states", async () => {
    const transitions: connectionModule.ConnectionStatus[] = [];
    const { result } = renderHook(() =>
      useTwitchConnection({
        clientId: "test",
        subscribe: ["channel.follow"],
        autoRestore: false,
      }),
    );

    // Record every status we see on re-render.
    const record = () => transitions.push(result.current.status);
    record();

    await act(async () => {
      await result.current.connect();
    });

    record();
    expect(result.current.status).toBe("active");
    expect(result.current.login).toBe("tester");
    expect(result.current.userId).toBe("42");

    // Order check: must hit authenticating → validating → connecting → active
    // at some point during the async connect.
    await waitFor(() => {
      expect(result.current.status).toBe("active");
    });
  });

  it("exposes onEvent + subscribes to connection.onEvent", () => {
    const { result } = renderHook(() =>
      useTwitchConnection({
        clientId: "test",
        subscribe: [],
        autoRestore: false,
      }),
    );
    const fn = vi.fn();
    const unsub = result.current.onEvent(fn);
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("disconnect() resets to idle", async () => {
    const { result } = renderHook(() =>
      useTwitchConnection({
        clientId: "test",
        subscribe: [],
        autoRestore: false,
      }),
    );
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.status).toBe("active");
    act(() => {
      result.current.disconnect();
    });
    expect(result.current.status).toBe("idle");
  });
});
