import React, { useMemo } from "react";
import { StyleProp, ViewStyle } from "react-native";
import WebView from "react-native-webview";

type ChallengeEvent = { stepIndex: number; stepLabel: string };
type FailureEvent = { reason: string };
type SuccessEvent = { imageBase64: string };
type FaceInOvalEvent = { inside: boolean; reason?: string };

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

type Props = {
  modelUrl?: string;
  wasmUrl?: string;
  /** Version or dist-tag of @daboss2003/liveness-web to load (via jsDelivr). Defaults to "latest". */
  webSdkVersion?: string;
  /** Fully-qualified ESM URL to load the web SDK from. Overrides `webSdkVersion`. */
  webSdkUrl?: string;
  sounds?: LivenessSoundOptions;
  onChallengeChanged?: (event: ChallengeEvent) => void;
  onFaceInOval?: (event: FaceInOvalEvent) => void;
  onFailure?: (event: FailureEvent) => void;
  onLivenessPassed?: (event: SuccessEvent) => void;
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_SDK_VERSION = "latest";

export function LivenessWebView({
  modelUrl,
  wasmUrl,
  webSdkVersion = DEFAULT_SDK_VERSION,
  webSdkUrl,
  sounds,
  onChallengeChanged,
  onFaceInOval,
  onFailure,
  onLivenessPassed,
  style,
}: Props) {
  const html = useMemo(
    () =>
      buildHtml({
        modelUrl,
        wasmUrl,
        sdkUrl:
          webSdkUrl ??
          `https://cdn.jsdelivr.net/npm/@daboss2003/liveness-web@${webSdkVersion}/+esm`,
        sounds,
      }),
    [modelUrl, wasmUrl, webSdkVersion, webSdkUrl, sounds]
  );

  return (
    <WebView
      originWhitelist={["*"]}
      source={{ html, baseUrl: "https://localhost" }}
      javaScriptEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      style={style}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          switch (data.type) {
            case "challengeChanged":
              onChallengeChanged?.(data);
              break;
            case "faceInOval":
              onFaceInOval?.(data);
              break;
            case "failure":
              onFailure?.(data);
              break;
            case "livenessPassed":
              onLivenessPassed?.(data);
              break;
          }
        } catch {
          // ignore
        }
      }}
    />
  );
}

function buildHtml({
  modelUrl,
  wasmUrl,
  sdkUrl,
  sounds,
}: {
  modelUrl?: string;
  wasmUrl?: string;
  sdkUrl: string;
  sounds?: LivenessSoundOptions;
}) {
  const startOptions = {
    modelUrl,
    wasmUrl,
    sounds,
  };

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
    </style>
  </head>
  <body>
    <script type="module">
      const post = (payload) => {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      };

      try {
        const mod = await import(${JSON.stringify(sdkUrl)});
        const opts = ${JSON.stringify(startOptions)};
        mod.startLiveness({
          ...opts,
          callbacks: {
            onChallengeChanged: (stepIndex, stepLabel) =>
              post({ type: "challengeChanged", stepIndex, stepLabel }),
            onFaceInOval: (inside, reason) =>
              post({ type: "faceInOval", inside, reason }),
            onSuccess: (imageBase64) =>
              post({ type: "livenessPassed", imageBase64 }),
            onFailure: (reason) =>
              post({ type: "failure", reason }),
          },
        });
      } catch (err) {
        post({ type: "failure", reason: (err && err.message) || String(err) });
      }
    </script>
  </body>
</html>`;
}
