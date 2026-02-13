export type LivenessCallbacks = {
  onChallengeChanged?: (stepIndex: number, stepLabel: string) => void;
  onFailure?: (reason: string) => void;
  onSuccess?: (imageBase64: string) => void;
};

export type LivenessOptions = {
  videoElement: HTMLVideoElement;
  canvasElement: HTMLCanvasElement;
  modelUrl?: string;
  wasmUrl?: string;
  callbacks?: LivenessCallbacks;
};

export const DEFAULT_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export const DEFAULT_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

type NormalizedLandmark = { x: number; y: number; z: number };

type FaceLandmarkerResult = {
  faceLandmarks: NormalizedLandmark[][];
  facialTransformationMatrixes?: Array<{ data?: number[] | Float32Array } | number[]>;
};

type FaceLandmarker = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => FaceLandmarkerResult;
  close: () => void;
};

type FilesetResolver = {
  forVisionTasks: (wasmUrl: string) => Promise<unknown>;
};

type TasksVisionModule = {
  FaceLandmarker: {
    createFromOptions: (vision: unknown, options: Record<string, unknown>) => Promise<FaceLandmarker>;
  };
  FilesetResolver: FilesetResolver;
};

type LivenessStep = {
  index: number;
  label: string;
};

const steps: LivenessStep[] = [
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

export class LivenessEngine {
  private landmarker: FaceLandmarker | null = null;
  private running = false;
  private rafId: number | null = null;
  private stream: MediaStream | null = null;

  private stepIndex = 0;
  private stepStart = 0;
  private blinkState: "open" | "closed" | "openAgain" = "open";
  private nodState: "down" | "up" = "down";
  private latestMetrics: { yaw: number; pitch: number; ear: number } | null = null;

  constructor(private opts: LivenessOptions) {}

  async start(): Promise<void> {
    this.stop();
    this.running = true;
    this.stepIndex = 0;
    this.stepStart = performance.now();
    this.opts.callbacks?.onChallengeChanged?.(steps[0].index, steps[0].label);

    await this.ensureVideo();
    this.landmarker = await this.createLandmarker();
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  private async ensureVideo(): Promise<void> {
    const video = this.opts.videoElement;
    if (!video.srcObject) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      video.srcObject = this.stream;
    }
    video.playsInline = true;
    await video.play();
  }

  private async createLandmarker(): Promise<FaceLandmarker> {
    const module = await loadTasksVision();
    const vision = await module.FilesetResolver.forVisionTasks(
      this.opts.wasmUrl ?? DEFAULT_WASM_URL
    );
    return module.FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: this.opts.modelUrl ?? DEFAULT_MODEL_URL
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    });
  }

  private loop(): void {
    if (!this.running || !this.landmarker) return;
    const now = performance.now();
    const result = this.landmarker.detectForVideo(this.opts.videoElement, now);
    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const metrics = extractMetrics(result);
      this.latestMetrics = metrics;
      const update = this.updateState(metrics, now);
      if (update === "passed") {
        this.scheduleCapture();
        return;
      }
    }
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  private updateState(metrics: { yaw: number; pitch: number; ear: number; mar: number }, now: number): "passed" | "none" {
    const step = steps[this.stepIndex];
    const elapsed = now - this.stepStart;
    const timeout =
      step.label === "Blink"
        ? config.blinkTimeoutMs
        : step.label === "Open your mouth"
        ? config.mouthTimeoutMs
        : step.label === "Nod your head"
        ? config.nodTimeoutMs
        : config.stepTimeoutMs;

    if (elapsed > timeout) {
      this.fail("Step timeout");
      return "none";
    }

    switch (step.label) {
      case "Turn your head LEFT":
        if (metrics.yaw > config.yawRightThreshold) return this.fail("Wrong direction: turned right");
        if (metrics.yaw < config.yawLeftThreshold) return this.advanceStep(now);
        break;
      case "Blink":
        if (Math.abs(metrics.yaw) > config.maxYawDuringBlink || Math.abs(metrics.pitch) > config.maxPitchDuringBlink) {
          return this.fail("Incorrect motion during blink");
        }
        if (this.blinkState === "open" && metrics.ear > config.blinkOpenThreshold) {
          this.blinkState = "closed";
        } else if (this.blinkState === "closed" && metrics.ear < config.blinkClosedThreshold) {
          this.blinkState = "openAgain";
        } else if (this.blinkState === "openAgain" && metrics.ear > config.blinkOpenThreshold) {
          if (elapsed <= config.blinkMaxDurationMs) return this.advanceStep(now);
          return this.fail("Blink too slow");
        }
        break;
      case "Turn your head RIGHT":
        if (metrics.yaw < config.yawLeftThreshold) return this.fail("Wrong direction: turned left");
        if (metrics.yaw > config.yawRightThreshold) return this.advanceStep(now);
        break;
      case "Nod your head":
        if (Math.abs(metrics.yaw) > config.maxYawDuringNod) return this.fail("Incorrect motion during nod");
        if (this.nodState === "down" && metrics.pitch > config.nodDownThreshold) {
          this.nodState = "up";
        } else if (this.nodState === "up" && metrics.pitch < config.nodUpThreshold) {
          return this.advanceStep(now);
        }
        break;
      case "Open your mouth":
        if (Math.abs(metrics.yaw) > config.maxYawDuringMouth || Math.abs(metrics.pitch) > config.maxPitchDuringMouth) {
          return this.fail("Incorrect motion during mouth step");
        }
        if (metrics.mar > config.mouthOpenThreshold) return this.advanceStep(now);
        break;
    }
    return "none";
  }

  private advanceStep(now: number): "passed" | "none" {
    this.stepIndex += 1;
    if (this.stepIndex >= steps.length) {
      return "passed";
    }
    this.stepStart = now;
    this.blinkState = "open";
    this.nodState = "down";
    const step = steps[this.stepIndex];
    this.opts.callbacks?.onChallengeChanged?.(step.index, step.label);
    return "none";
  }

  private fail(reason: string): "none" {
    this.opts.callbacks?.onFailure?.(reason);
    this.stop();
    return "none";
  }

  private scheduleCapture(): void {
    setTimeout(() => {
      const metrics = this.latestMetrics;
      if (!metrics) {
        this.fail("No face available for capture");
        return;
      }
      if (Math.abs(metrics.yaw) > config.frontalYawThreshold || Math.abs(metrics.pitch) > config.frontalPitchThreshold || metrics.ear < config.blinkOpenThreshold) {
        this.fail("Final check failed (frontal + eyes open required)");
        return;
      }
      const canvas = this.opts.canvasElement;
      const video = this.opts.videoElement;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        this.fail("Canvas unavailable");
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const base64 = dataUrl.split(",")[1] || "";
      this.opts.callbacks?.onSuccess?.(base64);
      this.stop();
    }, config.captureDelayMs);
  }
}

function extractMetrics(result: FaceLandmarkerResult) {
  const landmarks = result.faceLandmarks[0];
  const { yaw, pitch } = extractPose(result, landmarks);
  const { leftEar, rightEar } = computeEar(landmarks);
  const mar = computeMar(landmarks);
  return { yaw, pitch, ear: (leftEar + rightEar) / 2, mar };
}

function extractPose(result: FaceLandmarkerResult, landmarks: NormalizedLandmark[]) {
  const matrices = result.facialTransformationMatrixes;
  const first = Array.isArray(matrices) ? matrices[0] : undefined;
  const data = Array.isArray(first)
    ? first
    : first && "data" in (first as any)
    ? (first as any).data
    : undefined;
  if (data && data.length >= 16) {
    const r00 = data[0];
    const r10 = data[4];
    const r20 = data[8];
    const r21 = data[9];
    const r22 = data[10];
    const pitch = Math.asin(-r20);
    const yaw = Math.atan2(r10, r00);
    const roll = Math.atan2(r21, r22);
    return { yaw: toDeg(yaw), pitch: toDeg(pitch), roll: toDeg(roll) };
  }

  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  const noseTip = landmarks[1];
  const chin = landmarks[152];
  const yaw = Math.atan2(rightEyeOuter.z - leftEyeOuter.z, rightEyeOuter.x - leftEyeOuter.x);
  const roll = Math.atan2(rightEyeOuter.y - leftEyeOuter.y, rightEyeOuter.x - leftEyeOuter.x);
  const pitch = Math.atan2(chin.y - noseTip.y, chin.z - noseTip.z);
  return { yaw: toDeg(yaw), pitch: toDeg(pitch), roll: toDeg(roll) };
}

function computeEar(landmarks: NormalizedLandmark[]) {
  const left = ear(landmarks[33], landmarks[133], landmarks[160], landmarks[158], landmarks[153], landmarks[144]);
  const right = ear(landmarks[362], landmarks[263], landmarks[385], landmarks[387], landmarks[373], landmarks[380]);
  return { leftEar: left, rightEar: right };
}

function computeMar(landmarks: NormalizedLandmark[]) {
  const left = landmarks[61];
  const right = landmarks[291];
  const upper = landmarks[13];
  const lower = landmarks[14];
  const horizontal = distance(left, right);
  const vertical = distance(upper, lower);
  return horizontal === 0 ? 0 : vertical / horizontal;
}

function ear(outer: NormalizedLandmark, inner: NormalizedLandmark, top1: NormalizedLandmark, top2: NormalizedLandmark, bottom1: NormalizedLandmark, bottom2: NormalizedLandmark) {
  const v1 = distance(top1, bottom1);
  const v2 = distance(top2, bottom2);
  const h = distance(outer, inner);
  return h === 0 ? 0 : (v1 + v2) / (2 * h);
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

async function loadTasksVision(): Promise<TasksVisionModule> {
  const module = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest");
  return module as unknown as TasksVisionModule;
}
