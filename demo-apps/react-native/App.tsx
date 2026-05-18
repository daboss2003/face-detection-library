import React, { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  addChallengeChangedListener,
  addFaceInOvalListener,
  addFailureListener,
  LIVENESS_ERROR_CDN_NOT_AVAILABLE,
  LIVENESS_ERROR_OFFLINE,
  startLiveness,
} from "@daboss/liveness-react-native";
import EmbedScreen from "./EmbedScreen";

export default function App() {
  const [route, setRoute] = useState<"home" | "embed">("home");
  if (route === "embed") return <EmbedScreen onBack={() => setRoute("home")} />;
  return <HomeScreen onOpenEmbed={() => setRoute("embed")} />;
}

function HomeScreen({ onOpenEmbed }: { onOpenEmbed: () => void }) {
  const [status, setStatus] = useState("Tap to start liveness (native UI).");
  const [step, setStep] = useState<string | null>(null);

  useEffect(() => {
    const s1 = addChallengeChangedListener((e) => setStep(`Step ${e.stepIndex + 1}: ${e.stepLabel}`));
    const s2 = addFailureListener((e) => setStatus(`Failure event: ${e.reason}`));
    const s3 = addFaceInOvalListener((e) => {
      if (!e.inside && e.reason) setStatus(e.reason);
    });
    return () => {
      s1.remove();
      s2.remove();
      s3.remove();
    };
  }, []);

  async function run() {
    setStatus("Starting...");
    setStep(null);
    try {
      const result = await startLiveness({
        // Customise any web-SDK config key; omit for parity defaults.
        config: {
          shuffleSteps: true,
          yawTurnDelta: 9,
        },
        // Per-key sounds or a baseUrl that joins `${key}.mp3`.
        // sounds: { baseUrl: "https://example.com/sounds" },
      });
      setStatus(`Passed (${result.imageBase64.length} base64 chars)`);
    } catch (err: any) {
      const reason = err?.message ?? String(err);
      if (reason === LIVENESS_ERROR_OFFLINE) {
        setStatus("You're offline. Check your internet connection.");
      } else if (reason === LIVENESS_ERROR_CDN_NOT_AVAILABLE) {
        setStatus("Unable to reach the model host. Please try again later.");
      } else {
        setStatus(`Failed: ${reason}`);
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Liveness RN demo</Text>
        <TouchableOpacity style={styles.button} onPress={run}>
          <Text style={styles.buttonText}>Start verification</Text>
        </TouchableOpacity>
        {step && <Text style={styles.step}>{step}</Text>}
        <Text style={styles.status}>{status}</Text>

        <TouchableOpacity style={[styles.button, styles.embedButton]} onPress={onOpenEmbed}>
          <Text style={styles.buttonText}>Try embedded demo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 24 },
  button: { backgroundColor: "#12c95c", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  step: { marginTop: 24, fontSize: 14, color: "#555" },
  status: { marginTop: 12, fontSize: 15, textAlign: "center" },
  embedButton: { backgroundColor: "#1a0f4d", marginTop: 32 },
});
