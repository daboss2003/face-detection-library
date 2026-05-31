# @daboss2003/liveness-web

Lightweight web liveness detection using MediaPipe Face Landmarker (CDN). The SDK provides the full UI: oval face frame, camera, and step progress. You only supply callbacks.

## Install

```
npm install @daboss2003/liveness-web
```

## Usage

```ts
import { startLiveness } from "@daboss2003/liveness-web";

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
import { stop } from "@daboss2003/liveness-web";
stop();
```

## Errors (CDN / connectivity)

When CDN or connectivity fails, `onFailure` is called with a string you can compare to exported constants:

- **`LIVENESS_ERROR_CDN_NOT_AVAILABLE`** (`"cdnNotAvailable"`) — CDN/assets unavailable after retries; internet was confirmed. Your app can fall back to a normal camera flow (e.g. capture without liveness).
- **`LIVENESS_ERROR_OFFLINE`** (`"offline"`) — No internet connection (e.g. user is offline).

Example:

```ts
import { startLiveness, LIVENESS_ERROR_CDN_NOT_AVAILABLE, isCdnNotAvailableError } from "@daboss2003/liveness-web";

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

## Embedding in your own UI

By default, `startLiveness` takes over the viewport and renders its own oval frame, step dots, and instructions. If you want to drop just the camera + face frame into a slot in your own designed page (custom button, branding, copy), pass:

```ts
startLiveness({
  container:        mySlotEl,   // your sized div (give it explicit width & height)
  embed:            true,       // render inside container instead of full-screen
  shape:            "circle",   // or "oval" (default)
  showInstructions: false,      // hide built-in text/dots — your UI shows them
  minSize:          240,        // floor on shape diameter (px) so small screens stay usable
  theme: {
    progressColor:      "#1a0f4d",
    progressErrorColor: "#ff3b3b",
    progressWidth:      4,
    progressLineCap:    "round",
    overlayColor:       "#5b34d6",          // fill outside the cutout — match your bg
    overlayErrorColor:  "rgba(180,0,0,0.6)",
  },
  callbacks: {
    onChallengeChanged: (i, label) => myStatus.textContent = label,
    onFaceInOval:       (inside, reason) => { if (!inside) myStatus.textContent = reason ?? ""; },
    onSuccess, onFailure,
  },
});
```

Sounds still play in `embed` mode and with `showInstructions: false` — only the visuals are hidden.

A complete working example (yellow page, purple circle slot, host-owned Start button) lives at [`demo-apps/web/embed.html`](../demo-apps/web/embed.html) + [`demo-apps/web/src/embed.ts`](../demo-apps/web/src/embed.ts). Run it with:

```bash
cd demo-apps/web && npm install && npm run dev
# open http://localhost:5173/embed.html
```

All new options are optional — omitting them gives you the original full-screen oval behaviour.

## Picking which challenges run

By default, all 5 challenges run in a random order. Pass `steps` to restrict to a subset (e.g. for shorter flows or A/B testing). The dot progress indicator and the progress ring both adjust to the active subset count.

```ts
import { startLiveness, type LivenessStepKey } from "@daboss2003/liveness-web";

startLiveness({
  steps: ["nod", "blink", "mouth"],   // run only these, in this set
  shuffleSteps: true,                 // default true — randomise within the subset
  callbacks: { /* … */ },
});
```

Valid keys are `"left"`, `"blink"`, `"right"`, `"nod"`, `"mouth"`. Unknown keys and duplicates are dropped; an empty array falls back to all 5.

`shuffleSteps: false` runs the steps in the order you pass.

## Notes

- Uses MediaPipe Tasks Vision Web from CDN.
- Camera permission is required in the browser.
