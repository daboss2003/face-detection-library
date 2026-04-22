import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export type LivenessChallengeEvent = {
  stepIndex: number;
  stepLabel: string;
};

export type LivenessFailureEvent = {
  reason: string;
};

export type LivenessFaceInOvalEvent = {
  inside: boolean;
  reason?: string;
};

export type LivenessResult = {
  imageBase64: string;
};

/** Per-key sound overrides, or a baseUrl the SDK joins with `${key}.mp3`. Matches web SDK. */
export type LivenessSoundOptions = {
  baseUrl?: string;
  left?: string;
  blink?: string;
  right?: string;
  nod?: string;
  mouth?: string;
  good?: string;
  capture?: string;
};

/** Tunable thresholds. All fields optional — omit to use SDK defaults (matching web SDK). */
export type LivenessConfigOptions = {
  readyMs?: number;
  sessionTimeoutMs?: number;
  baselineFrames?: number;
  yawTurnDelta?: number;
  yawWrongDirDelta?: number;
  headTurnHoldMs?: number;
  nodDownDelta?: number;
  nodReturnFraction?: number;
  nodReturnMaxDelta?: number;
  blinkClosedThreshold?: number;
  blinkOpenThreshold?: number;
  earClosedThreshold?: number;
  earOpenThreshold?: number;
  blinkMaxDurationMs?: number;
  mouthOpenThreshold?: number;
  mouthOpenMarThreshold?: number;
  mouthHoldMs?: number;
  maxYawDuringBlink?: number;
  maxPitchDuringBlink?: number;
  maxYawDuringNod?: number;
  maxYawDuringMouth?: number;
  maxPitchDuringMouth?: number;
  ovalCx?: number;
  ovalCy?: number;
  ovalRx?: number;
  ovalRy?: number;
  minFaceSize?: number;
  maxFaceSize?: number;
  captureDelayMs?: number;
  captureMaxAttempts?: number;
  captureMaxYaw?: number;
  captureMaxPitch?: number;
  captureMaxMouthScore?: number;
  captureMaxBlinkScore?: number;
  captureMinEar?: number;
  captureMaxMar?: number;
  shuffleSteps?: boolean;
  cdnMaxRetries?: number;
  cdnAttemptTimeoutMs?: number;
  connectivityCheckTimeoutMs?: number;
};

export type LivenessStartOptions = {
  modelUrl?: string;
  /** Deprecated — use `sounds.baseUrl`. Kept for backwards compatibility. */
  soundBaseUrl?: string;
  sounds?: LivenessSoundOptions;
  config?: LivenessConfigOptions;
};

/** Reasons surfaced via `failure` / promise rejection when model/CDN fails. Matches web SDK. */
export const LIVENESS_ERROR_CDN_NOT_AVAILABLE = "cdnNotAvailable";
export const LIVENESS_ERROR_OFFLINE = "offline";

export interface Spec extends TurboModule {
  startLiveness(options?: LivenessStartOptions): Promise<LivenessResult>;
  stop(): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>(
  "LivenessDetection"
);
