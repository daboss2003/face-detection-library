import { startLiveness ,LivenessCallbacks} from "@daboss/liveness-web";

const root = document.getElementById("root") as HTMLElement;

const callbacks: LivenessCallbacks = {
  onSuccess(imageBase64) {
    console.log("Liveness passed, image length:", imageBase64.length);
    alert("Verification complete!");
  },
  onFailure(reason) {
    console.error("Liveness failed:", reason);
    alert("Verification failed: " + reason);
  },
  onChallengeChanged(stepIndex, stepLabel) {
    console.log(`Step ${stepIndex + 1}: ${stepLabel}`);
  },
  onDebugFrame({ hasFace, metrics, step }) {
    console.log(step, hasFace, metrics);
  },
};

startLiveness({
  container: root,
  callbacks: callbacks,
});
