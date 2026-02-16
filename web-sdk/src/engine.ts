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
  yaw:        number;
  pitch:      number;
  ear:        number;
  mar:        number;
  blinkScore: number; // 0=open → 1=closed  (blendshape, preferred)
  mouthScore: number; // 0=closed → 1=open   (blendshape jawOpen, preferred)
  faceCx:     number; // raw unmirrored normalised x [0,1]
  faceCy:     number; // normalised y [0,1]
  faceSize:   number; // inter-eye distance / video width
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
// Tuning notes (so thresholds are easy to reason about in production):
//
//  HEAD TURNS
//    A relaxed "glance" to the side produces ≈ 13–20° of yaw.
//    We trigger at 13° and hold for just 150ms — feels instant.
//    Wrong-direction deadband at 22° prevents neutral jitter from blocking.
//
//  BLINK
//    blinkScore (eyeBlinkLeft/Right blendshape) peaks ≈ 0.7–1.0 during a blink.
//    We accept anything > 0.35 as "closed" so even a slow lazy blink counts.
//    On re-open we check < 0.20 (not 0.15) to reduce the gap between states.
//    We do NOT require eyes to be "perfectly open" before the blink starts —
//    the engine only waits for closed→open transition, not open→closed→open.
//
//  NOD
//    Pitch > 10° = chin dips (nodding down). Much lower than 14°.
//    Returning to > −8° (almost any upward movement) = nod complete.
//    This catches small, natural nods rather than exaggerated ones.
//
//  MOUTH
//    jawOpen blendshape > 0.28 is a natural open mouth (saying "ahh" hits 0.6+).
//    Hold reduced to 120ms — just enough to avoid accidental triggers from speech.
//
//  FACE-IN-OVAL
//    Relaxed ovalRx/Ry so the guard never blocks a valid positioned face.
//    Head-turn steps skip the x-check (face drifts laterally when turning).
// ─────────────────────────────────────────────────────────────────────────────
const config = {
  // Grace period before each step starts evaluating
  readyMs: 1800,

  // ── Head turns ─────────────────────────────────────────────────────────────
  // Trigger at 13° — a relaxed glance, not a full head swing
  yawLeftThreshold:       -13,
  yawRightThreshold:       13,
  // Block wrong-direction only if clearly past 22° (absorbs natural drift)
  wrongDirectionDeadband:  22,
  // Sustain for 150ms — registers quickly without being jumpy
  holdMs: 150,

  // ── Frontal capture guard ──────────────────────────────────────────────────
  frontalYawThreshold:   18,
  frontalPitchThreshold: 18,

  // ── Blink ──────────────────────────────────────────────────────────────────
  // Accept any blink where eyes close meaningfully (> 0.35) then reopen (< 0.20)
  blinkClosedThreshold: 0.35,
  blinkOpenThreshold:   0.20,
  // EAR fallback (used only when blendshapes aren't available)
  earClosedThreshold:   0.20,
  earOpenThreshold:     0.25,
  // Max blink duration — 4s is generous; real blinks are 100–400ms
  blinkMaxDurationMs:   4000,
  // Don't penalise slight head movement during blink — just wait
  maxYawDuringBlink:    25,
  maxPitchDuringBlink:  25,

  // ── Mouth ──────────────────────────────────────────────────────────────────
  // 0.28 = mouth clearly open; saying "ah" hits 0.6–0.8
  mouthOpenBlendshapeThreshold: 0.28,
  mouthOpenMarThreshold:        0.28,
  // Short hold to avoid triggering on speech/yawning mid-check
  mouthHoldMs:  120,
  maxYawDuringMouth:    25,
  maxPitchDuringMouth:  25,

  // ── Nod ────────────────────────────────────────────────────────────────────
  // 10° chin-down = a clear small nod (not a major bow)
  nodDownThreshold:  10,
  // Return to any upward position (> −8°) = nod cycle complete
  nodUpThreshold:    -8,
  maxYawDuringNod:   25,

  // ── Face-in-oval ───────────────────────────────────────────────────────────
  ovalCx: 0.50,
  ovalCy: 0.42,
  ovalRx: 0.32,  // generous — guide only, not a pixel-perfect check
  ovalRy: 0.40,
  minFaceSize: 0.10,
  maxFaceSize: 0.62,
  headTurnSteps: new Set(["Turn your head LEFT", "Turn your head RIGHT"]),

  // ── Capture ────────────────────────────────────────────────────────────────
  // Delay after last step — gives user time to relax before snapshot
  captureDelayMs:      700,
  captureMaxAttempts:   90,

  // "Neutral face" requirements for the final image.
  // User must look normal: no open mouth, no closed eyes, no turned head.
  captureMaxYaw:          18,   // roughly facing forward
  captureMaxPitch:        18,
  captureMaxMouthScore:   0.20, // jawOpen blendshape — mouth must be closed
  captureMaxBlinkScore:   0.25, // blink blendshape — eyes must be open
  captureMinEar:          0.22, // EAR fallback for eyes-open check
  captureMaxMar:          0.22, // MAR fallback for mouth-closed check
} as const;

// ─────────────────────────────────────────────────────────────────────────────

export class LivenessEngine {
  private landmarker:  FaceLandmarker | null = null;
  private running      = false;
  private rafId:       number | null = null;
  private stream:      MediaStream | null = null;

  private stepIndex   = 0;
  private stepStart   = 0;

  // ── Per-step sub-state ─────────────────────────────────────────────────────
  private blinkState:   "waitingClose" | "closed" = "waitingClose";
  private blinkCloseTs  = 0;
  private nodState:     "neutral" | "down" = "neutral";
  private holdStart:    number | null = null;

  private latestMetrics: Metrics | null = null;
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

    // MediaPipe → raw unmirrored coords; mirror x to match CSS display
    const mx = 1 - m.faceCx;
    const dy = (m.faceCy - config.ovalCy) / config.ovalRy;
    const dx = (mx       - config.ovalCx) / config.ovalRx;

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
    this.blinkState   = "waitingClose";
    this.blinkCloseTs = 0;
    this.nodState     = "neutral";
    this.holdStart    = null;
  }

  private updateState(metrics: Metrics, now: number): "passed" | "none" {
    if (now < this.stepStart) return "none"; // still in ready countdown

    switch (steps[this.stepIndex].label) {

      // ── LEFT turn ──────────────────────────────────────────────────────────
      case "Turn your head LEFT": {
        if (metrics.yaw > config.wrongDirectionDeadband) {
          this.holdStart = null;
          return "none";
        }
        if (metrics.yaw < config.yawLeftThreshold) {
          if (this.holdStart === null) this.holdStart = now;
          if (now - this.holdStart >= config.holdMs) return this.advanceStep(now);
        } else {
          this.holdStart = null;
        }
        break;
      }

      // ── RIGHT turn ─────────────────────────────────────────────────────────
      case "Turn your head RIGHT": {
        if (metrics.yaw < -config.wrongDirectionDeadband) {
          this.holdStart = null;
          return "none";
        }
        if (metrics.yaw > config.yawRightThreshold) {
          if (this.holdStart === null) this.holdStart = now;
          if (now - this.holdStart >= config.holdMs) return this.advanceStep(now);
        } else {
          this.holdStart = null;
        }
        break;
      }

      // ── BLINK ──────────────────────────────────────────────────────────────
      case "Blink": {
        // Allow minor head movement — a real blink often causes a tiny head shift
        if (Math.abs(metrics.yaw) > config.maxYawDuringBlink ||
            Math.abs(metrics.pitch) > config.maxPitchDuringBlink) {
          // Don't reset blink state — just pause until they face forward again
          return "none";
        }

        // Prefer blendshape score; fall back to EAR
        const isEyeClosed = metrics.blinkScore > 0
          ? metrics.blinkScore > config.blinkClosedThreshold
          : metrics.ear < config.earClosedThreshold;

        const isEyeOpen = metrics.blinkScore > 0
          ? metrics.blinkScore < config.blinkOpenThreshold
          : metrics.ear > config.earOpenThreshold;

        if (this.blinkState === "waitingClose" && isEyeClosed) {
          // Eyes just closed — start timing
          this.blinkState  = "closed";
          this.blinkCloseTs = now;
        } else if (this.blinkState === "closed") {
          if (isEyeOpen) {
            // Complete blink: closed → open
            const dur = now - this.blinkCloseTs;
            if (dur <= config.blinkMaxDurationMs) {
              return this.advanceStep(now);
            }
            // Held too long (e.g. eyes were stuck) — reset and wait for a fresh blink
            this.blinkState = "waitingClose";
          }
          // Still closed — keep waiting for reopening, no timeout pressure
        }
        break;
      }

      // ── NOD ────────────────────────────────────────────────────────────────
      case "Nod your head": {
        // Allow some yaw during a nod — people naturally do both
        if (Math.abs(metrics.yaw) > config.maxYawDuringNod) return "none";

        if (this.nodState === "neutral") {
          // Wait for chin to dip
          if (metrics.pitch > config.nodDownThreshold) {
            this.nodState = "down";
          }
        } else if (this.nodState === "down") {
          // Wait for head to come back up — any upward movement counts
          if (metrics.pitch < config.nodUpThreshold) {
            return this.advanceStep(now);
          }
        }
        break;
      }

      // ── OPEN MOUTH ─────────────────────────────────────────────────────────
      case "Open your mouth": {
        if (Math.abs(metrics.yaw)   > config.maxYawDuringMouth ||
            Math.abs(metrics.pitch) > config.maxPitchDuringMouth) return "none";

        const isMouthOpen = metrics.mouthScore > 0
          ? metrics.mouthScore > config.mouthOpenBlendshapeThreshold
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