Pod::Spec.new do |s|
  s.name             = 'LivenessReactNative'
  s.version          = '0.1.0'
  s.summary          = 'React Native TurboModule for liveness detection'
  s.license          = { :type => 'Apache-2.0' }
  s.authors          = { 'Liveness' => 'dev@liveness.local' }
  s.platform         = :ios, '15.0'
  s.source           = { :path => '.' }
  s.source_files     = 'ios/**/*.{h,m,mm,swift}'
  s.dependency       'React-Core'
  s.dependency       'React-RCTEventEmitter'
  s.vendored_frameworks = 'ios/LivenessDetection.xcframework'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_VERSION' => '5.7'
  }
end
