import { describe, expect, it } from "vitest";
import { buildEmoteUrl } from "../firstParty";

describe("buildEmoteUrl", () => {
  it("defaults to static dark 2.0", () => {
    expect(buildEmoteUrl("25")).toBe(
      "https://static-cdn.jtvnw.net/emoticons/v2/25/static/dark/2.0",
    );
  });

  it("honours explicit format / theme / scale", () => {
    expect(buildEmoteUrl("305954156", { format: "animated", theme: "light", scale: "3.0" })).toBe(
      "https://static-cdn.jtvnw.net/emoticons/v2/305954156/animated/light/3.0",
    );
  });

  it("supports all three scales", () => {
    expect(buildEmoteUrl("42", { scale: "1.0" })).toContain("/1.0");
    expect(buildEmoteUrl("42", { scale: "2.0" })).toContain("/2.0");
    expect(buildEmoteUrl("42", { scale: "3.0" })).toContain("/3.0");
  });
});
