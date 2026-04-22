import type { DonationEvent } from "./donation";

export interface ChatFragment {
  type: "text" | "emote" | "mention" | "cheermote";
  text: string;
  emoteId?: string;
  /** 2x */
  emoteUrl?: string;
  /** only on cheermote */
  bits?: number;
}

export interface ChatMessage {
  kind: "chat.message";
  id: string;
  user: {
    id: string;
    login: string;
    displayName: string;
    color?: string;
    roles: Array<"viewer" | "subscriber" | "vip" | "mod" | "broadcaster">;
  };
  fragments: ChatFragment[];
  /** fragments.map(f => f.text).join("") */
  plain: string;
  receivedAt: number;
}

export interface CheerEvent {
  kind: "channel.cheer";
  id: string;
  /** anonymous cheers are null */
  user: { id: string; login: string; displayName: string } | null;
  bits: number;
  message: string;
  receivedAt: number;
}

export interface SubEvent {
  kind: "channel.subscribe" | "channel.subscription.gift";
  id: string;
  user: { id: string; login: string; displayName: string };
  tier: "1000" | "2000" | "3000";
  isGift: boolean;
  cumulativeMonths?: number;
  receivedAt: number;
}

export interface FollowEvent {
  kind: "channel.follow";
  id: string;
  user: { id: string; login: string; displayName: string };
  receivedAt: number;
}

export interface RaidEvent {
  kind: "channel.raid";
  id: string;
  from: { id: string; login: string; displayName: string };
  viewers: number;
  receivedAt: number;
}

export interface RedeemEvent {
  kind: "channel.channel_points_custom_reward_redemption.add";
  id: string;
  user: { id: string; login: string; displayName: string };
  rewardId: string;
  rewardTitle: string;
  userInput?: string;
  receivedAt: number;
}

export type StreamEvent =
  | ChatMessage
  | CheerEvent
  | SubEvent
  | FollowEvent
  | RaidEvent
  | RedeemEvent
  | DonationEvent;
