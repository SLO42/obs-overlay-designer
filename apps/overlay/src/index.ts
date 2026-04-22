/**
 * Public barrel for the overlay runtime. Consumed by the builder (Task 6)
 * to build preview URLs; the actual runtime entry is `main.tsx`.
 */
export { makePreviewUrl } from "./preview";
export type { MakePreviewUrlOptions } from "./preview";
export { resolveConfig, encodeBase64UrlJson, decodeBase64UrlJson } from "./boot";
export type { OverlayConfig } from "./boot";
export { overlayBus, fireEvent } from "./bus";
export type { HostMessage } from "./host";
