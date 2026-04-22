import { z } from "zod";

/**
 * Zod schemas for the subset of EventSub WebSocket message types we care
 * about. Twitch's full schema is larger; we pick only what we need so
 * forward compatibility (new subscription types) doesn't tank parsing.
 *
 * See: https://dev.twitch.tv/docs/eventsub/websocket-reference/
 */

const metadataBase = z.object({
  message_id: z.string(),
  message_timestamp: z.string(),
  subscription_type: z.string().optional(),
  subscription_version: z.string().optional(),
});

export const sessionWelcomeSchema = z.object({
  metadata: metadataBase.extend({
    message_type: z.literal("session_welcome"),
  }),
  payload: z.object({
    session: z.object({
      id: z.string(),
      status: z.string(),
      keepalive_timeout_seconds: z.number().nullable(),
      reconnect_url: z.string().nullable().optional(),
      connected_at: z.string(),
    }),
  }),
});

export const sessionKeepaliveSchema = z.object({
  metadata: metadataBase.extend({
    message_type: z.literal("session_keepalive"),
  }),
  payload: z.object({}).passthrough(),
});

export const sessionReconnectSchema = z.object({
  metadata: metadataBase.extend({
    message_type: z.literal("session_reconnect"),
  }),
  payload: z.object({
    session: z.object({
      id: z.string(),
      status: z.string(),
      keepalive_timeout_seconds: z.number().nullable(),
      reconnect_url: z.string(),
      connected_at: z.string(),
    }),
  }),
});

/**
 * Notification envelope — `event` is typed as `unknown` here; callers pass
 * it through `normalizeNotification()` which does shape-specific parsing
 * based on the subscription type. Keeping `event` loose avoids having to
 * enumerate every possible event payload in the schema (Twitch adds new
 * ones faster than we can keep up).
 */
export const notificationSchema = z.object({
  metadata: metadataBase.extend({
    message_type: z.literal("notification"),
    subscription_type: z.string(),
    subscription_version: z.string(),
  }),
  payload: z.object({
    subscription: z.object({
      id: z.string(),
      type: z.string(),
      version: z.string(),
      status: z.string(),
      created_at: z.string(),
    }),
    event: z.unknown(),
  }),
});

export const revocationSchema = z.object({
  metadata: metadataBase.extend({
    message_type: z.literal("revocation"),
    subscription_type: z.string(),
    subscription_version: z.string(),
  }),
  payload: z.object({
    subscription: z.object({
      id: z.string(),
      status: z.string(),
      type: z.string(),
      version: z.string(),
    }),
  }),
});

export type SessionWelcomeMessage = z.infer<typeof sessionWelcomeSchema>;
export type SessionKeepaliveMessage = z.infer<typeof sessionKeepaliveSchema>;
export type SessionReconnectMessage = z.infer<typeof sessionReconnectSchema>;
export type NotificationMessage = z.infer<typeof notificationSchema>;
export type RevocationMessage = z.infer<typeof revocationSchema>;

export type EventSubMessage =
  | SessionWelcomeMessage
  | SessionKeepaliveMessage
  | SessionReconnectMessage
  | NotificationMessage
  | RevocationMessage;

/**
 * Safely parse an incoming WebSocket frame. Returns `null` for messages
 * whose `message_type` we don't handle today (future-compat). Throws on
 * malformed JSON or schema mismatches for types we do handle.
 */
export function parseEventSubMessage(raw: string): EventSubMessage | null {
  const json = JSON.parse(raw) as { metadata?: { message_type?: string } };
  const type = json?.metadata?.message_type;
  switch (type) {
    case "session_welcome":
      return sessionWelcomeSchema.parse(json);
    case "session_keepalive":
      return sessionKeepaliveSchema.parse(json);
    case "session_reconnect":
      return sessionReconnectSchema.parse(json);
    case "notification":
      return notificationSchema.parse(json);
    case "revocation":
      return revocationSchema.parse(json);
    default:
      return null;
  }
}
