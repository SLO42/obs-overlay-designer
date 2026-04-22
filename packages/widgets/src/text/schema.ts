import { z } from "zod";

/** Matches #rrggbb. */
const HEX_RGB = /^#[0-9a-fA-F]{6}$/;
/** Matches #rrggbb or #rrggbbaa. */
const HEX_RGB_OR_RGBA = /^#[0-9a-fA-F]{8}$|^#[0-9a-fA-F]{6}$/;

export const textSchema = z.object({
  content: z.string().min(0).max(500).default("Text"),
  fontFamily: z.enum(["sans", "mono", "display", "display-sketch"]).default("sans"),
  fontSize: z.number().int().min(8).max(512).default(48),
  fontWeight: z.enum(["400", "500", "600", "700"]).default("600"),
  color: z.string().regex(HEX_RGB).default("#ffffff"),
  align: z.enum(["left", "center", "right"]).default("center"),
  /** em units */
  letterSpacing: z.number().min(-0.1).max(1).default(0),
  lineHeight: z.number().min(0.8).max(3).default(1.2),
  background: z
    .object({
      color: z.string().regex(HEX_RGB_OR_RGBA).default("#00000000"),
      paddingX: z.number().int().min(0).max(200).default(0),
      paddingY: z.number().int().min(0).max(200).default(0),
      radius: z.number().int().min(0).max(64).default(0),
    })
    .default({}),
  textShadow: z
    .object({
      x: z.number().min(-40).max(40).default(0),
      y: z.number().min(-40).max(40).default(2),
      blur: z.number().min(0).max(40).default(4),
      color: z.string().default("#000000cc"),
      enabled: z.boolean().default(true),
    })
    .default({}),
});

export type TextProps = z.infer<typeof textSchema>;
