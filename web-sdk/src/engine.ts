export type LivenessCallbacks = {
  onChallengeChanged?: (stepIndex: number, stepLabel: string) => void;
  onFailure?: (reason: string) => void;
  onSuccess?: (imageBase64: string) => void;
  /**
   * Called when face enters/leaves the oval, with a human-readable reason
   * when outside so the UI can give specific guidance.
   * reason is undefined when inside === true.
   */
  onFaceInOval?: (inside: boolean, reason?: string) => void;
  /** Per-frame debug hook */
  onDebugFrame?: (info: { hasFace: boolean; metrics: Metrics | null; step: string }) => void;
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
type BlendshapeCategory  = { categoryName: string; score: number };

type FaceLandmarkerResult = {
  faceLandmarks: NormalizedLandmark[][];
  facialTransformationMatrixes?: Array<{ data?: number[] | Float32Array } | number[]>;
  faceBlendshapes?: Array<{ categories: BlendshapeCategory[] }>;
};

type FaceLandmarker = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => FaceLandmarkerResult;
  close: () => void;
};

type FilesetResolver  = { forVisionTasks: (wasmUrl: string) => Promise<unknown> };
type TasksVisionModule = {
  FaceLandmarker: {
    createFromOptions: (vision: unknown, options: Record<string, unknown>) => Promise<FaceLandmarker>;
  };
  FilesetResolver: FilesetResolver;
};

type LivenessStep = { index: number; label: string };

export type Metrics = {
  yaw: number;
  pitch: number;
  ear: number;
  mar: number;
  blinkScore: number;
  mouthScore: number;
  faceCx: number;   // raw (unmirrored) normalised x centre [0,1]
  faceCy: number;   // normalised y centre [0,1]
  faceSize: number; // inter-eye distance / video width
};

const steps: LivenessStep[] = [
  { index: 0, label: "Turn your head LEFT"  },
  { index: 1, label: "Blink"                },
  { index: 2, label: "Turn your head RIGHT" },
  { index: 3, label: "Nod your head"        },
  { index: 4, label: "Open your mouth"      },
];

export const LIVENESS_STEP_COUNT = steps.length;

const config = {
  readyMs: 2000,

  // ── Head turn ──────────────────────────────────────────────────────────────
  yawLeftThreshold:      -18,
  yawRightThreshold:        18,
  wrongDirectionDeadband: 28,
  holdMs: 250,

  // ── Frontal capture guard ──────────────────────────────────────────────────
  frontalYawThreshold:   15,
  frontalPitchThreshold: 15,

  // ── Blink ──────────────────────────────────────────────────────────────────
  blinkClosedThreshold: 0.40,
  blinkOpenThreshold:   0.15,
  earClosedThreshold:   0.18,
  earOpenThreshold:     0.23,
  blinkMaxDurationMs:   3000,
  maxYawDuringBlink:    20,
  maxPitchDuringBlink:  20,

  // ── Mouth ──────────────────────────────────────────────────────────────────
  mouthOpenBlendshapeThreshold: 0.35,
  mouthOpenMarThreshold:        0.30,
  maxYawDuringMouth:  20,
  maxPitchDuringMouth: 20,

  // ── Nod ───────────────────────────────────────────────────────────────────
  nodDownThreshold: 14,
  nodUpThreshold:   -3,
  maxYawDuringNod:  20,

  // ── Face-in-oval ───────────────────────────────────────────────────────────
  /**
   * The oval is centred at 50% x, 40% y of the **video** frame.
   * These are in normalised [0,1] video coordinates (not screen pixels).
   *
   * NOTE: the video is CSS-mirrored for display. MediaPipe gives raw
   * (unmirrored) coords. We flip x before the ellipse test.
   *
   * The rx/ry values are intentionally relaxed (larger than the visual oval)
   * so the check doesn't block users who are slightly off-centre. The visual
   * oval in the UI is just a guide — we don't need pixel-perfect alignment.
   */
  ovalCx: 0.50,
  ovalCy: 0.42,   // slightly below centre — faces tend to sit a bit lower
  ovalRx: 0.30,   // relaxed from 0.24 — was blocking valid faces
  ovalRy: 0.38,   // relaxed from 0.32

  /**
   * Face size = inter-eye distance / video width.
   * Comfortable desktop: 0.15–0.50
   * Mobile portrait:     0.20–0.55
   * Use a wide range so we don't fail on different camera distances.
   */
  minFaceSize: 0.12,
  maxFaceSize: 0.58,

  /**
   * Steps where the head turns away from centre — oval containment is
   * relaxed for x-axis during these steps because the face SHOULD drift.
   */
  headTurnSteps: new Set(["Turn your head LEFT", "Turn your head RIGHT"]),

  // ── Capture ───────────────────────────────────────────────────────────────
  captureDelayMs:      500,
  captureMaxAttempts:   90,
};

export class LivenessEngine {
  private landmarker:  FaceLandmarker | null = null;
  private running      = false;
  private rafId:       number | null = null;
  private stream:      MediaStream | null = null;

  private stepIndex  = 0;
  private stepStart  = 0;

  private blinkState:   "open" | "closed" = "open";
  private blinkCloseTs  = 0;
  private nodState:     "neutral" | "down" = "neutral";
  private holdStart:    number | null = null;

  private latestMetrics: Metrics | null = null;
  private lastDetectTs   = -1;
  private lastOvalState: boolean | null = null;

  constructor(private opts: LivenessOptions) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.stopDetectionOnly();
    this.running       = true;
    this.stepIndex     = 0;
    this.lastDetectTs  = -1;
    this.lastOvalState = null;
    const now = performance.now();
    this.stepStart = now + config.readyMs;
    this.resetStepState();
    this.opts.callbacks?.onChallengeChanged?.(steps[0].index, steps[0].label);
    await this.ensureVideo();
    this.landmarker = await this.createLandmarker();
    this.loop();
  }

  stop(): void {
    this.stopDetectionOnly();
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  private stopDetectionOnly(): void {
    this.running = false;
    if (this.rafId != null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.landmarker)    { this.landmarker.close(); this.landmarker = null; }
  }

  // ── Video ──────────────────────────────────────────────────────────────────

  private async ensureVideo(): Promise<void> {
    const video = this.opts.videoElement;
    if (!video.srcObject) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      video.srcObject = this.stream;
    } else {
      this.stream = video.srcObject as MediaStream;
    }
    video.playsInline = true;
    await video.play();
    await this.waitForVideoReady(video);
  }

  private waitForVideoReady(video: HTMLVideoElement): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });
  }

  // ── Landmarker ─────────────────────────────────────────────────────────────

  private async createLandmarker(): Promise<FaceLandmarker> {
    const module = await loadTasksVision();
    const vision = await module.FilesetResolver.forVisionTasks(this.opts.wasmUrl ?? DEFAULT_WASM_URL);
    return module.FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: this.opts.modelUrl ?? DEFAULT_MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  }

  // ── Detection loop ─────────────────────────────────────────────────────────

  private loop(): void {
    if (!this.running || !this.landmarker) return;

    const now = performance.now();
    const ts  = now > this.lastDetectTs ? now : this.lastDetectTs + 1;
    this.lastDetectTs = ts;

    const result  = this.landmarker.detectForVideo(this.opts.videoElement, ts);
    const hasFace = !!(result.faceLandmarks?.length);

    if (hasFace) {
      const metrics = extractMetrics(result);
      this.latestMetrics = metrics;

      const { inside, reason } = this.checkFaceInOval(metrics);

      // Only fire callback on change to avoid flooding the UI
      if (inside !== this.lastOvalState) {
        this.lastOvalState = inside;
        this.opts.callbacks?.onFaceInOval?.(inside, reason);
      }

      this.opts.callbacks?.onDebugFrame?.({
        hasFace: true,
        metrics,
        step: steps[this.stepIndex]?.label ?? "done",
      });

      if (inside && this.updateState(metrics, now) === "passed") {
        this.scheduleCapture();
        return;
      }
    } else {
      if (this.lastOvalState !== false) {
        this.lastOvalState = false;
        this.opts.callbacks?.onFaceInOval?.(false, "No face detected");
      }
      this.opts.callbacks?.onDebugFrame?.({ hasFace: false, metrics: null, step: steps[this.stepIndex]?.label ?? "done" });
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  }

  // ── Oval check ─────────────────────────────────────────────────────────────

  private checkFaceInOval(m: Metrics): { inside: boolean; reason?: string } {
    const currentStep = steps[this.stepIndex]?.label ?? "";
    const isHeadTurn  = config.headTurnSteps.has(currentStep);

    // Mirror x — video is CSS scaleX(-1), MediaPipe gives raw unmirrored coords
    const mx = 1 - m.faceCx;
    const my = m.faceCy;

    const dx = (mx - config.ovalCx) / config.ovalRx;
    const dy = (my - config.ovalCy) / config.ovalRy;

    // During head-turn steps, only check the y-axis and size —
    // the face WILL move horizontally as the head turns.
    const inEllipse = isHeadTurn
      ? Math.abs(dy) <= 1           // only vertical check
      : dx * dx + dy * dy <= 1;    // full ellipse check

    if (!inEllipse) {
      const xDrift = mx - config.ovalCx;
      const yDrift = my - config.ovalCy;
      if (Math.abs(yDrift) > Math.abs(xDrift)) {
        return { inside: false, reason: yDrift < 0 ? "Move down" : "Move up" };
      }
      return { inside: false, reason: xDrift < 0 ? "Move right" : "Move left" };
    }

    if (m.faceSize < config.minFaceSize) return { inside: false, reason: "Move closer to the camera" };
    if (m.faceSize > config.maxFaceSize) return { inside: false, reason: "Move further from the camera" };

    return { inside: true };
  }

  // ── State machine ──────────────────────────────────────────────────────────

  private resetStepState(): void {
    this.blinkState  = "open";
    this.blinkCloseTs = 0;
    this.nodState    = "neutral";
    this.holdStart   = null;
  }

  private updateState(metrics: Metrics, now: number): "passed" | "none" {
    if (now - this.stepStart < 0) return "none";

    switch (steps[this.stepIndex].label) {

      case "Turn your head LEFT": {
        if (metrics.yaw > config.wrongDirectionDeadband) { this.holdStart = null; return "none"; }
        if (metrics.yaw < config.yawLeftThreshold) {
          if (this.holdStart === null) this.holdStart = now;
          if (now - this.holdStart >= config.holdMs) return this.advanceStep(now);
        } else {
          this.holdStart = null;
        }
        break;
      }

      case "Turn your head RIGHT": {
        if (metrics.yaw < -config.wrongDirectionDeadband) { this.holdStart = null; return "none"; }
        if (metrics.yaw > config.yawRightThreshold) {
          if (this.holdStart === null) this.holdStart = now;
          if (now - this.holdStart >= config.holdMs) return this.advanceStep(now);
        } else {
          this.holdStart = null;
        }
        break;
      }

      case "Blink": {
        if (Math.abs(metrics.yaw) > config.maxYawDuringBlink ||
            Math.abs(metrics.pitch) > config.maxPitchDuringBlink) return "none";

        const eyesClosed = metrics.blinkScore > 0
          ? metrics.blinkScore > config.blinkClosedThreshold
          : metrics.ear < config.earClosedThreshold;

        const eyesOpen = metrics.blinkScore > 0
          ? metrics.blinkScore < config.blinkOpenThreshold
          : metrics.ear > config.earOpenThreshold;

        if (this.blinkState === "open" && eyesClosed) {
          this.blinkState  = "closed";
          this.blinkCloseTs = now;
        } else if (this.blinkState === "closed" && eyesOpen) {
          if (now - this.blinkCloseTs <= config.blinkMaxDurationMs) return this.advanceStep(now);
          this.blinkState = "open"; // too slow — reset sub-state only
        }
        break;
      }

      case "Nod your head": {
        if (Math.abs(metrics.yaw) > config.maxYawDuringNod) return "none";
        if (this.nodState === "neutral" && metrics.pitch > config.nodDownThreshold) {
          this.nodState = "down";
        } else if (this.nodState === "down" && metrics.pitch < config.nodUpThreshold) {
          return this.advanceStep(now);
        }
        break;
      }

      case "Open your mouth": {
        if (Math.abs(metrics.yaw)   > config.maxYawDuringMouth ||
            Math.abs(metrics.pitch) > config.maxPitchDuringMouth) return "none";

        const mouthIsOpen = metrics.mouthScore > 0
          ? metrics.mouthScore > config.mouthOpenBlendshapeThreshold
          : metrics.mar > config.mouthOpenMarThreshold;

        if (mouthIsOpen) {
          if (this.holdStart === null) this.holdStart = now;
          if (now - this.holdStart >= config.holdMs) return this.advanceStep(now);
        } else {
          this.holdStart = null;
        }
        break;
      }
    }

    return "none";
  }

  private advanceStep(now: number): "passed" | "none" {
    this.stepIndex += 1;
    if (this.stepIndex >= steps.length) return "passed";
    this.stepStart = now + config.readyMs;
    this.resetStepState();
    const step = steps[this.stepIndex];
    this.opts.callbacks?.onChallengeChanged?.(step.index, step.label);
    return "none";
  }

  private fail(reason: string): void {
    this.opts.callbacks?.onFailure?.(reason);
    this.stopDetectionOnly();
  }

  // ── Capture ────────────────────────────────────────────────────────────────

  private scheduleCapture(): void {
    let attempts = 0;

    const tryCapture = () => {
      if (!this.running || !this.landmarker) return;
      attempts++;

      const now = performance.now();
      const ts  = now > this.lastDetectTs ? now : this.lastDetectTs + 1;
      this.lastDetectTs = ts;

      const result = this.landmarker.detectForVideo(this.opts.videoElement, ts);
      if (result.faceLandmarks?.length) {
        const metrics = extractMetrics(result);
        this.latestMetrics = metrics;

        const eyesOpen = metrics.blinkScore > 0
          ? metrics.blinkScore < config.blinkOpenThreshold
          : metrics.ear > config.earOpenThreshold;

        if (Math.abs(metrics.yaw)   <= config.frontalYawThreshold &&
            Math.abs(metrics.pitch) <= config.frontalPitchThreshold &&
            eyesOpen) {
          this.captureImage();
          return;
        }
      }

      if (attempts >= config.captureMaxAttempts) {
        this.fail("Please look straight at the camera to complete verification.");
        return;
      }

      this.rafId = requestAnimationFrame(tryCapture);
    };

    setTimeout(() => { this.rafId = requestAnimationFrame(tryCapture); }, config.captureDelayMs);
  }

  private captureImage(): void {
    const canvas = this.opts.canvasElement;
    const video  = this.opts.videoElement;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { this.fail("Canvas unavailable"); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.95).split(",")[1] ?? "";
    this.opts.callbacks?.onSuccess?.(base64);
    this.stop();
  }
}

// ── Metric extraction ────────────────────────────────────────────────────────

function extractMetrics(result: FaceLandmarkerResult): Metrics {
  const landmarks  = result.faceLandmarks[0];
  const { yaw, pitch } = extractPose(result, landmarks);
  const { leftEar, rightEar } = computeEar(landmarks);
  const mar = computeMar(landmarks);

  const categories = result.faceBlendshapes?.[0]?.categories ?? [];
  const getBS = (name: string): number =>
    categories.find(c => c.categoryName === name)?.score ?? 0;

  const blinkL = getBS("eyeBlinkLeft"), blinkR = getBS("eyeBlinkRight");
  const blinkScore = blinkL > 0 || blinkR > 0 ? (blinkL + blinkR) / 2 : 0;
  const mouthScore = getBS("jawOpen");

  let sumX = 0, sumY = 0;
  for (const lm of landmarks) { sumX += lm.x; sumY += lm.y; }
  const faceCx = sumX / landmarks.length;
  const faceCy = sumY / landmarks.length;

  const le = landmarks[33], re = landmarks[263];
  const faceSize = Math.hypot(re.x - le.x, re.y - le.y);

  return { yaw, pitch, ear: (leftEar + rightEar) / 2, mar, blinkScore, mouthScore, faceCx, faceCy, faceSize };
}

function extractPose(result: FaceLandmarkerResult, landmarks: NormalizedLandmark[]) {
  const matrices = result.facialTransformationMatrixes;
  const first    = Array.isArray(matrices) ? matrices[0] : undefined;
  const data     = Array.isArray(first) ? first
    : first && "data" in (first as object) ? (first as { data: number[] | Float32Array }).data
    : undefined;

  if (data && data.length >= 16) {
    const r00 = data[0], r10 = data[1], r20 = data[2];
    const r21 = data[6], r22 = data[10];
    return {
      yaw:   toDeg(Math.atan2(r10, r00)),
      pitch: toDeg(Math.asin(Math.max(-1, Math.min(1, -r20)))),
      roll:  toDeg(Math.atan2(r21, r22)),
    };
  }

  const le = landmarks[33], re = landmarks[263], n = landmarks[1], ch = landmarks[152];
  return {
    yaw:   toDeg(Math.atan2(re.z - le.z, re.x - le.x)),
    pitch: toDeg(Math.atan2(ch.y - n.y,  ch.z - n.z)),
    roll:  toDeg(Math.atan2(re.y - le.y, re.x - le.x)),
  };
}

function computeEar(lks: NormalizedLandmark[]) {
  return {
    leftEar:  ear(lks[33],  lks[133], lks[160], lks[158], lks[153], lks[144]),
    rightEar: ear(lks[362], lks[263], lks[385], lks[387], lks[373], lks[380]),
  };
}

function computeMar(lks: NormalizedLandmark[]) {
  const h = dist(lks[61], lks[291]), v = dist(lks[13], lks[14]);
  return h === 0 ? 0 : v / h;
}

function ear(o: NormalizedLandmark, i: NormalizedLandmark, t1: NormalizedLandmark, t2: NormalizedLandmark, b1: NormalizedLandmark, b2: NormalizedLandmark) {
  const h = dist(o, i);
  return h === 0 ? 0 : (dist(t1, b1) + dist(t2, b2)) / (2 * h);
}

function dist(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function toDeg(rad: number) { return (rad * 180) / Math.PI; }

async function loadTasksVision(): Promise<TasksVisionModule> {
  const m = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest");
  return m as unknown as TasksVisionModule;
}