import { parseEmotionTags } from "./parseEmotionTags";
import { resolveProfile } from "./profiles";
import type { EmotionProfile, Segment, SpeakEvent, SpeakHandle, SpeakOptions } from "./types";
import { pickVoice } from "./utils/voicePicker";

/**
 * Dependency injection hook for tests. The runtime defaults wire to
 * `window.speechSynthesis` + `window.SpeechSynthesisUtterance`. Tests
 * substitute a fake that calls `onstart`/`onend` synchronously on a
 * microtask + a pre-built voice list.
 */
export interface SpeakQueueDeps {
  /** Default: `window.speechSynthesis`. */
  synthesis?: SpeechSynthesis;
  /** Default: `window.SpeechSynthesisUtterance`. */
  UtteranceCtor?: typeof SpeechSynthesisUtterance;
  /** Default: `synthesis.getVoices()`. */
  getVoices?: () => SpeechSynthesisVoice[];
}

/** How long we wait for async `voiceschanged` before giving up. */
const VOICE_LOAD_TIMEOUT_MS = 800;

/**
 * Clamp the Web Speech API inputs to their spec ranges so a misbehaving
 * profile or a silly multiplier can't throw `RangeError` at the driver.
 */
function clamp(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return lo;
  return Math.max(lo, Math.min(hi, value));
}

/**
 * Wait until `getVoices()` returns a non-empty list (voices load async
 * on Chrome/Edge) or until the timeout expires. Resolves to the latest
 * snapshot either way.
 */
function awaitVoices(
  synthesis: SpeechSynthesis,
  getVoices: () => SpeechSynthesisVoice[],
): Promise<SpeechSynthesisVoice[]> {
  const initial = getVoices();
  if (initial.length > 0) return Promise.resolve(initial);

  return new Promise((resolve) => {
    let done = false;
    const finish = (list: SpeechSynthesisVoice[]) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        synthesis.removeEventListener?.("voiceschanged", handler);
      } catch {
        /* some environments don't implement removeEventListener */
      }
      resolve(list);
    };
    const handler = () => finish(getVoices());
    const timer = setTimeout(() => finish(getVoices()), VOICE_LOAD_TIMEOUT_MS);
    try {
      synthesis.addEventListener?.("voiceschanged", handler);
    } catch {
      // No event API available — just fall through and wait the timer.
    }
  });
}

/**
 * Orchestrates utterance playback for tag-annotated messages.
 *
 * One `SpeakQueue` instance can `speak()` multiple messages, but only
 * one message's queue is active at a time: every `speak()` call first
 * cancels whatever is in flight (via `synthesis.cancel()`), then enqueues
 * its segments. Call `cancelAll()` to stop everything without starting
 * anything new.
 */
export class SpeakQueue {
  private readonly synthesis: SpeechSynthesis | null;
  private readonly UtteranceCtor: typeof SpeechSynthesisUtterance | null;
  private readonly getVoices: () => SpeechSynthesisVoice[];
  /** Active handle, if any — used by cancelAll and replace-on-new-speak. */
  private active: SpeakHandle | null = null;

  constructor(deps: SpeakQueueDeps = {}) {
    const win: (Window & typeof globalThis) | undefined =
      typeof window !== "undefined" ? window : undefined;
    this.synthesis = deps.synthesis ?? win?.speechSynthesis ?? null;
    this.UtteranceCtor = deps.UtteranceCtor ?? win?.SpeechSynthesisUtterance ?? null;
    const syn = this.synthesis;
    this.getVoices = deps.getVoices ?? (() => syn?.getVoices?.() ?? []);
  }

  /**
   * Parse `message`, turn each segment into an utterance, and enqueue
   * them sequentially. Returns a handle that exposes `onEvent`, a
   * `done` promise, and a `cancel` method.
   */
  speak(message: string, opts: SpeakOptions): SpeakHandle {
    // Any previous speak call is superseded. We do this first so the
    // no-synth early return below doesn't leave a dangling queue.
    if (this.active) this.active.cancel();

    const handle = this.createHandle();
    this.active = handle;

    if (!this.synthesis || !this.UtteranceCtor) {
      // No API at all. Fire an error + finish so consumers see a
      // deterministic end-state.
      queueMicrotask(() => {
        handle._dispatch({
          type: "error",
          error: new Error("SpeechSynthesis API is unavailable in this environment"),
        });
        handle._finish();
      });
      return handle;
    }

    const segments = parseEmotionTags(message, { defaultEmotion: opts.defaultEmotion }).filter(
      (s) => s.text.length > 0,
    );

    if (segments.length === 0) {
      // Nothing to say. Finish cleanly on a microtask so the handle
      // behaves like the real async path.
      queueMicrotask(() => handle._finish());
      return handle;
    }

    // Kick off the playback sequence — voice resolution may be async.
    void this.run(handle, segments, opts);
    return handle;
  }

  /** Stop anything currently in flight and do not start anything new. */
  cancelAll(): void {
    if (this.active) {
      this.active.cancel();
      this.active = null;
    }
    try {
      this.synthesis?.cancel?.();
    } catch {
      /* driver quirks on cancel */
    }
  }

  /** Internal: build the handle object. Event listeners live here. */
  private createHandle(): InternalHandle {
    const listeners = new Set<(e: SpeakEvent) => void>();
    let resolveDone: () => void = () => {};
    const done = new Promise<void>((r) => {
      resolveDone = r;
    });
    let cancelled = false;
    let finished = false;

    const handle: InternalHandle = {
      cancel: () => {
        if (finished) return;
        cancelled = true;
        try {
          this.synthesis?.cancel?.();
        } catch {
          /* ignore */
        }
        finished = true;
        listeners.clear();
        resolveDone();
      },
      done,
      onEvent: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      _dispatch: (event) => {
        if (cancelled || finished) return;
        for (const l of listeners) {
          try {
            l(event);
          } catch (err) {
            // A thrown listener must not break the rest of the queue.
            // eslint-disable-next-line no-console
            console.error("[tts] onEvent listener threw", err);
          }
        }
      },
      _finish: () => {
        if (finished) return;
        if (!cancelled) {
          for (const l of listeners) {
            try {
              l({ type: "finish" });
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error("[tts] onEvent listener threw", err);
            }
          }
        }
        finished = true;
        listeners.clear();
        resolveDone();
      },
      _cancelled: () => cancelled,
    };
    return handle;
  }

  /** Internal: drive the utterance sequence to completion. */
  private async run(
    handle: InternalHandle,
    segments: Segment[],
    opts: SpeakOptions,
  ): Promise<void> {
    const voices = await awaitVoices(this.synthesis!, this.getVoices);
    if (handle._cancelled()) return;

    for (let i = 0; i < segments.length; i++) {
      if (handle._cancelled()) return;
      const segment = segments[i];
      if (!segment) continue; // satisfies noUncheckedIndexedAccess
      const profile = resolveProfile(segment.emotion, opts.profiles, opts.defaultEmotion);
      try {
        await this.speakSegment(handle, i, segment, profile, voices, opts);
      } catch (err) {
        // `speakSegment` swallows per-utterance onerror and emits a
        // `SpeakEvent` error; it only throws on truly unexpected
        // failures (e.g. the UtteranceCtor blew up). Emit an error
        // event and move on — the next segment still gets a chance.
        handle._dispatch({
          type: "error",
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }
    handle._finish();
  }

  /** Internal: speak one segment, await start → end. */
  private speakSegment(
    handle: InternalHandle,
    segmentIndex: number,
    segment: Segment,
    profile: EmotionProfile,
    voices: SpeechSynthesisVoice[],
    opts: SpeakOptions,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const utterance = new this.UtteranceCtor!(segment.text);

      const rateMultiplier = opts.rateMultiplier ?? 1;
      const volumeMultiplier = opts.volumeMultiplier ?? 1;

      utterance.rate = clamp(profile.rate * rateMultiplier, 0.1, 10);
      utterance.pitch = clamp(profile.pitch, 0, 2);
      utterance.volume = clamp(profile.volume * volumeMultiplier, 0, 1);

      const voice = pickVoice(voices, profile.voice, opts.lang);
      if (voice) utterance.voice = voice;
      if (opts.lang) utterance.lang = opts.lang;
      else if (profile.voice?.lang) utterance.lang = profile.voice.lang;

      utterance.onstart = () => {
        handle._dispatch({ type: "start", segmentIndex, segment });
      };
      utterance.onboundary = (ev: SpeechSynthesisEvent) => {
        handle._dispatch({
          type: "boundary",
          segmentIndex,
          segment,
          charIndex: ev.charIndex ?? 0,
          // `charLength` is not available on every browser. Default to 0
          // so consumers always get a number.
          charLength: (ev as SpeechSynthesisEvent & { charLength?: number }).charLength ?? 0,
        });
      };
      utterance.onend = () => {
        handle._dispatch({ type: "end", segmentIndex, segment });
        resolve();
      };
      utterance.onerror = (ev: SpeechSynthesisErrorEvent) => {
        const reason =
          (ev as SpeechSynthesisErrorEvent & { error?: string }).error ?? "speech-error";
        handle._dispatch({
          type: "error",
          error: new Error(`utterance failed: ${reason}`),
        });
        // Continue to the next segment; resolve (don't reject) so the
        // queue keeps moving.
        resolve();
      };

      this.synthesis!.speak(utterance);
    });
  }
}

/** Extended handle interface with internal dispatch hooks. */
interface InternalHandle extends SpeakHandle {
  _dispatch(event: SpeakEvent): void;
  _finish(): void;
  _cancelled(): boolean;
}
