import { z } from "zod";

const HEX_RGB_OR_RGBA = /^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/;
/** RFC 2397-ish data URI pattern — we accept base64 *or* plain, since both are
 *  legitimate pastes from browser devtools / copy-as-data-url flows. */
const DATA_URL = /^data:[^;,]+(?:;[^;,]+)*,.+$/;

export const imageSchema = z.object({
  /**
   * Image source. Empty string → renders the "no image" placeholder.
   * Accepts any absolute URL parsable by `URL` (covers http/https/file/etc.)
   * *or* a `data:` URI so streamers can paste base64 blobs from devtools.
   */
  src: z
    .union([z.literal(""), z.string().url(), z.string().regex(DATA_URL, "must be a data: URI")])
    .default(""),
  alt: z.string().default(""),
  fit: z.enum(["contain", "cover", "fill", "none"]).default("contain"),
  opacity: z.number().min(0).max(1).default(1),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  tint: z
    .object({
      color: z.string().regex(HEX_RGB_OR_RGBA).default("#00000000"),
      blendMode: z
        .enum(["multiply", "screen", "overlay", "hard-light", "soft-light"])
        .default("multiply"),
      enabled: z.boolean().default(false),
    })
    .default({}),
});

export type ImageProps = z.infer<typeof imageSchema>;
