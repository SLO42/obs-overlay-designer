import { useCallback, useEffect, useMemo, useRef } from "react";
import { SpeakQueue, type SpeakQueueDeps } from "../speak";
import { BUILTIN_PROFILES } from "../profiles";
import type { EmotionProfile, SpeakHandle, SpeakOptions } from "../types";

export interface UseTTSOptions extends Omit<SpeakOptions, "profiles"> {
  /** Override the profile map. Defaults to `BUILTIN_PROFILES`. */
  profiles?: Record<string, EmotionProfile>;
  /** Master on/off. When false, `speak()` returns a no-op handle immediately. */
  enabled?: boolean;
  /**
   * Dependency injection — the same shape `SpeakQueue` accepts. Most
   * consumers will leave this unset; tests pass in a fake synthesis.
   */
  deps?: SpeakQueueDeps;
}

export interface UseTTSResult {
  speak: (message: string) => SpeakHandle;
  cancelAll: () => void;
  /** `true` when `window.speechSynthesis` is available. */
  available: boolean;
}

/** Handle returned when `enabled: false`. Does nothing and resolves immediately. */
function noopHandle(): SpeakHandle {
  return {
    cancel: () => {},
    done: Promise.resolve(),
    onEvent: () => () => {},
  };
}

/**
 * React wrapper around `SpeakQueue`. `speak` + `cancelAll` have stable
 * identities across re-renders; options are stored on a ref so the
 * hook consumes the latest values on every `speak` call without
 * recreating the queue. The queue is cancelled on unmount.
 *
 * Pass `deps.synthesis` from a test to avoid depending on the real Web
 * Speech API, which happy-dom does not implement.
 */
export function useTTS(opts: UseTTSOptions = {}): UseTTSResult {
  // A single SpeakQueue for the lifetime of the component. We create it
  // lazily inside a ref so the constructor only runs once.
  const queueRef = useRef<SpeakQueue | null>(null);
  if (queueRef.current === null) {
    queueRef.current = new SpeakQueue(opts.deps);
  }

  // Current options live on a ref so `speak` can read the latest
  // without consumers needing to memoize the options object.
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const available = useMemo(() => {
    if (opts.deps?.synthesis) return true;
    return typeof window !== "undefined" && !!window.speechSynthesis;
  }, [opts.deps?.synthesis]);

  const speak = useCallback((message: string): SpeakHandle => {
    const current = optsRef.current;
    if (current.enabled === false) return noopHandle();
    const {
      profiles = BUILTIN_PROFILES,
      defaultEmotion,
      rateMultiplier,
      volumeMultiplier,
      lang,
    } = current;
    return queueRef.current!.speak(message, {
      profiles,
      defaultEmotion,
      rateMultiplier,
      volumeMultiplier,
      lang,
    });
  }, []);

  const cancelAll = useCallback(() => {
    queueRef.current?.cancelAll();
  }, []);

  useEffect(() => {
    // Capture the queue on mount so the unmount cleanup can't reach a
    // stale ref later.
    const queue = queueRef.current;
    return () => {
      queue?.cancelAll();
    };
  }, []);

  return { speak, cancelAll, available };
}
