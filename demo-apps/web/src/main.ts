import { startLiveness, stop } from "@daboss/liveness-web";

const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const startBtn = document.getElementById("start") as HTMLButtonElement;
const stopBtn = document.getElementById("stop") as HTMLButtonElement;

if (!video || !canvas || !overlay || !statusEl || !startBtn || !stopBtn) {
  throw new Error("Missing required elements");
}

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  overlay.textContent = "Starting…";
  statusEl.textContent = "Requesting camera…";

  try {
    await startLiveness({
      videoElement: video,
      canvasElement: canvas,
      callbacks: {
        onChallengeChanged: (stepIndex, stepLabel) => {
          overlay.textContent = stepLabel;
          statusEl.textContent = `Step ${stepIndex + 1} of 5`;
        },
        onFailure: (reason) => {
          statusEl.textContent = `Failed: ${reason}`;
          startBtn.disabled = false;
          stopBtn.disabled = true;
        },
        onSuccess: (imageBase64) => {
          statusEl.textContent = `Liveness passed (image: ${imageBase64.length} chars)`;
          startBtn.disabled = false;
          stopBtn.disabled = true;
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    statusEl.textContent = `Error: ${message}`;
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
});

stopBtn.addEventListener("click", () => {
  stop();
  overlay.textContent = "Ready";
  statusEl.textContent = "Stopped.";
  startBtn.disabled = false;
  stopBtn.disabled = true;
});
