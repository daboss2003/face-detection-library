import React, { useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { LivenessWebView } from "@daboss/liveness-react-native";

/**
 * Alternative mode: run the full web SDK inside a WebView. Uses the same
 * engine/UI as `@daboss2003/liveness-web` — steps randomised, face-in-oval,
 * sounds, error codes — all parity with the browser experience.
 */
export default function WebViewScreen() {
  const [status, setStatus] = useState("Initializing...");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>{status}</Text>
      </View>
      <LivenessWebView
        style={styles.webview}
        onChallengeChanged={(e) => setStatus(`Step ${e.stepIndex + 1}: ${e.stepLabel}`)}
        onFaceInOval={(e) => {
          if (!e.inside && e.reason) setStatus(e.reason);
        }}
        onLivenessPassed={(e) => {
          setStatus(`Passed (${e.imageBase64.length} base64 chars)`);
          Alert.alert("Liveness passed", `Captured ${e.imageBase64.length} base64 chars`);
        }}
        onFailure={(e) => setStatus(`Failed: ${e.reason}`)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  banner: { padding: 12, backgroundColor: "#111" },
  bannerText: { color: "#fff", textAlign: "center" },
  webview: { flex: 1 },
});
