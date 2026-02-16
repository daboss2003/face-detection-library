import { LivenessEngine, LIVENESS_STEP_COUNT, LivenessCallbacks } from "./engine";

export type StartLivenessOptions = {
  container?: HTMLElement;
  modelUrl?: string;
  wasmUrl?: string;
  callbacks: LivenessCallbacks;
};

// ── Oval dimensions — keep in sync with engine.ts config.ovalCx/Cy/Rx/Ry ──
const OVAL_W = 270;
const OVAL_H = 360;
// The oval sits at 40% from the top of the screen
const OVAL_TOP_PCT = 40;

const STEP_HINTS = ["left", "blink", "right", "nod", "mouth"] as const;
type HintKind = (typeof STEP_HINTS)[number];

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
      /* Clip the video to the oval using clip-path on the parent */
    }

    /* ── Dark overlay with oval cutout ──────────────────────────────────── */
    .lv-overlay {
      position: absolute;
      inset: 0;
      /* The mask punches a transparent oval at 50% x, OVAL_TOP_PCT% y */
      --ow: min(72vw, ${OVAL_W}px);
      --oh: min(90vw, ${OVAL_H}px);
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

    /* ── Oval SVG ring ───────────────────────────────────────────────────── */
    .lv-ring-wrap {
      position: absolute;
      left: 50%;
      top: ${OVAL_TOP_PCT}%;
      transform: translate(-50%, -50%);
      width: min(72vw, ${OVAL_W}px);
      height: min(90vw, ${OVAL_H}px);
      pointer-events: none;
    }
    .lv-ring-wrap svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      /* Rotate so stroke starts at the top */
      transform: rotate(-90deg);
    }
    .lv-ring-bg {
      fill: none;
      stroke: rgba(255,255,255,0.18);
      stroke-width: 3;
    }
    .lv-ring-progress {
      fill: none;
      stroke: var(--lv-green);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      transition: stroke-dashoffset 0.35s cubic-bezier(.4,0,.2,1),
                  stroke 0.25s;
    }
    .lv-ring-progress.out-of-oval {
      stroke: var(--lv-red);
    }

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
      top: calc(${OVAL_TOP_PCT}% + min(45vw, ${OVAL_H / 2}px) + 18px);
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 7px;
    }
    .lv-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      transition: background 0.3s, transform 0.3s;
    }
    .lv-dot.active {
      background: var(--lv-green);
      transform: scale(1.25);
    }
    .lv-dot.done {
      background: var(--lv-green);
      opacity: 0.55;
    }

    /* ── Instruction text ────────────────────────────────────────────────── */
    .lv-instruction {
      position: absolute;
      z-index: 2;
      top: calc(${OVAL_TOP_PCT}% + min(45vw, ${OVAL_H / 2}px) + 48px);
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
    .lv-position-hint {
      position: absolute;
      z-index: 2;
      top: calc(${OVAL_TOP_PCT}% + min(45vw, ${OVAL_H / 2}px) + 82px);
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
    .lv-position-hint.visible {
      opacity: 1;
    }

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
  const stroke = `stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`;
  switch (kind) {
    case "left":
      return `<svg viewBox="0 0 24 24" fill="none" ${stroke} class="lv-anim-left">
        <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
      </svg>`;
    case "right":
      return `<svg viewBox="0 0 24 24" fill="none" ${stroke} class="lv-anim-right">
        <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
      </svg>`;
    case "nod":
      return `<svg viewBox="0 0 24 24" fill="none" ${stroke} class="lv-anim-down">
        <path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>
      </svg>`;
    case "blink":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <ellipse class="lv-eye" cx="8"  cy="12" rx="2" ry="2.5"/>
        <ellipse class="lv-eye" cx="16" cy="12" rx="2" ry="2.5" style="animation-delay:.08s"/>
      </svg>`;
    case "mouth":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
        <path class="lv-jaw" d="M6 10 Q12 17 18 10"/>
      </svg>`;
    default:
      return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main factory
// ─────────────────────────────────────────────────────────────────────────────

export function startLivenessWithUI(options: StartLivenessOptions): LivenessEngine {
  const container = options.container ?? document.body;

  // ── Root shell ─────────────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.className = "lv-root";
  root.appendChild(createStyles());

  // ── Video background ───────────────────────────────────────────────────────
  const videoBg = document.createElement("div");
  videoBg.className = "lv-video-bg";
  const video = document.createElement("video");
  video.className = "lv-video";
  video.setAttribute("autoplay", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
  videoBg.appendChild(video);
  root.appendChild(videoBg);

  // ── Dark overlay with oval cutout ──────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "lv-overlay";
  root.appendChild(overlay);

  // ── Progress ring (SVG oval) ───────────────────────────────────────────────
  const rx = OVAL_W / 2, ry = OVAL_H / 2;
  const ringWrap = document.createElement("div");
  ringWrap.className = "lv-ring-wrap";
  ringWrap.innerHTML = `
    <svg viewBox="0 0 ${OVAL_W} ${OVAL_H}">
      <ellipse class="lv-ring-bg"       cx="${rx}" cy="${ry}" rx="${rx - 2}" ry="${ry - 2}" pathLength="100"/>
      <ellipse class="lv-ring-progress" cx="${rx}" cy="${ry}" rx="${rx - 2}" ry="${ry - 2}" pathLength="100"/>
    </svg>`;
  root.appendChild(ringWrap);

  // ── Gesture hint icon (inside the oval) ────────────────────────────────────
  const hintIcon = document.createElement("div");
  hintIcon.className = "lv-hint-icon";
  hintIcon.setAttribute("aria-hidden", "true");
  root.appendChild(hintIcon);

  // ── Header ─────────────────────────────────────────────────────────────────
  const header = document.createElement("div");
  header.className = "lv-header";
  header.innerHTML = `<span class="lv-header-title">Face Verification</span>`;
  root.appendChild(header);

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
  posHint.className = "lv-position-hint";
  posHint.textContent = "Move your face into the oval";
  root.appendChild(posHint);

  // ── Hidden canvas ──────────────────────────────────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.className = "lv-canvas";
  root.appendChild(canvas);

  container.appendChild(root);

  // ── Helper refs ────────────────────────────────────────────────────────────
  const ringProgress = ringWrap.querySelector(".lv-ring-progress") as SVGElement;
  const dots = Array.from(dotsEl.querySelectorAll(".lv-dot"));

  // ── UI update helpers ──────────────────────────────────────────────────────
  let currentStep = 0;

  function setProgress(stepIndex: number): void {
    const pct = Math.min(stepIndex / LIVENESS_STEP_COUNT, 1);
    ringProgress?.setAttribute("stroke-dashoffset", String(100 - pct * 100));
    dots.forEach((d, i) => {
      d.classList.toggle("done",   i < stepIndex);
      d.classList.toggle("active", i === stepIndex);
    });
    currentStep = stepIndex;
  }

  function setHint(stepIndex: number): void {
    const kind = STEP_HINTS[stepIndex] ?? "left";
    hintIcon.innerHTML = hintSvg(kind);
  }

  function setFaceInOval(inside: boolean, reason?: string): void {
    overlay.classList.toggle("out-of-oval", !inside);
    ringProgress?.classList.toggle("out-of-oval", !inside);
    posHint.classList.toggle("visible", !inside);
    if (!inside && reason) posHint.textContent = reason;
    else if (inside) posHint.textContent = "";
  }

  function cleanup(): void {
    engine.stop();
    root.remove();
  }

  // ── Engine ─────────────────────────────────────────────────────────────────
  const engine = new LivenessEngine({
    videoElement: video,
    canvasElement: canvas,
    modelUrl: options.modelUrl,
    wasmUrl: options.wasmUrl,
    callbacks: {
      onChallengeChanged: (stepIndex, stepLabel) => {
        setProgress(stepIndex);
        setHint(stepIndex);
        instruction.textContent = stepLabel;
        options.callbacks.onChallengeChanged?.(stepIndex, stepLabel);
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

  setHint(0);

  engine.start().then(
    () => {},
    (err) => {
      cleanup();
      options.callbacks.onFailure?.(err instanceof Error ? err.message : String(err));
    }
  );

  return engine;
}