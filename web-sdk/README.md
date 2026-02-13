# @daboss/liveness-web

Lightweight web liveness detection using MediaPipe Face Landmarker (CDN).

## Install

```
npm install @daboss/liveness-web
```

## Usage

```ts
import { startLiveness } from "@daboss/liveness-web";

const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;

await startLiveness({
  videoElement: video,
  canvasElement: canvas,
  callbacks: {
    onChallengeChanged: (stepIndex, stepLabel) => console.log(stepIndex, stepLabel),
    onFailure: (reason) => console.error(reason),
    onSuccess: (imageBase64) => console.log(imageBase64)
  }
});
```

## Notes

- Uses MediaPipe Tasks Vision Web from CDN.
- Camera permission is required in the browser.
