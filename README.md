# Cross-Platform Liveness Detection Library

Production-ready, on-device liveness detection using **MediaPipe Face Landmarker** with native Android (CameraX) and iOS (AVCaptureSession) libraries, plus Capacitor and React Native wrappers.

## Monorepo layout

```
/
├── android/                    # Kotlin library → AAR
├── ios/                        # Swift framework → XCFramework
├── capacitor-plugin/           # Capacitor bridge (WebView; no new Activity)
├── react-native-module/        # TurboModule (Expo 54 + New RN)
├── demo-apps/
│   ├── android/                # Android demo app
│   └── ios/                    # iOS demo app
└── docs/                       # Architecture, thresholds, wrapping guides
```

## Quick start

- Android: build the library in `android/`, then use it in `demo-apps/android/`.
- iOS: integrate `MediaPipeTasksVision` and `face_landmarker.task`, then build the framework and use it in `demo-apps/ios/`.
- Capacitor: install `@daboss/liveness-capacitor`.
- React Native / Expo 54: install `@daboss/liveness-react-native` and add the Expo config plugin.

See `docs/README.md` for full details, thresholds, and usage.
