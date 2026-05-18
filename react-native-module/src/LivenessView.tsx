import React from "react";
import {
  NativeSyntheticEvent,
  StyleProp,
  ViewStyle,
  requireNativeComponent,
} from "react-native";
import type {
  LivenessChallengeEvent,
  LivenessConfigOptions,
  LivenessFaceInOvalEvent,
  LivenessSoundOptions,
} from "./NativeLivenessDetection";

type SuccessEvent  = { imageBase64: string };
type FailureEvent  = { reason: string };

type NativeProps = {
  config?: LivenessConfigOptions;
  sounds?: LivenessSoundOptions;
  modelUrl?: string;
  started?: boolean;
  onChallengeChanged?: (event: NativeSyntheticEvent<LivenessChallengeEvent>) => void;
  onFaceInOval?:       (event: NativeSyntheticEvent<LivenessFaceInOvalEvent>) => void;
  onLivenessPassed?:   (event: NativeSyntheticEvent<SuccessEvent>) => void;
  onLivenessFailure?:  (event: NativeSyntheticEvent<FailureEvent>) => void;
  style?: StyleProp<ViewStyle>;
};

const NativeLivenessView = requireNativeComponent<NativeProps>("LivenessNativeView");

export type LivenessViewProps = {
  /** Mount the view, then set `started: true` to begin. Camera permission must already be granted. */
  started?: boolean;
  config?: LivenessConfigOptions;
  sounds?: LivenessSoundOptions;
  modelUrl?: string;
  onChallengeChanged?: (event: LivenessChallengeEvent) => void;
  onFaceInOval?: (event: LivenessFaceInOvalEvent) => void;
  onSuccess?: (imageBase64: string) => void;
  onFailure?: (reason: string) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Embeddable native liveness camera. Drop into your JSX inside a sized container
 * (e.g. a circular slot) and the SDK will render its face frame + progress ring
 * inside the view's bounds.
 *
 * Set `config.showInstructions = false` to have the host own all text and step
 * indicators (drive them from the callbacks).
 */
export function LivenessView({
  started,
  config,
  sounds,
  modelUrl,
  onChallengeChanged,
  onFaceInOval,
  onSuccess,
  onFailure,
  style,
}: LivenessViewProps) {
  return (
    <NativeLivenessView
      started={started}
      config={config}
      sounds={sounds}
      modelUrl={modelUrl}
      style={style}
      onChallengeChanged={(e) => onChallengeChanged?.(e.nativeEvent)}
      onFaceInOval={(e) => onFaceInOval?.(e.nativeEvent)}
      onLivenessPassed={(e) => onSuccess?.(e.nativeEvent.imageBase64)}
      onLivenessFailure={(e) => onFailure?.(e.nativeEvent.reason)}
    />
  );
}
