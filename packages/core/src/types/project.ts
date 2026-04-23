import type { Widget } from "./widget";

export interface CanvasSize {
  width: number;
  height: number;
}

export interface ProjectMeta {
  id: string;
  name: string;
  /** epoch ms */
  createdAt: number;
  /** epoch ms */
  updatedAt: number;
  /** bump when schema changes */
  version: 1;
}

export interface TwitchConfig {
  clientId?: string;
  channelLogin?: string;
  /** stored in export; NOT written to IndexedDB in Task 3 */
  accessToken?: string;
  scopes?: string[];
}

/**
 * StreamTeam tip pipeline config (Task 22+). `slug` identifies the
 * streamer's tip page and the Supabase Realtime channel the overlay
 * subscribes to. Set by the builder after `ensure-streamer` returns a row.
 */
export interface StreamTeamConfig {
  slug?: string;
}

export interface Project {
  meta: ProjectMeta;
  /** default { width: 1920, height: 1080 } */
  canvas: CanvasSize;
  /** ordered bottom → top (index 0 is back, last is front) */
  widgets: Widget[];
  /** placeholder, populated in Task 8 (future) */
  twitch?: TwitchConfig;
  /** Task 22: StreamTeam tip pipeline wiring. Optional — missing means no tips. */
  streamteam?: StreamTeamConfig;
}
