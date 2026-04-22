import type { HelixClient } from "../helix";
import type { CreateRewardBody, CustomReward, UpdateRewardBody } from "./types";

/**
 * Raw reward shape returned by Helix. Kept local to this module because
 * external consumers should only ever see the flattened `CustomReward`.
 */
interface HelixRewardRaw {
  id: string;
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  title: string;
  prompt: string;
  cost: number;
  image: { url_1x: string; url_2x: string; url_4x: string } | null;
  default_image: { url_1x: string; url_2x: string; url_4x: string } | null;
  background_color: string;
  is_enabled: boolean;
  is_user_input_required: boolean;
  max_per_stream_setting: {
    is_enabled: boolean;
    max_per_stream: number;
  };
  max_per_user_per_stream_setting: {
    is_enabled: boolean;
    max_per_user_per_stream: number;
  };
  global_cooldown_setting: {
    is_enabled: boolean;
    global_cooldown_seconds: number;
  };
  is_paused: boolean;
  is_in_stock: boolean;
  should_redemptions_skip_request_queue: boolean;
  redemptions_redeemed_current_stream: number | null;
  cooldown_expires_at: string | null;
}

/** `{ data: T[] }` — Helix's standard list envelope. */
interface DataEnvelope<T> {
  data: T[];
}

/**
 * Normalize the raw Helix reward payload into the flat camelCase shape the
 * UI consumes. `ownedByApp` starts as `false`; callers that know they
 * created the reward (i.e. `create()`) flip it on.
 */
function normalizeReward(raw: HelixRewardRaw, ownedByApp: boolean): CustomReward {
  const globalCooldownSeconds = raw.global_cooldown_setting?.is_enabled
    ? (raw.global_cooldown_setting.global_cooldown_seconds ?? 0)
    : null;
  const maxPerStream = raw.max_per_stream_setting?.is_enabled
    ? (raw.max_per_stream_setting.max_per_stream ?? 0)
    : null;
  const maxPerUserPerStream = raw.max_per_user_per_stream_setting?.is_enabled
    ? (raw.max_per_user_per_stream_setting.max_per_user_per_stream ?? 0)
    : null;
  return {
    id: raw.id,
    broadcasterId: raw.broadcaster_id,
    broadcasterLogin: raw.broadcaster_login,
    title: raw.title,
    cost: raw.cost,
    prompt: raw.prompt ?? "",
    isEnabled: raw.is_enabled,
    isPaused: raw.is_paused,
    isInStock: raw.is_in_stock,
    isUserInputRequired: raw.is_user_input_required,
    backgroundColor: raw.background_color ?? "",
    shouldRedemptionsSkipRequestQueue: raw.should_redemptions_skip_request_queue,
    globalCooldownSeconds,
    cooldownExpiresAt: raw.cooldown_expires_at ?? null,
    maxPerStream,
    maxPerUserPerStream,
    ownedByApp,
    imageUrlX1: raw.image?.url_1x,
    imageUrlX2: raw.image?.url_2x,
    imageUrlX4: raw.image?.url_4x,
    defaultImageUrlX1: raw.default_image?.url_1x,
    defaultImageUrlX2: raw.default_image?.url_2x,
    defaultImageUrlX4: raw.default_image?.url_4x,
  };
}

/**
 * Convert the camelCase create/update body into the snake_case shape Helix
 * expects. Undefined values are dropped so PATCH can be used partial.
 */
function bodyToHelix(body: CreateRewardBody | UpdateRewardBody): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("title" in body && body.title !== undefined) out.title = body.title;
  if ("cost" in body && body.cost !== undefined) out.cost = body.cost;
  if ("prompt" in body && body.prompt !== undefined) out.prompt = body.prompt;
  if ("isEnabled" in body && body.isEnabled !== undefined) out.is_enabled = body.isEnabled;
  if ("backgroundColor" in body && body.backgroundColor !== undefined) {
    out.background_color = body.backgroundColor;
  }
  if ("isUserInputRequired" in body && body.isUserInputRequired !== undefined) {
    out.is_user_input_required = body.isUserInputRequired;
  }
  if ("globalCooldownSeconds" in body && body.globalCooldownSeconds !== undefined) {
    const secs = body.globalCooldownSeconds;
    out.is_global_cooldown_enabled = secs > 0;
    out.global_cooldown_seconds = Math.max(0, Math.floor(secs));
  }
  if ("maxPerStream" in body && body.maxPerStream !== undefined) {
    const n = body.maxPerStream;
    out.is_max_per_stream_enabled = n > 0;
    out.max_per_stream = Math.max(0, Math.floor(n));
  }
  if ("maxPerUserPerStream" in body && body.maxPerUserPerStream !== undefined) {
    const n = body.maxPerUserPerStream;
    out.is_max_per_user_per_stream_enabled = n > 0;
    out.max_per_user_per_stream = Math.max(0, Math.floor(n));
  }
  if ("isPaused" in body && body.isPaused !== undefined) {
    out.is_paused = body.isPaused;
  }
  return out;
}

/**
 * Typed wrapper around the custom-rewards Helix surface for one broadcaster.
 *
 * ## ownedByApp caveat
 *
 * Twitch only allows a client_id to PATCH/DELETE rewards it created. The
 * REST response does NOT flag which rewards belong to which app, so:
 *
 *  - `list()` returns every reward with `ownedByApp: false`.
 *  - `create()` returns the new reward with `ownedByApp: true`.
 *
 * The UI surface attempts mutations optimistically and reports the 403
 * Helix returns for rewards owned elsewhere (see `RewardsDialog`).
 */
export interface RewardsClient {
  list(): Promise<CustomReward[]>;
  create(body: CreateRewardBody): Promise<CustomReward>;
  update(rewardId: string, body: UpdateRewardBody): Promise<CustomReward>;
  remove(rewardId: string): Promise<void>;
}

/**
 * Build a `RewardsClient` bound to a given broadcaster. The `clientId`
 * parameter is retained for symmetry with future app-ownership tracking
 * (e.g. a cache keyed by clientId so "ownedByApp" survives page reloads).
 * Today it's unused; we surface the 403 and move on.
 */
export function createRewardsClient(
  helix: HelixClient,
  broadcasterId: string,
  _clientId: string,
): RewardsClient {
  const path = "channel_points/custom_rewards";

  return {
    async list() {
      const response = await helix.get<DataEnvelope<HelixRewardRaw>>(path, {
        broadcaster_id: broadcasterId,
      });
      return response.data.map((raw) => normalizeReward(raw, false));
    },
    async create(body) {
      const query = new URLSearchParams({ broadcaster_id: broadcasterId });
      const response = await helix.post<DataEnvelope<HelixRewardRaw>>(
        `${path}?${query.toString()}`,
        bodyToHelix(body),
      );
      const raw = response.data[0];
      if (!raw) {
        throw new Error("Twitch returned an empty response from create reward.");
      }
      return normalizeReward(raw, true);
    },
    async update(rewardId, body) {
      const query = new URLSearchParams({ broadcaster_id: broadcasterId, id: rewardId });
      const response = await helix.patch<DataEnvelope<HelixRewardRaw>>(
        `${path}?${query.toString()}`,
        bodyToHelix(body),
      );
      const raw = response.data[0];
      if (!raw) {
        throw new Error("Twitch returned an empty response from update reward.");
      }
      // We know the app can mutate it — otherwise this request would have
      // 403'd. Flag it as app-owned so the UI keeps enabling edit/delete.
      return normalizeReward(raw, true);
    },
    async remove(rewardId) {
      const query = new URLSearchParams({ broadcaster_id: broadcasterId, id: rewardId });
      await helix.delete(`${path}?${query.toString()}`);
    },
  };
}
