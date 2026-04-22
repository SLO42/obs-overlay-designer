/**
 * Known Twitch OAuth scope identifiers we use for overlays. Kept as a
 * string-literal union rather than an enum so callers can pass raw strings
 * from config without enum imports, and so Twitch's canonical scope names
 * round-trip untouched.
 *
 * Expand this list as new EventSub subscription types are added. It's
 * deliberately small: the overlay app stays read-only.
 */
export type Scope =
  | "user:read:chat"
  | "user:write:chat"
  | "channel:read:redemptions"
  | "channel:read:subscriptions"
  | "bits:read"
  | "moderator:read:followers"
  | "channel:manage:redemptions";

/**
 * Default scope set requested by the Connect button in the builder. Covers
 * the EventSub subscription types we auto-create plus the Helix rewards
 * CRUD surface exposed by the builder's Rewards dialog. Callers can narrow
 * this by passing an explicit `scopes` to `openAuthPopup`.
 *
 * Notes:
 *  - `channel:manage:redemptions` is required to PATCH/DELETE custom rewards
 *    the app created. It's wider than `channel:read:redemptions` (which only
 *    covers read + redemption notifications), so we request both explicitly
 *    so degraded clients that only grant the read scope still function for
 *    EventSub even if the rewards dialog is gated.
 */
export const DEFAULT_SCOPES: Scope[] = [
  "user:read:chat",
  "channel:read:redemptions",
  "channel:manage:redemptions",
  "bits:read",
  "moderator:read:followers",
  "channel:read:subscriptions",
];
