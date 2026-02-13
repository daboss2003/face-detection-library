import { registerPlugin } from "@capacitor/core";
import type { LivenessPlugin } from "./definitions";

const LivenessDetector = registerPlugin<LivenessPlugin>("LivenessDetector");

export * from "./definitions";
export { LivenessDetector };
