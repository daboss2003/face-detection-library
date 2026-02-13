import React, { useMemo } from "react";
import { StyleProp, ViewStyle } from "react-native";
import WebView from "react-native-webview";

type ChallengeEvent = { stepIndex: number; stepLabel: string };
type FailureEvent = { reason: string };
type SuccessEvent = { imageBase64: string };

type Props = {
  modelUrl?: string;
  onChallengeChanged?: (event: ChallengeEvent) => void;
  onFailure?: (event: FailureEvent) => void;
  onLivenessPassed?: (event: SuccessEvent) => void;
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const DEFAULT_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

export function LivenessWebView({
  modelUrl = DEFAULT_MODEL_URL,
  onChallengeChanged,
  onFailure,
  onLivenessPassed,
  style
}: Props) {
  const html = useMemo(() => buildHtml(modelUrl), [modelUrl]);

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
          if (data.type === "challengeChanged") onChallengeChanged?.(data);
          if (data.type === "failure") onFailure?.(data);
          if (data.type === "livenessPassed") onLivenessPassed?.(data);
        } catch {
          // ignore
        }
      }}
    />
  );
}

function buildHtml(modelUrl: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; }
      #video { width: 100%; height: 100%; object-fit: cover; }
      #overlay {
        position: fixed; top: 0; left: 0; right: 0;
        padding: 12px; color: #fff; background: rgba(0,0,0,0.4);
        font-family: -apple-system, sans-serif; font-size: 18px; text-align: center;
      }
      #status {
        position: fixed; bottom: 0; left: 0; right: 0;
        padding: 10px; color: #fff; background: rgba(0,0,0,0.4);
        font-family: -apple-system, sans-serif; font-size: 14px; text-align: center;
      }
    </style>
  </head>
  <body>
    <video id="video" autoplay playsinline></video>
    <canvas id="canvas" style="display:none"></canvas>
    <div id="overlay">Starting…</div>
    <div id="status">Initializing…</div>
    <script type="module">
      const MODEL_URL = ${JSON.stringify(modelUrl)};
      const WASM_URL = ${JSON.stringify(DEFAULT_WASM_URL)};
      const overlay = document.getElementById("overlay");
      const status = document.getElementById("status");
      const video = document.getElementById("video");
      const canvas = document.getElementById("canvas");

      const steps = [
        { index: 0, label: "Turn your head LEFT" },
        { index: 1, label: "Blink" },
        { index: 2, label: "Turn your head RIGHT" },
        { index: 3, label: "Nod your head" },
        { index: 4, label: "Open your mouth" }
      ];

      const config = {
        yawLeftThreshold: -15,
        yawRightThreshold: 15,
        frontalYawThreshold: 10,
        frontalPitchThreshold: 10,
        blinkOpenThreshold: 0.25,
        blinkClosedThreshold: 0.18,
        blinkMaxDurationMs: 1000,
        blinkTimeoutMs: 5000,
        stepTimeoutMs: 10000,
        mouthTimeoutMs: 5000,
        mouthOpenThreshold: 0.35,
        nodDownThreshold: 15,
        nodUpThreshold: -5,
        nodTimeoutMs: 10000,
        maxYawDuringBlink: 20,
        maxPitchDuringBlink: 20,
        maxYawDuringNod: 20,
        maxYawDuringMouth: 20,
        maxPitchDuringMouth: 20,
        captureDelayMs: 400
      };

      let landmarker = null;
      let rafId = null;
      let stepIndex = 0;
      let stepStart = 0;
      let blinkState = "open";
      let nodState = "down";
      let latestMetrics = null;

      function post(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function updateStep() {
        overlay.textContent = steps[stepIndex].label;
        post({ type: "challengeChanged", stepIndex: steps[stepIndex].index, stepLabel: steps[stepIndex].label });
      }

      function fail(reason) {
        status.textContent = reason;
        post({ type: "failure", reason });
        stop();
      }

      function stop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        if (landmarker) { landmarker.close(); landmarker = null; }
        if (video.srcObject) {
          video.srcObject.getTracks().forEach(t => t.stop());
          video.srcObject = null;
        }
      }

      function distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
      }

      function ear(outer, inner, top1, top2, bottom1, bottom2) {
        const v1 = distance(top1, bottom1);
        const v2 = distance(top2, bottom2);
        const h = distance(outer, inner);
        return h === 0 ? 0 : (v1 + v2) / (2 * h);
      }

      function computeEar(landmarks) {
        const left = ear(landmarks[33], landmarks[133], landmarks[160], landmarks[158], landmarks[153], landmarks[144]);
        const right = ear(landmarks[362], landmarks[263], landmarks[385], landmarks[387], landmarks[373], landmarks[380]);
        return (left + right) / 2;
      }

      function computeMar(landmarks) {
        const left = landmarks[61];
        const right = landmarks[291];
        const upper = landmarks[13];
        const lower = landmarks[14];
        const horizontal = distance(left, right);
        const vertical = distance(upper, lower);
        return horizontal === 0 ? 0 : vertical / horizontal;
      }

      function extractPose(result, landmarks) {
        const matrices = result.facialTransformationMatrixes;
        const first = Array.isArray(matrices) ? matrices[0] : undefined;
        const data = Array.isArray(first) ? first : (first && first.data ? first.data : undefined);
        if (data && data.length >= 16) {
          const r00 = data[0];
          const r10 = data[4];
          const r20 = data[8];
          const r21 = data[9];
          const r22 = data[10];
          const pitch = Math.asin(-r20);
          const yaw = Math.atan2(r10, r00);
          return { yaw: yaw * 180 / Math.PI, pitch: pitch * 180 / Math.PI };
        }
        const leftEyeOuter = landmarks[33];
        const rightEyeOuter = landmarks[263];
        const noseTip = landmarks[1];
        const chin = landmarks[152];
        const yaw = Math.atan2(rightEyeOuter.z - leftEyeOuter.z, rightEyeOuter.x - leftEyeOuter.x);
        const pitch = Math.atan2(chin.y - noseTip.y, chin.z - noseTip.z);
        return { yaw: yaw * 180 / Math.PI, pitch: pitch * 180 / Math.PI };
      }

      function advanceStep(now) {
        stepIndex += 1;
        if (stepIndex >= steps.length) return "passed";
        stepStart = now;
        blinkState = "open";
        nodState = "down";
        updateStep();
        return "none";
      }

      function updateState(metrics, now) {
        const step = steps[stepIndex];
        const elapsed = now - stepStart;
        const timeout = step.label === "Blink"
          ? config.blinkTimeoutMs
          : step.label === "Open your mouth"
          ? config.mouthTimeoutMs
          : step.label === "Nod your head"
          ? config.nodTimeoutMs
          : config.stepTimeoutMs;

        if (elapsed > timeout) { fail("Step timeout"); return "none"; }

        switch (step.label) {
          case "Turn your head LEFT":
            if (metrics.yaw > config.yawRightThreshold) return fail("Wrong direction: turned right");
            if (metrics.yaw < config.yawLeftThreshold) return advanceStep(now);
            break;
          case "Blink":
            if (Math.abs(metrics.yaw) > config.maxYawDuringBlink || Math.abs(metrics.pitch) > config.maxPitchDuringBlink) {
              return fail("Incorrect motion during blink");
            }
            if (blinkState === "open" && metrics.ear > config.blinkOpenThreshold) {
              blinkState = "closed";
            } else if (blinkState === "closed" && metrics.ear < config.blinkClosedThreshold) {
              blinkState = "openAgain";
            } else if (blinkState === "openAgain" && metrics.ear > config.blinkOpenThreshold) {
              if (elapsed <= config.blinkMaxDurationMs) return advanceStep(now);
              return fail("Blink too slow");
            }
            break;
          case "Turn your head RIGHT":
            if (metrics.yaw < config.yawLeftThreshold) return fail("Wrong direction: turned left");
            if (metrics.yaw > config.yawRightThreshold) return advanceStep(now);
            break;
          case "Nod your head":
            if (Math.abs(metrics.yaw) > config.maxYawDuringNod) return fail("Incorrect motion during nod");
            if (nodState === "down" && metrics.pitch > config.nodDownThreshold) nodState = "up";
            else if (nodState === "up" && metrics.pitch < config.nodUpThreshold) return advanceStep(now);
            break;
          case "Open your mouth":
            if (Math.abs(metrics.yaw) > config.maxYawDuringMouth || Math.abs(metrics.pitch) > config.maxPitchDuringMouth) {
              return fail("Incorrect motion during mouth step");
            }
            if (metrics.mar > config.mouthOpenThreshold) return advanceStep(now);
            break;
        }
        return "none";
      }

      function scheduleCapture() {
        setTimeout(() => {
          if (!latestMetrics) return fail("No face available for capture");
          if (Math.abs(latestMetrics.yaw) > config.frontalYawThreshold ||
              Math.abs(latestMetrics.pitch) > config.frontalPitchThreshold ||
              latestMetrics.ear < config.blinkOpenThreshold) {
            return fail("Final check failed (frontal + eyes open required)");
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL("image/jpeg", 0.95).split(",")[1] || "";
          post({ type: "livenessPassed", imageBase64: base64 });
          stop();
        }, config.captureDelayMs);
      }

      async function setup() {
        status.textContent = "Requesting camera...";
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        video.srcObject = stream;
        await video.play();
        status.textContent = "Loading model...";

        const tasksVision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest");
        const vision = await tasksVision.FilesetResolver.forVisionTasks(WASM_URL);
        landmarker = await tasksVision.FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true
        });

        stepIndex = 0;
        stepStart = performance.now();
        updateStep();
        status.textContent = "Running...";
        loop();
      }

      function loop() {
        const now = performance.now();
        const result = landmarker.detectForVideo(video, now);
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
          const landmarks = result.faceLandmarks[0];
          const earVal = computeEar(landmarks);
          const marVal = computeMar(landmarks);
          const pose = extractPose(result, landmarks);
          latestMetrics = { yaw: pose.yaw, pitch: pose.pitch, ear: earVal, mar: marVal };
          const update = updateState(latestMetrics, now);
          if (update === "passed") {
            scheduleCapture();
            return;
          }
        }
        rafId = requestAnimationFrame(loop);
      }

      setup().catch((err) => {
        status.textContent = "Error: " + err.message;
        post({ type: "failure", reason: err.message });
      });
    </script>
  </body>
</html>`;
}
