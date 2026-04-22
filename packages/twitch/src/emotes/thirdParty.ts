/**
 * Stub interfaces for third-party emote providers (7TV / BTTV / FFZ). The
 * actual fetchers are a Phase 3 concern; we export the shape so future
 * tasks can fill in the implementations without editing call sites.
 *
 * IMPORTANT: these stubs must not issue network requests. They throw so
 * callers know the feature isn't implemented — silent failure would mask
 * a real bug later.
 */
export interface ThirdPartyEmote {
  /** Provider-unique id. */
  id: string;
  /** Emote code typed in chat (e.g. "PogU"). */
  code: string;
  /** Fully-qualified image URL (CDN). */
  url: string;
  /** Whether the emote is animated. */
  animated: boolean;
}

export interface EmoteProvider {
  /** Fetch globally-available emotes. */
  fetchGlobal(): Promise<ThirdPartyEmote[]>;
  /** Fetch channel-scoped emotes for a specific login. */
  fetchChannel(login: string): Promise<ThirdPartyEmote[]>;
}

const notImplemented = (provider: string) => (): never => {
  throw new Error(`[twitch] ${provider} emote provider is not implemented yet (Phase 3).`);
};

export const sevenTv: EmoteProvider = {
  fetchGlobal: notImplemented("7TV"),
  fetchChannel: notImplemented("7TV"),
};

export const bttv: EmoteProvider = {
  fetchGlobal: notImplemented("BTTV"),
  fetchChannel: notImplemented("BTTV"),
};

export const ffz: EmoteProvider = {
  fetchGlobal: notImplemented("FFZ"),
  fetchChannel: notImplemented("FFZ"),
};
