import { describe, expect, it, vi } from "vitest";
import { SpeakQueue } from "./speak";
import { BUILTIN_PROFILES } from "./profiles";
import type { SpeakEvent } from "./types";

/* ---------------------------------------------------------------------
 * Fake SpeechSynthesis / SpeechSynthesisUtterance implementations
 *
 * happy-dom does NOT implement `window.speechSynthesis`, so we define a
 * minimal drop-in that fires `onstart` then `onend` on microtasks. Tests
 * can either use the default (success path) or override `speak()` to
 * simulate errors / long-running utterances.
 * ------------------------------------------------------------------- */

interface CapturedUtterance {
  text: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onboundary: ((ev: { charIndex: number; charLength?: number }) => void) | null;
}

class FakeUtterance implements CapturedUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  lang = "";
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((ev: { error?: string }) => void) | null = null;
  onboundary: ((ev: { charIndex: number; charLength?: number }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

type SpeakHook = (u: FakeUtterance) => void;

/** A single default voice so `awaitVoices` resolves immediately. */
const DEFAULT_VOICES: SpeechSynthesisVoice[] = [
  {
    name: "Test Voice",
    lang: "en-US",
    default: true,
    localService: true,
    voiceURI: "",
  } as SpeechSynthesisVoice,
];

class FakeSynth {
  /** All utterances ever passed to `speak()`, in call order. */
  public readonly utterances: FakeUtterance[] = [];
  /** `true` once `cancel()` has been called. */
  public cancelled = false;
  /** Custom speak behavior (defaults to auto-success). */
  private hook: SpeakHook;

  constructor(hook?: SpeakHook) {
    this.hook =
      hook ??
      ((u) => {
        queueMicrotask(() => u.onstart?.());
        queueMicrotask(() => u.onend?.());
      });
  }

  speak(u: FakeUtterance): void {
    this.utterances.push(u);
    this.hook(u);
  }
  cancel(): void {
    this.cancelled = true;
  }
  getVoices(): SpeechSynthesisVoice[] {
    return DEFAULT_VOICES;
  }
  addEventListener(): void {
    /* noop */
  }
  removeEventListener(): void {
    /* noop */
  }
}

/** Wait a few microtasks so queued callbacks can drain. */
async function drain(ticks = 10): Promise<void> {
  for (let i = 0; i < ticks; i++) await Promise.resolve();
}

function collectEvents(queue: SpeakQueue, message: string, opts = { profiles: BUILTIN_PROFILES }) {
  const events: SpeakEvent[] = [];
  const handle = queue.speak(message, opts);
  handle.onEvent((e) => events.push(e));
  return { handle, events };
}

describe("SpeakQueue", () => {
  it("speaks a tag-free message with `normal` profile params", async () => {
    const synth = new FakeSynth();
    const queue = new SpeakQueue({
      synthesis: synth as unknown as SpeechSynthesis,
      UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    });
    const { handle, events } = collectEvents(queue, "hello");
    await handle.done;

    expect(synth.utterances).toHaveLength(1);
    const u = synth.utterances[0]!;
    expect(u.text).toBe("hello");
    expect(u.rate).toBe(BUILTIN_PROFILES.normal.rate);
    expect(u.pitch).toBe(BUILTIN_PROFILES.normal.pitch);
    expect(u.volume).toBe(BUILTIN_PROFILES.normal.volume);
    expect(events.map((e) => e.type)).toEqual(["start", "end", "finish"]);
  });

  it("enqueues one utterance per segment with the right params", async () => {
    const synth = new FakeSynth();
    const queue = new SpeakQueue({
      synthesis: synth as unknown as SpeechSynthesis,
      UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    });
    const { handle, events } = collectEvents(queue, "(whisper) hi (excited) yo");
    await handle.done;

    expect(synth.utterances).toHaveLength(2);
    expect(synth.utterances[0]!.text).toBe(" hi ");
    expect(synth.utterances[0]!.volume).toBe(BUILTIN_PROFILES.whisper.volume);
    expect(synth.utterances[1]!.text).toBe(" yo");
    expect(synth.utterances[1]!.rate).toBe(BUILTIN_PROFILES.excited.rate);

    // start/end per segment, then a final finish event.
    expect(events.map((e) => e.type)).toEqual(["start", "end", "start", "end", "finish"]);
    // Start events carry the segment emotion.
    const startEvents = events.filter((e) => e.type === "start");
    expect(startEvents).toHaveLength(2);
    if (startEvents[0]!.type === "start") expect(startEvents[0]!.segment.emotion).toBe("whisper");
    if (startEvents[1]!.type === "start") expect(startEvents[1]!.segment.emotion).toBe("excited");
  });

  it("cancel() calls synthesis.cancel() and stops further events", async () => {
    // Hook that only fires `start` — `end` will never fire naturally, so
    // we rely on the cancel path to resolve `done`.
    const synth = new FakeSynth((u) => {
      queueMicrotask(() => u.onstart?.());
    });
    const queue = new SpeakQueue({
      synthesis: synth as unknown as SpeechSynthesis,
      UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    });
    const events: SpeakEvent[] = [];
    const handle = queue.speak("hi", { profiles: BUILTIN_PROFILES });
    handle.onEvent((e) => events.push(e));

    await drain();
    handle.cancel();
    await handle.done;

    expect(synth.cancelled).toBe(true);
    // No `finish` event after cancel — cancel is a quiet teardown.
    expect(events.some((e) => e.type === "finish")).toBe(false);

    // Try dispatching more events: the fake utterance's onend still
    // exists, but the handle should have cleared its listeners.
    const u = synth.utterances[0]!;
    const beforeLen = events.length;
    u.onend?.();
    expect(events.length).toBe(beforeLen);
  });

  it("applies rateMultiplier on top of the per-emotion rate", async () => {
    const synth = new FakeSynth();
    const queue = new SpeakQueue({
      synthesis: synth as unknown as SpeechSynthesis,
      UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    });
    const handle = queue.speak("hello", {
      profiles: BUILTIN_PROFILES,
      rateMultiplier: 2,
    });
    await handle.done;

    // normal.rate is 1.0 → clamped 2.0 after multiplier.
    expect(synth.utterances[0]!.rate).toBe(2);
  });

  it("applies volumeMultiplier and clamps to 0..1", async () => {
    const synth = new FakeSynth();
    const queue = new SpeakQueue({
      synthesis: synth as unknown as SpeechSynthesis,
      UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    });
    const handle = queue.speak("hi", {
      profiles: BUILTIN_PROFILES,
      volumeMultiplier: 5, // absurd — clamp to 1.
    });
    await handle.done;
    expect(synth.utterances[0]!.volume).toBe(1);
  });

  it("emits a final `error` + resolves `done` when synthesis is missing", async () => {
    // No synthesis, no utterance ctor.
    const queue = new SpeakQueue({
      synthesis: undefined as unknown as SpeechSynthesis,
      UtteranceCtor: undefined as unknown as typeof SpeechSynthesisUtterance,
    });
    // Avoid happy-dom's possibly-undefined `window.speechSynthesis` also
    // being picked up — the constructor prefers deps first, then falls
    // back to `window`. Scrub both to confirm the no-API path.
    const origSynth = (globalThis as { speechSynthesis?: unknown }).speechSynthesis;
    const origCtor = (globalThis as { SpeechSynthesisUtterance?: unknown })
      .SpeechSynthesisUtterance;
    try {
      delete (globalThis as { speechSynthesis?: unknown }).speechSynthesis;
      delete (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
      const fresh = new SpeakQueue();
      const events: SpeakEvent[] = [];
      const handle = fresh.speak("hello", { profiles: BUILTIN_PROFILES });
      handle.onEvent((e) => events.push(e));
      await handle.done;
      expect(events.some((e) => e.type === "error")).toBe(true);
    } finally {
      if (origSynth !== undefined)
        (globalThis as { speechSynthesis?: unknown }).speechSynthesis = origSynth;
      if (origCtor !== undefined)
        (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = origCtor;
    }
    // The constructed-with-undefined-deps queue still takes the error
    // branch because we explicitly nulled its deps.
    const events: SpeakEvent[] = [];
    const handle = queue.speak("hi", { profiles: BUILTIN_PROFILES });
    handle.onEvent((e) => events.push(e));
    await handle.done;
    expect(events.map((e) => e.type)).toContain("error");
  });

  it("emits `error` on utterance failure and continues the queue", async () => {
    let counter = 0;
    const synth = new FakeSynth((u) => {
      counter++;
      if (counter === 1) {
        queueMicrotask(() => u.onerror?.({ error: "interrupted" }));
      } else {
        queueMicrotask(() => u.onstart?.());
        queueMicrotask(() => u.onend?.());
      }
    });
    const queue = new SpeakQueue({
      synthesis: synth as unknown as SpeechSynthesis,
      UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    });
    const events: SpeakEvent[] = [];
    const handle = queue.speak("(angry) one (happy) two", { profiles: BUILTIN_PROFILES });
    handle.onEvent((e) => events.push(e));
    await handle.done;

    expect(synth.utterances).toHaveLength(2);
    const types = events.map((e) => e.type);
    // First utterance errored, second started + ended, finish at the end.
    expect(types).toEqual(["error", "start", "end", "finish"]);
  });

  it("emits `boundary` events carrying charIndex", async () => {
    const synth = new FakeSynth((u) => {
      queueMicrotask(() => {
        u.onstart?.();
        u.onboundary?.({ charIndex: 0, charLength: 5 });
        u.onboundary?.({ charIndex: 6, charLength: 5 });
        u.onend?.();
      });
    });
    const queue = new SpeakQueue({
      synthesis: synth as unknown as SpeechSynthesis,
      UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    });
    const events: SpeakEvent[] = [];
    const handle = queue.speak("hello world", { profiles: BUILTIN_PROFILES });
    handle.onEvent((e) => events.push(e));
    await handle.done;

    const boundaries = events.filter((e) => e.type === "boundary");
    expect(boundaries).toHaveLength(2);
    const first = boundaries[0]!;
    if (first.type === "boundary") {
      expect(first.charIndex).toBe(0);
      expect(first.charLength).toBe(5);
    }
  });

  it("cancelAll() stops in-flight speech and clears the active handle", async () => {
    const synth = new FakeSynth((u) => {
      queueMicrotask(() => u.onstart?.());
    });
    const queue = new SpeakQueue({
      synthesis: synth as unknown as SpeechSynthesis,
      UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    });
    const handle = queue.speak("hi", { profiles: BUILTIN_PROFILES });
    await drain();
    queue.cancelAll();
    await handle.done;
    expect(synth.cancelled).toBe(true);
  });

  it("starting a new speak() cancels the previous one", async () => {
    const synth = new FakeSynth((u) => {
      // Never fire end — only a second `speak()` call should end it.
      queueMicrotask(() => u.onstart?.());
    });
    const queue = new SpeakQueue({
      synthesis: synth as unknown as SpeechSynthesis,
      UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    });
    const first = queue.speak("first", { profiles: BUILTIN_PROFILES });
    await drain();
    queue.speak("second", { profiles: BUILTIN_PROFILES });
    // first should have been cancelled → done resolves.
    await first.done;
    expect(synth.cancelled).toBe(true);
  });

  it("speaking an all-tags message with no text resolves without utterances", async () => {
    const synth = new FakeSynth();
    const queue = new SpeakQueue({
      synthesis: synth as unknown as SpeechSynthesis,
      UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    });
    const events: SpeakEvent[] = [];
    // Two tags back-to-back with no content produce zero non-empty segments.
    const handle = queue.speak("(shy)(whisper)", { profiles: BUILTIN_PROFILES });
    handle.onEvent((e) => events.push(e));
    await handle.done;
    expect(synth.utterances).toHaveLength(0);
    expect(events).toEqual([{ type: "finish" }]);
  });

  it("listens for `voiceschanged` when getVoices returns empty initially", async () => {
    let voices: SpeechSynthesisVoice[] = [];
    let firedHandler: (() => void) | null = null;
    const synth = {
      utterances: [] as FakeUtterance[],
      speak(u: FakeUtterance) {
        this.utterances.push(u);
        queueMicrotask(() => u.onstart?.());
        queueMicrotask(() => u.onend?.());
      },
      cancel() {},
      getVoices() {
        return voices;
      },
      addEventListener(_: string, handler: () => void) {
        firedHandler = handler;
      },
      removeEventListener() {},
    };
    const queue = new SpeakQueue({
      synthesis: synth as unknown as SpeechSynthesis,
      UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
      getVoices: () => voices,
    });
    const handle = queue.speak("hi", { profiles: BUILTIN_PROFILES });
    // Drain microtasks so the `run()` path reaches awaitVoices.
    await drain();
    // Populate voices + fire the voiceschanged handler.
    voices = [
      {
        name: "V",
        lang: "en-US",
        default: true,
        localService: true,
        voiceURI: "",
      } as SpeechSynthesisVoice,
    ];
    expect(firedHandler).not.toBeNull();
    firedHandler!();
    await handle.done;
    expect(synth.utterances).toHaveLength(1);
  });

  it("awaitVoices times out gracefully when voiceschanged never fires", async () => {
    vi.useFakeTimers();
    try {
      const synth = {
        utterances: [] as FakeUtterance[],
        speak(u: FakeUtterance) {
          this.utterances.push(u);
          queueMicrotask(() => u.onstart?.());
          queueMicrotask(() => u.onend?.());
        },
        cancel() {},
        getVoices() {
          return [] as SpeechSynthesisVoice[];
        },
        addEventListener() {},
        removeEventListener() {},
      };
      const queue = new SpeakQueue({
        synthesis: synth as unknown as SpeechSynthesis,
        UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
        getVoices: () => [],
      });
      const handle = queue.speak("hi", { profiles: BUILTIN_PROFILES });
      // Advance past the 800ms timeout.
      await vi.advanceTimersByTimeAsync(900);
      await handle.done;
      expect(synth.utterances).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
