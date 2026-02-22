import { LivenessEngine, LIVENESS_STEP_COUNT, LivenessCallbacks, LivenessSoundOptions, LivenessError } from "./engine";
import { DEFAULT_SOUND_DATA_URLS } from "./default-sounds.generated";

export type StartLivenessOptions = {
  container?: HTMLElement;
  modelUrl?: string;
  wasmUrl?: string;
  callbacks: LivenessCallbacks;
  sounds?: LivenessSoundOptions;
};

// ── Oval dimensions — keep in sync with engine.ts config.ovalCx/Cy/Rx/Ry ──
const OVAL_W = 270;
const OVAL_H = 360;
const OVAL_TOP_PCT = 40;

// Progress stroke sits on the main oval: ellipse inset by half stroke so outer edge aligns with cutout
const STROKE_HALF = 1.75;
const RX = OVAL_W / 2 - STROKE_HALF;
const RY = OVAL_H / 2 - STROKE_HALF;
const ELLIPSE_PERIMETER = Math.PI * (3 * (RX + RY) - Math.sqrt((3 * RX + RY) * (RX + 3 * RY)));

type HintKind = "left" | "blink" | "right" | "nod" | "mouth";

/** Step label (from engine) → hint icon kind. Use this so the correct icon shows when steps are randomized. */
const STEP_LABEL_TO_HINT: Record<string, HintKind> = {
  "Turn your head LEFT":  "left",
  "Blink":                "blink",
  "Turn your head RIGHT": "right",
  "Nod your head":        "nod",
  "Open your mouth":      "mouth",
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function createStyles(): HTMLStyleElement {
  const s = document.createElement("style");
  s.textContent = `
    :root {
      --lv-green: #12c95c;
      --lv-red:   #ff3b3b;
      --lv-white: #ffffff;
      --lv-dark:  rgba(0,0,0,0.82);
    }

    .lv-root {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: #000;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
      color: var(--lv-white);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      /* Radii: keep oval inside viewport on mobile (diameter = 2× this), cap at desktop */
      --oval-w: min(45vmin, ${OVAL_W}px);
      --oval-h: min(60vmin, ${OVAL_H}px);
      /* Half-height of the visible oval for positioning (oval uses full w/h as radii) */
      --oval-half-h: var(--oval-h);
    }

    /* ── Full-bleed video behind everything ─────────────────────────────── */
    .lv-video-bg {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .lv-video {
      /* Fill the container while keeping aspect ratio */
      width: 100%;
      height: 100%;
      object-fit: cover;
      /* Mirror so it feels like a selfie camera */
      transform: scaleX(-1);
      opacity: 0;
      transition: opacity 0.2s ease;
      /* Clip the video to the oval using clip-path on the parent */
    }
    .lv-video.is-playing { opacity: 1; }
    .lv-video::-webkit-media-controls,
    .lv-video::-webkit-media-controls-panel,
    .lv-video::-webkit-media-controls-play-button,
    .lv-video::-webkit-media-controls-start-playback-button,
    .lv-video::-webkit-media-controls-overlay-play-button,
    .lv-video::-webkit-media-controls-enclosure {
      display: none !important;
      -webkit-appearance: none;
    }

    .lv-root.lv-is-loading .lv-ring-wrap,
    .lv-root.lv-is-loading .lv-dots,
    .lv-root.lv-is-loading .lv-instruction,
    .lv-root.lv-is-loading .lv-pos-hint,
    .lv-root.lv-is-loading .lv-hint-icon {
      opacity: 0;
      pointer-events: none;
    }
    .lv-root:not(.lv-is-loading) .lv-loading { display: none; }
    .lv-loading {
      position: absolute;
      z-index: 2;
      left: 50%;
      top: ${OVAL_TOP_PCT}%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      color: var(--lv-white);
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
    }
    .lv-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255,255,255,0.25);
      border-top-color: var(--lv-white);
      border-radius: 50%;
      animation: lv-spin 0.9s linear infinite;
    }
    .lv-loading-text {
      font-size: 13px;
      font-weight: 500;
      opacity: 0.9;
    }
    @keyframes lv-spin { to { transform: rotate(360deg); } }

    /* ── Dark overlay with oval cutout ──────────────────────────────────── */
    .lv-overlay {
      position: absolute;
      inset: 0;
      /* Ellipse size (radii): full oval w/h so cutout is large; ring is scaled to match */
      --ow: var(--oval-w);
      --oh: var(--oval-h);
      background: var(--lv-dark);
      -webkit-mask-image: radial-gradient(
        ellipse var(--ow) var(--oh) at 50% ${OVAL_TOP_PCT}%,
        transparent 99%, black 100%
      );
      mask-image: radial-gradient(
        ellipse var(--ow) var(--oh) at 50% ${OVAL_TOP_PCT}%,
        transparent 99%, black 100%
      );
      pointer-events: none;
      transition: background 0.25s;
    }
    .lv-overlay.out-of-oval {
      /* Tint red when face isn't in position */
      background: rgba(180,0,0,0.55);
    }

    /* ── Oval SVG ring (2× so progress sits on the main oval boundary) ───── */
    .lv-ring-wrap {
      position: absolute;
      left: 50%;
      top: ${OVAL_TOP_PCT}%;
      transform: translate(-50%, -50%);
      width: calc(2 * var(--oval-w));
      height: calc(2 * var(--oval-h));
      pointer-events: none;
    }
    .lv-ring-wrap svg { width: 100%; height: 100%; overflow: visible; }
    .lv-ring-progress {
      fill: none;
      stroke: var(--lv-green);
      stroke-width: 3.5;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.45s cubic-bezier(.4,0,.2,1), stroke 0.25s;
      transform: rotate(0deg);
      transform-origin: center;
    }
    .lv-ring-progress.out-of-oval { stroke: var(--lv-red); }

    /* ── Top header bar ──────────────────────────────────────────────────── */
    .lv-header {
      position: relative;
      z-index: 2;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px 20px 0;
      gap: 10px;
    }
    .lv-header-title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.02em;
      opacity: 0.9;
    }

    /* ── Step dots ───────────────────────────────────────────────────────── */
    .lv-dots {
      position: absolute;
      z-index: 2;
      top: calc(${OVAL_TOP_PCT}% + var(--oval-half-h) + 20px);
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
    }
    .lv-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: rgba(255,255,255,0.2);
      transition: background 0.3s, transform 0.3s;
    }
    .lv-dot.active { background: var(--lv-green); transform: scale(1.3); }
    .lv-dot.done  { background: var(--lv-green); opacity: .5; transform: scale(1); }

    /* ── Instruction text ────────────────────────────────────────────────── */
    .lv-instruction {
      position: absolute;
      z-index: 2;
      top: calc(${OVAL_TOP_PCT}% + var(--oval-half-h) + 52px);
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      font-size: 17px;
      font-weight: 600;
      text-align: center;
      letter-spacing: -0.01em;
      text-shadow: 0 1px 8px rgba(0,0,0,0.6);
      transition: opacity 0.2s;
    }

    /* ── "Move closer / centre your face" hint ───────────────────────────── */
    .lv-pos-hint {
      position: absolute;
      z-index: 2;
      top: calc(${OVAL_TOP_PCT}% + var(--oval-half-h) + 84px);
      left: 50%;
      transform: translateX(-50%);
      font-size: 13px;
      font-weight: 500;
      color: var(--lv-red);
      opacity: 0;
      white-space: nowrap;
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
      transition: opacity 0.3s;
      pointer-events: none;
    }
    .lv-pos-hint.visible { opacity: 1; }

    /* ── Animated gesture icon ───────────────────────────────────────────── */
    .lv-hint-icon {
      position: absolute;
      z-index: 2;
      left: 50%;
      top: ${OVAL_TOP_PCT}%;
      transform: translate(-50%, -50%);
      width: 52px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
    }
    .lv-hint-icon svg { width: 40px; height: 40px; }

    /* Arrow bounce animations */
    @keyframes lv-left  { 0%,100%{transform:translateX(0)}  50%{transform:translateX(-9px)} }
    @keyframes lv-right { 0%,100%{transform:translateX(0)}  50%{transform:translateX(9px)}  }
    @keyframes lv-down  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(8px)}  }
    @keyframes lv-blink {
      0%,40%,60%,100% { transform: scaleY(1); opacity: 1; }
      50% { transform: scaleY(0.08); opacity: 0.4; }
    }
    @keyframes lv-mouth {
      0%,60%,100% { transform: scaleY(0.35); }
      30%          { transform: scaleY(1); }
    }

    .lv-anim-left  { animation: lv-left  1s ease-in-out infinite; }
    .lv-anim-right { animation: lv-right 1s ease-in-out infinite; }
    .lv-anim-down  { animation: lv-down  1s ease-in-out infinite; }
    .lv-eye        { animation: lv-blink 2s ease-in-out infinite; transform-origin: center; }
    .lv-jaw        { animation: lv-mouth 1.5s ease-in-out infinite; transform-origin: top center; }

    /* ── Capture pulse ──────────────────────────────────────────────────── */
    @keyframes lv-pulse {
      0%,100% { stroke-width: 3.5; opacity: 1; }
      50%     { stroke-width: 5;   opacity: 0.55; }
    }
    .lv-ring-pulse { animation: lv-pulse 1s ease-in-out infinite; stroke: var(--lv-green) !important; }

    /* ── Hidden canvas for capture ───────────────────────────────────────── */
    .lv-canvas {
      position: absolute;
      width: 0; height: 0;
      opacity: 0;
      pointer-events: none;
    }
  `;
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG hints
// ─────────────────────────────────────────────────────────────────────────────

function hintSvg(kind: HintKind): string {
  const sk = `stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`;
  switch (kind) {
    case "left":  return `<svg viewBox="0 0 24 24" fill="none" ${sk} class="lv-anim-left"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>`;
    case "right": return `<svg viewBox="0 0 24 24" fill="none" ${sk} class="lv-anim-right"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>`;
    case "nod":   return `<svg viewBox="0 0 24 24" fill="none" ${sk} class="lv-anim-down"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>`;
    case "blink": return `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><ellipse class="lv-eye" cx="8" cy="12" rx="2" ry="2.5"/><ellipse class="lv-eye" cx="16" cy="12" rx="2" ry="2.5" style="animation-delay:.08s"/></svg>`;
    case "mouth": return `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path class="lv-jaw" d="M6 10 Q12 17 18 10"/></svg>`;
    default:      return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main factory
// ─────────────────────────────────────────────────────────────────────────────

export function startLivenessWithUI(options: StartLivenessOptions): LivenessEngine {
  const container = options.container ?? document.body;

  // ── Root shell ─────────────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.className = "lv-root lv-is-loading";
  root.appendChild(createStyles());

  // ── Video background ───────────────────────────────────────────────────────
  const videoBg = document.createElement("div");
  videoBg.className = "lv-video-bg";
  const video = document.createElement("video");
  video.className = "lv-video";
  video.setAttribute("autoplay", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("muted", "");
  videoBg.appendChild(video);
  root.appendChild(videoBg);

  // ── Dark overlay with oval cutout ──────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "lv-overlay";
  root.appendChild(overlay);

  // ── Progress ring (ellipse pathLength = perimeter so dash offset matches) ───
  const rx = OVAL_W / 2, ry = OVAL_H / 2;
  const ringWrap = document.createElement("div");
  ringWrap.className = "lv-ring-wrap";
  ringWrap.innerHTML = `
    <svg viewBox="0 0 ${OVAL_W} ${OVAL_H}">
      <ellipse class="lv-ring-progress"
        cx="${rx}" cy="${ry}" rx="${RX}" ry="${RY}"
        pathLength="${ELLIPSE_PERIMETER.toFixed(1)}"
        stroke-dasharray="${ELLIPSE_PERIMETER.toFixed(1)}"
        stroke-dashoffset="${ELLIPSE_PERIMETER.toFixed(1)}"
        transform="rotate(-90 ${rx} ${ry})"/>
    </svg>`;
  root.appendChild(ringWrap);

  // ── Gesture hint icon (inside the oval) ────────────────────────────────────
  const hintIcon = document.createElement("div");
  hintIcon.className = "lv-hint-icon";
  hintIcon.setAttribute("aria-hidden", "true");
  root.appendChild(hintIcon);

  // ── Loading spinner (shown until model is ready) ───────────────────────────
  const loading = document.createElement("div");
  loading.className = "lv-loading";
  loading.innerHTML = `
    <div class="lv-spinner" aria-hidden="true"></div>
    <div class="lv-loading-text">Preparing camera...</div>
  `;
  root.appendChild(loading);

  // ── Header ─────────────────────────────────────────────────────────────────
  // const header = document.createElement("div");
  // header.className = "lv-header";
  // header.innerHTML = `<span class="lv-header-title">Face Verification</span>`;
  // root.appendChild(header);

  // ── Step dots ──────────────────────────────────────────────────────────────
  const dotsEl = document.createElement("div");
  dotsEl.className = "lv-dots";
  for (let i = 0; i < LIVENESS_STEP_COUNT; i++) {
    const dot = document.createElement("div");
    dot.className = "lv-dot" + (i === 0 ? " active" : "");
    dotsEl.appendChild(dot);
  }
  root.appendChild(dotsEl);

  // ── Instruction text ───────────────────────────────────────────────────────
  const instruction = document.createElement("div");
  instruction.className = "lv-instruction";
  instruction.textContent = "Position your face in the oval";
  root.appendChild(instruction);

  // ── Position hint (shows when face is out of oval) ─────────────────────────
  const posHint = document.createElement("div");
  posHint.className = "lv-pos-hint";
  root.appendChild(posHint);

  // ── Hidden canvas ──────────────────────────────────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.className = "lv-canvas";
  root.appendChild(canvas);

  container.appendChild(root);

  const ringEl = ringWrap.querySelector(".lv-ring-progress") as SVGEllipseElement | null;
  const dots = Array.from(dotsEl.querySelectorAll(".lv-dot"));
  const P = ELLIPSE_PERIMETER;
  let isLoading = true;
  let pendingChallenge: { stepIndex: number; stepLabel: string } | null = null;

  // ── UI helpers ──────────────────────────────────────────────────────────────

  function setProgress(completedSteps: number): void {
    if (!ringEl) return;
    const filled = Math.min(completedSteps / LIVENESS_STEP_COUNT, 1);
    const offset = P * (1 - filled);
    ringEl.setAttribute("stroke-dashoffset", offset.toFixed(1));
  }

  function setCapturePulse(): void {
    ringEl?.classList.add("lv-ring-pulse");
    ringEl?.setAttribute("stroke-dashoffset", "0");
  }

  function setHint(stepLabel: string | null): void {
    if (!stepLabel) { hintIcon.innerHTML = ""; return; }
    const kind = STEP_LABEL_TO_HINT[stepLabel];
    hintIcon.innerHTML = kind ? hintSvg(kind) : "";
  }

  function setDots(activeIndex: number): void {
    dots.forEach((d, i) => {
      d.classList.toggle("done",   i < activeIndex);
      d.classList.toggle("active", i === activeIndex);
    });
  }

  function setFaceInOval(inside: boolean, reason?: string): void {
    overlay.classList.toggle("out-of-oval", !inside);
    ringEl?.classList.toggle("out-of-oval", !inside);
    posHint.classList.toggle("visible", !inside);
    posHint.textContent = inside ? "" : (reason ?? "Move your face into the oval");
  }

  function renderChallenge(stepIndex: number, stepLabel: string): void {
    if (stepIndex === -1) {
      setProgress(LIVENESS_STEP_COUNT);
      setCapturePulse();
      setHint(null);
      setDots(LIVENESS_STEP_COUNT);
      instruction.textContent = stepLabel;
      return;
    }
    setProgress(stepIndex);
    setDots(stepIndex);
    setHint(stepLabel);
    instruction.textContent = stepLabel;
    ringEl?.classList.remove("lv-ring-pulse");
  }

  function cleanup(): void {
    engine.stop();
    video.removeEventListener("playing", onVideoPlaying);
    video.removeEventListener("pause", onVideoPause);
    video.removeEventListener("waiting", onVideoPause);
    root.remove();
  }

  // ── Engine ─────────────────────────────────────────────────────────────────
  // Use options.sounds if provided; otherwise use embedded default sounds (works in any host)
  const sounds: LivenessSoundOptions = options.sounds ?? {
    ...(Object.keys(DEFAULT_SOUND_DATA_URLS).length > 0 ? DEFAULT_SOUND_DATA_URLS : { baseUrl: "audios/" }),
  };

  const onVideoPlaying = () => video.classList.add("is-playing");
  const onVideoPause = () => video.classList.remove("is-playing");
  video.addEventListener("playing", onVideoPlaying);
  video.addEventListener("pause", onVideoPause);
  video.addEventListener("waiting", onVideoPause);

  const engine = new LivenessEngine({
    videoElement: video,
    canvasElement: canvas,
    modelUrl: options.modelUrl,
    wasmUrl: options.wasmUrl,
    sounds,
    callbacks: {
      onChallengeChanged: (stepIndex, stepLabel) => {
        pendingChallenge = { stepIndex, stepLabel };
        if (!isLoading) {
          renderChallenge(stepIndex, stepLabel);
        }
        if (stepIndex !== -1) {
          options.callbacks.onChallengeChanged?.(stepIndex, stepLabel);
        }
      },
      onFaceInOval: (inside, reason) => {
        setFaceInOval(inside, reason);
        options.callbacks.onFaceInOval?.(inside, reason);
      },
      onFailure: (reason) => {
        cleanup();
        options.callbacks.onFailure?.(reason);
      },
      onSuccess: (imageBase64) => {
        setProgress(LIVENESS_STEP_COUNT);
        cleanup();
        options.callbacks.onSuccess?.(imageBase64);
      },
      onDebugFrame: (info) => {
        options.callbacks.onDebugFrame?.(info);
      },
    },
  });

  setProgress(0);
  setDots(0);
  setHint(null);

  engine.start().then(
    () => {
      isLoading = false;
      root.classList.remove("lv-is-loading");
      if (pendingChallenge) renderChallenge(pendingChallenge.stepIndex, pendingChallenge.stepLabel);
    },
    (err) => {
      cleanup();
      const reason =
        err instanceof LivenessError
          ? err.code
          : err instanceof Error
            ? err.message
            : String(err);
      options.callbacks.onFailure?.(reason);
    }
  );

  return engine;
}