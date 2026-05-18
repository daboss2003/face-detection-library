import { NativeEventEmitter } from "react-native";
import NativeLivenessDetection from "./NativeLivenessDetection";
import type {
  LivenessChallengeEvent,
  LivenessConfigOptions,
  LivenessFailureEvent,
  LivenessFaceInOvalEvent,
  LivenessResult,
  LivenessSoundOptions,
  LivenessStartOptions,
} from "./NativeLivenessDetection";
export { LivenessWebView } from "./LivenessWebView";
export { LivenessView } from "./LivenessView";
export type { LivenessViewProps } from "./LivenessView";
export {
  LIVENESS_ERROR_CDN_NOT_AVAILABLE,
  LIVENESS_ERROR_OFFLINE,
} from "./NativeLivenessDetection";

const emitter = new NativeEventEmitter(NativeLivenessDetection);

export function startLiveness(options?: LivenessStartOptions): Promise<LivenessResult> {
  return NativeLivenessDetection.startLiveness(options);
}

export function stop(): void {
  NativeLivenessDetection.stop();
}

export function addChallengeChangedListener(
  listener: (event: LivenessChallengeEvent) => void
) {
  return emitter.addListener("challengeChanged", listener);
}

export function addFailureListener(
  listener: (event: LivenessFailureEvent) => void
) {
  return emitter.addListener("failure", listener);
}

export function addFaceInOvalListener(
  listener: (event: LivenessFaceInOvalEvent) => void
) {
  return emitter.addListener("faceInOval", listener);
}

export type {
  LivenessChallengeEvent,
  LivenessConfigOptions,
  LivenessFailureEvent,
  LivenessFaceInOvalEvent,
  LivenessResult,
  LivenessSoundOptions,
  LivenessStartOptions,
};
