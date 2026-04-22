export interface DonationEvent {
  kind: "donation";
  id: string;
  source: "twitch-cheer" | "streamlabs" | "streamelements" | "kofi";
  user: { displayName: string; login?: string } | null;
  /** in minor units (cents, or bits×1) — see `currency` */
  amount: number;
  /** "USD", "EUR", "BITS" (for cheers) */
  currency: string;
  message?: string;
  receivedAt: number;
}
