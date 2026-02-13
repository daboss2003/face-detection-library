const { withAndroidManifest, withInfoPlist } = require("@expo/config-plugins");

const CAMERA_PERMISSION = "android.permission.CAMERA";

function withLivenessDetection(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const permissions = manifest["uses-permission"] || [];
    const hasCamera = permissions.some((p) => p.$["android:name"] === CAMERA_PERMISSION);
    if (!hasCamera) {
      permissions.push({ $: { "android:name": CAMERA_PERMISSION } });
      manifest["uses-permission"] = permissions;
    }
    return config;
  });

  config = withInfoPlist(config, (config) => {
    if (!config.modResults.NSCameraUsageDescription) {
      config.modResults.NSCameraUsageDescription =
        "Camera access is required for liveness detection.";
    }
    return config;
  });

  return config;
}

module.exports = withLivenessDetection;
