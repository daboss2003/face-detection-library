import {
  LivenessDetector,
  LIVENESS_ERROR_CDN_NOT_AVAILABLE,
  LIVENESS_ERROR_OFFLINE,
} from "@daboss/liveness-capacitor";

const startButton = document.getElementById("start") as HTMLButtonElement;
const stepEl = document.getElementById("step") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

LivenessDetector.addListener("challengeChanged", (e) => {
  stepEl.textContent = `Step ${e.stepIndex + 1}: ${e.stepLabel}`;
});

LivenessDetector.addListener("faceInOval", (e) => {
  if (!e.inside && e.reason) statusEl.textContent = e.reason;
});

LivenessDetector.addListener("failure", (e) => {
  console.warn("failure event", e.reason);
});

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  statusEl.textContent = "Starting...";
  stepEl.textContent = "";
  try {
    const result = await LivenessDetector.startLiveness({
      // Customise any web-SDK config key; omit for parity defaults.
      config: {
        shuffleSteps: true,
        yawTurnDelta: 9,
      },
      // Per-key sounds or a baseUrl that joins `${key}.mp3`.
      // sounds: { baseUrl: "https://example.com/sounds" },
    });
    statusEl.textContent = `Passed (${result.imageBase64.length} base64 chars)`;
  } catch (err: any) {
    const reason = err?.message ?? String(err);
    if (reason === LIVENESS_ERROR_OFFLINE) {
      statusEl.textContent = "You're offline. Check your internet connection.";
    } else if (reason === LIVENESS_ERROR_CDN_NOT_AVAILABLE) {
      statusEl.textContent = "Unable to reach the model host. Please try again later.";
    } else {
      statusEl.textContent = `Failed: ${reason}`;
    }
  } finally {
    startButton.disabled = false;
  }
});
