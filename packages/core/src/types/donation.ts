export interface DonationEvent {
  kind: "donation";
  id: string;
  /**
   * Where the donation originated. The upcoming Supabase → Stripe pipeline
   * (Tasks 22/23) emits events with `source: "streamteam-tip"`; everything
   * else comes from integrations that already existed.
   */
  source: "twitch-cheer" | "streamteam-tip" | "streamlabs" | "streamelements" | "kofi";
  user: { displayName: string; login?: string } | null;
  /** in minor units (cents, or bits×1) — see `currency` */
  amount: number;
  /** "USD", "EUR", "BITS" (for cheers) */
  currency: string;
  message?: string;
  /**
   * Processing fees in minor units that were deducted from or added to the
   * payment. For `source: "streamteam-tip"`: the Stripe + platform fee the
   * viewer covered (when `coveredFees` is true) or that was deducted from
   * the streamer's net (when false). Absent for integrations that don't
   * surface fees.
   */
  feeAmount?: number;
  /**
   * Whether the viewer opted into covering fees. Only meaningful for
   * `source: "streamteam-tip"` — other sources should leave this
   * undefined.
   */
  coveredFees?: boolean;
  receivedAt: number;
}
