import React, { useEffect, useState } from "react";
import {
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LivenessView } from "@daboss/liveness-react-native";

/**
 * Embedded liveness: drop the native LivenessView into a slot inside your own UI.
 * Host owns the page chrome (heading, copy, Start button); the SDK only renders
 * camera + face frame + progress ring inside the slot.
 */
export default function EmbedScreen({ onBack }: { onBack?: () => void }) {
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState("Tap start when you're ready.");

  useEffect(() => {
    if (Platform.OS === "android") {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA).catch(() => {});
    }
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.headerRow}>
        {onBack && (
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.heading}>Match your BVN photo.</Text>
      <Text style={styles.subtitle}>
        A quick selfie to match against your BVN photo. Make sure you are in a well-lit room.
      </Text>

      <View style={styles.slot}>
        <LivenessView
          started={started}
          style={StyleSheet.absoluteFill}
          config={{
            shape: "circle",
            showInstructions: false,
            minSize: 240,
            progressColor: "#1A0F4D",
            progressErrorColor: "#FF3B3B",
            progressWidth: 4,
            progressLineCap: "round",
            overlayColor: "#5B34D6",
            overlayErrorColor: "#99B40000",
          }}
          onChallengeChanged={({ stepIndex, stepLabel }) =>
            setStatus(stepIndex === -1 ? "Hold still — capturing…" : stepLabel)
          }
          onFaceInOval={({ inside, reason }) => {
            if (!inside) setStatus(reason ?? "Centre your face in the circle");
          }}
          onSuccess={(b64) => {
            setStatus(`Verified (${b64.length} chars)`);
            setStarted(false);
          }}
          onFailure={(reason) => {
            setStatus(`Failed: ${reason}`);
            setStarted(false);
          }}
        />
      </View>

      <Text style={styles.status}>{status}</Text>

      <TouchableOpacity
        style={[styles.button, started && styles.buttonDisabled]}
        onPress={() => {
          if (!started) {
            setStatus("Preparing camera…");
            setStarted(true);
          }
        }}
        disabled={started}
      >
        <Text style={styles.buttonText}>{started ? "Running…" : "Start"}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#FFD400", alignItems: "center", padding: 24 },
  headerRow:   { alignSelf: "stretch", flexDirection: "row", marginBottom: 8 },
  back:        { fontSize: 15, color: "#111", opacity: 0.7 },
  heading:     { fontSize: 32, fontWeight: "800", color: "#111", textAlign: "center", marginTop: 16 },
  subtitle:    { fontSize: 14, color: "rgba(17,17,17,0.65)", textAlign: "center", marginTop: 12, maxWidth: 300, lineHeight: 20 },
  slot:        { width: 280, height: 280, borderRadius: 140, backgroundColor: "#5B34D6", overflow: "hidden", marginTop: 32 },
  status:      { fontSize: 14, color: "#111", textAlign: "center", marginTop: 20, minHeight: 22 },
  button:      { backgroundColor: "#1A0F4D", paddingHorizontal: 56, paddingVertical: 16, borderRadius: 999, minWidth: 220, alignItems: "center", marginTop: "auto", marginBottom: 24 },
  buttonDisabled: { opacity: 0.5 },
  buttonText:  { color: "#fff", fontSize: 16, fontWeight: "600" },
});
