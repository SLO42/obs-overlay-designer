/**
 * Flattened representation of a Twitch custom channel-point reward.
 *
 * Helix returns a deeply nested snake_case shape (with separate
 * `global_cooldown_setting`, `max_per_stream_setting`, `image`, and
 * `default_image` sub-objects). `createRewardsClient` normalizes the
 * response into this flatter, camelCase shape — closer to how builder /
 * overlay code wants to read it, and close enough to the UI form fields
 * that translation in the form is trivial.
 */
export interface CustomReward {
  id: string;
  broadcasterId: string;
  broadcasterLogin: string;
  title: string;
  cost: number;
  prompt: string;
  isEnabled: boolean;
  isPaused: boolean;
  isInStock: boolean;
  isUserInputRequired: boolean;
  backgroundColor: string;
  shouldRedemptionsSkipRequestQueue: boolean;
  /**
   * Flattened from `global_cooldown_setting`. `null` when the cooldown is
   * disabled (Helix returns `is_enabled: false` with a zero seconds value).
   */
  globalCooldownSeconds: number | null;
  cooldownExpiresAt: string | null;
  /** Flattened from `max_per_stream_setting.max_per_stream`. `null` = unlimited. */
  maxPerStream: number | null;
  /** Flattened from `max_per_user_per_stream_setting.max_per_user_per_stream`. `null` = unlimited. */
  maxPerUserPerStream: number | null;
  /**
   * True only when the authenticated client's client_id created the reward;
   * only these can be PATCH/DELETE'd. Twitch does NOT return a direct boolean
   * for this — we infer by flagging rewards returned from our own `create()`
   * call as app-owned, and leaving everything coming from `list()` as false.
   * The UI layer attempts PATCH/DELETE optimistically for entries it wants
   * to mutate and surfaces the 403 that comes back for rewards owned by
   * other apps / the Twitch dashboard.
   */
  ownedByApp: boolean;
  imageUrlX1?: string;
  imageUrlX2?: string;
  imageUrlX4?: string;
  defaultImageUrlX1?: string;
  defaultImageUrlX2?: string;
  defaultImageUrlX4?: string;
}

/**
 * Body accepted by `POST /helix/channel_points/custom_rewards`. All fields
 * except `title` + `cost` are optional; we send only what's present.
 */
export interface CreateRewardBody {
  title: string;
  cost: number;
  prompt?: string;
  isEnabled?: boolean;
  /** `#rrggbb`. Helix rejects 8-char hex; keep it 6. */
  backgroundColor?: string;
  isUserInputRequired?: boolean;
  /** 0 disables the cooldown entirely. */
  globalCooldownSeconds?: number;
  /** 0 = unlimited. */
  maxPerStream?: number;
  /** 0 = unlimited. */
  maxPerUserPerStream?: number;
}

/** Body accepted by `PATCH /helix/channel_points/custom_rewards`. */
export type UpdateRewardBody = Partial<CreateRewardBody> & { isPaused?: boolean };
