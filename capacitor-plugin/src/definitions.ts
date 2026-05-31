export type LivenessChallengeEvent = {
  stepIndex: number;
  stepLabel: string;
};

export type LivenessFailureEvent = {
  reason: string;
};

/** Identifier for a liveness challenge step. */
export type LivenessStepKey = "left" | "blink" | "right" | "nod" | "mouth";

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
  /** Subset of challenges to run, e.g. `["nod", "blink", "mouth"]`. Default: all 5. Empty/invalid → falls back to all 5. */
  steps?: LivenessStepKey[];
  cdnMaxRetries?: number;
  cdnAttemptTimeoutMs?: number;
  connectivityCheckTimeoutMs?: number;

  // ── UI: shape, theme, layout (mirrors @daboss2003/liveness-web options) ─
  /** "oval" (default) or "circle". Capacitor renders the camera fullscreen over the WebView. */
  shape?: "oval" | "circle";
  /** When false, SDK-rendered instruction text, position hint, gesture icon and step dots are hidden. Sounds still play. */
  showInstructions?: boolean;
  /** Minimum diameter (dp on Android, pt on iOS) of the visible face frame. */
  minSize?: number;
  /** Ring stroke colour while face is in position. CSS-style hex e.g. "#12c95c" or "#FF12c95c". */
  progressColor?: string;
  progressErrorColor?: string;
  progressWidth?: number;
  progressLineCap?: "round" | "square" | "butt";
  overlayColor?: string;
  overlayErrorColor?: string;
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

export interface LivenessPlugin {
  startLiveness(options?: LivenessStartOptions): Promise<LivenessResult>;
  stop(): Promise<void>;
  addListener(
    eventName: "challengeChanged",
    listenerFunc: (event: LivenessChallengeEvent) => void
  ): Promise<void>;
  addListener(
    eventName: "failure",
    listenerFunc: (event: LivenessFailureEvent) => void
  ): Promise<void>;
  addListener(
    eventName: "faceInOval",
    listenerFunc: (event: LivenessFaceInOvalEvent) => void
  ): Promise<void>;
}
