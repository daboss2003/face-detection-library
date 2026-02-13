import { DEFAULT_MODEL_URL, DEFAULT_WASM_URL, LivenessEngine, LivenessOptions } from "./engine";

let currentEngine: LivenessEngine | null = null;

export async function startLiveness(options: LivenessOptions): Promise<LivenessEngine> {
  if (currentEngine) {
    currentEngine.stop();
  }
  const engine = new LivenessEngine(options);
  await engine.start();
  currentEngine = engine;
  return engine;
}

export function stop(): void {
  currentEngine?.stop();
  currentEngine = null;
}

export { DEFAULT_MODEL_URL, DEFAULT_WASM_URL };
