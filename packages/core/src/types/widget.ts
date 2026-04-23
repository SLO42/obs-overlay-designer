export interface Transform {
  /** top-left x in canvas px */
  x: number;
  /** top-left y in canvas px */
  y: number;
  /** width in px */
  w: number;
  /** height in px */
  h: number;
  /** degrees, -180..180 */
  rotation: number;
  /** explicit z; derived from array order for rendering but preserved */
  zIndex: number;
  /** 0..1 of own box, default 0.5/0.5 */
  anchor?: { x: number; y: number };
}

export type WidgetKind =
  | "text"
  | "image"
  | "chat-feed"
  | "emote-wall"
  | "alert-box"
  | "channel-point-alert"
  | "event-ticker"
  | "custom-trigger"
  | "timer-goal"
  | "speak-alert";

export interface Widget<Props = Record<string, unknown>> {
  id: string;
  kind: WidgetKind;
  /** editor label, user-editable */
  name: string;
  transform: Transform;
  /** shape is defined by each widget's zod schema in packages/widgets */
  props: Props;
  /** attached custom triggers */
  triggers: Trigger[];
  /** stacked visual effects */
  effects: Effect[];
  hidden?: boolean;
  /** ignores canvas clicks when true */
  locked?: boolean;
}

export type TriggerMatcher =
  | {
      type: "chat.keyword";
      keyword: string;
      caseSensitive?: boolean;
      roles?: Array<"viewer" | "subscriber" | "vip" | "mod" | "broadcaster">;
    }
  | { type: "chat.command"; command: string }
  | { type: "channel.redeem"; rewardId: string }
  | { type: "channel.cheer"; minBits?: number }
  | { type: "donation"; minAmount?: number; currency?: string };

export interface Trigger {
  id: string;
  match: TriggerMatcher;
  /** effect ids to fire */
  effects: string[];
  enabled: boolean;
}

export type Effect =
  | { id: string; type: "shake"; amplitude: number; durationMs: number }
  | { id: string; type: "flash"; color: string; durationMs: number }
  | { id: string; type: "zoom-punch"; scale: number; durationMs: number }
  | { id: string; type: "confetti"; count: number; durationMs: number }
  | { id: string; type: "emote-rain"; durationMs: number };
