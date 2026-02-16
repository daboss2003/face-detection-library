export type LivenessCallbacks = {
  onChallengeChanged?: (stepIndex: number, stepLabel: string) => void;
  onFailure?: (reason: string) => void;
  onSuccess?: (imageBase64: string) => void;
  onFaceInOval?: (inside: boolean, reason?: string) => void;
  onDebugFrame?: (info: { hasFace: boolean; metrics: Metrics | null; step: string }) => void;
};

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

export type LivenessOptions = {
  videoElement: HTMLVideoElement;
  canvasElement: HTMLCanvasElement;
  modelUrl?: string;
  wasmUrl?: string;
  callbacks?: LivenessCallbacks;
  sounds?: LivenessSoundOptions;
};

export const DEFAULT_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export const DEFAULT_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

type NormalizedLandmark  = { x: number; y: number; z: number };
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

type FilesetResolver   = { forVisionTasks: (wasmUrl: string) => Promise<unknown> };
type TasksVisionModule = {
  FaceLandmarker: {
    createFromOptions: (vision: unknown, opts: Record<string, unknown>) => Promise<FaceLandmarker>;
  };
  FilesetResolver: FilesetResolver;
};

type LivenessStep = { index: number; label: string };

export type Metrics = {
  yaw:        number;  // degrees, negative=left positive=right
  pitch:      number;  // degrees, negative=up positive=down
  ear:        number;
  mar:        number;
  blinkScore: number;  // 0=open → 1=closed
  mouthScore: number;  // 0=closed → 1=open
  faceCx:     number;
  faceCy:     number;
  faceSize:   number;
};

const STEP_LABELS = [
  "Turn your head LEFT",
  "Blink",
  "Turn your head RIGHT",
  "Nod your head",
  "Open your mouth",
] as const;

/** Step label → sound key (filename without .mp3). Used so the correct sound plays regardless of randomized step order. */
const STEP_LABEL_TO_SOUND: Record<string, string> = {
  "Turn your head LEFT":  "left",
  "Blink":                "blink",
  "Turn your head RIGHT": "right",
  "Nod your head":        "nod",
  "Open your mouth":      "mouth",
};

function shuffleArray<T>(array: readonly T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const steps: LivenessStep[] = shuffleArray(STEP_LABELS).map((label, index) => ({ index, label }));

export const LIVENESS_STEP_COUNT = steps.length;

// ─────────────────────────────────────────────────────────────────────────────
//  KEY DESIGN: RELATIVE MEASUREMENT
//
//  Rather than fixed absolute thresholds, the engine samples the user's
//  resting yaw/pitch at the start of each step (during the readyMs window)
//  and measures CHANGE FROM THAT BASELINE.
//
//  This fixes the core UX problem: someone sitting slightly turned or with
//  a slightly tilted monitor should not need to fight their natural position.
//
//  Head turn LEFT:  yaw delta < -12° from baseline  (a natural glance)
//  Head turn RIGHT: yaw delta > +12° from baseline
//  Nod down:        pitch delta > +10° from baseline (chin dips toward chest)
//  Nod up return:   pitch delta < +3° (back near starting point, not below it)
//
//  Blink and mouth use blendshapes which are already camera-relative.
// ─────────────────────────────────────────────────────────────────────────────
const config = {
  readyMs: 1800,   // ms to sample baseline before evaluating

  // ── Baseline sampling ──────────────────────────────────────────────────────
  // Number of frames averaged to produce the resting baseline per step
  baselineFrames: 8,

  // ── Head turns (relative to baseline) ─────────────────────────────────────
  yawTurnDelta:           12,   // degrees of YAW change needed from rest
  yawWrongDirDelta:       16,   // block if turned clearly the WRONG way
  headTurnHoldMs:        120,   // sustain the turned pose for this long

  // ── Nod (relative to baseline) ────────────────────────────────────────────
  nodDownDelta:            8,   // chin must DROP by this many degrees from baseline
  nodReturnFraction:      0.40, // return to 40% of peak nod depth to complete
  nodReturnMaxDelta:       5,   // cap: never require returning past 5° from baseline
  maxYawDuringNod:        22,

  // ── Blink ──────────────────────────────────────────────────────────────────
  blinkClosedThreshold:  0.35,  // blendshape score = eyes closed
  blinkOpenThreshold:    0.20,  // blendshape score = eyes open
  earClosedThreshold:    0.20,
  earOpenThreshold:      0.25,
  blinkMaxDurationMs:   4000,
  maxYawDuringBlink:     25,
  maxPitchDuringBlink:   25,

  // ── Mouth ──────────────────────────────────────────────────────────────────
  mouthOpenThreshold:    0.28,  // jawOpen blendshape
  mouthOpenMarThreshold: 0.28,
  mouthHoldMs:          120,
  maxYawDuringMouth:     25,
  maxPitchDuringMouth:   25,

  // ── Face-in-oval ───────────────────────────────────────────────────────────
  ovalCx:       0.50,
  ovalCy:       0.42,
  ovalRx:       0.32,
  ovalRy:       0.40,
  minFaceSize:  0.10,
  maxFaceSize:  0.62,
  headTurnSteps: new Set(["Turn your head LEFT", "Turn your head RIGHT"]),

  // ── Capture ────────────────────────────────────────────────────────────────
  captureDelayMs:      700,
  captureMaxAttempts:   90,
  captureMaxYaw:        18,
  captureMaxPitch:      18,
  captureMaxMouthScore: 0.20,
  captureMaxBlinkScore: 0.25,
  captureMinEar:        0.22,
  captureMaxMar:        0.22,
} as const;

// ─────────────────────────────────────────────────────────────────────────────

export class LivenessEngine {
  private landmarker:  FaceLandmarker | null = null;
  private running      = false;
  private rafId:       number | null = null;
  private stream:      MediaStream | null = null;

  private stepIndex   = 0;
  private stepStart   = 0;

  // ── Baseline (sampled during readyMs window) ───────────────────────────────
  private baselineYaw:    number | null = null;
  private baselinePitch:  number | null = null;
  private baselineSamples: Array<{ yaw: number; pitch: number }> = [];

  // ── Per-step sub-state ─────────────────────────────────────────────────────
  private blinkState:   "waitingClose" | "closed" = "waitingClose";
  private blinkCloseTs  = 0;
  private nodState:     "neutral" | "down" = "neutral";
  private holdStart:    number | null = null;

  private latestMetrics: Metrics | null = null;
   private nodPeakDPitch: number = 0;
  private lastDetectTs   = -1;
  private lastOvalState: boolean | null = null;
  private stepSoundPlayedForCurrentStep = false;

  constructor(private opts: LivenessOptions) {}

  private playSound(url: string, onEnded?: () => void): void {
    const a = new Audio(url);
    if (onEnded) {
      const done = () => {
        a.removeEventListener("ended", done);
        a.removeEventListener("error", done);
        onEnded();
      };
      a.addEventListener("ended", done);
      a.addEventListener("error", done);
    }
    a.play().catch(() => onEnded?.());
  }

  private getSoundUrl(key: string): string | undefined {
    const s = this.opts.sounds;
    if (!s) return undefined;
    const override = (s as Record<string, string | undefined>)[key];
    if (override) return override;
    const base = s.baseUrl;
    if (!base) return undefined;
    const baseNorm = base.replace(/\/?$/, "/");
    return baseNorm + key + ".mp3";
  }

  private playStepSound(stepLabel: string): void {
    const key = STEP_LABEL_TO_SOUND[stepLabel];
    if (!key) return;
    const url = this.getSoundUrl(key);
    if (url) this.playSound(url);
  }

  private playGoodSound(onEnded?: () => void): void {
    const url = this.getSoundUrl("good");
    if (url) this.playSound(url, onEnded);
    else onEnded?.();
  }

  private playCaptureSound(): void {
    const url = this.getSoundUrl("capture");
    if (url) this.playSound(url);
  }

  // ── Public ─────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.stopDetectionOnly();
    this.running      = true;
    this.stepIndex    = 0;
    this.lastDetectTs = -1;
    this.lastOvalState = null;
    const now = performance.now();
    this.stepStart = now + config.readyMs;
    this.resetStepState();
    this.stepSoundPlayedForCurrentStep = false;
    this.opts.callbacks?.onChallengeChanged?.(steps[0].index, steps[0].label);
    await this.ensureVideo();
    this.landmarker = await this.createLandmarker();
    this.loop();
  }

  stop(): void {
    this.stopDetectionOnly();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
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
    await new Promise<void>(resolve => {
      const check = () =>
        video.readyState >= 2 && video.videoWidth > 0
          ? resolve()
          : requestAnimationFrame(check);
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

  // ── Loop ───────────────────────────────────────────────────────────────────

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

      // ── Sample baseline during ready countdown ─────────────────────────────
      const timeToStart = this.stepStart - now;
      if (timeToStart > 0 && this.baselineYaw === null) {
        this.baselineSamples.push({ yaw: metrics.yaw, pitch: metrics.pitch });
        if (this.baselineSamples.length >= config.baselineFrames) {
          const yaws   = this.baselineSamples.map(s => s.yaw).sort((a, b) => a - b);
          const pitches = this.baselineSamples.map(s => s.pitch).sort((a, b) => a - b);
          const mid = Math.floor(yaws.length / 2);
          this.baselineYaw   = yaws[mid];
          this.baselinePitch = pitches[mid];
        }
      }

      const { inside, reason } = this.checkFaceInOval(metrics);
      if (inside !== this.lastOvalState) {
        this.lastOvalState = inside;
        this.opts.callbacks?.onFaceInOval?.(inside, reason);
      }

      this.opts.callbacks?.onDebugFrame?.({
        hasFace: true, metrics,
        step: steps[this.stepIndex]?.label ?? "done",
      });

      if (inside) {
        if (!this.stepSoundPlayedForCurrentStep && this.stepIndex < steps.length) {
          this.stepSoundPlayedForCurrentStep = true;
          this.playStepSound(steps[this.stepIndex].label);
        }
        if (this.updateState(metrics, now) === "passed") {
          this.scheduleCapture();
          return;
        }
      }
    } else {
      if (this.lastOvalState !== false) {
        this.lastOvalState = false;
        this.opts.callbacks?.onFaceInOval?.(false, "No face detected");
      }
      this.opts.callbacks?.onDebugFrame?.({
        hasFace: false, metrics: null,
        step: steps[this.stepIndex]?.label ?? "done",
      });
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  }

  // ── Oval check ─────────────────────────────────────────────────────────────

  private checkFaceInOval(m: Metrics): { inside: boolean; reason?: string } {
    const isHeadTurn = config.headTurnSteps.has(steps[this.stepIndex]?.label ?? "");
    const mx = 1 - m.faceCx; // mirror x to match CSS scaleX(-1)
    const dy = (m.faceCy - config.ovalCy) / config.ovalRy;
    const dx = (mx - config.ovalCx) / config.ovalRx;

    // During head turns only check vertical position — x drifts intentionally
    const inEllipse = isHeadTurn
      ? Math.abs(dy) <= 1
      : dx * dx + dy * dy <= 1;

    if (!inEllipse) {
      if (Math.abs(dy) >= Math.abs(dx)) {
        return { inside: false, reason: dy < 0 ? "Move down slightly" : "Move up slightly" };
      }
      return { inside: false, reason: dx < 0 ? "Move right" : "Move left" };
    }

    if (m.faceSize < config.minFaceSize) return { inside: false, reason: "Move closer to the camera" };
    if (m.faceSize > config.maxFaceSize) return { inside: false, reason: "Move back a little" };

    return { inside: true };
  }

  // ── State machine ──────────────────────────────────────────────────────────

  private resetStepState(): void {
    this.blinkState      = "waitingClose";
    this.blinkCloseTs    = 0;
    this.nodState        = "neutral";
    this.holdStart       = null;
    this.baselineYaw     = null;
    this.baselinePitch   = null;
    this.baselineSamples = [];
  }

  private updateState(metrics: Metrics, now: number): "passed" | "none" {
    if (now < this.stepStart) return "none"; // in ready countdown

    const bYaw   = this.baselineYaw   ?? metrics.yaw;
    const bPitch = this.baselinePitch ?? metrics.pitch;
    const dYaw   = metrics.yaw   - bYaw;
    const dPitch = metrics.pitch - bPitch;

    switch (steps[this.stepIndex].label) {

      // ── LEFT turn (negative yaw delta = turning left from rest) ─────────────
      case "Turn your head LEFT": {
        if (dYaw > config.yawWrongDirDelta) { this.holdStart = null; return "none"; }
        if (dYaw < -config.yawTurnDelta) {
          if (this.holdStart === null) this.holdStart = now;
          if (now - this.holdStart >= config.headTurnHoldMs) return this.advanceStep(now);
        } else {
          this.holdStart = null;
        }
        break;
      }

      // ── RIGHT turn (positive yaw delta = turning right from rest) ──────────
      case "Turn your head RIGHT": {
        if (dYaw < -config.yawWrongDirDelta) { this.holdStart = null; return "none"; }
        if (dYaw > config.yawTurnDelta) {
          if (this.holdStart === null) this.holdStart = now;
          if (now - this.holdStart >= config.headTurnHoldMs) return this.advanceStep(now);
        } else {
          this.holdStart = null;
        }
        break;
      }

      // ── BLINK ──────────────────────────────────────────────────────────────
      case "Blink": {
        if (Math.abs(metrics.yaw)   > config.maxYawDuringBlink ||
            Math.abs(metrics.pitch) > config.maxPitchDuringBlink) return "none";

        const isEyeClosed = metrics.blinkScore > 0
          ? metrics.blinkScore > config.blinkClosedThreshold
          : metrics.ear < config.earClosedThreshold;

        const isEyeOpen = metrics.blinkScore > 0
          ? metrics.blinkScore < config.blinkOpenThreshold
          : metrics.ear > config.earOpenThreshold;

        if (this.blinkState === "waitingClose" && isEyeClosed) {
          this.blinkState   = "closed";
          this.blinkCloseTs = now;
        } else if (this.blinkState === "closed" && isEyeOpen) {
          if (now - this.blinkCloseTs <= config.blinkMaxDurationMs) return this.advanceStep(now);
          this.blinkState = "waitingClose";
        }
        break;
      }

      // ── NOD (dPitch > 0 = chin dropping; completion = back within nodReturnDelta) ─
      case "Nod your head": {
        if (Math.abs(dYaw) > config.maxYawDuringNod) return "none";

        if (this.nodState === "neutral") {
          if (dPitch > config.nodDownDelta) {
            this.nodState      = "down";
            this.nodPeakDPitch = dPitch;
          }
        } else if (this.nodState === "down") {
          // Keep updating peak in case they nod deeper
          if (dPitch > this.nodPeakDPitch) this.nodPeakDPitch = dPitch;

          // Return target: proportional to how deep they nodded,
          // capped so a very deep nod doesn't need a huge return
          const returnTarget = Math.min(
            this.nodPeakDPitch * config.nodReturnFraction,
            config.nodReturnMaxDelta
          );

          if (dPitch < returnTarget) return this.advanceStep(now);
        }
        break;
      }

      // ── OPEN MOUTH ─────────────────────────────────────────────────────────
      case "Open your mouth": {
        if (Math.abs(metrics.yaw)   > config.maxYawDuringMouth ||
            Math.abs(metrics.pitch) > config.maxPitchDuringMouth) return "none";

        const isMouthOpen = metrics.mouthScore > 0
          ? metrics.mouthScore > config.mouthOpenThreshold
          : metrics.mar > config.mouthOpenMarThreshold;

        if (isMouthOpen) {
          if (this.holdStart === null) this.holdStart = now;
          // Short hold prevents accidental trigger from talking/yawning
          if (now - this.holdStart >= config.mouthHoldMs) return this.advanceStep(now);
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
    if (this.stepIndex >= steps.length) {
      this.playGoodSound();
      return "passed";
    }
    this.stepStart = now + config.readyMs;
    this.resetStepState();
    this.stepSoundPlayedForCurrentStep = false;
    const step = steps[this.stepIndex];
    this.opts.callbacks?.onChallengeChanged?.(step.index, step.label);
    this.playGoodSound(() => this.playStepSound(step.label));
    return "none";
  }

  private fail(reason: string): void {
    this.opts.callbacks?.onFailure?.(reason);
    this.stopDetectionOnly();
  }

  // ── Capture ────────────────────────────────────────────────────────────────

  private scheduleCapture(): void {
    let attempts = 0;

    this.playCaptureSound();
    // Tell the UI to prompt the user to relax their face
    this.opts.callbacks?.onChallengeChanged?.(-1, "Relax and look at the camera");

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

        // ── Neutral face check ─────────────────────────────────────────────
        // Head must be roughly forward
        const headFrontal =
          Math.abs(metrics.yaw)   <= config.captureMaxYaw &&
          Math.abs(metrics.pitch) <= config.captureMaxPitch;

        // Eyes must be open (not blinking or squinting)
        const eyesOpen = metrics.blinkScore > 0
          ? metrics.blinkScore < config.captureMaxBlinkScore
          : metrics.ear >= config.captureMinEar;

        // Mouth must be closed — this is the key fix
        const mouthClosed = metrics.mouthScore > 0
          ? metrics.mouthScore < config.captureMaxMouthScore
          : metrics.mar < config.captureMaxMar;

        if (headFrontal && eyesOpen && mouthClosed) {
          this.captureImage();
          return;
        }
      }

      if (attempts >= config.captureMaxAttempts) {
        this.fail("Please look straight at the camera with a relaxed expression.");
        return;
      }

      this.rafId = requestAnimationFrame(tryCapture);
    };

    // Longer delay so the user has time to close their mouth after the last step
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
  const lks = result.faceLandmarks[0];
  const { yaw, pitch } = extractPose(result, lks);
  const { leftEar, rightEar } = computeEar(lks);
  const mar = computeMar(lks);

  const bs    = result.faceBlendshapes?.[0]?.categories ?? [];
  const getBS = (name: string) => bs.find(c => c.categoryName === name)?.score ?? 0;

  const blinkL = getBS("eyeBlinkLeft"), blinkR = getBS("eyeBlinkRight");
  const blinkScore = (blinkL > 0 || blinkR > 0) ? (blinkL + blinkR) / 2 : 0;
  const mouthScore = getBS("jawOpen");

  // Face centre: mean of all landmarks
  let sumX = 0, sumY = 0;
  for (const lm of lks) { sumX += lm.x; sumY += lm.y; }
  const faceCx = sumX / lks.length;
  const faceCy = sumY / lks.length;

  // Face size: normalised inter-eye distance
  const faceSize = dist(lks[33], lks[263]);

  return {
    yaw, pitch,
    ear: (leftEar + rightEar) / 2,
    mar, blinkScore, mouthScore,
    faceCx, faceCy, faceSize,
  };
}

function extractPose(result: FaceLandmarkerResult, lks: NormalizedLandmark[]) {
  const mats  = result.facialTransformationMatrixes;
  const first = Array.isArray(mats) ? mats[0] : undefined;
  const data  = Array.isArray(first) ? first
    : first && "data" in (first as object)
    ? (first as { data: number[] | Float32Array }).data
    : undefined;

  if (data && data.length >= 16) {
    // Column-major 4×4: indices [0,1,2] = col-0 = [r00,r10,r20]
    //                             [6]   = col-1 row-2 = r21
    //                             [10]  = col-2 row-2 = r22
    const r00 = data[0], r10 = data[1], r20 = data[2];
    const r21 = data[6],  r22 = data[10];
    return {
      yaw:   toDeg(Math.atan2(r10, r00)),
      pitch: toDeg(Math.asin(Math.max(-1, Math.min(1, -r20)))),
      roll:  toDeg(Math.atan2(r21, r22)),
    };
  }

  // Landmark fallback
  const le = lks[33], re = lks[263], n = lks[1], ch = lks[152];
  return {
    yaw:   toDeg(Math.atan2(re.z - le.z, re.x - le.x)),
    pitch: toDeg(Math.atan2(ch.y - n.y,  ch.z - n.z)),
    roll:  toDeg(Math.atan2(re.y - le.y, re.x - le.x)),
  };
}

function computeEar(lks: NormalizedLandmark[]) {
  return {
    leftEar:  ear(lks[33], lks[133], lks[160], lks[158], lks[153], lks[144]),
    rightEar: ear(lks[362],lks[263], lks[385], lks[387], lks[373], lks[380]),
  };
}

function computeMar(lks: NormalizedLandmark[]) {
  const h = dist(lks[61], lks[291]);
  return h === 0 ? 0 : dist(lks[13], lks[14]) / h;
}

function ear(o: NormalizedLandmark, i: NormalizedLandmark, t1: NormalizedLandmark, t2: NormalizedLandmark, b1: NormalizedLandmark, b2: NormalizedLandmark) {
  const h = dist(o, i);
  return h === 0 ? 0 : (dist(t1, b1) + dist(t2, b2)) / (2 * h);
}

function dist(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function toDeg(r: number) { return (r * 180) / Math.PI; }

async function loadTasksVision(): Promise<TasksVisionModule> {
  return (await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest")) as unknown as TasksVisionModule;
}