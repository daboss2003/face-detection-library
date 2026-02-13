#!/usr/bin/env bash
set -euo pipefail

SCHEME="LivenessDetection"
PROJECT="LivenessDetection.xcodeproj"
OUTPUT_DIR="build"

rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

xcodebuild archive \
  -project "${PROJECT}" \
  -scheme "${SCHEME}" \
  -configuration Release \
  -sdk iphoneos \
  -archivePath "${OUTPUT_DIR}/LivenessDetection-iOS.xcarchive" \
  SKIP_INSTALL=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=YES

xcodebuild archive \
  -project "${PROJECT}" \
  -scheme "${SCHEME}" \
  -configuration Release \
  -sdk iphonesimulator \
  -archivePath "${OUTPUT_DIR}/LivenessDetection-Sim.xcarchive" \
  SKIP_INSTALL=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=YES

xcodebuild -create-xcframework \
  -framework "${OUTPUT_DIR}/LivenessDetection-iOS.xcarchive/Products/Library/Frameworks/LivenessDetection.framework" \
  -framework "${OUTPUT_DIR}/LivenessDetection-Sim.xcarchive/Products/Library/Frameworks/LivenessDetection.framework" \
  -output "${OUTPUT_DIR}/LivenessDetection.xcframework"
