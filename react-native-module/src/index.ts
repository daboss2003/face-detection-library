import { NativeEventEmitter } from "react-native";
import NativeLivenessDetection from "./NativeLivenessDetection";
import type { LivenessChallengeEvent, LivenessFailureEvent, LivenessResult, LivenessStartOptions } from "./NativeLivenessDetection";
export { LivenessWebView } from "./LivenessWebView";

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

export type { LivenessChallengeEvent, LivenessFailureEvent, LivenessResult };
