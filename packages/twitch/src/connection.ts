import type { StreamEvent } from "@obs/core";
import {
  clearStoredToken,
  loadStoredToken,
  openAuthPopup,
  storeToken,
  type StoredToken,
} from "./auth/implicitGrant";
import { DEFAULT_SCOPES, type Scope } from "./auth/scopes";
import { validateToken, type TokenInfo } from "./auth/validate";
import { getClientId } from "./config";
import { createHelixClient, getUserByLogin } from "./helix";
import {
  createEventSubClient,
  type EventSubClientApi,
  type EventSubStatus,
  type WebSocketFactory,
} from "./eventsub/client";
import type { EventSubType } from "./eventsub/subscriptions";

export type ConnectionStatus =
  | "idle"
  | "authenticating"
  | "validating"
  | "connecting"
  | "active"
  | "reconnecting"
  | "error";

export interface TwitchConnectionOptions {
  clientId?: string;
  redirectUri?: string;
  /** Injection hooks for tests — do not use in app code. */
  fetchImpl?: typeof fetch;
  wsFactory?: WebSocketFactory;
}

export interface ConnectOptions {
  channelLogin?: string;
  subscribe: EventSubType[];
  scopes?: Scope[];
}

/**
 * One-stop façade over auth + EventSub + validation. The builder and
 * overlay share this; keeping a single class lets listeners attach once
 * and have the right state through reconnects.
 */
export class TwitchConnection {
  status: ConnectionStatus = "idle";
  token: string | null = null;
  /**
   * Scopes granted by Twitch on the current token. Sourced from the
   * validate-token response (Twitch returns the effective set, which may
   * differ from the `scope=` URL param if the user deselected any). Used
   * by helpers like `useRewards` that must gate UI on specific scopes.
   */
  scopes: string[] = [];
  userLogin: string | null = null;
  userId: string | null = null;
  channelLogin: string | null = null;
  channelUserId: string | null = null;

  /** Periodic validation interval id. */
  private validateInterval: ReturnType<typeof setInterval> | null = null;
  /** Abort controller for the current in-flight validate. */
  private validateAbort: AbortController | null = null;
  private eventsub: EventSubClientApi | null = null;
  /** Unsubscribes to run on disconnect. */
  private cleanups: Array<() => void> = [];

  private readonly statusListeners = new Set<(s: ConnectionStatus) => void>();
  private readonly eventListeners = new Set<(e: StreamEvent) => void>();
  private readonly errorListeners = new Set<(err: Error) => void>();

  constructor(private readonly opts: TwitchConnectionOptions = {}) {}

  /**
   * Seed the connection with a pre-stamped token (for the exported
   * overlay, where the builder already obtained the token). The next
   * connect() call will validate it and skip the popup flow entirely if
   * it's still good. Returns `false` when the token can't be validated
   * (caller should fall back to the popup flow).
   */
  async seedToken(token: string): Promise<boolean> {
    this.setStatus("validating");
    try {
      const info = await this.runValidate(token);
      if (!info.valid) {
        this.setStatus("idle");
        return false;
      }
      this.token = token;
      this.userId = info.userId;
      this.userLogin = info.login;
      this.scopes = info.scopes;
      this.setStatus("idle");
      return true;
    } catch (err) {
      this.emitError(err as Error);
      this.setStatus("error");
      return false;
    }
  }

  private setStatus(next: ConnectionStatus) {
    if (this.status === next) return;
    this.status = next;
    for (const l of [...this.statusListeners]) l(next);
  }

  onStatusChange(fn: (s: ConnectionStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn) as unknown as void;
  }

  onEvent(fn: (e: StreamEvent) => void): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn) as unknown as void;
  }

  onError(fn: (err: Error) => void): () => void {
    this.errorListeners.add(fn);
    return () => this.errorListeners.delete(fn) as unknown as void;
  }

  private emitError(err: Error) {
    for (const l of [...this.errorListeners]) l(err);
  }

  /**
   * Try to resume from a stored token. Returns true if the stored token
   * is still valid (and hydrates userId/login), false otherwise.
   * Clears the stored token if it's rejected.
   */
  async restore(): Promise<boolean> {
    const stored = loadStoredToken();
    if (!stored) return false;

    this.setStatus("validating");
    try {
      const info = await this.runValidate(stored.token);
      if (!info.valid) {
        clearStoredToken();
        this.setStatus("idle");
        return false;
      }
      this.token = stored.token;
      this.userId = info.userId;
      this.userLogin = info.login;
      this.scopes = info.scopes;
      // Refresh the stored envelope so `expiresAt` reflects the latest
      // value (Twitch can lengthen it behind the scenes).
      const refreshed: StoredToken = {
        token: stored.token,
        scopes: stored.scopes,
        expiresAt: Date.now() + info.expiresIn * 1000,
        userId: info.userId,
        login: info.login,
      };
      storeToken(refreshed);
      this.setStatus("idle");
      return true;
    } catch (err) {
      this.emitError(err as Error);
      this.setStatus("error");
      return false;
    }
  }

  /**
   * Open the OAuth popup. Resolves with the new token info and stores it.
   * Throws if the user cancels or the token is rejected.
   */
  private async authenticate(scopes: Scope[]): Promise<string> {
    this.setStatus("authenticating");
    const popup = await openAuthPopup({
      clientId: this.opts.clientId,
      redirectUri: this.opts.redirectUri,
      scopes,
    });
    this.setStatus("validating");
    const info = await this.runValidate(popup.token);
    if (!info.valid) {
      throw new Error("Twitch rejected the new token during validation.");
    }
    this.token = popup.token;
    this.userId = info.userId;
    this.userLogin = info.login;
    this.scopes = info.scopes;
    storeToken({
      token: popup.token,
      scopes: (popup.scopes as Scope[]) ?? scopes,
      expiresAt: Date.now() + (popup.expiresIn || info.expiresIn) * 1000,
      userId: info.userId,
      login: info.login,
    });
    return popup.token;
  }

  /**
   * Validate a token, cancelling any in-flight validation first. Throws
   * on network/unexpected errors; returns the plain result otherwise.
   */
  private async runValidate(token: string): Promise<{ valid: false } | TokenInfo> {
    if (this.validateAbort) this.validateAbort.abort();
    const ctrl = new AbortController();
    this.validateAbort = ctrl;
    try {
      return await validateToken(token, {
        signal: ctrl.signal,
        fetchImpl: this.opts.fetchImpl,
      });
    } finally {
      if (this.validateAbort === ctrl) this.validateAbort = null;
    }
  }

  /**
   * Start the periodic re-validation loop. 60-minute cadence — Twitch's
   * validate endpoint is cheap, but more frequent polls buy us nothing
   * over a long-lived OBS session.
   */
  private startValidateLoop() {
    this.stopValidateLoop();
    this.validateInterval = setInterval(
      () => {
        if (!this.token) return;
        this.runValidate(this.token)
          .then((res) => {
            if (!res.valid) {
              this.emitError(new Error("Twitch token expired — disconnecting."));
              this.disconnect();
              this.setStatus("error");
            }
          })
          .catch((err) => this.emitError(err as Error));
      },
      60 * 60 * 1000,
    );
  }

  private stopValidateLoop() {
    if (this.validateInterval) {
      clearInterval(this.validateInterval);
      this.validateInterval = null;
    }
  }

  async connect(options: ConnectOptions): Promise<void> {
    const scopes = options.scopes ?? DEFAULT_SCOPES;

    // 1) Token — from storage or popup.
    if (!this.token) {
      const restored = await this.restore();
      if (!restored) {
        await this.authenticate(scopes);
      }
    }
    if (!this.token || !this.userId || !this.userLogin) {
      throw new Error("Twitch token unavailable after auth.");
    }

    // 2) Resolve channel user id.
    const clientId = getClientId(this.opts.clientId);
    const helix = createHelixClient({
      clientId,
      token: this.token,
      fetchImpl: this.opts.fetchImpl,
    });

    const channelLogin = (options.channelLogin ?? this.userLogin).toLowerCase();
    if (channelLogin === this.userLogin.toLowerCase()) {
      this.channelLogin = this.userLogin;
      this.channelUserId = this.userId;
    } else {
      const channelUser = await getUserByLogin(helix, channelLogin);
      if (!channelUser) {
        throw new Error(`Channel not found: ${channelLogin}`);
      }
      this.channelLogin = channelUser.login;
      this.channelUserId = channelUser.id;
    }

    // 3) EventSub.
    this.setStatus("connecting");
    const eventsub = createEventSubClient({
      helix,
      channelUserId: this.channelUserId,
      selfUserId: this.userId,
      subscribe: options.subscribe,
      wsFactory: this.opts.wsFactory,
    });
    this.eventsub = eventsub;

    const offStatus = eventsub.onStatusChange((s) => {
      this.setStatus(mapEventSubStatus(s));
    });
    const offEvent = eventsub.onEvent((e) => {
      for (const l of [...this.eventListeners]) l(e);
    });
    const offError = eventsub.onError((err) => this.emitError(err));
    this.cleanups.push(offStatus, offEvent, offError);

    await eventsub.connect();
    this.startValidateLoop();
  }

  disconnect(): void {
    this.stopValidateLoop();
    if (this.validateAbort) {
      this.validateAbort.abort();
      this.validateAbort = null;
    }
    for (const c of this.cleanups) {
      try {
        c();
      } catch {
        // ignore
      }
    }
    this.cleanups = [];
    if (this.eventsub) {
      this.eventsub.disconnect();
      this.eventsub = null;
    }
    this.setStatus("idle");
  }
}

function mapEventSubStatus(s: EventSubStatus): ConnectionStatus {
  switch (s) {
    case "idle":
      return "idle";
    case "connecting":
    case "welcomed":
    case "subscribing":
      return "connecting";
    case "active":
      return "active";
    case "reconnecting":
      return "reconnecting";
    case "failed":
      return "error";
    case "disconnected":
      return "idle";
    default:
      return "idle";
  }
}
