import { describe, expect, it } from "vitest";
import { render, act } from "@testing-library/react";
import { useRef } from "react";
import { useTTS } from "./useTTS";
import { BUILTIN_PROFILES } from "../profiles";
import type { SpeakHandle } from "../types";

/* ---------------------------------------------------------------------
 * Local fakes (duplicated from speak.test.ts to avoid a shared-test-util
 * file — the two test files are the only consumers).
 * ------------------------------------------------------------------- */

class FakeUtterance {
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
  public readonly utterances: FakeUtterance[] = [];
  public cancelled = false;
  speak(u: FakeUtterance) {
    this.utterances.push(u);
    queueMicrotask(() => u.onstart?.());
    queueMicrotask(() => u.onend?.());
  }
  cancel() {
    this.cancelled = true;
  }
  getVoices(): SpeechSynthesisVoice[] {
    return DEFAULT_VOICES;
  }
  addEventListener() {}
  removeEventListener() {}
}

describe("useTTS", () => {
  it("reports `available: true` when a synthesis is injected", () => {
    const synth = new FakeSynth();
    let api: ReturnType<typeof useTTS> | null = null;
    function Probe() {
      api = useTTS({
        deps: {
          synthesis: synth as unknown as SpeechSynthesis,
          UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
        },
      });
      return null;
    }
    render(<Probe />);
    expect(api).not.toBeNull();
    expect(api!.available).toBe(true);
  });

  it("reports `available: false` when `window.speechSynthesis` is missing", () => {
    const orig = (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    // happy-dom doesn't implement speechSynthesis in the first place;
    // make sure we stay in that state regardless of harness config.
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    try {
      let api: ReturnType<typeof useTTS> | null = null;
      function Probe() {
        api = useTTS();
        return null;
      }
      render(<Probe />);
      expect(api!.available).toBe(false);
    } finally {
      if (orig !== undefined)
        (window as unknown as { speechSynthesis?: unknown }).speechSynthesis = orig;
    }
  });

  it("returns a no-op handle when `enabled: false`", async () => {
    const synth = new FakeSynth();
    let api: ReturnType<typeof useTTS> | null = null;
    function Probe() {
      api = useTTS({
        enabled: false,
        deps: {
          synthesis: synth as unknown as SpeechSynthesis,
          UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
        },
      });
      return null;
    }
    render(<Probe />);
    let handle: SpeakHandle | null = null;
    act(() => {
      handle = api!.speak("hello");
    });
    // Nothing enqueued on the fake synth.
    expect(synth.utterances).toHaveLength(0);
    await handle!.done; // resolves immediately
  });

  it("has stable `speak` / `cancelAll` identity across re-renders", () => {
    const synth = new FakeSynth();
    const refs = { speakRef: null as unknown, cancelRef: null as unknown, renders: 0 };
    function Probe({ rev }: { rev: number }) {
      const api = useTTS({
        deps: {
          synthesis: synth as unknown as SpeechSynthesis,
          UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
        },
      });
      const lastSpeak = useRef(api.speak);
      if (refs.renders === 0) {
        refs.speakRef = api.speak;
        refs.cancelRef = api.cancelAll;
      } else {
        expect(api.speak).toBe(refs.speakRef);
        expect(api.cancelAll).toBe(refs.cancelRef);
        // rev param is just to cause a re-render
        void rev;
        lastSpeak.current = api.speak;
      }
      refs.renders++;
      return null;
    }
    const { rerender } = render(<Probe rev={0} />);
    rerender(<Probe rev={1} />);
    rerender(<Probe rev={2} />);
    expect(refs.renders).toBe(3);
  });

  it("picks up option changes on the next speak() call", async () => {
    const synth = new FakeSynth();
    let api: ReturnType<typeof useTTS> | null = null;
    function Probe({ mult }: { mult: number }) {
      api = useTTS({
        rateMultiplier: mult,
        deps: {
          synthesis: synth as unknown as SpeechSynthesis,
          UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
        },
      });
      return null;
    }
    const { rerender } = render(<Probe mult={1} />);
    // Let the first render's effect commit so optsRef catches up.
    await act(async () => {
      await Promise.resolve();
    });
    let h1: SpeakHandle | null = null;
    act(() => {
      h1 = api!.speak("hi");
    });
    await h1!.done;
    expect(synth.utterances[0]!.rate).toBe(BUILTIN_PROFILES.normal.rate * 1);

    rerender(<Probe mult={2} />);
    await act(async () => {
      await Promise.resolve();
    });
    let h2: SpeakHandle | null = null;
    act(() => {
      h2 = api!.speak("hi");
    });
    await h2!.done;
    expect(synth.utterances[1]!.rate).toBe(BUILTIN_PROFILES.normal.rate * 2);
  });

  it("cancels in-flight speech on unmount", () => {
    const synth = new FakeSynth();
    let api: ReturnType<typeof useTTS> | null = null;
    function Probe() {
      api = useTTS({
        deps: {
          synthesis: synth as unknown as SpeechSynthesis,
          UtteranceCtor: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
        },
      });
      return null;
    }
    const { unmount } = render(<Probe />);
    act(() => {
      api!.speak("hi");
    });
    unmount();
    expect(synth.cancelled).toBe(true);
  });
});
