import { startLiveness, stop, isCdnNotAvailableError, isOfflineError } from "@daboss/liveness-web";

const slot     = document.getElementById("slot")   as HTMLElement;
const status   = document.getElementById("status") as HTMLElement;
const startBtn = document.getElementById("start")  as HTMLButtonElement;

function setStatus(text: string) {
  status.textContent = text;
}

function run() {
  startBtn.disabled = true;
  setStatus("Preparing camera…");

  startLiveness({
    container:        slot,
    embed:            true,
    shape:            "circle",
    showInstructions: false,
    minSize:          240,
    theme: {
      progressColor:      "#1a0f4d",
      progressErrorColor: "#ff3b3b",
      progressWidth:      4,
      progressLineCap:    "round",
      overlayColor:       "#5b34d6",
      overlayErrorColor:  "rgba(180,0,0,0.6)",
    },
    callbacks: {
      onChallengeChanged(stepIndex, stepLabel) {
        setStatus(stepIndex === -1 ? "Hold still — capturing…" : stepLabel);
      },
      onFaceInOval(inside, reason) {
        if (!inside) setStatus(reason ?? "Centre your face in the circle");
      },
      onSuccess(imageBase64) {
        sessionStorage.setItem("livenessImageBase64", imageBase64);
        window.location.href = "/view-image.html";
      },
      onFailure(reason) {
        const msg =
          isOfflineError(reason)         ? "You appear to be offline. Check your connection."
        : isCdnNotAvailableError(reason) ? "Couldn't load required resources. Please try again."
        : reason;
        setStatus("Failed: " + msg);
        startBtn.disabled = false;
        startBtn.textContent = "Try again";
      },
    },
    steps: ["blink", 'mouth', 'nod']
  });
}

startBtn.addEventListener("click", run);
window.addEventListener("beforeunload", () => stop());
