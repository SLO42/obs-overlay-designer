import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  clearStoredToken,
  consumeRedirect,
  loadStoredToken,
  parseRedirectFragment,
  POPUP_MESSAGE_TYPE,
  storeToken,
} from "../implicitGrant";
import { DEFAULT_SCOPES } from "../scopes";

describe("buildAuthorizeUrl", () => {
  it("joins scopes with a space and includes all required params", () => {
    const url = buildAuthorizeUrl({
      clientId: "abc123",
      redirectUri: "https://example.com/cb",
      scopes: DEFAULT_SCOPES,
      state: "nonce42",
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://id.twitch.tv/oauth2/authorize");
    expect(u.searchParams.get("client_id")).toBe("abc123");
    expect(u.searchParams.get("redirect_uri")).toBe("https://example.com/cb");
    expect(u.searchParams.get("response_type")).toBe("token");
    expect(u.searchParams.get("scope")).toBe(DEFAULT_SCOPES.join(" "));
    expect(u.searchParams.get("state")).toBe("nonce42");
    expect(u.searchParams.get("force_verify")).toBe("false");
  });
});

describe("parseRedirectFragment", () => {
  it("returns null when no token present", () => {
    expect(parseRedirectFragment("")).toBeNull();
    expect(parseRedirectFragment("#foo=bar")).toBeNull();
  });

  it("parses access_token, scope (space-separated) and state", () => {
    const frag =
      "#access_token=tok_xyz&scope=user%3Aread%3Achat%20bits%3Aread&state=st-01&token_type=bearer&expires_in=14400";
    const parsed = parseRedirectFragment(frag);
    expect(parsed).not.toBeNull();
    expect(parsed!.token).toBe("tok_xyz");
    expect(parsed!.scopes).toEqual(["user:read:chat", "bits:read"]);
    expect(parsed!.state).toBe("st-01");
    expect(parsed!.expiresIn).toBe(14400);
  });
});

describe("consumeRedirect", () => {
  beforeEach(() => {
    // Reset hash between tests.
    window.location.hash = "";
  });

  it("returns null when there's no fragment token", () => {
    window.location.hash = "";
    expect(consumeRedirect()).toBeNull();
  });

  it("parses the hash, postMessages to opener, and returns the payload", () => {
    window.location.hash =
      "#access_token=tok_zz&scope=user%3Aread%3Achat&state=s-01&token_type=bearer&expires_in=100";

    const postMessage = vi.fn();
    const fakeOpener = {
      closed: false,
      postMessage,
      location: { origin: "http://localhost:3000" },
    };
    // Cast — we're faking a Window enough for consumeRedirect's needs.
    (window as unknown as { opener: unknown }).opener = fakeOpener;
    // Stub window.close so happy-dom doesn't throw.
    const closeSpy = vi.spyOn(window, "close").mockImplementation(() => {});

    const result = consumeRedirect();
    expect(result).not.toBeNull();
    expect(result!.token).toBe("tok_zz");
    expect(postMessage).toHaveBeenCalledTimes(1);
    const [payload, origin] = postMessage.mock.calls[0]!;
    expect((payload as { type: string }).type).toBe(POPUP_MESSAGE_TYPE);
    expect((payload as { token: string }).token).toBe("tok_zz");
    expect(origin).toBe("http://localhost:3000");
    expect(closeSpy).toHaveBeenCalled();

    // Cleanup
    (window as unknown as { opener: unknown }).opener = null;
    closeSpy.mockRestore();
  });
});

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and loads a valid token envelope", () => {
    const entry = {
      token: "tt",
      scopes: ["user:read:chat"] as const,
      expiresAt: Date.now() + 60_000,
      userId: "42",
      login: "tester",
    };
    storeToken({ ...entry, scopes: [...entry.scopes] });
    const loaded = loadStoredToken();
    expect(loaded).not.toBeNull();
    expect(loaded!.token).toBe("tt");
    expect(loaded!.login).toBe("tester");
  });

  it("refuses to store already-expired tokens", () => {
    storeToken({
      token: "tt",
      scopes: [],
      expiresAt: Date.now() - 1_000,
    });
    expect(loadStoredToken()).toBeNull();
  });

  it("evicts tokens that expired between store and load", () => {
    storeToken({
      token: "tt",
      scopes: [],
      expiresAt: Date.now() + 10,
    });
    // Fast-forward past expiry.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60_000);
    expect(loadStoredToken()).toBeNull();
    vi.useRealTimers();
  });

  it("clearStoredToken removes the envelope", () => {
    storeToken({
      token: "tt",
      scopes: [],
      expiresAt: Date.now() + 60_000,
    });
    clearStoredToken();
    expect(loadStoredToken()).toBeNull();
  });
});
