import { LivenessEngine } from "./engine";
import { startLivenessWithUI } from "./ui";

export type { StartLivenessOptions, LivenessTheme } from "./ui";
export {
  DEFAULT_MODEL_URL,
  DEFAULT_WASM_URL,
  LIVENESS_ERROR_CDN_NOT_AVAILABLE,
  LIVENESS_ERROR_OFFLINE,
  LIVENESS_STEP_COUNT,
  isCdnNotAvailableError,
  isOfflineError,
  LivenessError,
} from "./engine";
export type { LivenessCallbacks, LivenessOptions, LivenessSoundOptions } from "./engine";
export type { LivenessEngine } from "./engine";

let currentEngine: LivenessEngine | null = null;

/**
 * Starts liveness verification with built-in UI (oval frame, progress ring, camera).
 * Runs until the user completes all steps or a hard error occurs. Callbacks only.
 */
export function startLiveness(options: import("./ui").StartLivenessOptions): LivenessEngine {
  if (currentEngine) {
    currentEngine.stop();
    currentEngine = null;
  }
  const engine = startLivenessWithUI(options);
  currentEngine = engine;
  return engine;
}

/** Stops the current liveness session and releases the camera. */
export function stop(): void {
  currentEngine?.stop();
  currentEngine = null;
}
