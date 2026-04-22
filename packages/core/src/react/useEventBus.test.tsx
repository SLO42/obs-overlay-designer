import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { createEventBus } from "../eventBus";
import type { StreamEvent } from "../types/events";
import { OverlayBusProvider } from "./OverlayBusContext";
import { useEventBus } from "./useEventBus";

/**
 * The context default is a silent no-op bus. A component outside the
 * provider must still get a usable object — subscribing, emitting, and
 * cleaning up never throw.
 */
describe("useEventBus", () => {
  it("returns a safe no-op bus when rendered outside the provider", () => {
    let observed: unknown = "not-set";

    function Probe() {
      const bus = useEventBus();
      // Subscribe, emit, unsubscribe — none of this may throw.
      const off = bus.onKind("chat.message", () => {
        observed = "fired";
      });
      // Emitting on the no-op bus is legal; listeners just never run from
      // a different bus instance. Our listener is registered on this bus,
      // so the emit actually delivers.
      bus.emit({
        kind: "chat.message",
        id: "m1",
        user: { id: "u", login: "a", displayName: "A", roles: ["viewer"] },
        fragments: [],
        plain: "",
        receivedAt: 0,
      } as unknown as StreamEvent);
      off();
      return null;
    }

    expect(() => render(<Probe />)).not.toThrow();
    expect(observed).toBe("fired");
  });

  it("exposes the bus passed through OverlayBusProvider", () => {
    const bus = createEventBus<StreamEvent>();
    let received: unknown = null;

    function Probe() {
      const ctxBus = useEventBus();
      // Same identity as the one we provided.
      received = ctxBus;
      return null;
    }

    render(
      <OverlayBusProvider bus={bus}>
        <Probe />
      </OverlayBusProvider>,
    );

    expect(received).toBe(bus);
  });
});
