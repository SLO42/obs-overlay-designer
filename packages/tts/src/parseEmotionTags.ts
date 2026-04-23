import type { Segment } from "./types";

/**
 * Grammar (stable, explicit):
 *  - `(name)` sets the current emotion for all following text.
 *  - `(*name)` behaves the same as `(name)` — the leading `*` matches a
 *    convention used by some chat overlays.
 *  - Name must match `[a-zA-Z][a-zA-Z0-9_-]{0,31}`.
 *  - An unmatched `(` (no closing `)` within 32 chars, or invalid name)
 *    is emitted as literal text — we never eat user input on a parse
 *    failure.
 *  - `\(` and `\)` are literal `(` / `)` (escape).
 *  - Unknown emotion names pass through — the consumer decides whether
 *    to resolve them to a fallback.
 *  - Empty segments (two tags with nothing between, or a tag at EOS)
 *    are collapsed out of the result.
 *
 * Round-trip invariant for a message with only `"normal"` segments:
 *   segments.map(s => s.text).join("") === message-with-tags-stripped
 *
 * Ranges are offsets into the ORIGINAL message (so event consumers
 * can highlight the source span, tags included in the span gap).
 */

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/;
/** Maximum scan distance for a `)` after `(`. Keeps an unclosed paren cheap. */
const MAX_TAG_LEN = 34; // `(` + 32-char name + optional `*` + `)`

export interface ParseEmotionTagsOptions {
  /** Fallback emotion before any tag is encountered. Defaults to `"normal"`. */
  defaultEmotion?: string;
}

/**
 * Parse a message with inline emotion tags into a list of text segments.
 *
 * The implementation is a single left-to-right scan. We accumulate
 * literal characters into a buffer and flush a `Segment` whenever the
 * emotion changes (on a successful tag match) or we reach EOS.
 */
export function parseEmotionTags(message: string, opts: ParseEmotionTagsOptions = {}): Segment[] {
  const defaultEmotion = opts.defaultEmotion ?? "normal";
  const segments: Segment[] = [];

  let emotion = defaultEmotion;
  let buf = "";
  /** Start offset in the ORIGINAL message of the current buffer. */
  let bufStart = 0;
  let i = 0;

  const flush = (end: number) => {
    if (buf.length === 0) return;
    segments.push({
      text: buf,
      emotion,
      range: { start: bufStart, end },
    });
    buf = "";
  };

  while (i < message.length) {
    const ch = message[i];

    // Escape: \( or \) → literal.
    if (ch === "\\" && i + 1 < message.length) {
      const next = message[i + 1];
      if (next === "(" || next === ")") {
        if (buf.length === 0) bufStart = i;
        buf += next;
        i += 2;
        continue;
      }
    }

    if (ch === "(") {
      // Try to match a tag starting here. Look for the closing `)` within
      // MAX_TAG_LEN characters; bail if we don't find one.
      const closeRel = message.indexOf(")", i + 1);
      if (closeRel !== -1 && closeRel - i <= MAX_TAG_LEN) {
        let inner = message.slice(i + 1, closeRel);
        if (inner.startsWith("*")) inner = inner.slice(1);
        if (NAME_RE.test(inner)) {
          // Valid tag. Flush any buffered text (ended at `i`, just before
          // the `(`), update the emotion, and advance past the `)`.
          flush(i);
          emotion = inner.toLowerCase();
          i = closeRel + 1;
          bufStart = i;
          continue;
        }
      }
      // Fallthrough: not a valid tag, treat `(` as literal.
    }

    if (buf.length === 0) bufStart = i;
    buf += ch;
    i++;
  }

  flush(message.length);
  return segments;
}
