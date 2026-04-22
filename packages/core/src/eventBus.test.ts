import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "./eventBus";

type TestEvent =
  | { kind: "ping"; value: number }
  | { kind: "pong"; name: string }
  | { kind: "noop" };

describe("createEventBus", () => {
  it("fires listeners in registration order", () => {
    const bus = createEventBus<TestEvent>();
    const calls: string[] = [];
    bus.on(() => calls.push("a"));
    bus.on(() => calls.push("b"));
    bus.on(() => calls.push("c"));

    bus.emit({ kind: "ping", value: 1 });

    expect(calls).toEqual(["a", "b", "c"]);
  });

  it("unsubscribe removes exactly the one listener", () => {
    const bus = createEventBus<TestEvent>();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    bus.on(a);
    const offB = bus.on(b);
    bus.on(c);

    offB();
    bus.emit({ kind: "ping", value: 1 });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(0);
    expect(c).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe is idempotent and does not affect other listeners", () => {
    const bus = createEventBus<TestEvent>();
    const a = vi.fn();
    const b = vi.fn();
    const offA = bus.on(a);
    bus.on(b);

    offA();
    offA(); // double unsubscribe — should be a no-op
    bus.emit({ kind: "ping", value: 2 });

    expect(a).toHaveBeenCalledTimes(0);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("onKind only fires for matching kind events and types the payload", () => {
    const bus = createEventBus<TestEvent>();
    const pingSpy = vi.fn<(event: Extract<TestEvent, { kind: "ping" }>) => void>();
    bus.onKind("ping", pingSpy);

    bus.emit({ kind: "pong", name: "hi" });
    bus.emit({ kind: "noop" });
    bus.emit({ kind: "ping", value: 42 });

    expect(pingSpy).toHaveBeenCalledTimes(1);
    expect(pingSpy).toHaveBeenCalledWith({ kind: "ping", value: 42 });
    // Static type narrowing check: .value must be accessible on the payload.
    const firstCall = pingSpy.mock.calls[0]![0];
    expect(firstCall.value).toBe(42);
  });

  it("onKind unsubscribe stops future matching events", () => {
    const bus = createEventBus<TestEvent>();
    const spy = vi.fn();
    const off = bus.onKind("ping", spy);

    bus.emit({ kind: "ping", value: 1 });
    off();
    bus.emit({ kind: "ping", value: 2 });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("clear() removes all listeners", () => {
    const bus = createEventBus<TestEvent>();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    bus.on(a);
    bus.onKind("ping", b);
    bus.on(c);

    bus.clear();
    bus.emit({ kind: "ping", value: 1 });

    expect(a).toHaveBeenCalledTimes(0);
    expect(b).toHaveBeenCalledTimes(0);
    expect(c).toHaveBeenCalledTimes(0);
  });
});
