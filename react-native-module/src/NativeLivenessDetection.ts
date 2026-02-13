import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export type LivenessChallengeEvent = {
  stepIndex: number;
  stepLabel: string;
};

export type LivenessFailureEvent = {
  reason: string;
};

export type LivenessResult = {
  imageBase64: string;
};

export type LivenessStartOptions = {
  modelUrl?: string;
};

export interface Spec extends TurboModule {
  startLiveness(options?: LivenessStartOptions): Promise<LivenessResult>;
  stop(): void;
  addListener(eventName: "challengeChanged"): void;
  addListener(eventName: "failure"): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>(
  "LivenessDetection"
);
