import type { Project } from "@obs/core";
import { encodeBase64UrlJson, type OverlayConfig } from "./boot";

export interface MakePreviewUrlOptions {
  /** Base path (e.g. the overlay dev server URL). Defaults to `/`. */
  base?: string;
  /** Optional additional config pieces to include alongside the project. */
  twitch?: OverlayConfig["twitch"];
  donationSources?: OverlayConfig["donationSources"];
}

/**
 * Builds a preview URL the builder's live-preview iframe can load. The
 * project (plus any extra config) is encoded as a base64url JSON blob on
 * the `?cfg=` param. Task 6 will wire this into the builder; exporting
 * here now so the builder can import it from `@obs/overlay/preview`.
 */
export function makePreviewUrl(project: Project, opts: MakePreviewUrlOptions = {}): string {
  const { base = "/", twitch, donationSources } = opts;
  const config: OverlayConfig = {
    project,
    ...(twitch ? { twitch } : {}),
    ...(donationSources !== undefined ? { donationSources } : {}),
  };
  const encoded = encodeBase64UrlJson(config);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}cfg=${encoded}`;
}
