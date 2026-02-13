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
}
