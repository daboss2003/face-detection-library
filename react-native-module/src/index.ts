import { NativeEventEmitter } from "react-native";
import NativeLivenessDetection from "./NativeLivenessDetection";
import type { LivenessChallengeEvent, LivenessFailureEvent, LivenessResult } from "./NativeLivenessDetection";

const emitter = new NativeEventEmitter(NativeLivenessDetection);

export function startLiveness(): Promise<LivenessResult> {
  return NativeLivenessDetection.startLiveness();
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
