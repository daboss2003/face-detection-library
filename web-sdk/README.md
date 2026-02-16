# @daboss/liveness-web

Lightweight web liveness detection using MediaPipe Face Landmarker (CDN). The SDK provides the full UI: oval face frame, camera, and step progress. You only supply callbacks.

## Install

```
npm install @daboss/liveness-web
```

## Usage

```ts
import { startLiveness } from "@daboss/liveness-web";

startLiveness({
  container: document.getElementById("root"), // optional; defaults to document.body
  callbacks: {
    onSuccess(imageBase64) {
      console.log("Verified", imageBase64.length);
    },
    onFailure(reason) {
      console.error(reason);
    },
    onChallengeChanged(stepIndex, stepLabel) {
      console.log(`Step ${stepIndex + 1}: ${stepLabel}`);
    },
  },
});
```

- **Auto-start:** Verification starts as soon as `startLiveness` is called (no Start button).
- **Runs until complete:** The flow continues until the user passes all steps or a hard error occurs. Wrong poses do not stop the session; the user can keep trying until they get each step right.
- **No timeouts:** Steps are not timed out.
- **Progress:** The oval border fills by segment as each step is completed (5 steps total).

To cancel and release the camera:

```ts
import { stop } from "@daboss/liveness-web";
stop();
```

## Errors (CDN / connectivity)

When CDN or connectivity fails, `onFailure` is called with a string you can compare to exported constants:

- **`LIVENESS_ERROR_CDN_NOT_AVAILABLE`** (`"cdnNotAvailable"`) — CDN/assets unavailable after retries; internet was confirmed. Your app can fall back to a normal camera flow (e.g. capture without liveness).
- **`LIVENESS_ERROR_OFFLINE`** (`"offline"`) — No internet connection (e.g. user is offline).

Example:

```ts
import { startLiveness, LIVENESS_ERROR_CDN_NOT_AVAILABLE, isCdnNotAvailableError } from "@daboss/liveness-web";

startLiveness({
  callbacks: {
    onFailure(reason) {
      if (isCdnNotAvailableError(reason)) {
        // Fall back to normal camera flow
        return;
      }
      console.error(reason);
    },
  },
});
```

## Notes

- Uses MediaPipe Tasks Vision Web from CDN.
- Camera permission is required in the browser.
