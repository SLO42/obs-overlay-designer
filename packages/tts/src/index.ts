export type { EmotionProfile, Segment, SpeakEvent, SpeakHandle, SpeakOptions } from "./types";
export { parseEmotionTags } from "./parseEmotionTags";
export type { ParseEmotionTagsOptions } from "./parseEmotionTags";
export { BUILTIN_PROFILES, resolveProfile } from "./profiles";
export { SpeakQueue } from "./speak";
export type { SpeakQueueDeps } from "./speak";
export { pickVoice } from "./utils/voicePicker";
