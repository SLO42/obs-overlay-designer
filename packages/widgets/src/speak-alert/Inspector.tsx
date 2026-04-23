import { useState } from "react";
import {
  Button,
  ColorInput,
  Input,
  InspectorField,
  NumberField,
  Panel,
  Select,
  Slider,
  Stack,
  Switch,
} from "@obs/design-system";
import type { Widget } from "@obs/core";
import { DEFAULT_EMOTION_ANIMATIONS, type EmotionAnimation, type SpeakAlertProps } from "./schema";
import inspectorStyles from "./Inspector.module.css";

interface SpeakAlertInspectorProps {
  widget: Widget<SpeakAlertProps>;
  update: (patch: Partial<SpeakAlertProps>) => void;
}

const FONT_OPTIONS = [
  { value: "sans", label: "Sans" },
  { value: "display", label: "Display" },
  { value: "mono", label: "Mono" },
];

const ENTRANCE_OPTIONS = [
  { value: "slide-up", label: "Slide up" },
  { value: "slide-in", label: "Slide in" },
  { value: "scale", label: "Scale" },
  { value: "fade", label: "Fade" },
];

const EXIT_OPTIONS = [
  { value: "slide-down", label: "Slide down" },
  { value: "slide-out", label: "Slide out" },
  { value: "scale", label: "Scale" },
  { value: "fade", label: "Fade" },
];

const EFFECT_OPTIONS = [
  { value: "none", label: "None" },
  { value: "shake", label: "Shake" },
  { value: "flash", label: "Flash" },
  { value: "zoom-punch", label: "Zoom punch" },
];

const SECTION_LABEL_STYLE = { fontSize: 12, fontWeight: 600, color: "var(--fg-secondary)" };

/**
 * Custom inspector for the SpeakAlert widget. The schema has more knobs than
 * fit cleanly in the auto-form, and the emotion-animation record needs a
 * bespoke UI (rows + add/remove) so we author the whole panel by hand.
 */
export function SpeakAlertInspector({ widget, update }: SpeakAlertInspectorProps) {
  const props = widget.props;
  const [newEmotion, setNewEmotion] = useState("");

  const emotions = Object.keys(props.emotionAnimations);

  const updateEmotion = (key: string, next: Partial<EmotionAnimation>) => {
    const current = props.emotionAnimations[key] ?? { effect: "none" as const, intensity: 1 };
    update({
      emotionAnimations: {
        ...props.emotionAnimations,
        [key]: { ...current, ...next },
      },
    });
  };

  const removeEmotion = (key: string) => {
    const next = { ...props.emotionAnimations };
    delete next[key];
    update({ emotionAnimations: next });
  };

  const addEmotion = () => {
    const name = newEmotion.trim().toLowerCase();
    if (!name) return;
    if (props.emotionAnimations[name]) {
      setNewEmotion("");
      return;
    }
    update({
      emotionAnimations: {
        ...props.emotionAnimations,
        [name]: { effect: "none", intensity: 1 },
      },
    });
    setNewEmotion("");
  };

  return (
    <Stack gap={3}>
      {/* 1. Events ------------------------------------------------------- */}
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={SECTION_LABEL_STYLE}>Events</span>
          <InspectorField label="Speak donations">
            <Switch
              aria-label="Speak donations"
              checked={props.speakDonation}
              onChange={(v) => update({ speakDonation: v })}
            />
          </InspectorField>
          <InspectorField label="Speak cheers">
            <Switch
              aria-label="Speak cheers"
              checked={props.speakCheer}
              onChange={(v) => update({ speakCheer: v })}
            />
          </InspectorField>
          <InspectorField label="Speak subscribes">
            <Switch
              aria-label="Speak subscribes"
              checked={props.speakSubscribe}
              onChange={(v) => update({ speakSubscribe: v })}
            />
          </InspectorField>
          <InspectorField label="Speak follows">
            <Switch
              aria-label="Speak follows"
              checked={props.speakFollow}
              onChange={(v) => update({ speakFollow: v })}
            />
          </InspectorField>
          <InspectorField label="Speak raids">
            <Switch
              aria-label="Speak raids"
              checked={props.speakRaid}
              onChange={(v) => update({ speakRaid: v })}
            />
          </InspectorField>
          <InspectorField label="Speak redeems">
            <Switch
              aria-label="Speak redeems"
              checked={props.speakRedeem}
              onChange={(v) => update({ speakRedeem: v })}
            />
          </InspectorField>
        </Stack>
      </Panel>

      {/* 2. Thresholds --------------------------------------------------- */}
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={SECTION_LABEL_STYLE}>Thresholds</span>
          <InspectorField
            label="Min donation amount"
            description="Minor units (cents). Donations below this are silent."
          >
            <NumberField
              value={props.minDonationAmount}
              min={0}
              step={50}
              onChange={(next) => update({ minDonationAmount: Math.round(next) })}
            />
          </InspectorField>
          {props.speakCheer ? (
            <InspectorField label="Min cheer bits">
              <NumberField
                value={props.minCheerBits}
                min={0}
                step={50}
                onChange={(next) => update({ minCheerBits: Math.round(next) })}
              />
            </InspectorField>
          ) : null}
        </Stack>
      </Panel>

      {/* 3. Templates ---------------------------------------------------- */}
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={SECTION_LABEL_STYLE}>Templates</span>
          <InspectorField
            label="Title"
            description="Supports {user}, {amount}, {currency}, {bits}, {from}, etc."
          >
            <Input
              value={props.titleTemplate}
              onChange={(e) => update({ titleTemplate: e.target.value })}
            />
          </InspectorField>
          <InspectorField
            label="Speak"
            description="The text that will be read aloud. Use (emotion) tags to drive animations."
          >
            <Input
              value={props.speakTemplate}
              onChange={(e) => update({ speakTemplate: e.target.value })}
            />
          </InspectorField>
        </Stack>
      </Panel>

      {/* 4. TTS ---------------------------------------------------------- */}
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={SECTION_LABEL_STYLE}>Text to speech</span>
          <InspectorField label="Enabled">
            <Switch
              aria-label="TTS enabled"
              checked={props.ttsEnabled}
              onChange={(v) => update({ ttsEnabled: v })}
            />
          </InspectorField>
          <InspectorField label="Rate">
            <Slider
              aria-label="TTS rate"
              value={props.ttsRate}
              min={0.5}
              max={1.6}
              step={0.05}
              onChange={(v) => update({ ttsRate: v })}
            />
          </InspectorField>
          <InspectorField label="Volume">
            <Slider
              aria-label="TTS volume"
              value={props.ttsVolume}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => update({ ttsVolume: v })}
            />
          </InspectorField>
          <InspectorField label="Default emotion">
            <Input
              value={props.ttsDefaultEmotion}
              onChange={(e) => update({ ttsDefaultEmotion: e.target.value })}
              placeholder="normal"
            />
          </InspectorField>
          <InspectorField label="Language">
            <Input
              value={props.ttsLang}
              onChange={(e) => update({ ttsLang: e.target.value })}
              placeholder="en-US"
            />
          </InspectorField>
          <InspectorField label="Voice name" description="Leave empty to auto-pick.">
            <Input
              value={props.ttsVoiceName}
              onChange={(e) => update({ ttsVoiceName: e.target.value })}
              placeholder="auto"
            />
          </InspectorField>
        </Stack>
      </Panel>

      {/* 5. Emotion animations ------------------------------------------ */}
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={SECTION_LABEL_STYLE}>Emotion animations</span>
          <InspectorField label="Animate on segments">
            <Switch
              aria-label="Animate on segments"
              checked={props.animateOnSegments}
              onChange={(v) => update({ animateOnSegments: v })}
            />
          </InspectorField>
          {emotions.map((key) => {
            const animation = props.emotionAnimations[key] ?? {
              effect: "none" as const,
              intensity: 1,
            };
            const isDefault = key in DEFAULT_EMOTION_ANIMATIONS;
            return (
              <div key={key} className={inspectorStyles.emotionRow} data-emotion-row={key}>
                <span className={inspectorStyles.emotionName}>{key}</span>
                <Select
                  value={animation.effect}
                  onValueChange={(v) =>
                    updateEmotion(key, { effect: v as EmotionAnimation["effect"] })
                  }
                  options={EFFECT_OPTIONS}
                  aria-label={`${key} effect`}
                />
                <NumberField
                  value={animation.intensity}
                  min={0.1}
                  max={3}
                  step={0.1}
                  onChange={(v) => updateEmotion(key, { intensity: v })}
                />
                {!isDefault ? (
                  <button
                    type="button"
                    className={inspectorStyles.removeBtn}
                    onClick={() => removeEmotion(key)}
                    aria-label={`Remove ${key}`}
                  >
                    Remove
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
              </div>
            );
          })}
          <div className={inspectorStyles.addEmotionRow}>
            <Input
              value={newEmotion}
              onChange={(e) => setNewEmotion(e.target.value)}
              placeholder="custom-emotion"
              aria-label="New emotion name"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={addEmotion}
              disabled={!newEmotion.trim()}
            >
              Add emotion
            </Button>
          </div>
        </Stack>
      </Panel>

      {/* 6. Visuals ------------------------------------------------------ */}
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={SECTION_LABEL_STYLE}>Visuals</span>
          <InspectorField label="Font family">
            <Select
              value={props.fontFamily}
              onValueChange={(v) => update({ fontFamily: v as SpeakAlertProps["fontFamily"] })}
              options={FONT_OPTIONS}
              aria-label="Font family"
            />
          </InspectorField>
          <InspectorField label="Title size">
            <NumberField
              value={props.titleSize}
              min={14}
              max={72}
              onChange={(v) => update({ titleSize: Math.round(v) })}
            />
          </InspectorField>
          <InspectorField label="Message size">
            <NumberField
              value={props.messageSize}
              min={10}
              max={48}
              onChange={(v) => update({ messageSize: Math.round(v) })}
            />
          </InspectorField>
          <InspectorField label="Accent from source">
            <Switch
              aria-label="Accent from source"
              checked={props.accentFromSource}
              onChange={(v) => update({ accentFromSource: v })}
            />
          </InspectorField>
          <InspectorField label="Accent override">
            <ColorInput
              value={props.accentOverride}
              onChange={(v) => update({ accentOverride: v })}
            />
          </InspectorField>
          <InspectorField label="Card background">
            <ColorInput value={props.cardBg} onChange={(v) => update({ cardBg: v })} />
          </InspectorField>
          <InspectorField label="Card padding">
            <NumberField
              value={props.cardPadding}
              min={4}
              max={48}
              onChange={(v) => update({ cardPadding: Math.round(v) })}
            />
          </InspectorField>
          <InspectorField label="Card radius">
            <NumberField
              value={props.cardRadius}
              min={0}
              max={32}
              onChange={(v) => update({ cardRadius: Math.round(v) })}
            />
          </InspectorField>
          <InspectorField label="Text shadow">
            <Switch
              aria-label="Text shadow"
              checked={props.textShadow}
              onChange={(v) => update({ textShadow: v })}
            />
          </InspectorField>
        </Stack>
      </Panel>

      {/* 7. Word highlight ---------------------------------------------- */}
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={SECTION_LABEL_STYLE}>Word highlight</span>
          <InspectorField label="Highlight current word">
            <Switch
              aria-label="Highlight current word"
              checked={props.highlightCurrentWord}
              onChange={(v) => update({ highlightCurrentWord: v })}
            />
          </InspectorField>
          <InspectorField label="Highlight color">
            <ColorInput
              value={props.highlightColor}
              onChange={(v) => update({ highlightColor: v })}
            />
          </InspectorField>
        </Stack>
      </Panel>

      {/* 8. Queue & motion ---------------------------------------------- */}
      <Panel tone="nested" padding={3}>
        <Stack gap={2}>
          <span style={SECTION_LABEL_STYLE}>Queue &amp; motion</span>
          <InspectorField label="Display (ms)">
            <NumberField
              value={props.displayMs}
              min={500}
              max={30_000}
              step={100}
              onChange={(v) => update({ displayMs: Math.round(v) })}
            />
          </InspectorField>
          <InspectorField label="Spacing (ms)">
            <NumberField
              value={props.spacingMs}
              min={0}
              max={5000}
              step={50}
              onChange={(v) => update({ spacingMs: Math.round(v) })}
            />
          </InspectorField>
          <InspectorField label="Max queue">
            <NumberField
              value={props.maxQueue}
              min={1}
              max={100}
              onChange={(v) => update({ maxQueue: Math.round(v) })}
            />
          </InspectorField>
          <InspectorField label="Entrance">
            <Select
              value={props.entranceAnim}
              onValueChange={(v) => update({ entranceAnim: v as SpeakAlertProps["entranceAnim"] })}
              options={ENTRANCE_OPTIONS}
              aria-label="Entrance animation"
            />
          </InspectorField>
          <InspectorField label="Exit">
            <Select
              value={props.exitAnim}
              onValueChange={(v) => update({ exitAnim: v as SpeakAlertProps["exitAnim"] })}
              options={EXIT_OPTIONS}
              aria-label="Exit animation"
            />
          </InspectorField>
        </Stack>
      </Panel>
    </Stack>
  );
}
