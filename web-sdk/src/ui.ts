import { LivenessEngine, LivenessCallbacks, LivenessSoundOptions, LivenessError, resolveStepLabels, LivenessStepKey } from "./engine";
import { DEFAULT_SOUND_DATA_URLS } from "./default-sounds.generated";

export type LivenessTheme = {
  progressColor?: string;
  progressErrorColor?: string;
  progressWidth?: number;
  progressLineCap?: "round" | "square" | "butt";
  overlayColor?: string;
  overlayErrorColor?: string;
};

export type StartLivenessOptions = {
  container?: HTMLElement;
  /** If true, render inside `container` instead of taking over the viewport. Container should have explicit width and height. */
  embed?: boolean;
  /** Visible face frame shape. Defaults to "oval". */
  shape?: "oval" | "circle";
  /** If false, hides SDK-provided instruction text, step dots, position hint, gesture icon and loading text. Sounds still play. Default true. */
  showInstructions?: boolean;
  theme?: LivenessTheme;
  /** Minimum diameter of the visible shape in CSS pixels (so it stays usable on small screens). Default 220. */
  minSize?: number;
  modelUrl?: string;
  wasmUrl?: string;
  callbacks: LivenessCallbacks;
  sounds?: LivenessSoundOptions;
  /** Subset of challenges to run, e.g. `["nod", "blink", "mouth"]`. Default: all 5. */
  steps?: LivenessStepKey[];
  /** Shuffle the selected step order. Default true. */
  shuffleSteps?: boolean;
};

const DEFAULT_THEME: Required<LivenessTheme> = {
  progressColor:      "#12c95c",
  progressErrorColor: "#ff3b3b",
  progressWidth:      3.5,
  progressLineCap:    "round",
  overlayColor:       "rgba(0,0,0,0.82)",
  overlayErrorColor:  "rgba(180,0,0,0.55)",
};
const DEFAULT_MIN_SIZE = 220;

// Max radii (in CSS px) of the visible shape's cutout — see ─KEY DESIGN note below.
const OVAL_BASE   = { w: 270, h: 360 };
const CIRCLE_BASE = 270;

type HintKind = "left" | "blink" | "right" | "nod" | "mouth";

/** Step label (from engine) → hint icon kind. Use this so the correct icon shows when steps are randomized. */
const STEP_LABEL_TO_HINT: Record<string, HintKind> = {
  "Turn your head LEFT":  "left",
  "Blink":                "blink",
  "Turn your head RIGHT": "right",
  "Nod your head":        "nod",
  "Open your mouth":      "mouth",
};

type StyleConfig = {
  embed:            boolean;
  showInstructions: boolean;
  theme:            Required<LivenessTheme>;
  minRadius:        number;
  dims:             { wMax: number; hMax: number; aspectH: number };
  ovalTopPct:       number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
//
// KEY DESIGN: `--oval-w` and `--oval-h` are RADII (not full dimensions) of the
// visible cutout, because the CSS radial-gradient mask consumes them as
// `ellipse <hRadius> <vRadius>`. The SVG ring wrapper is therefore sized to
// `2 * var(--oval-w)` × `2 * var(--oval-h)` so it aligns to the cutout edge.
// ─────────────────────────────────────────────────────────────────────────────

function createStyles(cfg: StyleConfig): HTMLStyleElement {
  const { embed, theme, minRadius, dims, ovalTopPct } = cfg;
  const sizeUnit  = embed ? "cqmin" : "vmin";
  const pulseHi   = (theme.progressWidth * 10 / 7).toFixed(2); // ~1.43× — preserves 3.5→5 ratio of the original
  const s = document.createElement("style");
  s.textContent = `
    .lv-outer {
      position: absolute;
      inset: 0;
      container-type: size;
      overflow: hidden;
    }

    .lv-root {
      position: ${embed ? "absolute" : "fixed"};
      inset: 0;
      z-index: ${embed ? "1" : "999999"};
      background: ${embed ? "transparent" : "#000"};
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
      color: #ffffff;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;

      --lv-progress:       ${theme.progressColor};
      --lv-progress-error: ${theme.progressErrorColor};
      --lv-overlay:        ${theme.overlayColor};
      --lv-overlay-error:  ${theme.overlayErrorColor};

      --oval-w: clamp(${minRadius}px, 45${sizeUnit}, ${dims.wMax}px);
      --oval-h: calc(var(--oval-w) * ${dims.aspectH});
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
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
      opacity: 0;
      transition: opacity 0.2s ease;
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

    /* When the host owns instructions, hide every SDK label/animation. Sounds + ring stay. */
    .lv-root.lv-no-instructions .lv-loading,
    .lv-root.lv-no-instructions .lv-dots,
    .lv-root.lv-no-instructions .lv-instruction,
    .lv-root.lv-no-instructions .lv-pos-hint,
    .lv-root.lv-no-instructions .lv-hint-icon {
      display: none !important;
    }

    .lv-loading {
      position: absolute;
      z-index: 2;
      left: 50%;
      top: ${ovalTopPct}%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      color: #ffffff;
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
    }
    .lv-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255,255,255,0.25);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: lv-spin 0.9s linear infinite;
    }
    .lv-loading-text {
      font-size: 13px;
      font-weight: 500;
      opacity: 0.9;
    }
    @keyframes lv-spin { to { transform: rotate(360deg); } }

    /* ── Dark overlay with shape cutout ────────────────────────────────── */
    .lv-overlay {
      position: absolute;
      inset: 0;
      --ow: var(--oval-w);
      --oh: var(--oval-h);
      background: var(--lv-overlay);
      -webkit-mask-image: radial-gradient(
        ellipse var(--ow) var(--oh) at 50% ${ovalTopPct}%,
        transparent 99%, black 100%
      );
      mask-image: radial-gradient(
        ellipse var(--ow) var(--oh) at 50% ${ovalTopPct}%,
        transparent 99%, black 100%
      );
      pointer-events: none;
      transition: background 0.25s;
    }
    .lv-overlay.out-of-oval { background: var(--lv-overlay-error); }

    /* ── Progress ring (2× so its stroke sits on the cutout edge) ──────── */
    .lv-ring-wrap {
      position: absolute;
      left: 50%;
      top: ${ovalTopPct}%;
      transform: translate(-50%, -50%);
      width: calc(2 * var(--oval-w));
      height: calc(2 * var(--oval-h));
      pointer-events: none;
    }
    .lv-ring-wrap svg { width: 100%; height: 100%; overflow: visible; }
    .lv-ring-progress {
      fill: none;
      stroke: var(--lv-progress);
      stroke-width: ${theme.progressWidth};
      stroke-linecap: ${theme.progressLineCap};
      transition: stroke-dashoffset 0.45s cubic-bezier(.4,0,.2,1), stroke 0.25s;
      transform: rotate(0deg);
      transform-origin: center;
    }
    .lv-ring-progress.out-of-oval { stroke: var(--lv-progress-error); }

    /* ── Step dots ─────────────────────────────────────────────────────── */
    .lv-dots {
      position: absolute;
      z-index: 2;
      top: calc(${ovalTopPct}% + var(--oval-half-h) + 20px);
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
    .lv-dot.active { background: var(--lv-progress); transform: scale(1.3); }
    .lv-dot.done  { background: var(--lv-progress); opacity: .5; transform: scale(1); }

    /* ── Instruction text ──────────────────────────────────────────────── */
    .lv-instruction {
      position: absolute;
      z-index: 2;
      top: calc(${ovalTopPct}% + var(--oval-half-h) + 52px);
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

    /* ── "Move closer / centre your face" hint ─────────────────────────── */
    .lv-pos-hint {
      position: absolute;
      z-index: 2;
      top: calc(${ovalTopPct}% + var(--oval-half-h) + 84px);
      left: 50%;
      transform: translateX(-50%);
      font-size: 13px;
      font-weight: 500;
      color: var(--lv-progress-error);
      opacity: 0;
      white-space: nowrap;
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
      transition: opacity 0.3s;
      pointer-events: none;
    }
    .lv-pos-hint.visible { opacity: 1; }

    /* ── Animated gesture icon ─────────────────────────────────────────── */
    .lv-hint-icon {
      position: absolute;
      z-index: 2;
      left: 50%;
      top: ${ovalTopPct}%;
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

    @keyframes lv-left  { 0%,100%{transform:translateX(0)}  50%{transform:translateX(-9px)} }
    @keyframes lv-right { 0%,100%{transform:translateX(0)}  50%{transform:translateX(9px)}  }
    @keyframes lv-down  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(8px)}  }
    @keyframes lv-blink {
      0%,40%,60%,100% { transform: scaleY(1); opacity: 1; }
      50% { transform: scaleY(0.08); opacity: 0.4; }
    }
    @keyframes lv-mouth {
      0%,60%,100% { transform: scaleY(0.35); }
      30%         { transform: scaleY(1); }
    }

    .lv-anim-left  { animation: lv-left  1s ease-in-out infinite; }
    .lv-anim-right { animation: lv-right 1s ease-in-out infinite; }
    .lv-anim-down  { animation: lv-down  1s ease-in-out infinite; }
    .lv-eye        { animation: lv-blink 2s ease-in-out infinite; transform-origin: center; }
    .lv-jaw        { animation: lv-mouth 1.5s ease-in-out infinite; transform-origin: top center; }

    /* ── Capture pulse ────────────────────────────────────────────────── */
    @keyframes lv-pulse {
      0%,100% { stroke-width: ${theme.progressWidth}; opacity: 1; }
      50%     { stroke-width: ${pulseHi};             opacity: 0.55; }
    }
    .lv-ring-pulse { animation: lv-pulse 1s ease-in-out infinite; stroke: var(--lv-progress) !important; }

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
  const embed            = !!options.embed;
  const shape            = options.shape ?? "oval";
  const showInstructions = options.showInstructions ?? true;
  const theme            = { ...DEFAULT_THEME, ...(options.theme ?? {}) };
  const minSize          = options.minSize ?? DEFAULT_MIN_SIZE;
  const minRadius        = Math.max(20, Math.floor(minSize / 2));

  const dims = shape === "circle"
    ? { wMax: CIRCLE_BASE,   hMax: CIRCLE_BASE,   aspectH: 1 }
    : { wMax: OVAL_BASE.w,   hMax: OVAL_BASE.h,   aspectH: OVAL_BASE.h / OVAL_BASE.w };

  // When the host owns instructions, the area below the cutout isn't needed,
  // so we centre the shape vertically. Otherwise keep the original 40% slot.
  const ovalTopPct = showInstructions ? 40 : 50;

  // Ring geometry derives from dims + stroke width
  const SVG_W      = dims.wMax;
  const SVG_H      = dims.hMax;
  const STROKE_HALF = theme.progressWidth / 2;
  const RX = SVG_W / 2 - STROKE_HALF;
  const RY = SVG_H / 2 - STROKE_HALF;
  const ELLIPSE_PERIMETER = Math.PI * (3 * (RX + RY) - Math.sqrt((3 * RX + RY) * (RX + 3 * RY)));

  const container = options.container ?? document.body;

  // ── Mount layer (wrapper only needed for embed so cqmin has a sized container) ──
  let outerEl: HTMLElement | null = null;
  let mountPoint: HTMLElement;
  if (embed) {
    const computed = getComputedStyle(container);
    if (computed.position === "static" && container !== document.body) {
      container.style.position = "relative";
    }
    const wrapper = document.createElement("div");
    wrapper.className = "lv-outer";
    container.appendChild(wrapper);
    outerEl    = wrapper;
    mountPoint = wrapper;
  } else {
    mountPoint = container;
  }

  // ── Root shell ─────────────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.className = "lv-root lv-is-loading"
    + (embed ? " lv-embed" : "")
    + (!showInstructions ? " lv-no-instructions" : "");
  root.appendChild(createStyles({ embed, showInstructions, theme, minRadius, dims, ovalTopPct }));

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

  // ── Dark overlay with shape cutout ─────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "lv-overlay";
  root.appendChild(overlay);

  // ── Progress ring ──────────────────────────────────────────────────────────
  const rx = SVG_W / 2, ry = SVG_H / 2;
  const ringWrap = document.createElement("div");
  ringWrap.className = "lv-ring-wrap";
  ringWrap.innerHTML = `
    <svg viewBox="0 0 ${SVG_W} ${SVG_H}">
      <ellipse class="lv-ring-progress"
        cx="${rx}" cy="${ry}" rx="${RX}" ry="${RY}"
        pathLength="${ELLIPSE_PERIMETER.toFixed(1)}"
        stroke-dasharray="${ELLIPSE_PERIMETER.toFixed(1)}"
        stroke-dashoffset="${ELLIPSE_PERIMETER.toFixed(1)}"
        transform="rotate(-90 ${rx} ${ry})"/>
    </svg>`;
  root.appendChild(ringWrap);

  // ── Gesture hint icon ──────────────────────────────────────────────────────
  const hintIcon = document.createElement("div");
  hintIcon.className = "lv-hint-icon";
  hintIcon.setAttribute("aria-hidden", "true");
  root.appendChild(hintIcon);

  // ── Loading spinner ────────────────────────────────────────────────────────
  const loading = document.createElement("div");
  loading.className = "lv-loading";
  loading.innerHTML = `
    <div class="lv-spinner" aria-hidden="true"></div>
    <div class="lv-loading-text">Preparing camera...</div>
  `;
  root.appendChild(loading);

  // ── Step dots ──────────────────────────────────────────────────────────────
  // Count derives from the active subset (`options.steps`), defaulting to all 5.
  const sessionStepCount = resolveStepLabels(options.steps).length;
  const dotsEl = document.createElement("div");
  dotsEl.className = "lv-dots";
  for (let i = 0; i < sessionStepCount; i++) {
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

  // ── Position hint ──────────────────────────────────────────────────────────
  const posHint = document.createElement("div");
  posHint.className = "lv-pos-hint";
  root.appendChild(posHint);

  // ── Hidden canvas ──────────────────────────────────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.className = "lv-canvas";
  root.appendChild(canvas);

  mountPoint.appendChild(root);

  const topEl = outerEl ?? root;
  const ringEl = ringWrap.querySelector(".lv-ring-progress") as SVGEllipseElement | null;
  const dots = Array.from(dotsEl.querySelectorAll(".lv-dot"));
  const P = ELLIPSE_PERIMETER;
  let isLoading = true;
  let pendingChallenge: { stepIndex: number; stepLabel: string } | null = null;

  // ── UI helpers ──────────────────────────────────────────────────────────────

  function setProgress(completedSteps: number): void {
    if (!ringEl) return;
    const filled = Math.min(completedSteps / sessionStepCount, 1);
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
      setProgress(sessionStepCount);
      setCapturePulse();
      setHint(null);
      setDots(sessionStepCount);
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
    topEl.remove();
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
    steps: options.steps,
    shuffleSteps: options.shuffleSteps,
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
        setProgress(sessionStepCount);
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
