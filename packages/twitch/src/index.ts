export { DEFAULT_SCOPES, type Scope } from "./auth/scopes";
export {
  buildAuthorizeUrl,
  clearStoredToken,
  consumeRedirect,
  loadStoredToken,
  openAuthPopup,
  parseRedirectFragment,
  POPUP_MESSAGE_TYPE,
  storeToken,
  type PopupResult,
  type RedirectResult,
  type StoredToken,
} from "./auth/implicitGrant";
export { validateToken, type TokenInfo, type ValidateResult } from "./auth/validate";
export { createHelixClient, getUserByLogin, HelixError, type HelixClient } from "./helix";
export {
  createEventSubClient,
  EventSubClient,
  type EventSubClientApi,
  type EventSubEvent,
  type EventSubStatus,
  type WebSocketFactory,
  type WebSocketLike,
} from "./eventsub/client";
export {
  buildSubscriptionRequest,
  createSubscriptions,
  type EventSubType,
} from "./eventsub/subscriptions";
export {
  parseEventSubMessage,
  sessionWelcomeSchema,
  sessionKeepaliveSchema,
  sessionReconnectSchema,
  notificationSchema,
  revocationSchema,
  type EventSubMessage,
  type NotificationMessage,
  type RevocationMessage,
  type SessionKeepaliveMessage,
  type SessionReconnectMessage,
  type SessionWelcomeMessage,
} from "./eventsub/messages";
export { normalizeNotification } from "./eventsub/normalize";
export { buildEmoteUrl } from "./emotes/firstParty";
export { bttv, ffz, sevenTv, type EmoteProvider, type ThirdPartyEmote } from "./emotes/thirdParty";
export { TwitchConnection, type ConnectionStatus } from "./connection";
export {
  useTwitchConnection,
  type UseTwitchConnectionOptions,
  type UseTwitchConnectionResult,
} from "./react/useTwitchConnection";
export {
  TwitchConnectionProvider,
  useTwitchConnectionContext,
  type TwitchConnectionContextValue,
  type TwitchConnectionProviderProps,
} from "./react/context";
export { useRewards, type UseRewardsOptions, type UseRewardsResult } from "./react/useRewards";
export { createRewardsClient, type RewardsClient } from "./rewards/client";
export type { CustomReward, CreateRewardBody, UpdateRewardBody } from "./rewards/types";
export {
  AUTHORIZE_URL,
  EVENTSUB_WS_URL,
  getClientId,
  getDefaultRedirectUri,
  HELIX_BASE_URL,
  VALIDATE_URL,
} from "./config";
