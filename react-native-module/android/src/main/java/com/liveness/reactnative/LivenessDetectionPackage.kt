package com.liveness.reactnative

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class LivenessDetectionPackage : TurboReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext) =
    if (name == LivenessDetectionModule.NAME) {
      LivenessDetectionModule(reactContext)
    } else {
      null
    }

  override fun getViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
        LivenessDetectionModule.NAME to ReactModuleInfo(
          LivenessDetectionModule.NAME,
          LivenessDetectionModule.NAME,
          false,
          false,
          true,
          false
        )
      )
    }
  }
}
