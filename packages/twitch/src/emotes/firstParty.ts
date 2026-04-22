/**
 * Build a first-party Twitch emote CDN URL. Mirrors the documented URL
 * template: `/v2/{id}/{format}/{theme}/{scale}` where format is static|animated,
 * theme is light|dark, and scale is 1.0|2.0|3.0.
 *
 * Defaults: static, dark, 2.0 — the sensible overlay default (2.0 reads
 * well against typical stream widths without being grotesque on small
 * browser sources).
 */
export function buildEmoteUrl(
  emoteId: string,
  opts: {
    format?: "static" | "animated";
    theme?: "light" | "dark";
    scale?: "1.0" | "2.0" | "3.0";
  } = {},
): string {
  const format = opts.format ?? "static";
  const theme = opts.theme ?? "dark";
  const scale = opts.scale ?? "2.0";
  return `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/${format}/${theme}/${scale}`;
}
