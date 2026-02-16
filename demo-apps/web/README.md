# Liveness Demo (Web)

Minimal web demo for `@daboss/liveness-web`. Uses camera, shows challenge steps, and reports pass/fail.

## Prerequisites

- Build the web SDK first (required for the local dependency):

  ```bash
  cd ../../web-sdk && npm install && npm run build && cd -
  ```

## Run

```bash
npm install
npm run dev
```

Open the URL shown (e.g. http://localhost:5173). Grant camera access, click **Start**, and follow the on-screen prompts (turn head left, blink, turn right, nod, open mouth).

## Build

```bash
npm run build
npm run preview   # optional: serve dist/
```
